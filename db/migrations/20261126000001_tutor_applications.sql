-- Tutor applications (docs/SPEC-2026-11-tutor-applications.md).
--
-- BR-23 amended: the public may apply while the centre has applications open,
-- but an application creates nothing until an administrator approves it. The
-- administrator switches applications on and off at any time; each "on" is a
-- recruitment round, so every application stays tied to the round it came in.
--
-- Applicants are signed-in users (an ordinary self-signup account). Functions
-- that take storage paths are in `private` (API only), as in
-- 20261125000003_payshap_payments.sql. Everything else an administrator does
-- is a public function that checks private.is_admin().

-- Rounds -------------------------------------------------------------------
create table public.tutor_recruitment_rounds (
  id                        uuid primary key default gen_random_uuid(),
  opened_at                 timestamptz not null default now(),
  opened_by                 uuid not null references public.profiles (id),
  closes_at                 timestamptz,
  closed_at                 timestamptz,
  closed_by                 uuid references public.profiles (id),
  message                   text not null default '' check (length(message) <= 1000),
  police_clearance_required boolean not null default false,
  check (closes_at is null or closes_at > opened_at),
  check (closed_at is null or closed_at >= opened_at)
);

comment on table public.tutor_recruitment_rounds is
  'One row per time the administrator opened tutor applications. Open while closed_at is null and '
  'closes_at (if set) is in the future; a past closes_at closes it without a scheduled job.';

-- At most one round not yet closed. An expired round (closes_at passed) is
-- closed by open_tutor_recruitment before it inserts the next one.
create unique index tutor_recruitment_rounds_one_open
  on public.tutor_recruitment_rounds ((true)) where closed_at is null;

create table public.tutor_recruitment_needs (
  round_id     uuid not null references public.tutor_recruitment_rounds (id) on delete cascade,
  subject_code text not null references public.subjects (code),
  primary key (round_id, subject_code)
);

-- Applications -------------------------------------------------------------
create table public.tutor_applications (
  id                            uuid primary key default gen_random_uuid(),
  round_id                      uuid not null references public.tutor_recruitment_rounds (id),
  applicant_id                  uuid not null references public.profiles (id) on delete cascade,
  first_name                    text not null check (length(trim(first_name)) > 0),
  last_name                     text not null check (length(trim(last_name)) > 0),
  phone                         text not null check (phone ~ '^\+27[0-9]{9}$'),
  whatsapp_number               text not null check (whatsapp_number ~ '^\+[0-9]{8,15}$'),
  address_line_1                text not null check (length(trim(address_line_1)) > 0),
  address_line_2                text not null default '',
  city                          text not null check (length(trim(city)) > 0),
  province                      text not null check (length(trim(province)) > 0),
  country                       text not null default 'South Africa' check (length(trim(country)) > 0),
  status                        text not null default 'submitted'
    check (status in ('submitted', 'shortlisted', 'approved', 'rejected', 'withdrawn')),
  decision_note                 text not null default '',
  police_clearance_required     boolean not null,
  police_clearance_requested_at timestamptz,
  police_clearance_request_note text not null default '',
  identity_checked_by           uuid references public.profiles (id),
  identity_checked_at           timestamptz,
  popia_consent_at              timestamptz not null,
  submitted_at                  timestamptz not null default now(),
  reviewed_by                   uuid references public.profiles (id),
  reviewed_at                   timestamptz,
  withdrawn_at                  timestamptz,
  tutor_id                      uuid references public.tutors (id) on delete set null,
  unique (round_id, applicant_id)
);

create index on public.tutor_applications (status, submitted_at desc);
create index on public.tutor_applications (applicant_id);

comment on column public.tutor_applications.police_clearance_required is
  'Copied from the round at submission, so changing the round later never makes an earlier '
  'applicant look as if they skipped a document they were not asked for.';

-- (application, subject, grade) is one fact, as in tutor_competencies, and
-- the composite FK refuses a subject the centre does not offer at that grade.
create table public.tutor_application_competencies (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.tutor_applications (id) on delete cascade,
  subject_code   text not null,
  grade_code     text not null,
  unique (application_id, subject_code, grade_code),
  foreign key (subject_code, grade_code)
    references public.subject_offerings (subject_code, grade_code)
);

create table public.tutor_application_competency_media (
  competency_id uuid not null references public.tutor_application_competencies (id) on delete cascade,
  language_code text not null references public.languages (code),
  primary key (competency_id, language_code)
);

create table public.tutor_application_documents (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.tutor_applications (id) on delete cascade,
  doc_type       text not null
    check (doc_type in ('cv', 'qualification', 'id', 'id_back', 'selfie', 'police_clearance')),
  storage_path   text not null unique,
  original_name  text not null default '',
  mime_type      text not null,
  size_bytes     integer not null check (size_bytes > 0),
  title          text not null default '',
  institution    text not null default '',
  year_awarded   smallint check (year_awarded between 1950 and 2100),
  uploaded_at    timestamptz not null default now(),
  check (doc_type <> 'qualification' or length(trim(title)) > 0)
);

create index on public.tutor_application_documents (application_id);

create table public.tutor_application_references (
  application_id uuid not null references public.tutor_applications (id) on delete cascade,
  position       smallint not null check (position between 1 and 3),
  full_name      text not null check (length(trim(full_name)) > 0),
  relationship   text not null check (length(trim(relationship)) > 0),
  phone          text not null check (length(trim(phone)) > 0),
  email          text not null default '',
  primary key (application_id, position)
);

-- Tutors -------------------------------------------------------------------
alter table public.tutors
  add column application_id uuid references public.tutor_applications (id) on delete set null,
  add column police_clearance_requested_at timestamptz,
  add column police_clearance_request_note text not null default '';

comment on column public.tutors.profile_id is
  'NOT NULL: a tutor always has an account. Only an administrator creates a tutor, by invitation, '
  'promotion of an existing account, or approval of an application (BR-23).';

-- A tutor may edit their own public profile (headline, bio, photo) through
-- "tutors: own profile update", but that policy and the table-wide UPDATE
-- grant also let them change their own status. An approved applicant starts
-- suspended until an administrator activates them, so that has to hold:
-- everything else on the row is the administrator's to change.
create or replace function private.guard_tutor_self_update()
returns trigger
language plpgsql set search_path = ''
as $fn$
begin
  -- Functions that act for the tutor (add_police_clearance) run as their
  -- owner; only a client's own UPDATE arrives as anon/authenticated.
  if current_user not in ('anon', 'authenticated') or (select private.is_admin()) then
    return new;
  end if;
  if (new.id, new.profile_id, new.slug, new.employment_type, new.status, new.started_on, new.ended_on,
      new.created_at, new.application_id, new.police_clearance_requested_at, new.police_clearance_request_note)
     is distinct from
     (old.id, old.profile_id, old.slug, old.employment_type, old.status, old.started_on, old.ended_on,
      old.created_at, old.application_id, old.police_clearance_requested_at, old.police_clearance_request_note) then
    raise exception 'Only an administrator can change that' using errcode = '42501';
  end if;
  return new;
end;
$fn$;

revoke execute on function private.guard_tutor_self_update() from public, anon, authenticated;

create trigger tutors_guard_self_update
  before update on public.tutors
  for each row execute function private.guard_tutor_self_update();

-- Selfies and the back of a smart ID card are new kinds of vetting document.
alter table public.tutor_documents drop constraint tutor_documents_doc_type_check;
alter table public.tutor_documents add constraint tutor_documents_doc_type_check
  check (doc_type in ('id', 'id_back', 'selfie', 'qualification', 'police_clearance', 'cv', 'other'));

-- RLS ----------------------------------------------------------------------
-- Administrators read everything; an applicant reads their own application
-- and its parts (the /teach status card). Nobody writes directly: every
-- write is a function below.
alter table public.tutor_recruitment_rounds            enable row level security;
alter table public.tutor_recruitment_needs             enable row level security;
alter table public.tutor_applications                  enable row level security;
alter table public.tutor_application_competencies      enable row level security;
alter table public.tutor_application_competency_media  enable row level security;
alter table public.tutor_application_documents         enable row level security;
alter table public.tutor_application_references        enable row level security;

revoke all on
  public.tutor_recruitment_rounds, public.tutor_recruitment_needs, public.tutor_applications,
  public.tutor_application_competencies, public.tutor_application_competency_media,
  public.tutor_application_documents, public.tutor_application_references
from anon, authenticated;

grant select on
  public.tutor_recruitment_rounds, public.tutor_recruitment_needs, public.tutor_applications,
  public.tutor_application_competencies, public.tutor_application_competency_media,
  public.tutor_application_documents, public.tutor_application_references
to authenticated;

create policy "recruitment rounds: admin read" on public.tutor_recruitment_rounds
  for select to authenticated using ((select private.is_admin()));
create policy "recruitment needs: admin read" on public.tutor_recruitment_needs
  for select to authenticated using ((select private.is_admin()));

create policy "tutor applications: own or admin read" on public.tutor_applications
  for select to authenticated
  using (applicant_id = (select auth.uid()) or (select private.is_admin()));

create policy "application competencies: own or admin read" on public.tutor_application_competencies
  for select to authenticated
  using (exists (select 1 from public.tutor_applications a where a.id = application_id
                  and (a.applicant_id = (select auth.uid()) or (select private.is_admin()))));
create policy "application media: own or admin read" on public.tutor_application_competency_media
  for select to authenticated
  using (exists (select 1 from public.tutor_application_competencies c
                   join public.tutor_applications a on a.id = c.application_id
                  where c.id = competency_id
                    and (a.applicant_id = (select auth.uid()) or (select private.is_admin()))));
create policy "application documents: own or admin read" on public.tutor_application_documents
  for select to authenticated
  using (exists (select 1 from public.tutor_applications a where a.id = application_id
                  and (a.applicant_id = (select auth.uid()) or (select private.is_admin()))));
create policy "application references: own or admin read" on public.tutor_application_references
  for select to authenticated
  using (exists (select 1 from public.tutor_applications a where a.id = application_id
                  and (a.applicant_id = (select auth.uid()) or (select private.is_admin()))));

-- Helpers ------------------------------------------------------------------
-- The round accepting applications right now, if any.
create or replace function private.open_recruitment_round()
returns public.tutor_recruitment_rounds
language sql stable security definer set search_path = ''
as $fn$
  select * from public.tutor_recruitment_rounds
   where closed_at is null and (closes_at is null or closes_at > now())
   limit 1
$fn$;

-- A round whose closing date has passed is closed as of that date.
create or replace function private.close_expired_recruitment()
returns void language sql security definer set search_path = ''
as $fn$
  update public.tutor_recruitment_rounds
     set closed_at = closes_at
   where closed_at is null and closes_at is not null and closes_at <= now()
$fn$;

-- The role swap and staff row shared by invitations and approvals. Replaces
-- the self-signup 'parent' role (and its empty guardian row) unless the person
-- really is a guardian; creates the tutors row with a unique slug.
create or replace function private.make_tutor(
  p_user_id   uuid,
  p_full_name text,
  p_status    text default 'active'
)
returns uuid
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_email     text;
  v_base_slug text;
  v_slug      text;
  v_suffix    integer := 1;
  v_tutor     uuid;
begin
  select id into v_tutor from public.tutors where profile_id = p_user_id;
  if v_tutor is not null then
    insert into public.user_roles (user_id, role) values (p_user_id, 'tutor')
    on conflict (user_id, role) do nothing;
    return v_tutor;
  end if;

  select email into v_email from auth.users where id = p_user_id;

  if not exists (select 1 from public.learner_guardians lg where lg.guardian_id = p_user_id) then
    delete from public.user_roles where user_id = p_user_id and role = 'parent';
    delete from public.guardians where profile_id = p_user_id;
  end if;

  insert into public.user_roles (user_id, role) values (p_user_id, 'tutor')
  on conflict (user_id, role) do nothing;

  v_base_slug := trim(both '-' from regexp_replace(lower(coalesce(p_full_name, '')), '[^a-z0-9]+', '-', 'g'));
  if v_base_slug = '' then
    v_base_slug := trim(both '-' from regexp_replace(lower(split_part(coalesce(v_email, ''), '@', 1)), '[^a-z0-9]+', '-', 'g'));
  end if;
  if v_base_slug = '' then
    v_base_slug := 'tutor';
  end if;

  v_slug := v_base_slug;
  while exists (select 1 from public.tutors where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix::text;
  end loop;

  insert into public.tutors (profile_id, slug, employment_type, headline, status)
  values (p_user_id, v_slug, 'sessional', '', p_status)
  returning id into v_tutor;

  return v_tutor;
end;
$fn$;

revoke execute on function private.make_tutor(uuid, text, text) from public, anon, authenticated;

-- configure_invited_user, unchanged in behaviour, now through make_tutor.
create or replace function public.configure_invited_user(
  p_user_id    uuid,
  p_first_name text,
  p_last_name  text,
  p_role       public.app_role
)
returns uuid
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_first text := trim(coalesce(p_first_name, ''));
  v_last  text := trim(coalesce(p_last_name, ''));
  v_full  text := trim(v_first || ' ' || v_last);
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;

  if p_role = 'superadmin' then
    raise exception 'Super administrator role cannot be assigned' using errcode = 'P0001';
  end if;

  if p_role = 'admin' and not (select private.is_superadmin()) then
    raise exception 'Only super administrators can create administrator accounts' using errcode = 'P0001';
  end if;

  if v_first = '' or v_last = '' then
    raise exception 'First name and last name are required' using errcode = 'check_violation';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Invited user account not found' using errcode = 'P0002';
  end if;

  update public.profiles
     set first_name = v_first,
         last_name  = v_last,
         full_name  = v_full
   where id = p_user_id;

  if p_role = 'tutor' then
    perform private.make_tutor(p_user_id, v_full, 'active');
  elsif p_role <> 'parent' then
    delete from public.user_roles where user_id = p_user_id and role = 'parent';
    delete from public.guardians
     where profile_id = p_user_id
       and not exists (select 1 from public.learner_guardians lg where lg.guardian_id = p_user_id);
    insert into public.user_roles (user_id, role) values (p_user_id, p_role)
    on conflict (user_id, role) do nothing;
  else
    insert into public.guardians (profile_id) values (p_user_id)
    on conflict (profile_id) do nothing;
    insert into public.user_roles (user_id, role) values (p_user_id, p_role)
    on conflict (user_id, role) do nothing;
  end if;

  return p_user_id;
end;
$fn$;

-- Public status --------------------------------------------------------------
-- What the landing page and /teach need. No counts, no names.
create or replace function public.tutor_recruitment_status()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $fn$
declare v_round public.tutor_recruitment_rounds;
begin
  v_round := private.open_recruitment_round();
  if v_round.id is null then
    return jsonb_build_object('isOpen', false);
  end if;
  return jsonb_build_object(
    'isOpen', true,
    'roundId', v_round.id,
    'closesAt', v_round.closes_at,
    'message', v_round.message,
    'policeClearanceRequired', v_round.police_clearance_required,
    'needs', coalesce((
      select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name) order by s.sort_order)
        from public.tutor_recruitment_needs n join public.subjects s on s.code = n.subject_code
       where n.round_id = v_round.id), '[]'::jsonb));
end;
$fn$;

-- Opening and closing ----------------------------------------------------------
create or replace function private.set_recruitment_needs(p_round_id uuid, p_needs text[])
returns void language plpgsql security definer set search_path = ''
as $fn$
begin
  delete from public.tutor_recruitment_needs where round_id = p_round_id;
  insert into public.tutor_recruitment_needs (round_id, subject_code)
  select p_round_id, code from (select distinct unnest(coalesce(p_needs, '{}')) as code) x;
end;
$fn$;

revoke execute on function private.set_recruitment_needs(uuid, text[]) from public, anon, authenticated;

create or replace function public.open_tutor_recruitment(
  p_closes_at                 timestamptz default null,
  p_message                   text default '',
  p_needs                     text[] default '{}',
  p_police_clearance_required boolean default false
)
returns uuid
language plpgsql security definer set search_path = ''
as $fn$
declare v_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;
  if p_closes_at is not null and p_closes_at <= now() then
    raise exception 'The closing date must be in the future' using errcode = 'check_violation';
  end if;

  perform private.close_expired_recruitment();
  if exists (select 1 from public.tutor_recruitment_rounds where closed_at is null) then
    raise exception 'Applications are already open' using errcode = 'P0001';
  end if;

  insert into public.tutor_recruitment_rounds (opened_by, closes_at, message, police_clearance_required)
  values ((select auth.uid()), p_closes_at, trim(coalesce(p_message, '')), coalesce(p_police_clearance_required, false))
  returning id into v_id;

  perform private.set_recruitment_needs(v_id, p_needs);
  return v_id;
end;
$fn$;

create or replace function public.update_tutor_recruitment(
  p_closes_at                 timestamptz,
  p_message                   text,
  p_needs                     text[],
  p_police_clearance_required boolean
)
returns uuid
language plpgsql security definer set search_path = ''
as $fn$
declare v_round public.tutor_recruitment_rounds;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;
  v_round := private.open_recruitment_round();
  if v_round.id is null then
    raise exception 'Applications are closed. Open them to start a new round.' using errcode = 'P0001';
  end if;
  if p_closes_at is not null and p_closes_at <= now() then
    raise exception 'The closing date must be in the future' using errcode = 'check_violation';
  end if;

  update public.tutor_recruitment_rounds
     set closes_at = p_closes_at,
         message = trim(coalesce(p_message, '')),
         police_clearance_required = coalesce(p_police_clearance_required, false)
   where id = v_round.id;

  perform private.set_recruitment_needs(v_round.id, p_needs);
  return v_round.id;
end;
$fn$;

create or replace function public.close_tutor_recruitment()
returns void
language plpgsql security definer set search_path = ''
as $fn$
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;
  perform private.close_expired_recruitment();
  update public.tutor_recruitment_rounds
     set closed_at = now(), closed_by = (select auth.uid())
   where closed_at is null;
end;
$fn$;

-- Submitting -------------------------------------------------------------------
-- p_application:
--   { firstName, lastName, phone, whatsappNumber,
--     address: { line1, line2, city, province, country },
--     competencies: [ { subjectCode, gradeCode, languageCodes: [..] } ],
--     documents:    [ { docType, stagingPath, mime, sizeBytes, originalName,
--                       title?, institution?, yearAwarded? } ],
--     references:   [ { fullName, relationship, phone, email? } ] x3,
--     consents:     { popia, referencesAgreed, declaration } }
-- Phone numbers arrive normalised by the API (+27...). Returns the new id and
-- where the API must move each staged file.
create or replace function private.submit_tutor_application(p_application jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_me         uuid := (select auth.uid());
  v_round      public.tutor_recruitment_rounds;
  v_id         uuid := gen_random_uuid();
  v_item       jsonb;
  v_lang       text;
  v_comp       uuid;
  v_staging    text;
  v_ext        text;
  v_type       text;
  v_path       text;
  v_moves      jsonb := '[]'::jsonb;
  v_pos        smallint := 0;
  v_name       text;
  v_staged     text;
begin
  perform private.assert_not_rest();
  if v_me is null then
    raise exception 'Not signed in' using errcode = 'P0001';
  end if;

  v_round := private.open_recruitment_round();
  if v_round.id is null then
    raise exception 'Applications are closed' using errcode = 'P0001';
  end if;

  if (select private.has_role('tutor')) or (select private.is_admin())
     or exists (select 1 from public.tutors where profile_id = v_me) then
    raise exception 'You already work with us, so you cannot apply' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.tutor_applications where round_id = v_round.id and applicant_id = v_me) then
    raise exception 'You have already applied in this round' using errcode = 'unique_violation';
  end if;

  if not (coalesce((p_application #>> '{consents,popia}')::boolean, false)
          and coalesce((p_application #>> '{consents,referencesAgreed}')::boolean, false)
          and coalesce((p_application #>> '{consents,declaration}')::boolean, false)) then
    raise exception 'Please accept all three statements before you submit' using errcode = 'check_violation';
  end if;

  if coalesce(jsonb_array_length(p_application -> 'competencies'), 0) = 0 then
    raise exception 'Add at least one subject you can teach' using errcode = 'check_violation';
  end if;
  if coalesce(jsonb_array_length(p_application -> 'references'), 0) <> 3 then
    raise exception 'Give exactly three references' using errcode = 'check_violation';
  end if;

  -- Documents: exactly one CV, ID and selfie; one to three qualifications; at
  -- most one ID back and one police clearance (required when the round says).
  if (select count(*) from jsonb_array_elements(p_application -> 'documents') d where d ->> 'docType' = 'cv') <> 1 then
    raise exception 'Upload your CV' using errcode = 'check_violation';
  end if;
  if (select count(*) from jsonb_array_elements(p_application -> 'documents') d where d ->> 'docType' = 'qualification') not between 1 and 3 then
    raise exception 'Upload between one and three qualifications' using errcode = 'check_violation';
  end if;
  if (select count(*) from jsonb_array_elements(p_application -> 'documents') d where d ->> 'docType' = 'id') <> 1 then
    raise exception 'Upload a photo of your ID' using errcode = 'check_violation';
  end if;
  if (select count(*) from jsonb_array_elements(p_application -> 'documents') d where d ->> 'docType' = 'selfie') <> 1 then
    raise exception 'Take a selfie' using errcode = 'check_violation';
  end if;
  if (select count(*) from jsonb_array_elements(p_application -> 'documents') d where d ->> 'docType' = 'id_back') > 1
     or (select count(*) from jsonb_array_elements(p_application -> 'documents') d where d ->> 'docType' = 'police_clearance') > 1 then
    raise exception 'Upload one file for each document' using errcode = 'check_violation';
  end if;
  if v_round.police_clearance_required
     and not exists (select 1 from jsonb_array_elements(p_application -> 'documents') d where d ->> 'docType' = 'police_clearance') then
    raise exception 'Upload your police clearance certificate' using errcode = 'check_violation';
  end if;

  insert into public.tutor_applications (
    id, round_id, applicant_id, first_name, last_name, phone, whatsapp_number,
    address_line_1, address_line_2, city, province, country,
    police_clearance_required, popia_consent_at)
  values (
    v_id, v_round.id, v_me,
    trim(p_application ->> 'firstName'), trim(p_application ->> 'lastName'),
    p_application ->> 'phone',
    coalesce(nullif(p_application ->> 'whatsappNumber', ''), p_application ->> 'phone'),
    trim(p_application #>> '{address,line1}'), trim(coalesce(p_application #>> '{address,line2}', '')),
    trim(p_application #>> '{address,city}'), trim(p_application #>> '{address,province}'),
    coalesce(nullif(trim(p_application #>> '{address,country}'), ''), 'South Africa'),
    v_round.police_clearance_required, now());

  for v_item in select * from jsonb_array_elements(p_application -> 'competencies') loop
    if coalesce(jsonb_array_length(v_item -> 'languageCodes'), 0) = 0 then
      raise exception 'Choose at least one language of instruction for each subject' using errcode = 'check_violation';
    end if;
    insert into public.tutor_application_competencies (application_id, subject_code, grade_code)
    values (v_id, v_item ->> 'subjectCode', v_item ->> 'gradeCode')
    on conflict (application_id, subject_code, grade_code) do update set grade_code = excluded.grade_code
    returning id into v_comp;
    for v_lang in select jsonb_array_elements_text(v_item -> 'languageCodes') loop
      insert into public.tutor_application_competency_media (competency_id, language_code)
      values (v_comp, v_lang) on conflict do nothing;
    end loop;
  end loop;

  for v_item in select * from jsonb_array_elements(p_application -> 'documents') loop
    v_type    := v_item ->> 'docType';
    v_staging := v_item ->> 'stagingPath';
    if coalesce(v_staging, '') !~ ('^staging/' || v_me::text || '/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$') then
      raise exception 'That upload does not belong to you' using errcode = 'P0001';
    end if;
    v_ext := substring(v_staging from '\.([a-z]+)$');
    if v_type in ('selfie', 'id_back') and v_ext = 'pdf' then
      raise exception 'A selfie or ID photo must be a photo, not a PDF' using errcode = 'check_violation';
    end if;
    v_path := format('applications/%s/%s.%s', v_id, gen_random_uuid(), v_ext);

    insert into public.tutor_application_documents
      (application_id, doc_type, storage_path, original_name, mime_type, size_bytes, title, institution, year_awarded)
    values (v_id, v_type, v_path, left(coalesce(v_item ->> 'originalName', ''), 200),
            v_item ->> 'mime', (v_item ->> 'sizeBytes')::integer,
            trim(coalesce(v_item ->> 'title', '')), trim(coalesce(v_item ->> 'institution', '')),
            nullif(v_item ->> 'yearAwarded', '')::smallint);

    v_moves := v_moves || jsonb_build_object('stagingPath', v_staging, 'storagePath', v_path);
  end loop;

  -- The same staged file must not be filed twice.
  select s into v_staged from (
    select m ->> 'stagingPath' as s from jsonb_array_elements(v_moves) m
  ) x group by s having count(*) > 1 limit 1;
  if v_staged is not null then
    raise exception 'The same file was uploaded twice' using errcode = 'check_violation';
  end if;

  for v_item in select * from jsonb_array_elements(p_application -> 'references') loop
    v_pos := v_pos + 1;
    insert into public.tutor_application_references (application_id, position, full_name, relationship, phone, email)
    values (v_id, v_pos, trim(v_item ->> 'fullName'), trim(v_item ->> 'relationship'),
            trim(v_item ->> 'phone'), trim(coalesce(v_item ->> 'email', '')));
  end loop;

  v_name := trim((p_application ->> 'firstName') || ' ' || (p_application ->> 'lastName'));
  perform private.notify(private.admin_ids(), 'New tutor application',
    format('%s applied to teach. Open Tutor applications to review it.', v_name));

  return jsonb_build_object('applicationId', v_id, 'documents', v_moves);
end;
$fn$;

create or replace function private.withdraw_tutor_application(p_application_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $fn$
begin
  perform private.assert_not_rest();
  update public.tutor_applications
     set status = 'withdrawn', withdrawn_at = now()
   where id = p_application_id and applicant_id = (select auth.uid()) and status = 'submitted';
  if not found then
    raise exception 'Only an application that has not been reviewed yet can be withdrawn' using errcode = 'P0001';
  end if;
end;
$fn$;

-- Review -----------------------------------------------------------------------
create or replace function public.set_tutor_application_status(
  p_application_id uuid,
  p_status         text,
  p_note           text default ''
)
returns void
language plpgsql security definer set search_path = ''
as $fn$
declare v_app public.tutor_applications;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;
  if p_status not in ('shortlisted', 'rejected') then
    raise exception 'Use approve to approve an application' using errcode = 'P0001';
  end if;

  select * into v_app from public.tutor_applications where id = p_application_id for update;
  if v_app.id is null then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  if v_app.status not in ('submitted', 'shortlisted') then
    raise exception 'This application has already been decided' using errcode = 'P0001';
  end if;
  if v_app.status = p_status then
    return;
  end if;

  update public.tutor_applications
     set status = p_status,
         decision_note = case when p_status = 'rejected' then trim(coalesce(p_note, '')) else decision_note end,
         reviewed_by = (select auth.uid()),
         reviewed_at = case when p_status = 'rejected' then now() else reviewed_at end
   where id = v_app.id;

  if p_status = 'shortlisted' then
    perform private.notify(array[v_app.applicant_id], 'You have been shortlisted',
      'Thank you for applying to teach at Skolopals. We will contact you to arrange an interview.');
  else
    perform private.notify(array[v_app.applicant_id], 'Your tutor application',
      'Thank you for applying to teach at Skolopals. We will not be taking your application further this time.');
  end if;
end;
$fn$;

create or replace function public.mark_tutor_application_identity_checked(p_application_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $fn$
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;
  update public.tutor_applications
     set identity_checked_by = (select auth.uid()), identity_checked_at = now()
   where id = p_application_id;
  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
end;
$fn$;

-- Approve: the person becomes a suspended tutor with everything they sent
-- copied into the vetting tables. Competencies whose offering has since been
-- withdrawn are skipped and returned, so the admin can see what did not carry.
create or replace function public.approve_tutor_application(p_application_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_app      public.tutor_applications;
  v_full     text;
  v_tutor    uuid;
  v_comp     record;
  v_new_comp uuid;
  v_skipped  jsonb := '[]'::jsonb;
  v_checked  boolean;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;

  select * into v_app from public.tutor_applications where id = p_application_id for update;
  if v_app.id is null then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  if v_app.status not in ('submitted', 'shortlisted') then
    raise exception 'This application has already been decided' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.tutors where profile_id = v_app.applicant_id) then
    raise exception 'That person is already a tutor' using errcode = 'unique_violation';
  end if;

  v_full := trim(v_app.first_name || ' ' || v_app.last_name);
  v_checked := v_app.identity_checked_at is not null;

  update public.profiles
     set first_name = v_app.first_name, last_name = v_app.last_name, full_name = v_full, phone = v_app.phone
   where id = v_app.applicant_id;

  v_tutor := private.make_tutor(v_app.applicant_id, v_full, 'suspended');
  update public.tutors
     set application_id = v_app.id,
         police_clearance_requested_at = case
           when not exists (select 1 from public.tutor_application_documents d
                             where d.application_id = v_app.id and d.doc_type = 'police_clearance')
           then v_app.police_clearance_requested_at end,
         police_clearance_request_note = case
           when v_app.police_clearance_requested_at is not null
            and not exists (select 1 from public.tutor_application_documents d
                             where d.application_id = v_app.id and d.doc_type = 'police_clearance')
           then v_app.police_clearance_request_note else '' end
   where id = v_tutor;

  for v_comp in
    select c.id, c.subject_code, c.grade_code from public.tutor_application_competencies c
     where c.application_id = v_app.id
  loop
    if exists (select 1 from public.subject_offerings o
                where o.subject_code = v_comp.subject_code and o.grade_code = v_comp.grade_code) then
      insert into public.tutor_competencies (tutor_id, subject_code, grade_code)
      values (v_tutor, v_comp.subject_code, v_comp.grade_code)
      on conflict (tutor_id, subject_code, grade_code) do update set tutor_id = excluded.tutor_id
      returning id into v_new_comp;
      insert into public.tutor_competency_media (competency_id, language_code)
      select v_new_comp, m.language_code from public.tutor_application_competency_media m
       where m.competency_id = v_comp.id
      on conflict do nothing;
    else
      v_skipped := v_skipped || jsonb_build_object('subjectCode', v_comp.subject_code, 'gradeCode', v_comp.grade_code);
    end if;
  end loop;

  insert into public.tutor_documents (tutor_id, doc_type, storage_path, uploaded_at, verified_at, verified_by)
  select v_tutor, d.doc_type, d.storage_path, d.uploaded_at,
         case when v_checked and d.doc_type in ('id', 'id_back', 'selfie') then v_app.identity_checked_at end,
         case when v_checked and d.doc_type in ('id', 'id_back', 'selfie') then v_app.identity_checked_by end
    from public.tutor_application_documents d
   where d.application_id = v_app.id;

  insert into public.tutor_qualifications (tutor_id, qualification_type, title, institution, year_awarded)
  select v_tutor, 'other', d.title, d.institution, d.year_awarded
    from public.tutor_application_documents d
   where d.application_id = v_app.id and d.doc_type = 'qualification';

  insert into public.tutor_references (tutor_id, full_name, relationship, phone, email)
  select v_tutor, r.full_name, r.relationship, r.phone, r.email
    from public.tutor_application_references r
   where r.application_id = v_app.id
   order by r.position;

  update public.tutor_applications
     set status = 'approved', reviewed_by = (select auth.uid()), reviewed_at = now(), tutor_id = v_tutor
   where id = v_app.id;

  perform private.notify(array[v_app.applicant_id], 'Welcome to Skolopals',
    'Your application to teach has been approved. Sign out and sign in again to open the tutor portal. '
    'We will be in touch to finish your vetting before your first class.');

  return jsonb_build_object('tutorId', v_tutor, 'skippedCompetencies', v_skipped);
end;
$fn$;

-- Police clearance on request --------------------------------------------------
-- Exactly one of the two ids: an application under review, or a tutor.
create or replace function public.request_police_clearance(
  p_application_id uuid default null,
  p_tutor_id       uuid default null,
  p_note           text default ''
)
returns void
language plpgsql security definer set search_path = ''
as $fn$
declare v_person uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;
  if (p_application_id is null) = (p_tutor_id is null) then
    raise exception 'Give an application or a tutor, not both' using errcode = 'P0001';
  end if;

  if p_application_id is not null then
    update public.tutor_applications
       set police_clearance_requested_at = now(), police_clearance_request_note = trim(coalesce(p_note, ''))
     where id = p_application_id and status in ('submitted', 'shortlisted')
    returning applicant_id into v_person;
    if v_person is null then
      raise exception 'Police clearance can only be requested while an application is under review' using errcode = 'P0001';
    end if;
  else
    update public.tutors
       set police_clearance_requested_at = now(), police_clearance_request_note = trim(coalesce(p_note, ''))
     where id = p_tutor_id
    returning profile_id into v_person;
    if v_person is null then
      raise exception 'Tutor not found' using errcode = 'P0002';
    end if;
  end if;

  perform private.notify(array[v_person], 'Please upload your police clearance certificate',
    coalesce(nullif(trim(p_note), ''), 'Skolopals needs a copy of your police clearance certificate.'));
end;
$fn$;

-- The caller's own staged upload, filed against their open application or
-- their tutor record (whichever exists). Returns the move for the API.
create or replace function private.add_police_clearance(p_document jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_me      uuid := (select auth.uid());
  v_staging text := p_document ->> 'stagingPath';
  v_ext     text;
  v_path    text;
  v_app     uuid;
  v_tutor   uuid;
  v_name    text;
begin
  perform private.assert_not_rest();
  if coalesce(v_staging, '') !~ ('^staging/' || v_me::text || '/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$') then
    raise exception 'That upload does not belong to you' using errcode = 'P0001';
  end if;
  v_ext := substring(v_staging from '\.([a-z]+)$');

  select id into v_tutor from public.tutors where profile_id = v_me;
  if v_tutor is not null then
    v_path := format('%s/police_clearance/%s.%s', v_tutor, gen_random_uuid(), v_ext);
    insert into public.tutor_documents (tutor_id, doc_type, storage_path)
    values (v_tutor, 'police_clearance', v_path);
    update public.tutors
       set police_clearance_requested_at = null, police_clearance_request_note = ''
     where id = v_tutor;
  else
    select id into v_app from public.tutor_applications
     where applicant_id = v_me and status in ('submitted', 'shortlisted')
     order by submitted_at desc limit 1;
    if v_app is null then
      raise exception 'There is no application to add this to' using errcode = 'P0001';
    end if;
    v_path := format('applications/%s/%s.%s', v_app, gen_random_uuid(), v_ext);
    delete from public.tutor_application_documents
     where application_id = v_app and doc_type = 'police_clearance';
    insert into public.tutor_application_documents
      (application_id, doc_type, storage_path, original_name, mime_type, size_bytes)
    values (v_app, 'police_clearance', v_path, left(coalesce(p_document ->> 'originalName', ''), 200),
            p_document ->> 'mime', (p_document ->> 'sizeBytes')::integer);
    update public.tutor_applications
       set police_clearance_requested_at = null, police_clearance_request_note = ''
     where id = v_app;
  end if;

  select full_name into v_name from public.profiles where id = v_me;
  perform private.notify(private.admin_ids(), 'Police clearance received',
    format('%s uploaded a police clearance certificate.', coalesce(v_name, 'An applicant')));

  return jsonb_build_object('stagingPath', v_staging, 'storagePath', v_path);
end;
$fn$;

-- Admin list ------------------------------------------------------------------
-- Joins the applicant's email from auth.users (not exposed to clients), as
-- list_users_for_admin does. p_status 'needs_action' = submitted + shortlisted.
create or replace function public.list_tutor_applications(
  p_status         text default null,
  p_round_id       uuid default null,
  p_application_id uuid default null
)
returns table (
  id                            uuid,
  round_id                      uuid,
  applicant_id                  uuid,
  first_name                    text,
  last_name                     text,
  email                         text,
  phone                         text,
  whatsapp_number               text,
  address_line_1                text,
  address_line_2                text,
  city                          text,
  province                      text,
  country                       text,
  status                        text,
  decision_note                 text,
  submitted_at                  timestamptz,
  reviewed_at                   timestamptz,
  police_clearance_required     boolean,
  police_clearance_requested_at timestamptz,
  police_clearance_request_note text,
  has_police_clearance          boolean,
  identity_checked_at           timestamptz,
  tutor_id                      uuid,
  subjects                      jsonb
)
language plpgsql stable security definer set search_path = ''
as $fn$
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;

  return query
  select a.id, a.round_id, a.applicant_id, a.first_name, a.last_name, coalesce(u.email, '')::text,
         a.phone, a.whatsapp_number, a.address_line_1, a.address_line_2, a.city, a.province, a.country,
         a.status, a.decision_note, a.submitted_at, a.reviewed_at,
         a.police_clearance_required, a.police_clearance_requested_at, a.police_clearance_request_note,
         exists (select 1 from public.tutor_application_documents d
                  where d.application_id = a.id and d.doc_type = 'police_clearance'),
         a.identity_checked_at, a.tutor_id,
         coalesce((
           select jsonb_agg(jsonb_build_object('subject', x.subject, 'grades', x.grades) order by x.sort_order)
             from (
               select s.name as subject, s.sort_order,
                      jsonb_agg(jsonb_build_object('name', g.name, 'order', g.sort_order) order by g.sort_order) as grades
                 from public.tutor_application_competencies c
                 join public.subjects s on s.code = c.subject_code
                 join public.grades g on g.code = c.grade_code
                where c.application_id = a.id
                group by s.name, s.sort_order
             ) x), '[]'::jsonb)
    from public.tutor_applications a
    left join auth.users u on u.id = a.applicant_id
   where (p_application_id is null or a.id = p_application_id)
     and (p_round_id is null or a.round_id = p_round_id)
     and (p_status is null
          or (p_status = 'needs_action' and a.status in ('submitted', 'shortlisted'))
          or a.status = p_status)
   order by a.submitted_at desc;
end;
$fn$;

-- Retention (SPEC D8) -----------------------------------------------------------
-- Applications that did not lead to a tutor are kept 12 months after the
-- decision, then deleted with their ID, selfie and documents. As with learner
-- records (20261020000007), nothing is destroyed silently: the view lists
-- what is due and an administrator confirms each deletion, which is logged.
-- An approved application is kept with the tutor record it became.
insert into public.data_retention_policies (record_class, description, retention_months, basis)
values ('tutor_applications',
        'Tutor applications that were not successful, with the ID, selfie and documents sent with them',
        12, 'POPIA s14 minimality')
on conflict (record_class) do nothing;

create or replace view public.v_tutor_application_retention_due with (security_invoker = true) as
select a.id as application_id,
       a.status,
       coalesce(a.reviewed_at, a.withdrawn_at, a.submitted_at) as decided_at,
       (coalesce(a.reviewed_at, a.withdrawn_at, a.submitted_at)
          + (p.retention_months || ' months')::interval)::date as due_on
  from public.tutor_applications a
  join public.data_retention_policies p on p.record_class = 'tutor_applications'
 where (select private.is_admin())
   and a.status in ('rejected', 'withdrawn')
   and coalesce(a.reviewed_at, a.withdrawn_at, a.submitted_at) + (p.retention_months || ' months')::interval < now();

comment on view public.v_tutor_application_retention_due is
  'Unsuccessful tutor applications past their 12-month retention. Admin only; each is deleted '
  'by purge_tutor_application after confirmation.';

grant select on public.v_tutor_application_retention_due to authenticated;

-- Deletes one due application and returns its storage paths for the API to
-- remove. The log names the round and date, not the person: keeping their
-- name would keep the very data the deletion is for.
create or replace function public.purge_tutor_application(p_application_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_app   public.tutor_applications;
  v_paths jsonb;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;

  select * into v_app from public.tutor_applications where id = p_application_id for update;
  if v_app.id is null then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.v_tutor_application_retention_due where application_id = v_app.id) then
    raise exception 'This application is not due for deletion yet' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(storage_path), '[]'::jsonb) into v_paths
    from public.tutor_application_documents where application_id = v_app.id;

  delete from public.tutor_applications where id = v_app.id;

  insert into public.data_retention_log (record_class, subject_id, subject_label, action, confirmed_by, note)
  values ('tutor_applications', v_app.id,
          format('Tutor application submitted %s (%s)', to_char(v_app.submitted_at, 'YYYY-MM-DD'), v_app.status),
          'deleted', (select auth.uid()),
          format('%s document(s) deleted from storage', jsonb_array_length(v_paths)));

  return jsonb_build_object('storagePaths', v_paths);
end;
$fn$;

-- Grants ---------------------------------------------------------------------
revoke execute on function
  private.open_recruitment_round(),
  private.close_expired_recruitment(),
  public.tutor_recruitment_status(),
  public.open_tutor_recruitment(timestamptz, text, text[], boolean),
  public.update_tutor_recruitment(timestamptz, text, text[], boolean),
  public.close_tutor_recruitment(),
  private.submit_tutor_application(jsonb),
  private.withdraw_tutor_application(uuid),
  public.set_tutor_application_status(uuid, text, text),
  public.mark_tutor_application_identity_checked(uuid),
  public.approve_tutor_application(uuid),
  public.request_police_clearance(uuid, uuid, text),
  private.add_police_clearance(jsonb),
  public.list_tutor_applications(text, uuid, uuid),
  public.purge_tutor_application(uuid)
from public, anon;

grant execute on function public.tutor_recruitment_status() to anon, authenticated;

grant execute on function
  private.open_recruitment_round(),
  public.open_tutor_recruitment(timestamptz, text, text[], boolean),
  public.update_tutor_recruitment(timestamptz, text, text[], boolean),
  public.close_tutor_recruitment(),
  private.submit_tutor_application(jsonb),
  private.withdraw_tutor_application(uuid),
  public.set_tutor_application_status(uuid, text, text),
  public.mark_tutor_application_identity_checked(uuid),
  public.approve_tutor_application(uuid),
  public.request_police_clearance(uuid, uuid, text),
  private.add_police_clearance(jsonb),
  public.list_tutor_applications(text, uuid, uuid),
  public.purge_tutor_application(uuid)
to authenticated;
