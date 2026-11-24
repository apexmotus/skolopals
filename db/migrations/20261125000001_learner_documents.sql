-- Report cards and the enrolment submit that requires one.
-- SPEC-2026-11-enrolment-payments-ux.md §4.1, §4.2, decisions D3 and D5.
--
-- The file itself lives in the private `learner-documents` bucket. The API
-- moves it there from the uploader's staging folder once the row below
-- exists, and hands out short-lived signed URLs after
-- private.learner_document_download has checked access and logged it.
--
-- submit_enrolment moves to the `private` schema. It now takes a storage path
-- from the caller, so it must only be reachable from the API (which moves the
-- file and checks the upload), never straight through PostgREST. See the
-- header of 20261124000002_aptitude.sql for why `private` is the boundary.

create table public.learner_documents (
  id            uuid primary key default gen_random_uuid(),
  learner_id    uuid not null references public.learners (id) on delete cascade,
  doc_type      text not null check (doc_type in ('report_card', 'other')),
  academic_year smallint check (academic_year between 2015 and 2100),
  term          smallint check (term between 1 and 4),
  storage_path  text not null unique,
  original_name text not null,
  mime          text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes    integer not null check (size_bytes > 0),
  uploaded_by   uuid not null references public.profiles (id),
  uploaded_at   timestamptz not null default now(),
  -- A replacement keeps the old file for the record instead of deleting it.
  superseded_at timestamptz
);

create index on public.learner_documents (learner_id);
create unique index learner_documents_one_current_report_card
  on public.learner_documents (learner_id) where doc_type = 'report_card' and superseded_at is null;

comment on table public.learner_documents is
  'School report cards and other learner documents. Files are in the private learner-documents '
  'bucket and reached only through API-issued signed URLs.';

-- POPIA accountability: who opened which child's document, and when.
create table public.document_access_log (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.learner_documents (id) on delete cascade,
  learner_id  uuid not null references public.learners (id) on delete cascade,
  accessed_by uuid not null references public.profiles (id),
  accessed_at timestamptz not null default now()
);

create index on public.document_access_log (document_id, accessed_at desc);

-- Who may read a learner's documents (D5): admin, the learner's guardians,
-- the tutor assigned to a live enrolment, and the tutor of any class the
-- learner currently sits in. A tutor's access ends with the placement.
create or replace function private.can_read_learner_document(p_learner_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $fn$
  select (select private.is_admin())
      or (select private.is_guardian_of(p_learner_id))
      or (select private.tutor_teaches(p_learner_id))
      or exists (
        select 1 from public.enrolments e
         where e.learner_id = p_learner_id
           and e.status in ('accepted', 'active', 'paused')
           and e.assigned_tutor_id = (select private.my_tutor_id()))
$fn$;

alter table public.learner_documents   enable row level security;
alter table public.document_access_log enable row level security;

revoke all on public.learner_documents, public.document_access_log from anon, authenticated;
grant select on public.learner_documents to authenticated;
grant select on public.document_access_log to authenticated;

create policy "learner documents: permitted readers" on public.learner_documents
  for select to authenticated using ((select private.can_read_learner_document(learner_id)));
create policy "document access log: admin read" on public.document_access_log
  for select to authenticated using ((select private.is_admin()));

-- Report card helper --------------------------------------------------------
-- Records a report card from a confirmed staging upload and returns where the
-- API must move the file. The staging path must be the caller's own, so a
-- caller can never attach somebody else's upload.
create or replace function private.record_report_card(p_learner_id uuid, p_card jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_me      uuid := (select auth.uid());
  v_staging text := p_card ->> 'stagingPath';
  v_ext     text;
  v_id      uuid := gen_random_uuid();
  v_path    text;
begin
  if p_card is null or coalesce(v_staging, '') = '' then
    raise exception 'Upload your child''s most recent school report' using errcode = 'check_violation';
  end if;
  if v_staging !~ ('^staging/' || v_me::text || '/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$') then
    raise exception 'That upload does not belong to you' using errcode = 'P0001';
  end if;

  v_ext  := substring(v_staging from '\.([a-z]+)$');
  v_path := format('learners/%s/%s.%s', p_learner_id, v_id, v_ext);

  update public.learner_documents set superseded_at = now()
   where learner_id = p_learner_id and doc_type = 'report_card' and superseded_at is null;

  insert into public.learner_documents
    (id, learner_id, doc_type, academic_year, term, storage_path, original_name, mime, size_bytes, uploaded_by)
  values (v_id, p_learner_id, 'report_card',
          nullif(p_card ->> 'year', '')::smallint, nullif(p_card ->> 'term', '')::smallint,
          v_path, left(coalesce(nullif(p_card ->> 'originalName', ''), 'report-card.' || v_ext), 200),
          p_card ->> 'mime', (p_card ->> 'sizeBytes')::integer, v_me);

  return jsonb_build_object('documentId', v_id, 'stagingPath', v_staging, 'storagePath', v_path);
end;
$fn$;

-- Submit an enrolment -------------------------------------------------------
-- As before (20261020000016), plus the required report card. Returns the new
-- ids and the report card's move instruction for the API.
drop function public.submit_enrolment(jsonb, text, jsonb, jsonb, jsonb, jsonb, text, uuid);

create or replace function private.submit_enrolment(
  p_learner         jsonb,
  p_package_code    text,
  p_subjects        jsonb,
  p_emergency       jsonb,
  p_collectors      jsonb,
  p_consents        jsonb,
  p_policy_version  text,
  p_report_card     jsonb,
  p_preferred_tutor uuid default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_guardian  uuid := (select auth.uid());
  v_learner   uuid;
  v_enrolment uuid;
  v_item      jsonb;
  v_required  integer;
  v_granted   integer;
  v_card      jsonb;
begin
  perform private.assert_not_rest();
  if v_guardian is null then
    raise exception 'Not signed in' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.guardians where profile_id = v_guardian) then
    raise exception 'Only a parent or guardian can enrol a learner' using errcode = 'P0001';
  end if;

  -- Every required consent must be present and granted (POPIA s35).
  select count(*) into v_required from public.consent_types where is_required;
  select count(*) into v_granted
  from jsonb_array_elements(p_consents) c
  join public.consent_types ct on ct.code = c ->> 'consent_type_code'
  where ct.is_required and (c ->> 'granted')::boolean;
  if v_granted < v_required then
    raise exception 'All required consents must be given before a learner can be registered'
      using errcode = 'check_violation';
  end if;

  if jsonb_array_length(p_emergency) < 1 then
    raise exception 'At least one emergency contact is required' using errcode = 'check_violation';
  end if;

  -- D3: a report card is required, no exceptions.
  if p_report_card is null or coalesce(p_report_card ->> 'stagingPath', '') = '' then
    raise exception 'Upload your child''s most recent school report' using errcode = 'check_violation';
  end if;

  insert into public.learners (full_name, date_of_birth, grade_code, school_name, home_language_code, status)
  values (p_learner ->> 'full_name', (p_learner ->> 'date_of_birth')::date, p_learner ->> 'grade_code',
          coalesce(p_learner ->> 'school_name', ''), nullif(p_learner ->> 'home_language_code', ''),
          'prospective')
  returning id into v_learner;

  insert into public.learner_guardians (learner_id, guardian_id, relationship, is_primary, is_billing_contact)
  values (v_learner, v_guardian, coalesce(p_learner ->> 'relationship', 'guardian'), true, true);

  for v_item in select * from jsonb_array_elements(p_emergency) loop
    insert into public.learner_emergency_contacts (learner_id, full_name, relationship, phone, priority)
    values (v_learner, v_item ->> 'full_name', v_item ->> 'relationship', v_item ->> 'phone',
            coalesce((v_item ->> 'priority')::smallint, 1));
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_collectors, '[]'::jsonb)) loop
    insert into public.authorised_collectors (learner_id, full_name, relationship, phone, id_number_last4)
    values (v_learner, v_item ->> 'full_name', v_item ->> 'relationship', v_item ->> 'phone',
            nullif(v_item ->> 'id_number_last4', ''));
  end loop;

  for v_item in select * from jsonb_array_elements(p_consents) loop
    insert into public.consents (consent_type_code, guardian_id, learner_id, granted, policy_version)
    values (v_item ->> 'consent_type_code', v_guardian, v_learner,
            (v_item ->> 'granted')::boolean, p_policy_version);
  end loop;

  insert into public.enrolments (learner_id, package_code, status, preferred_tutor_id, source)
  values (v_learner, p_package_code, 'pending', p_preferred_tutor, 'website')
  returning id into v_enrolment;

  for v_item in select * from jsonb_array_elements(coalesce(p_subjects, '[]'::jsonb)) loop
    insert into public.enrolment_subjects (enrolment_id, subject_code, preferred_language_code)
    values (v_enrolment, v_item ->> 'subject_code', nullif(v_item ->> 'preferred_language_code', ''));
  end loop;

  v_card := private.record_report_card(v_learner, p_report_card);

  return jsonb_build_object('enrolmentId', v_enrolment, 'learnerId', v_learner, 'reportCard', v_card);
end;
$fn$;

-- Replace a report card ------------------------------------------------------
-- The guardian, while the application is still waiting for a decision (for
-- example after "please send a clearer copy"), or an administrator at any time.
create or replace function private.replace_report_card(p_enrolment_id uuid, p_report_card jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare v_enrolment public.enrolments;
begin
  perform private.assert_not_rest();
  select * into v_enrolment from public.enrolments where id = p_enrolment_id for update;
  if not found or not ((select private.is_admin()) or (select private.is_guardian_of(v_enrolment.learner_id))) then
    raise exception 'Application not found' using errcode = 'P0001';
  end if;
  if not (select private.is_admin()) and v_enrolment.status <> 'pending' then
    raise exception 'The report card can only be replaced while the application is waiting for review'
      using errcode = 'P0001';
  end if;
  return private.record_report_card(v_enrolment.learner_id, p_report_card);
end;
$fn$;

-- Download -----------------------------------------------------------------
-- Checks access, logs it and returns where the file is. The API turns that
-- into a 60-second signed URL.
create or replace function private.learner_document_download(p_document_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare v_doc public.learner_documents;
begin
  perform private.assert_not_rest();
  select * into v_doc from public.learner_documents where id = p_document_id;
  if not found or not (select private.can_read_learner_document(v_doc.learner_id)) then
    raise exception 'Document not found' using errcode = 'P0001';
  end if;

  insert into public.document_access_log (document_id, learner_id, accessed_by)
  values (v_doc.id, v_doc.learner_id, (select auth.uid()));

  return jsonb_build_object('storagePath', v_doc.storage_path, 'mime', v_doc.mime,
                            'originalName', v_doc.original_name);
end;
$fn$;

revoke execute on function
  private.can_read_learner_document(uuid),
  private.record_report_card(uuid, jsonb),
  private.submit_enrolment(jsonb, text, jsonb, jsonb, jsonb, jsonb, text, jsonb, uuid),
  private.replace_report_card(uuid, jsonb),
  private.learner_document_download(uuid)
from public, anon;

grant execute on function
  private.can_read_learner_document(uuid),
  private.submit_enrolment(jsonb, text, jsonb, jsonb, jsonb, jsonb, text, jsonb, uuid),
  private.replace_report_card(uuid, jsonb),
  private.learner_document_download(uuid)
to authenticated;
