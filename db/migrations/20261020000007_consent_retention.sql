-- POPIA: consent capture and enforced retention.
-- See docs/POPIA-policy.md, Annex B4 and B8.
--
-- Section 35 of POPIA prohibits processing a child's personal information
-- without the consent of a competent person. Enrolment is therefore unlawful
-- without a recorded guardian consent - enforced here, not in the UI.

create table public.consent_types (
  code        text primary key,
  name        text not null,
  description text not null,
  statute_ref text not null default '',
  is_required boolean not null default false,
  sort_order  smallint not null
);

comment on column public.consent_types.is_required is
  'Required consents block enrolment. Optional ones MUST default to off and '
  'MUST NOT block submission - bundling them would invalidate the consent.';

create table public.consents (
  id                uuid primary key default gen_random_uuid(),
  consent_type_code text not null references public.consent_types (code),
  guardian_id       uuid not null references public.guardians (profile_id) on delete cascade,
  learner_id        uuid references public.learners (id) on delete cascade,
  granted           boolean not null,
  granted_at        timestamptz not null default now(),
  withdrawn_at      timestamptz,
  policy_version    text not null,
  check (withdrawn_at is null or withdrawn_at >= granted_at)
);

create index on public.consents (learner_id);
create index on public.consents (guardian_id);

-- One live consent per guardian/learner/type. Withdrawn rows are kept as the
-- record of the withdrawal, so this is a partial unique index.
create unique index consent_one_live
  on public.consents (consent_type_code, guardian_id, coalesce(learner_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where withdrawn_at is null;

comment on column public.consents.policy_version is
  'Which version of the privacy notice was consented to. When the notice '
  'changes you can tell who agreed to what.';

-- Is a required consent in place for this learner right now?
create or replace function public.has_required_consents(p_learner_id uuid)
returns boolean
language sql stable
as $fn$
  select not exists (
    select 1 from public.consent_types ct
    where ct.is_required
      and not exists (
        select 1 from public.consents c
        where c.consent_type_code = ct.code
          and c.learner_id = p_learner_id
          and c.granted
          and c.withdrawn_at is null
      )
  )
$fn$;

-- An enrolment cannot go active without the required consents (POPIA s35).
create or replace function private.check_enrolment_consents()
returns trigger
language plpgsql security definer set search_path = ''
as $fn$
begin
  if new.status = 'active' and not public.has_required_consents(new.learner_id) then
    raise exception
      'Required POPIA consents are not in place for this learner'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

create trigger enrolment_requires_consent
  before insert or update of status on public.enrolments
  for each row execute function private.check_enrolment_consents();

-- Retention (POPIA s14) ----------------------------------------------------
create table public.data_retention_policies (
  record_class     text primary key,
  description      text not null,
  retention_months smallint not null check (retention_months > 0),
  basis            text not null
);

create table public.data_retention_log (
  id            uuid primary key default gen_random_uuid(),
  record_class  text not null references public.data_retention_policies (record_class),
  subject_id    uuid not null,
  subject_label text not null default '',
  action        text not null check (action in ('deleted', 'anonymised', 'skipped')),
  performed_at  timestamptz not null default now(),
  confirmed_by  uuid references public.profiles (id),
  note          text not null default ''
);

comment on table public.data_retention_log is
  'Nothing is destroyed silently. Every purge writes a row here and requires '
  'administrator confirmation.';

-- What is now past its retention period.
create or replace view public.v_retention_due with (security_invoker = true) as
select
  'learner_records'                              as record_class,
  l.id                                           as subject_id,
  l.full_name                                    as subject_label,
  l.left_on,
  p.retention_months,
  (l.left_on + (p.retention_months || ' months')::interval)::date as due_on
from public.learners l
cross join public.data_retention_policies p
where p.record_class = 'learner_records'
  and l.left_on is not null
  and l.left_on + (p.retention_months || ' months')::interval < now()
  and not exists (
    select 1 from public.data_retention_log g
    where g.subject_id = l.id and g.action in ('deleted', 'anonymised')
  );

comment on view public.v_retention_due is
  'Learners past their retention period and not yet purged. Drives the monthly '
  'purge job, which requires admin confirmation before deleting.';

alter table public.consent_types           enable row level security;
alter table public.consents                enable row level security;
alter table public.data_retention_policies enable row level security;
alter table public.data_retention_log      enable row level security;

-- Consent types are public: the enrolment form has to render them.
create policy "consent_types: public read" on public.consent_types
  for select to anon, authenticated using (true);
grant select on public.consent_types to anon, authenticated;
