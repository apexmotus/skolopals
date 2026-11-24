-- UAT ONLY: a realistic "centre in operation" data set for end-to-end testing.
--
-- Target: Supabase project dhmjzshlznhqohvkdcpz (UAT). NEVER production.
--
-- Simulates Skolopals as it would look on 2026-11-20, about five weeks after
-- opening on the first day of 2026 Term 4 (13 October 2026): staff, tutors with
-- competencies and pay, 11 families, 13 learners, a weekly timetable with held
-- sessions and attendance, assessments, learning plans, reports, two billing
-- runs with payments, arrears and a late fee, programmes, messages,
-- announcements, enquiries, reviews and expenses.
--
-- The E2E plan's scripted personas (Thandi/Thabo/Lerato Mokoena, Naledi Dube,
-- Kgomotso Mokoena) are deliberately NOT seeded - testers create them through
-- the UI. Sipho Nkosi IS seeded, as the plan's "Guardian B".
--
-- Wherever the app has an RPC the seed calls it as the right person (guardian,
-- tutor, admin), so the data goes through the same rules a real user hits.
-- Rows the app writes with plain inserts are inserted directly. Timestamps are
-- then backdated so the history reads in date order.
--
-- Every seeded login: <name>@uat.skolopals.test, password Uat-Skolopals-2026!
-- See docs/UAT-TEST-DATA.md for the account list and the scenarios.
--
-- How to run (either):
--   db/scripts/seed-uat.sh "<UAT DATABASE_URL>"      (checks the URL is UAT)
--   Supabase SQL editor on the UAT project: add this line at the very top,
--   then run the whole file:
--     set skp.project_ref = 'dhmjzshlznhqohvkdcpz';
--
-- Not re-runnable over itself: run db/uat/99_teardown_uat.sql first.

begin;

-- 0. Guards -----------------------------------------------------------------
do $$
begin
  if coalesce(current_setting('skp.project_ref', true), '') <> 'dhmjzshlznhqohvkdcpz' then
    raise exception 'Refusing to run: skp.project_ref is not the UAT project ref. This seed is for UAT (dhmjzshlznhqohvkdcpz) only.'
      using hint = 'In the UAT SQL editor, add this as the first line and run again: '
                   'set skp.project_ref = ''dhmjzshlznhqohvkdcpz'';  (seed-uat.sh sets it for you)';
  end if;

  -- The schema must be the current one, not the old marketplace schema.
  if to_regclass('public.class_sessions') is null
     or not exists (select 1 from pg_proc where proname = 'configure_invited_user')
     or not exists (select 1 from pg_proc where proname = 'update_user_for_admin')
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'profiles' and column_name = 'first_name') then
    raise exception 'UAT schema is out of date. Apply every file in db/migrations first.';
  end if;

  if (select count(*) from public.packages) < 10
     or (select count(*) from public.consent_types where is_required) <> 3
     or (select count(*) from public.grades) <> 13
     or not exists (select 1 from public.billing_settings) then
    raise exception 'Reference seeds missing. Run db/seed/01..05 first.';
  end if;

  if exists (select 1 from auth.users where email like '%@uat.skolopals.test') then
    raise exception 'UAT data already present. Run db/uat/99_teardown_uat.sql first.';
  end if;

  -- Invoice numbers, terms and capacities assume an empty operational DB.
  if exists (select 1 from public.learners) or exists (select 1 from public.invoices)
     or exists (select 1 from public.terms) or exists (select 1 from public.tutors) then
    raise exception 'UAT already holds learners/invoices/terms/tutors. Run db/uat/99_teardown_uat.sql first.';
  end if;
end $$;

-- 1. Helpers (dropped at the end) -------------------------------------------
create schema uat_seed;

create table uat_seed.ref (key text primary key, id uuid not null);

create function uat_seed.id(p_key text) returns uuid
language plpgsql stable as $fn$
declare v uuid;
begin
  select id into v from uat_seed.ref where key = p_key;
  if v is null then raise exception 'uat_seed: unknown key %', p_key; end if;
  return v;
end $fn$;

create function uat_seed.put(p_key text, p_id uuid) returns uuid
language sql as $fn$
  insert into uat_seed.ref (key, id) values (p_key, p_id) returning id
$fn$;

-- Become a signed-in user for the RPCs that follow (auth.uid()).
create function uat_seed.act_as(p_key text) returns void
language plpgsql as $fn$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uat_seed.id(p_key), 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uat_seed.id(p_key)::text, true);
end $fn$;

-- A confirmed email/password account, as GoTrue would create it. The
-- on_auth_user_created trigger builds profile + 'parent' role + guardian row.
create function uat_seed.make_user(
  p_key text, p_first text, p_last text, p_phone text, p_created timestamptz
) returns uuid
language plpgsql as $fn$
declare
  v_id    uuid := gen_random_uuid();
  v_email text := lower(regexp_replace(p_first || '.' || p_last, '[^A-Za-z.]', '', 'g'))
                  || '@uat.skolopals.test';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, crypt('Uat-Skolopals-2026!', gen_salt('bf')), p_created,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('first_name', p_first, 'last_name', p_last,
                       'full_name', p_first || ' ' || p_last, 'phone', p_phone),
    p_created, p_created, '', '', '', ''
  );
  insert into auth.identities (user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
  values (v_id, 'email', v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          p_created, p_created, p_created);
  update public.profiles set created_at = p_created where id = v_id;
  update public.guardians set created_at = p_created where profile_id = v_id;
  return uat_seed.put(p_key, v_id);
end $fn$;

-- Parent submits the /enrol form (submit_enrolment, with the required report
-- card), then the history is backdated to the submission time. The report
-- card row has no file behind it in UAT storage, so its download link 404s.
create function uat_seed.enrol(
  p_guardian   text,
  p_key        text,
  p_learner    jsonb,
  p_package    text,
  p_subjects   jsonb,
  p_emergency  jsonb,
  p_collectors jsonb,
  p_marketing  boolean,
  p_pref_tutor text,
  p_at         timestamptz
) returns uuid
language plpgsql as $fn$
declare
  v_enrolment uuid;
  v_learner   uuid;
begin
  perform uat_seed.act_as(p_guardian);
  v_enrolment := (private.submit_enrolment(
    p_learner, p_package, p_subjects, p_emergency, p_collectors,
    jsonb_build_array(
      jsonb_build_object('consent_type_code', 'enrolment_s35',     'granted', true),
      jsonb_build_object('consent_type_code', 'health_s27',        'granted', true),
      jsonb_build_object('consent_type_code', 'cross_border_s72',  'granted', true),
      jsonb_build_object('consent_type_code', 'marketing_photos',  'granted', p_marketing),
      jsonb_build_object('consent_type_code', 'marketing_updates', 'granted', p_marketing)),
    '1.0',
    jsonb_build_object('stagingPath', format('staging/%s/%s.pdf', uat_seed.id(p_guardian), gen_random_uuid()),
                       'year', 2026, 'term', 3, 'originalName', 'Term 3 report.pdf',
                       'mime', 'application/pdf', 'sizeBytes', 245000),
    case when p_pref_tutor is null then null else uat_seed.id(p_pref_tutor) end) ->> 'enrolmentId')::uuid;

  select learner_id into v_learner from public.enrolments where id = v_enrolment;
  update public.learner_documents set uploaded_at = p_at where learner_id = v_learner;
  update public.enrolments set created_at = p_at where id = v_enrolment;
  update public.learners   set created_at = p_at, joined_on = p_at::date where id = v_learner;
  update public.consents   set granted_at = p_at where learner_id = v_learner;
  update public.authorised_collectors set active_from = p_at::date where learner_id = v_learner;

  perform uat_seed.put('l.' || p_key, v_learner);
  return uat_seed.put('e.' || p_key, v_enrolment);
end $fn$;

-- Admin approves on /admin/enrolments. This history is from October 2026,
-- before the pre-paid rules of SPEC-2026-11 §5: approval raised a registration
-- invoice only, tuition came from the monthly run, and the admin could set the
-- first month by hand. The function below records it that way, directly,
-- because today's accept/activate functions follow the new rules. Each
-- learner still gets a finished aptitude test (D15): a plain "Developing"
-- result, the day before the start date.
create function uat_seed.activate(
  p_key text, p_tutor text, p_start date,
  p_first_cents integer default null, p_reason text default null
) returns uuid
language plpgsql as $fn$
declare
  v_enrolment uuid := uat_seed.id('e.' || p_key);
  v_learner   uuid;
  v_guardian  uuid;
  v_account   uuid;
  v_invoice   uuid;
  v_admin     uuid := uat_seed.id('u.lindiwe');
  v_at        timestamptz := ((p_start - 1) + time '10:30') at time zone 'Africa/Johannesburg';
begin
  select learner_id into v_learner from public.enrolments where id = v_enrolment;

  insert into public.aptitude_attempts
    (learner_id, enrolment_id, bank_version, status, current_difficulty, started_at, completed_at,
     final_band, level_label, literacy_pct, logic_pct, low_confidence)
  select v_learner, v_enrolment, b.version, 'completed', 3,
         ((p_start - 1) + time '09:00') at time zone 'Africa/Johannesburg',
         ((p_start - 1) + time '09:20') at time zone 'Africa/Johannesburg',
         3, 'Developing', 58, 62, false
    from public.aptitude_banks b where b.is_current;

  perform uat_seed.act_as('u.lindiwe');

  select guardian_id into v_guardian from public.learner_guardians where learner_id = v_learner and is_billing_contact;
  select id into v_account from public.billing_accounts where guardian_id = v_guardian;
  if v_account is null then
    insert into public.billing_accounts (guardian_id) values (v_guardian) returning id into v_account;
  end if;

  insert into public.invoices (billing_account_id, invoice_number, issued_on, due_on, status, notes)
  values (v_account, private.next_invoice_number(p_start), p_start, p_start, 'issued', 'Registration fee')
  returning id into v_invoice;
  insert into public.invoice_lines (invoice_id, line_type, description, package_code, learner_id, unit_amount_cents)
  values (v_invoice, 'registration', 'Registration fee', 'registration', v_learner,
          coalesce(public.package_price_on('registration', p_start), 0));

  update public.enrolments
     set status = 'accepted', accepted_at = v_at, accepted_by = v_admin, offer_invoice_id = v_invoice
   where id = v_enrolment;
  update public.enrolments
     set status = 'active', assigned_tutor_id = uat_seed.id(p_tutor), start_date = p_start, activated_at = v_at,
         first_month_amount_cents = p_first_cents,
         first_month_set_by = case when p_first_cents is not null then v_admin end,
         first_month_reason = p_reason
   where id = v_enrolment;
  update public.learners set status = 'active', joined_on = p_start where id = v_learner and status = 'prospective';
  return v_invoice;
end $fn$;

-- Admin records a payment on /admin/billing (record_payment).
create function uat_seed.pay(
  p_guardian text, p_rand integer, p_method text, p_ref text, p_on date
) returns uuid
language plpgsql as $fn$
declare v_payment uuid; v_account uuid;
begin
  select id into v_account from public.billing_accounts where guardian_id = uat_seed.id(p_guardian);
  perform uat_seed.act_as('u.lindiwe');
  v_payment := public.record_payment(v_account, p_rand * 100, p_method, p_ref, p_on);
  update public.payments set created_at = (p_on + time '11:00') at time zone 'Africa/Johannesburg'
   where id = v_payment;
  return v_payment;
end $fn$;

-- Tutor records an assessment on /tutor/assessments (record_assessment).
create function uat_seed.assess(
  p_tutor text, p_learner text, p_type text, p_grade text, p_on date,
  p_scores jsonb, p_subject text default null, p_notes text default ''
) returns uuid
language plpgsql as $fn$
declare v_id uuid;
begin
  perform uat_seed.act_as(p_tutor);
  v_id := public.record_assessment(uat_seed.id('l.' || p_learner), p_type, p_grade, p_on,
                                   p_scores, p_subject, uat_seed.id('term.2026.4'), p_notes);
  update public.assessments set created_at = (p_on + time '16:45') at time zone 'Africa/Johannesburg'
   where id = v_id;
  return v_id;
end $fn$;

-- Build {domain, raw, max} score arrays without the JSON noise.
create function uat_seed.scores(variadic p text[]) returns jsonb
language plpgsql immutable as $fn$
declare v jsonb := '[]'; i integer := 1;
begin
  while i <= array_length(p, 1) loop
    v := v || jsonb_build_object('domain_code', p[i], 'raw_score', p[i + 1]::numeric,
                                 'max_score', p[i + 2]::numeric);
    i := i + 3;
  end loop;
  return v;
end $fn$;

-- Raise a programme booking invoice. The app has no RPC for this yet, so the
-- seed writes it directly; flagged in docs/UAT-TEST-DATA.md.
create function uat_seed.bill_programme(
  p_guardian text, p_booking uuid, p_on date, p_due date
) returns uuid
language plpgsql as $fn$
declare v_account uuid; v_invoice uuid; v_prog public.programmes; v_learner uuid;
begin
  select p.* into v_prog from public.programmes p
    join public.programme_enrolments pe on pe.programme_id = p.id where pe.id = p_booking;
  select learner_id into v_learner from public.programme_enrolments where id = p_booking;
  select id into v_account from public.billing_accounts where guardian_id = uat_seed.id(p_guardian);
  insert into public.invoices (billing_account_id, invoice_number, issued_on, due_on, status, notes)
  values (v_account, private.next_invoice_number(p_on), p_on, p_due, 'issued', v_prog.name)
  returning id into v_invoice;
  insert into public.invoice_lines (invoice_id, line_type, description, programme_enrolment_id,
                                    learner_id, unit_amount_cents)
  values (v_invoice, 'programme', v_prog.name, p_booking, v_learner, v_prog.price_cents);
  return v_invoice;
end $fn$;

-- 2. Accounts ----------------------------------------------------------------
-- Staff
select uat_seed.make_user('u.refilwe',  'Refilwe',  'Kgosana',        '0825550101', '2026-09-01 08:00+02');
select uat_seed.make_user('u.lindiwe',  'Lindiwe',  'Khumalo',        '0825550102', '2026-09-02 09:00+02');
-- Tutors
select uat_seed.make_user('u.kagiso',   'Kagiso',   'Mokgatle',       '0825550110', '2026-09-15 10:00+02');
select uat_seed.make_user('u.johan',    'Johan',    'van der Merwe',  '0825550111', '2026-09-15 10:05+02');
select uat_seed.make_user('u.boitumelo','Boitumelo','Seleke',         '0825550112', '2026-09-15 10:10+02');
select uat_seed.make_user('u.precious', 'Precious', 'Ndlovu',         '0825550113', '2026-09-16 10:00+02');
select uat_seed.make_user('u.thabiso',  'Thabiso',  'Mabena',         '0825550114', '2026-09-16 10:05+02');
select uat_seed.make_user('u.annelie',  'Annelie',  'Swanepoel',      '0825550115', '2026-09-16 10:10+02');
-- Parents (self sign-up)
select uat_seed.make_user('u.sipho',    'Sipho',    'Nkosi',          '0725550120', '2026-10-01 19:12+02');
select uat_seed.make_user('u.grace',    'Grace',    'Molefe',         '0735550121', '2026-09-28 20:41+02');
select uat_seed.make_user('u.marlene',  'Marlene',  'Botha',          '0825550122', '2026-10-03 07:55+02');
select uat_seed.make_user('u.pieter',   'Pieter',   'Botha',          '0825550123', '2026-10-04 18:20+02');
select uat_seed.make_user('u.nomsa',    'Nomsa',    'Dlamini',        '0615550124', '2026-10-06 13:02+02');
select uat_seed.make_user('u.dineo',    'Dineo',    'Mahlangu',       '0795550125', '2026-10-22 21:15+02');
select uat_seed.make_user('u.fatima',   'Fatima',   'Petersen',       '0845550126', '2026-10-05 12:30+02');
select uat_seed.make_user('u.lerato',   'Lerato',   'Mabaso',         '0715550127', '2026-10-07 17:48+02');
select uat_seed.make_user('u.busisiwe', 'Busisiwe', 'Zulu',           '0765550128', '2026-11-16 19:30+02');
select uat_seed.make_user('u.mandla',   'Mandla',   'Shabalala',      '0835550129', '2026-10-09 08:10+02');
select uat_seed.make_user('u.thuli',    'Thuli',    'Mthembu',        '0605550130', '2026-11-18 20:05+02');
-- Learner login (Grade 11)
select uat_seed.make_user('u.neo',      'Neo',      'Molefe',         '0735550140', '2026-10-20 16:00+02');

-- Superadmin: the one role the app can never grant (see db/scripts/create-superadmin.sql).
insert into public.user_roles (user_id, role) values (uat_seed.id('u.refilwe'), 'superadmin');
delete from public.user_roles where user_id = uat_seed.id('u.refilwe') and role = 'parent';
delete from public.guardians  where profile_id = uat_seed.id('u.refilwe');

-- Superadmin creates the administrator (/admin/users, role Admin).
select uat_seed.act_as('u.refilwe');
select public.configure_invited_user(uat_seed.id('u.lindiwe'), 'Lindiwe', 'Khumalo', 'admin');

-- Administrator invites the tutors and the learner login (/admin/users).
select uat_seed.act_as('u.lindiwe');
select public.configure_invited_user(uat_seed.id('u.kagiso'),    'Kagiso',    'Mokgatle',      'tutor');
select public.configure_invited_user(uat_seed.id('u.johan'),     'Johan',     'van der Merwe', 'tutor');
select public.configure_invited_user(uat_seed.id('u.boitumelo'), 'Boitumelo', 'Seleke',        'tutor');
select public.configure_invited_user(uat_seed.id('u.precious'),  'Precious',  'Ndlovu',        'tutor');
select public.configure_invited_user(uat_seed.id('u.thabiso'),   'Thabiso',   'Mabena',        'tutor');
select public.configure_invited_user(uat_seed.id('u.annelie'),   'Annelie',   'Swanepoel',     'tutor');
select public.configure_invited_user(uat_seed.id('u.neo'),       'Neo',       'Molefe',        'learner');

-- Boitumelo is a tutor AND a parent at the centre (multi-role account).
insert into public.user_roles (user_id, role) values (uat_seed.id('u.boitumelo'), 'parent');
insert into public.guardians  (profile_id, physical_address, preferred_contact)
values (uat_seed.id('u.boitumelo'), '14 Mosetlha Street, Damonsville', 'whatsapp');

-- Guardian contact details (parent profile page).
update public.guardians g set physical_address = v.addr, preferred_contact = v.pref
from (values
  ('u.sipho',   '23 Lekgotla Street, Damonsville, 0251', 'whatsapp'),
  ('u.grace',   '7 Kgosi Avenue, Damonsville, 0251',     'email'),
  ('u.marlene', '41 Van Velden Street, Brits, 0250',     'email'),
  ('u.pieter',  '41 Van Velden Street, Brits, 0250',     'phone'),
  ('u.nomsa',   '112 Extension 2, Damonsville, 0251',    'sms'),
  ('u.dineo',   '9 Molopo Crescent, Oskraal, 0251',      'whatsapp'),
  ('u.fatima',  '3 Rose Street, Elandsrand, Brits, 0250','whatsapp'),
  ('u.lerato',  '58 Thabo Street, Damonsville, 0251',    'whatsapp'),
  ('u.busisiwe','201 Zone 1, Damonsville, 0251',         'whatsapp'),
  ('u.mandla',  '77 Extension 4, Damonsville, 0251',     'phone'),
  ('u.thuli',   '',                                      'whatsapp')
) as v(k, addr, pref)
where g.profile_id = uat_seed.id(v.k);

-- 3. Tutors ------------------------------------------------------------------
insert into uat_seed.ref (key, id)
select 't.' || split_part(r.key, '.', 2), t.id
from uat_seed.ref r join public.tutors t on t.profile_id = r.id
where r.key in ('u.kagiso','u.johan','u.boitumelo','u.precious','u.thabiso','u.annelie');

update public.tutors t set
  headline = v.headline, bio = v.bio, employment_type = v.emp, started_on = date '2026-10-01',
  status = v.status
from (values
  ('t.kagiso', 'Foundation Phase reading specialist', 'salaried',
   'B.Ed Foundation Phase (NWU). Five years teaching Grade 1-3 in Brits. Patient phonics-first approach; teaches in English and Setswana.', 'active'),
  ('t.johan', 'Maths & Physical Sciences, Grade 7-12', 'sessional',
   'Retired Hoërskool Brits HOD. Twenty years of matric Maths and Physical Sciences in English and Afrikaans. Past-paper drilling and exam technique.', 'active'),
  ('t.boitumelo', 'English & Setswana, Grade 4-9', 'sessional',
   'BA Languages, PGCE (Unisa). Builds reading confidence and comprehension; parent of a Skolopals learner.', 'active'),
  ('t.precious', 'Intermediate Phase Maths & Natural Sciences', 'sessional',
   'Final-year B.Ed student. Makes fractions and number sense hands-on with manipulatives.', 'active'),
  ('t.thabiso', 'Accounting, Business Studies & Economics', 'sessional',
   'BCom Accounting (UJ). Bookkeeper by day; helps FET learners make sense of journals and ledgers.', 'active'),
  ('t.annelie', 'Afrikaans FAL, Grade 4-9', 'sessional',
   'Afrikaans first additional language. Currently suspended pending vetting.', 'suspended')
) as v(k, headline, emp, bio, status)
where t.id = uat_seed.id(v.k);

-- Annelie is also deactivated in auth (the API does this with a long ban).
update auth.users set banned_until = now() + interval '876000 hours'
 where id = uat_seed.id('u.annelie');

-- What each tutor teaches (/admin/tutors/[id] -> set_tutor_competency).
select uat_seed.act_as('u.lindiwe');
select public.set_tutor_competency(uat_seed.id(c.tutor), c.subject, g.code, c.langs)
from (values
  ('t.kagiso',    'reading',               0,  3, array['english','setswana']),
  ('t.kagiso',    'writing',               0,  3, array['english','setswana']),
  ('t.kagiso',    'english',               0,  3, array['english']),
  ('t.kagiso',    'mathematics',           0,  3, array['english','setswana']),
  ('t.kagiso',    'life_skills',           0,  3, array['english','setswana']),
  ('t.johan',     'mathematics',           7, 12, array['english','afrikaans']),
  ('t.johan',     'physical_sciences',    10, 12, array['english','afrikaans']),
  ('t.johan',     'natural_sciences',      7,  9, array['english']),
  ('t.boitumelo', 'english',               4,  9, array['english']),
  ('t.boitumelo', 'setswana',              4,  9, array['setswana']),
  ('t.boitumelo', 'social_sciences',       4,  6, array['english','setswana']),
  ('t.precious',  'mathematics',           4,  7, array['english']),
  ('t.precious',  'natural_sciences',      4,  7, array['english']),
  ('t.precious',  'english',               7,  7, array['english']),
  ('t.thabiso',   'accounting',           10, 12, array['english']),
  ('t.thabiso',   'business_studies',     10, 12, array['english']),
  ('t.thabiso',   'economics',            10, 12, array['english']),
  ('t.thabiso',   'mathematical_literacy',10, 12, array['english']),
  ('t.annelie',   'afrikaans',             4,  9, array['afrikaans'])
) as c(tutor, subject, g_from, g_to, langs)
join public.grades g on g.sort_order between c.g_from and c.g_to;

insert into public.tutor_spoken_languages (tutor_id, language_code)
select uat_seed.id(v.t), v.lang
from (values
  ('t.kagiso','english'),('t.kagiso','setswana'),('t.kagiso','sesotho'),
  ('t.johan','english'),('t.johan','afrikaans'),
  ('t.boitumelo','english'),('t.boitumelo','setswana'),('t.boitumelo','isizulu'),
  ('t.precious','english'),('t.precious','isizulu'),
  ('t.thabiso','english'),('t.thabiso','setswana'),
  ('t.annelie','afrikaans'),('t.annelie','english')
) as v(t, lang);

-- Pay (set_tutor_pay_rate). Precious' November increase closes her October rate.
select public.set_tutor_pay_rate(uat_seed.id('t.kagiso'),    'monthly_salary', 650000, '2026-10-01');
select public.set_tutor_pay_rate(uat_seed.id('t.johan'),     'per_hour',        18000, '2026-10-01');
select public.set_tutor_pay_rate(uat_seed.id('t.boitumelo'), 'per_hour',        13000, '2026-10-01');
select public.set_tutor_pay_rate(uat_seed.id('t.precious'),  'per_hour',        11000, '2026-10-01');
select public.set_tutor_pay_rate(uat_seed.id('t.precious'),  'per_hour',        12500, '2026-11-01');
select public.set_tutor_pay_rate(uat_seed.id('t.thabiso'),   'per_hour',        16000, '2026-10-01');
select public.set_tutor_pay_rate(uat_seed.id('t.annelie'),   'per_hour',        13000, '2026-10-01');

-- Vetting (BP section 13).
insert into public.tutor_qualifications (tutor_id, qualification_type, title, institution, year_awarded, verified_at, verified_by)
select uat_seed.id(v.t), v.qtype, v.title, v.inst, v.yr,
       case when v.verified then timestamptz '2026-09-25 10:00+02' end,
       case when v.verified then uat_seed.id('u.lindiwe') end
from (values
  ('t.kagiso',    'degree',      'B.Ed Foundation Phase Teaching',            'North-West University', 2019, true),
  ('t.johan',     'degree',      'B.Sc Ed (Mathematics and Physical Science)','University of Pretoria',2004, true),
  ('t.boitumelo', 'degree',      'BA Languages',                              'Unisa',                 2014, true),
  ('t.boitumelo', 'certificate', 'PGCE Senior and FET Phase',                 'Unisa',                 2016, true),
  ('t.precious',  'other',       'B.Ed Intermediate Phase (final year)',      'Tshwane University of Technology', null, false),
  ('t.thabiso',   'degree',      'BCom Accounting',                           'University of Johannesburg', 2018, true),
  ('t.annelie',   'diploma',     'Diploma in Education',                      'Unknown - not yet supplied', null, false)
) as v(t, qtype, title, inst, yr, verified);

insert into public.tutor_references (tutor_id, full_name, relationship, phone, email, checked_at, checked_by, outcome)
select uat_seed.id(v.t), v.name, v.rel, v.phone, v.email,
       case when v.outcome is not null then timestamptz '2026-09-26 14:00+02' end,
       case when v.outcome is not null then uat_seed.id('u.lindiwe') end,
       v.outcome
from (values
  ('t.kagiso',    'Mrs D. Mothibi',    'Former principal, Damonsville Primary', '0125550200', '', 'positive'),
  ('t.johan',     'Mr H. Pretorius',   'Former principal, Hoërskool Brits',     '0125550201', '', 'positive'),
  ('t.boitumelo', 'Ms K. Letsholo',    'HOD Languages',                         '0125550202', '', 'positive'),
  ('t.precious',  'Dr S. Mokoena',     'TUT lecturer',                          '0125550203', 'smokoena@example.org', null),
  ('t.thabiso',   'Mr P. Naidoo',      'Employer, Naidoo & Co Bookkeepers',     '0125550204', '', 'positive'),
  ('t.annelie',   'Mrs E. du Plessis', 'Previous employer',                     '0125550205', '', 'unreachable')
) as v(t, name, rel, phone, email, outcome);

-- 4. Terms and rooms ---------------------------------------------------------
-- 2026 dates are the public-school calendar; verify against the gazette before
-- relying on them. 2027 matches db/scripts/load-terms-2027.sql.
insert into public.terms (year, term_number, starts_on, ends_on) values
  (2026, 1, '2026-01-14', '2026-03-27'),
  (2026, 2, '2026-04-08', '2026-06-26'),
  (2026, 3, '2026-07-21', '2026-10-02'),
  (2026, 4, '2026-10-13', '2026-12-09'),
  (2027, 1, '2027-01-13', '2027-03-19'),
  (2027, 2, '2027-04-06', '2027-06-25'),
  (2027, 3, '2027-07-20', '2027-09-22'),
  (2027, 4, '2027-10-05', '2027-12-08');

insert into uat_seed.ref (key, id)
select 'term.' || year || '.' || term_number, id from public.terms;

insert into public.rooms (name, capacity) values
  ('Room A (Foundation & Intermediate)', 8),
  ('Room B (Senior)',                   10),
  ('Study Hall',                        16);
insert into public.rooms (name, capacity, is_active) values ('Old storeroom', 4, false);

insert into uat_seed.ref (key, id)
select case name when 'Room A (Foundation & Intermediate)' then 'room.a'
                 when 'Room B (Senior)' then 'room.b'
                 when 'Study Hall' then 'room.hall'
                 else 'room.old' end, id
from public.rooms;

-- 5. Enrolments (submitted by parents on /enrol) -------------------------------
select uat_seed.enrol('u.sipho', 'ayanda',
  '{"full_name":"Ayanda Nkosi","date_of_birth":"2015-06-11","grade_code":"grade_5","school_name":"Damonsville Primary School","home_language_code":"isizulu","relationship":"Father"}',
  'group_1', '[{"subject_code":"mathematics","preferred_language_code":"english"}]',
  '[{"full_name":"Zodwa Nkosi","relationship":"Mother","phone":"0725550150","priority":1},{"full_name":"Bongani Nkosi","relationship":"Uncle","phone":"0725550151","priority":2}]',
  '[{"full_name":"Zodwa Nkosi","relationship":"Mother","phone":"0725550150","id_number_last4":"0817"}]',
  true, 't.precious', '2026-10-01 19:40+02');

select uat_seed.enrol('u.sipho', 'lwazi',
  '{"full_name":"Lwazi Nkosi","date_of_birth":"2017-09-02","grade_code":"grade_3","school_name":"Damonsville Primary School","home_language_code":"isizulu","relationship":"Father"}',
  'group_1', '[{"subject_code":"reading","preferred_language_code":"english"}]',
  '[{"full_name":"Zodwa Nkosi","relationship":"Mother","phone":"0725550150","priority":1}]',
  '[{"full_name":"Zodwa Nkosi","relationship":"Mother","phone":"0725550150","id_number_last4":"0817"},{"full_name":"Gogo Thembi Nkosi","relationship":"Grandmother","phone":"0725550152","id_number_last4":"3391"}]',
  true, 't.kagiso', '2026-10-01 19:55+02');

select uat_seed.enrol('u.grace', 'neo',
  '{"full_name":"Neo Molefe","date_of_birth":"2009-03-27","grade_code":"grade_11","school_name":"Brits High School","home_language_code":"setswana","relationship":"Mother"}',
  'group_3', '[{"subject_code":"mathematics","preferred_language_code":"english"},{"subject_code":"physical_sciences","preferred_language_code":"english"},{"subject_code":"accounting","preferred_language_code":"english"}]',
  '[{"full_name":"Grace Molefe","relationship":"Mother","phone":"0735550121","priority":1},{"full_name":"Tebogo Molefe","relationship":"Father","phone":"0735550153","priority":2}]',
  '[]', true, 't.johan', '2026-09-28 21:02+02');

select uat_seed.enrol('u.grace', 'kamo',
  '{"full_name":"Kamogelo Molefe","date_of_birth":"2012-11-19","grade_code":"grade_8","school_name":"Brits High School","home_language_code":"setswana","relationship":"Mother"}',
  'group_2', '[{"subject_code":"mathematics","preferred_language_code":"english"},{"subject_code":"english","preferred_language_code":"english"}]',
  '[{"full_name":"Grace Molefe","relationship":"Mother","phone":"0735550121","priority":1}]',
  '[{"full_name":"Tebogo Molefe","relationship":"Father","phone":"0735550153","id_number_last4":"5502"}]',
  true, null, '2026-09-28 21:15+02');

select uat_seed.enrol('u.marlene', 'ruan',
  '{"full_name":"Ruan Botha","date_of_birth":"2010-07-14","grade_code":"grade_10","school_name":"Hoërskool Brits","home_language_code":"afrikaans","relationship":"Mother"}',
  'group_2', '[{"subject_code":"mathematics","preferred_language_code":"afrikaans"},{"subject_code":"physical_sciences","preferred_language_code":"afrikaans"}]',
  '[{"full_name":"Marlene Botha","relationship":"Mother","phone":"0825550122","priority":1},{"full_name":"Pieter Botha","relationship":"Father","phone":"0825550123","priority":2}]',
  '[{"full_name":"Pieter Botha","relationship":"Father","phone":"0825550123","id_number_last4":"7710"}]',
  false, 't.johan', '2026-10-03 08:20+02');

select uat_seed.enrol('u.nomsa', 'zanele',
  '{"full_name":"Zanele Dlamini","date_of_birth":"2018-04-23","grade_code":"grade_2","school_name":"Mmakau Primary School","home_language_code":"isizulu","relationship":"Mother"}',
  'homework', '[]',
  '[{"full_name":"Nomsa Dlamini","relationship":"Mother","phone":"0615550124","priority":1},{"full_name":"Sizwe Dlamini","relationship":"Brother","phone":"0615550154","priority":2}]',
  '[{"full_name":"Sizwe Dlamini","relationship":"Brother (19)","phone":"0615550154","id_number_last4":"2286"},{"full_name":"Thandeka Mahlaba","relationship":"Neighbour","phone":"0615550155","id_number_last4":"9043"}]',
  false, null, '2026-10-06 13:20+02');

select uat_seed.enrol('u.fatima', 'owen',
  '{"full_name":"Owen Petersen","date_of_birth":"2012-02-08","grade_code":"grade_8","school_name":"Brits High School","home_language_code":"english","relationship":"Mother"}',
  'group_1', '[{"subject_code":"mathematics","preferred_language_code":"english"}]',
  '[{"full_name":"Fatima Petersen","relationship":"Mother","phone":"0845550126","priority":1}]',
  '[]', false, null, '2026-10-05 12:45+02');

select uat_seed.enrol('u.boitumelo', 'lesedi',
  '{"full_name":"Lesedi Seleke","date_of_birth":"2016-08-30","grade_code":"grade_4","school_name":"Damonsville Primary School","home_language_code":"setswana","relationship":"Mother"}',
  'group_1', '[{"subject_code":"mathematics","preferred_language_code":"english"}]',
  '[{"full_name":"Boitumelo Seleke","relationship":"Mother","phone":"0825550112","priority":1}]',
  '[{"full_name":"Kabelo Seleke","relationship":"Father","phone":"0825550156","id_number_last4":"6620"}]',
  true, 't.precious', '2026-10-02 18:00+02');

select uat_seed.enrol('u.lerato', 'karabo',
  '{"full_name":"Karabo Mabaso","date_of_birth":"2011-05-05","grade_code":"grade_9","school_name":"Bapong High School","home_language_code":"setswana","relationship":"Mother"}',
  'one_on_one_4', '[{"subject_code":"mathematics","preferred_language_code":"english"}]',
  '[{"full_name":"Lerato Mabaso","relationship":"Mother","phone":"0715550127","priority":1}]',
  '[]', false, 't.johan', '2026-10-07 18:05+02');

select uat_seed.enrol('u.dineo', 'tshepo',
  '{"full_name":"Tshepo Mahlangu","date_of_birth":"2008-01-16","grade_code":"grade_12","school_name":"Brits High School","home_language_code":"sesotho","relationship":"Mother"}',
  'academic_plus', '[{"subject_code":"mathematics","preferred_language_code":"english"},{"subject_code":"physical_sciences","preferred_language_code":"english"},{"subject_code":"accounting","preferred_language_code":"english"}]',
  '[{"full_name":"Dineo Mahlangu","relationship":"Mother","phone":"0795550125","priority":1}]',
  '[]', true, 't.johan', '2026-10-22 21:30+02');

-- Still in the admin queue on 2026-11-20 (approve it during testing).
select uat_seed.enrol('u.busisiwe', 'sanele',
  '{"full_name":"Sanele Zulu","date_of_birth":"2014-10-03","grade_code":"grade_6","school_name":"Damonsville Primary School","home_language_code":"isizulu","relationship":"Mother"}',
  'group_2', '[{"subject_code":"mathematics","preferred_language_code":"english"},{"subject_code":"natural_sciences","preferred_language_code":"english"}]',
  '[{"full_name":"Busisiwe Zulu","relationship":"Mother","phone":"0765550128","priority":1},{"full_name":"Mthunzi Zulu","relationship":"Father","phone":"0765550157","priority":2}]',
  '[{"full_name":"Mthunzi Zulu","relationship":"Father","phone":"0765550157","id_number_last4":"1148"}]',
  false, 't.precious', '2026-11-17 19:45+02');

-- Declined by the centre (no English Grade 7 group yet).
select uat_seed.enrol('u.mandla', 'sibusiso',
  '{"full_name":"Sibusiso Shabalala","date_of_birth":"2013-12-12","grade_code":"grade_7","school_name":"Damonsville Primary School","home_language_code":"isizulu","relationship":"Father"}',
  'group_1', '[{"subject_code":"english","preferred_language_code":"english"}]',
  '[{"full_name":"Mandla Shabalala","relationship":"Father","phone":"0835550129","priority":1}]',
  '[]', false, null, '2026-10-09 08:30+02');
update public.enrolments
   set status = 'declined', decline_reason = 'No class available for this grade/subject',
       declined_at = '2026-10-12 11:00+02'
 where id = uat_seed.id('e.sibusiso');

-- Pieter Botha: second guardian on Ruan, neither primary nor billing contact.
insert into public.learner_guardians (learner_id, guardian_id, relationship, is_primary, is_billing_contact)
values (uat_seed.id('l.ruan'), uat_seed.id('u.pieter'), 'Father', false, false);

-- Neo's own login (role learner) is linked to Neo's learner record.
update public.learners set profile_id = uat_seed.id('u.neo') where id = uat_seed.id('l.neo');

-- Special personal information (admin-only; tutors must never see it).
insert into public.learner_medical_notes (learner_id, allergies, conditions, medication, accommodations, updated_by, updated_at)
select uat_seed.id('l.' || v.l), v.allergies, v.conditions, v.medication, v.acc, uat_seed.id('u.lindiwe'),
       timestamptz '2026-10-12 11:00+02'
from (values
  ('lwazi',  '',                       'Mild asthma',            'Asthma pump (blue) in school bag', 'Allow pump use without asking'),
  ('zanele', 'Peanuts (severe)',       '',                       'EpiPen kept at reception',         'No nut snacks in Room A'),
  ('ayanda', '',                       'Short-sighted',          '',                                 'Sit near the whiteboard'),
  ('karabo', '',                       'Dyslexia (assessed 2024)','',                                'Extra time; larger print worksheets')
) as v(l, allergies, conditions, medication, acc);

-- Michael Jacobs: a legacy learner who left in 2021, now past the 5-year
-- retention period - appears in v_retention_due (TC-SEC-05).
insert into public.learners (full_name, date_of_birth, grade_code, school_name, home_language_code,
                             status, joined_on, left_on, created_at)
values ('Michael Jacobs', '2006-08-19', 'grade_9', 'Brits High School', 'english',
        'left', '2020-02-03', '2021-09-30', '2020-02-03 09:00+02')
returning uat_seed.put('l.michael', id);

-- 6. Classes for 2026 Term 4 (/admin/timetable) ------------------------------
create table uat_seed.class_def (
  key text primary key, name text, subject text, lang text, tutor text, mode text,
  room text, capacity smallint, grades text[], days smallint[], t_from time, t_to time
);
insert into uat_seed.class_def values
  ('c.reading',  'Foundation Reading Gr 1-3 (English)',      'reading',           'english',   't.kagiso',    'in_centre', 'room.a',    6, '{grade_1,grade_2,grade_3}',    '{1,3}', '14:00', '15:00'),
  ('c.maths46',  'Intermediate Maths Gr 4-6 (English)',      'mathematics',       'english',   't.precious',  'in_centre', 'room.a',    4, '{grade_4,grade_5,grade_6}',    '{2,4}', '14:00', '15:00'),
  ('c.maths89',  'Senior Maths Gr 8-9 (English)',            'mathematics',       'english',   't.johan',     'in_centre', 'room.b',    8, '{grade_8,grade_9}',            '{1,3}', '15:30', '16:30'),
  ('c.eng79',    'Senior English Gr 7-9 (English)',          'english',           'english',   't.boitumelo', 'in_centre', 'room.b',    8, '{grade_7,grade_8,grade_9}',    '{2,4}', '15:30', '16:30'),
  ('c.wisk10',   'Gr 10 Wiskunde (Afrikaans)',               'mathematics',       'afrikaans', 't.johan',     'in_centre', 'room.b',    6, '{grade_10}',                   '{1}',   '16:45', '17:45'),
  ('c.fisies10', 'Gr 10 Fisiese Wetenskappe (Afrikaans, online)', 'physical_sciences', 'afrikaans', 't.johan', 'online', null,      6, '{grade_10}',                   '{3}',   '18:30', '19:30'),
  ('c.acc',      'FET Accounting Gr 11-12 (English)',        'accounting',        'english',   't.thabiso',   'in_centre', 'room.b',   10, '{grade_11,grade_12}',          '{4}',   '16:45', '17:45'),
  ('c.fetmaths', 'FET Mathematics Gr 10-12 (English)',       'mathematics',       'english',   't.johan',     'in_centre', 'room.hall',12, '{grade_10,grade_11,grade_12}', '{6}',   '08:30', '10:30'),
  ('c.fetphys',  'FET Physical Sciences Gr 10-12 (English)', 'physical_sciences', 'english',   't.johan',     'in_centre', 'room.hall',12, '{grade_10,grade_11,grade_12}', '{6}',   '10:45', '12:15'),
  ('c.karabo',   'One-on-one Maths - Karabo M. (Gr 9)',      'mathematics',       'english',   't.johan',     'in_centre', 'room.hall', 1, '{grade_9}',                    '{3}',   '17:00', '18:00');

do $$
declare c uat_seed.class_def; v_id uuid; d smallint; g text;
begin
  for c in select * from uat_seed.class_def loop
    insert into public.class_groups (name, subject_code, language_code, tutor_id, term_id,
                                     delivery_mode, room_id, capacity, created_at)
    values (c.name, c.subject, c.lang, uat_seed.id(c.tutor), uat_seed.id('term.2026.4'), c.mode,
            case when c.room is null then null else uat_seed.id(c.room) end, c.capacity,
            timestamptz '2026-10-08 10:00+02')
    returning id into v_id;
    perform uat_seed.put(c.key, v_id);
    foreach g in array c.grades loop
      insert into public.class_group_grades (class_group_id, grade_code) values (v_id, g);
    end loop;
    foreach d in array c.days loop
      insert into public.class_schedules (class_group_id, day_of_week, starts_at_time, ends_at_time)
      values (v_id, d, c.t_from, c.t_to);
    end loop;
  end loop;
end $$;

-- Prove competency triggers now, not at commit, so a mistake names its class.
set constraints all immediate;
set constraints all deferred;

select uat_seed.act_as('u.lindiwe');
select key, public.generate_class_sessions(uat_seed.id(key)) as sessions
from uat_seed.class_def order by key;

-- 7. October: approvals, registration invoices, placements -------------------
-- Each approval raises its registration invoice in order, so numbers
-- SKP-2026-0001.. follow the real sequence of events.
select uat_seed.activate('ayanda', 't.precious', '2026-10-13');
select uat_seed.activate('lwazi',  't.kagiso',   '2026-10-13');
select uat_seed.activate('neo',    't.johan',    '2026-10-13');
select uat_seed.activate('kamo',   't.johan',    '2026-10-13');
select uat_seed.activate('ruan',   't.johan',    '2026-10-13');
select uat_seed.activate('zanele', 't.kagiso',   '2026-10-13');
select uat_seed.activate('owen',   't.johan',    '2026-10-13');
select uat_seed.activate('lesedi', 't.precious', '2026-10-13');
select uat_seed.activate('karabo', 't.johan',    '2026-10-14');

-- One-on-one blocks are not billed by the monthly run; the admin invoices the
-- first block of four by hand (seeded directly).
do $$
declare v_account uuid; v_invoice uuid;
begin
  select id into v_account from public.billing_accounts where guardian_id = uat_seed.id('u.lerato');
  insert into public.invoices (billing_account_id, invoice_number, issued_on, due_on, status, notes)
  values (v_account, private.next_invoice_number('2026-10-14'), '2026-10-14', '2026-10-14', 'issued',
          'One-on-one block 1 of 4 lessons')
  returning id into v_invoice;
  insert into public.invoice_lines (invoice_id, line_type, description, enrolment_id, package_code,
                                    learner_id, period_month, unit_amount_cents)
  values (v_invoice, 'package', 'One-on-one Maths - block of 4 lessons (Oct-Nov)',
          uat_seed.id('e.karabo'), 'one_on_one_4', uat_seed.id('l.karabo'), '2026-10-01', 65000);
end $$;

-- Placements into classes.
insert into public.class_enrolments (class_group_id, learner_id, enrolment_id, joined_on)
select uat_seed.id(v.c), uat_seed.id('l.' || v.l), uat_seed.id('e.' || v.l), v.d::date
from (values
  ('c.maths46',  'ayanda', '2026-10-13'),
  ('c.maths46',  'lesedi', '2026-10-13'),
  ('c.reading',  'lwazi',  '2026-10-13'),
  ('c.reading',  'zanele', '2026-10-13'),
  ('c.fetmaths', 'neo',    '2026-10-13'),
  ('c.fetphys',  'neo',    '2026-10-13'),
  ('c.acc',      'neo',    '2026-10-13'),
  ('c.maths89',  'kamo',   '2026-10-13'),
  ('c.eng79',    'kamo',   '2026-10-13'),
  ('c.maths89',  'owen',   '2026-10-13'),
  ('c.wisk10',   'ruan',   '2026-10-13'),
  ('c.fisies10', 'ruan',   '2026-10-13'),
  ('c.karabo',   'karabo', '2026-10-14')
) as v(c, l, d);

-- Registration payments.
select uat_seed.pay('u.sipho',     300, 'cash',         'Cash receipt 0001',      '2026-10-13');
select uat_seed.pay('u.grace',     300, 'eft',          'MOLEFE REG',             '2026-10-13');
select uat_seed.pay('u.nomsa',     150, 'cash',         'Cash receipt 0002',      '2026-10-13');
select uat_seed.pay('u.fatima',    150, 'card_offline', 'Speedpoint 448120',      '2026-10-13');
select uat_seed.pay('u.marlene',   150, 'eft',          'BOTHA RUAN REG',         '2026-10-14');
select uat_seed.pay('u.lerato',    800, 'eft',          'MABASO KARABO',          '2026-10-14');
select uat_seed.pay('u.boitumelo', 150, 'eft',          'SELEKE LESEDI',          '2026-10-16');

-- 15 October: the run for November (catches up October for the 13 Oct starters).
select uat_seed.act_as('u.lindiwe');
select * from public.run_monthly_invoices('2026-11-01');

-- Tshepo joins late; the admin charges R600 for the part month.
select uat_seed.activate('tshepo', 't.johan', '2026-10-26', 60000, 'Joined 26 October - part month');
insert into public.class_enrolments (class_group_id, learner_id, enrolment_id, joined_on)
select uat_seed.id(c), uat_seed.id('l.tshepo'), uat_seed.id('e.tshepo'), '2026-10-26'
from unnest(array['c.fetmaths','c.fetphys','c.acc']) c;

-- 8. Programmes --------------------------------------------------------------
insert into public.programmes (name, description, programme_type, starts_on, ends_on, capacity,
                               price_cents, delivery_mode, room_id, is_published, created_at)
values
  ('Matric Maths Crash Course (online)', 'Four Sunday afternoon sessions on Paper 1 and Paper 2 before the November finals.',
   'exam_prep', '2026-11-01', '2026-11-22', 15, 35000, 'online', null, true, '2026-10-19 09:00+02'),
  ('December Holiday Revision - Gr 10-12 Maths & Science', 'Five mornings of revision and Term 1 head-start, 09:00-12:00, at the centre.',
   'holiday', '2026-12-14', '2026-12-18', 12, 75000, 'in_centre', uat_seed.id('room.hall'), true, '2026-11-16 08:30+02'),
  ('Grade 7 Bridging Camp', 'Draft - not yet published. Prepares Grade 7s for high school.',
   'holiday', '2027-01-04', '2027-01-08', 16, 50000, 'in_centre', uat_seed.id('room.a'), false, '2026-11-19 15:00+02');

insert into uat_seed.ref (key, id)
select case programme_type when 'exam_prep' then 'p.crash' else
       case when is_published then 'p.december' else 'p.bridging' end end, id
from public.programmes;

insert into public.programme_sessions (programme_id, session_date, starts_at, ends_at, tutor_id, status, meeting_url)
select uat_seed.id('p.crash'), d::date,
       (d::date + time '14:00') at time zone 'Africa/Johannesburg',
       (d::date + time '16:00') at time zone 'Africa/Johannesburg',
       uat_seed.id('t.johan'),
       case when d::date < date '2026-11-20' then 'held' else 'scheduled' end,
       'https://meet.google.com/uat-skp-crash-' || to_char(d, 'MMDD')
from generate_series(date '2026-11-01', date '2026-11-22', interval '7 days') d;

insert into public.programme_sessions (programme_id, session_date, starts_at, ends_at, tutor_id)
select uat_seed.id('p.december'), d::date,
       (d::date + time '09:00') at time zone 'Africa/Johannesburg',
       (d::date + time '12:00') at time zone 'Africa/Johannesburg',
       uat_seed.id('t.johan')
from generate_series(date '2026-12-14', date '2026-12-18', interval '1 day') d;

insert into public.programme_enrolments (programme_id, learner_id, booked_at)
values (uat_seed.id('p.crash'), uat_seed.id('l.tshepo'), '2026-10-26 12:00+02')
returning uat_seed.put('pe.tshepo.crash', id);
select uat_seed.bill_programme('u.dineo', uat_seed.id('pe.tshepo.crash'), '2026-10-26', '2026-11-01');

select uat_seed.pay('u.dineo',      500, 'eft', 'MAHLANGU T REG+CRASH', '2026-10-26');
select uat_seed.pay('u.grace',     3400, 'eft', 'MOLEFE NOV',           '2026-10-28');
select uat_seed.pay('u.sipho',     1800, 'eft', 'NKOSI NOV',            '2026-10-30');
select uat_seed.pay('u.fatima',     900, 'eft', 'PETERSEN O NOV',       '2026-10-31');
select uat_seed.pay('u.boitumelo',  900, 'other', 'Staff payroll deduction Oct', '2026-11-02');
select uat_seed.pay('u.marlene',   1500, 'eft', 'BOTHA NOV',            '2026-11-03');

-- 9. November: late fee, part payment, a learner leaves, the December run ------
-- Nomsa has not paid November (due 1 Nov); day 4 after the 3-day grace.
select uat_seed.act_as('u.lindiwe');
select public.apply_late_fees('2026-11-05') as late_fees_charged;

select uat_seed.pay('u.nomsa', 500, 'cash', 'Cash receipt 0007', '2026-11-12');

-- Owen leaves on 14 November; the family gets a credit for the unused half month.
update public.class_enrolments set left_on = '2026-11-14' where learner_id = uat_seed.id('l.owen');
update public.enrolments set status = 'ended', end_date = '2026-11-14' where id = uat_seed.id('e.owen');
update public.learners   set status = 'left', left_on = '2026-11-14' where id = uat_seed.id('l.owen');
insert into public.credit_notes (billing_account_id, issued_on, amount_cents, reason, issued_by)
select id, '2026-11-14', 22500, 'Owen left 14 November - credit for the unused half of November',
       uat_seed.id('u.lindiwe')
from public.billing_accounts where guardian_id = uat_seed.id('u.fatima');

-- 15 November: the run for December (catches up Tshepo's October and November).
select uat_seed.act_as('u.lindiwe');
select * from public.run_monthly_invoices('2026-12-01');

select uat_seed.pay('u.grace', 1700, 'eft', 'MOLEFE DEC', '2026-11-18');
select uat_seed.pay('u.dineo', 1000, 'eft', 'MAHLANGU DEC PART', '2026-11-18');

-- December holiday bookings (invoiced at booking, due before the programme).
insert into public.programme_enrolments (programme_id, learner_id, booked_at)
values (uat_seed.id('p.december'), uat_seed.id('l.neo'), '2026-11-18 20:10+02')
returning uat_seed.put('pe.neo.dec', id);
select uat_seed.bill_programme('u.grace', uat_seed.id('pe.neo.dec'), '2026-11-18', '2026-12-11');

insert into public.programme_enrolments (programme_id, learner_id, booked_at)
values (uat_seed.id('p.december'), uat_seed.id('l.ruan'), '2026-11-19 07:40+02')
returning uat_seed.put('pe.ruan.dec', id);
select uat_seed.bill_programme('u.marlene', uat_seed.id('pe.ruan.dec'), '2026-11-19', '2026-12-11');

-- Invoices are dated by their issue date, not by when this script ran.
update public.invoices set created_at = (issued_on + time '08:00') at time zone 'Africa/Johannesburg';
update public.billing_accounts ba set created_at = i.first_issue
from (select billing_account_id, (min(issued_on) + time '08:00') at time zone 'Africa/Johannesburg' as first_issue
      from public.invoices group by 1) i
where i.billing_account_id = ba.id;

-- 10. Sessions held, cancelled, substituted; attendance; sign-in/out --------
-- "Today" is 2026-11-20: everything before it has happened.
update public.class_sessions set status = 'held' where session_date < date '2026-11-20';

-- Load-shedding (stage 4) closed the centre on Wednesday 4 November.
update public.class_sessions cs
   set status = 'cancelled', notes = 'Load-shedding stage 4 - no power at the centre'
from public.class_groups cg
where cg.id = cs.class_group_id and cs.session_date = date '2026-11-04' and cg.delivery_mode <> 'online';

-- Boitumelo was off sick on 12 November; Precious covered (substitute).
update public.class_sessions
   set tutor_id = uat_seed.id('t.precious'), notes = 'Covered by Precious Ndlovu (Boitumelo sick)'
 where class_group_id = uat_seed.id('c.eng79') and session_date = date '2026-11-12';

-- Online sessions carry a per-session meeting link (never on the public timetable).
update public.class_sessions
   set meeting_url = 'https://meet.google.com/uat-skp-fisies-' || to_char(session_date, 'MMDD')
 where class_group_id = uat_seed.id('c.fisies10');

-- Attendance for every held session, for learners in the class that day.
-- Deterministic mix (~80% present); Zanele misses more often (arrears family).
insert into public.attendance_records (class_session_id, learner_id, status, marked_by, marked_at, note)
select cs.id, ce.learner_id,
       case
         when ce.learner_id = uat_seed.id('l.zanele') and h % 4 = 0 then 'absent'
         when h % 20 = 0 then 'absent'
         when h % 20 in (1, 2) then 'late'
         when h % 20 = 3 then 'excused'
         else 'present'
       end,
       t.profile_id, cs.ends_at,
       case when h % 20 = 3 then 'Parent sent a WhatsApp - school sports' else '' end
from public.class_sessions cs
join public.class_groups cg   on cg.id = cs.class_group_id
join public.class_enrolments ce on ce.class_group_id = cg.id
                               and ce.joined_on <= cs.session_date
                               and (ce.left_on is null or ce.left_on > cs.session_date)
join public.tutors t           on t.id = coalesce(cs.tutor_id, cg.tutor_id)
cross join lateral (select abs(hashtext(ce.learner_id::text || cs.id::text)::bigint) as h) x
where cs.status = 'held';

-- Foundation learners are signed in and collected (last two weeks).
insert into public.session_check_ins (class_session_id, learner_id, arrived_at, signed_in_by,
                                      departed_at, collected_by, signed_out_by)
select ar.class_session_id, ar.learner_id,
       cs.starts_at - interval '8 minutes', t.profile_id,
       cs.ends_at + interval '12 minutes',
       (select c.id from public.authorised_collectors c
         where c.learner_id = ar.learner_id order by c.full_name limit 1),
       t.profile_id
from public.attendance_records ar
join public.class_sessions cs on cs.id = ar.class_session_id
join public.class_groups cg   on cg.id = cs.class_group_id
join public.tutors t          on t.id = cg.tutor_id
where cg.id = uat_seed.id('c.reading')
  and ar.status in ('present', 'late')
  and cs.session_date >= date '2026-11-06';

-- Zanele's neighbour was only authorised until 31 October (expired collector).
update public.authorised_collectors set active_to = '2026-10-31'
 where learner_id = uat_seed.id('l.zanele') and full_name = 'Thandeka Mahlaba';

-- Programme attendance (crash course, held Sundays).
insert into public.programme_attendance_records (programme_session_id, learner_id, status, marked_by, marked_at)
select ps.id, uat_seed.id('l.tshepo'),
       case ps.session_date when date '2026-11-15' then 'late' else 'present' end,
       uat_seed.id('u.johan'), ps.ends_at
from public.programme_sessions ps
where ps.programme_id = uat_seed.id('p.crash') and ps.status = 'held';

-- 11. Assessments, learning plans, progress reports --------------------------
select uat_seed.assess('u.kagiso', 'lwazi', 'initial', 'grade_3', '2026-10-14',
  uat_seed.scores('reading','14','40', 'spelling','12','30', 'comprehension','9','30',
                  'writing','15','30', 'mathematics','20','30', 'language','16','30'),
  null, 'Guesses unfamiliar words from the first letter. Loves stories read aloud.');
select uat_seed.assess('u.kagiso', 'lwazi', 'monthly', 'grade_3', '2026-11-11',
  uat_seed.scores('reading','21','40', 'comprehension','14','30'), 'reading',
  'Decoding blends confidently now.');

select uat_seed.assess('u.kagiso', 'zanele', 'initial', 'grade_2', '2026-10-14',
  uat_seed.scores('reading','10','40', 'spelling','8','30', 'comprehension','12','30',
                  'writing','9','30', 'mathematics','18','30', 'language','14','30'),
  null, 'Letter-sound knowledge incomplete (b/d reversal). Strong oral vocabulary.');

select uat_seed.assess('u.precious', 'ayanda', 'initial', 'grade_5', '2026-10-15',
  uat_seed.scores('reading','30','40', 'spelling','22','30', 'comprehension','20','30',
                  'writing','19','30', 'mathematics','11','30', 'language','21','30'),
  null, 'Reads well; times tables not yet automatic; struggles with fractions.');
select uat_seed.assess('u.precious', 'ayanda', 'monthly', 'grade_5', '2026-11-12',
  uat_seed.scores('mathematics','17','30'), 'mathematics', 'Tables to 10 secure.');

select uat_seed.assess('u.precious', 'lesedi', 'initial', 'grade_4', '2026-10-15',
  uat_seed.scores('reading','28','40', 'spelling','20','30', 'comprehension','19','30',
                  'writing','18','30', 'mathematics','14','30', 'language','22','30'),
  null, 'Place value weak beyond hundreds.');

select uat_seed.assess('u.johan', 'kamo', 'initial', 'grade_8', '2026-10-14',
  uat_seed.scores('reading','35','50', 'spelling','38','50', 'comprehension','28','50',
                  'writing','27','50', 'mathematics','26','50', 'language','31','50'),
  null, 'Integers fine; algebraic manipulation shaky.');
select uat_seed.assess('u.johan', 'kamo', 'monthly', 'grade_8', '2026-11-11',
  uat_seed.scores('mathematics','33','50'), 'mathematics', 'Linear equations much better.');

-- Owen has left, so the tutor can no longer record for him; the admin back-fills
-- the paper assessment Johan did on 14 October.
update public.assessments set administered_by = uat_seed.id('t.johan')
 where id = uat_seed.assess('u.lindiwe', 'owen', 'initial', 'grade_8', '2026-10-14',
              uat_seed.scores('mathematics','30','50'), 'mathematics', 'Paper assessment captured by admin.');

select uat_seed.assess('u.johan', 'karabo', 'initial', 'grade_9', '2026-10-14',
  uat_seed.scores('mathematics','21','50', 'reading','24','50'), 'mathematics',
  'Dyslexic: read word problems aloud to him.');

select uat_seed.assess('u.johan', 'neo', 'initial', 'grade_11', '2026-10-17',
  uat_seed.scores('mathematics','58','100'), 'mathematics', 'Functions solid; trig identities weak.');
select uat_seed.assess('u.johan', 'neo', 'monthly', 'grade_11', '2026-11-14',
  uat_seed.scores('mathematics','67','100'), 'mathematics', 'Trig much improved.');

select uat_seed.assess('u.johan', 'ruan', 'initial', 'grade_10', '2026-10-19',
  uat_seed.scores('mathematics','44','100', 'comprehension','55','100'), 'physical_sciences',
  'Sterk in chemie, swak in meganika.');
select uat_seed.assess('u.johan', 'ruan', 'monthly', 'grade_10', '2026-11-16',
  uat_seed.scores('mathematics','52','100'), 'mathematics', '');

select uat_seed.assess('u.johan', 'tshepo', 'initial', 'grade_12', '2026-10-31',
  uat_seed.scores('mathematics','39','100'), 'mathematics', 'Final exams start 26 Oct; triage on Paper 1.');
select uat_seed.assess('u.johan', 'tshepo', 'monthly', 'grade_12', '2026-11-14',
  uat_seed.scores('mathematics','48','100'), 'mathematics', '');

-- Learning plans (create_learning_plan). Ayanda's first plan is superseded.
select uat_seed.act_as('u.precious');
select uat_seed.put('lp.ayanda.1', public.create_learning_plan(uat_seed.id('l.ayanda'),
  '[{"subject_code":"mathematics","goal":"Know times tables 1-10 by heart","target_level_code":"4","target_date":"2026-11-13"}]',
  null, uat_seed.id('term.2026.4')));
update public.learning_plans set created_at = '2026-10-20 15:30+02', activated_at = '2026-10-20 15:30+02'
 where id = uat_seed.id('lp.ayanda.1');
update public.learning_plan_goals set status = 'achieved', review_note = 'Achieved 12 Nov (monthly check 57%).'
 where learning_plan_id = uat_seed.id('lp.ayanda.1');

select uat_seed.put('lp.ayanda.2', public.create_learning_plan(uat_seed.id('l.ayanda'),
  '[{"subject_code":"mathematics","goal":"Compare, add and subtract fractions with like denominators","target_level_code":"5","target_date":"2026-12-09"},{"subject_code":"mathematics","goal":"Solve two-step word problems","target_level_code":"4","target_date":"2026-12-09"}]',
  null, uat_seed.id('term.2026.4')));
update public.learning_plans set created_at = '2026-11-13 15:10+02', activated_at = '2026-11-13 15:10+02'
 where id = uat_seed.id('lp.ayanda.2');

select uat_seed.act_as('u.kagiso');
select uat_seed.put('lp.lwazi', public.create_learning_plan(uat_seed.id('l.lwazi'),
  '[{"subject_code":"reading","goal":"Read a Grade 3 text at 70 words per minute","target_level_code":"4","target_date":"2026-12-09"},{"subject_code":"reading","goal":"Answer who/what/why questions about a short story","target_level_code":"4","target_date":"2026-12-09"}]',
  null, uat_seed.id('term.2026.4')));
select uat_seed.put('lp.zanele', public.create_learning_plan(uat_seed.id('l.zanele'),
  '[{"subject_code":"reading","goal":"Secure all single letter sounds; no b/d reversals","target_level_code":"3","target_date":"2026-12-09"}]',
  null, uat_seed.id('term.2026.4')));

select uat_seed.act_as('u.johan');
select uat_seed.put('lp.kamo', public.create_learning_plan(uat_seed.id('l.kamo'),
  '[{"subject_code":"mathematics","goal":"Simplify algebraic expressions and solve linear equations","target_level_code":"5","target_date":"2026-12-04"},{"subject_code":"english","goal":"Write a structured 3-paragraph essay","target_level_code":"5","target_date":"2026-12-04"}]',
  null, uat_seed.id('term.2026.4')));
select uat_seed.put('lp.neo', public.create_learning_plan(uat_seed.id('l.neo'),
  '[{"subject_code":"mathematics","goal":"70% or more in the November exam","target_level_code":"6","target_date":"2026-11-30"},{"subject_code":"physical_sciences","goal":"Apply Newton''s laws to multi-body problems","target_level_code":"5","target_date":"2026-11-30"},{"subject_code":"accounting","goal":"Complete a cash journal and general ledger without errors","target_level_code":"5","target_date":"2026-11-30"}]',
  null, uat_seed.id('term.2026.4')));
update public.learning_plans lp set created_at = v.at::timestamptz, activated_at = v.at::timestamptz
from (values ('lp.lwazi','2026-10-16 15:20+02'), ('lp.zanele','2026-10-16 15:40+02'),
             ('lp.kamo','2026-10-19 17:00+02'),  ('lp.neo','2026-10-20 17:10+02')) v(k, at)
where lp.id = uat_seed.id(v.k);
update public.learning_plan_goals set status = 'in_progress'
 where learning_plan_id in (uat_seed.id('lp.lwazi'), uat_seed.id('lp.kamo'), uat_seed.id('lp.neo'));

-- Term 4 progress reports (save_progress_report).
--   Lwazi: published + acknowledged by Sipho.  Kamo: published + acknowledged by Grace.
--   Neo:   published, NOT acknowledged (Grace or Neo to view).
--   Ayanda, Ruan: drafts, hidden from parents.
select uat_seed.act_as('u.kagiso');
select uat_seed.put('pr.lwazi', public.save_progress_report(uat_seed.id('l.lwazi'), uat_seed.id('term.2026.4'),
  'Lwazi has settled in well and now decodes most blends. He still rushes and skips words.',
  '[{"subject_code":"reading","achievement_level_code":"4","strengths":"Decoding blends; enthusiasm","areas_for_improvement":"Reading pace and self-correction","recommended_intervention":"Read aloud to an adult for 10 minutes every evening"}]',
  true, ''));

select uat_seed.act_as('u.johan');
select uat_seed.put('pr.kamo', public.save_progress_report(uat_seed.id('l.kamo'), uat_seed.id('term.2026.4'),
  'Kamogelo''s confidence in maths has grown noticeably; English essays are well organised.',
  '[{"subject_code":"mathematics","achievement_level_code":"5","strengths":"Linear equations","areas_for_improvement":"Factorising","recommended_intervention":"Weekly worksheet pack"},{"subject_code":"english","achievement_level_code":"5","strengths":"Essay structure","areas_for_improvement":"Spelling of subject vocabulary","recommended_intervention":"Personal spelling list"}]',
  true, ''));
select uat_seed.put('pr.neo', public.save_progress_report(uat_seed.id('l.neo'), uat_seed.id('term.2026.4'),
  'Neo works hard and asks good questions. Exam technique in Physical Sciences needs attention.',
  '[{"subject_code":"mathematics","achievement_level_code":"5","strengths":"Trigonometry now secure","areas_for_improvement":"Calculus word problems","recommended_intervention":"Holiday programme"},{"subject_code":"physical_sciences","achievement_level_code":"4","strengths":"Chemistry calculations","areas_for_improvement":"Free-body diagrams","recommended_intervention":"Past papers 2022-2025"},{"subject_code":"accounting","achievement_level_code":"5","strengths":"Journals","areas_for_improvement":"Reconciliations","recommended_intervention":"Extra Thursday practice"}]',
  true, ''));
select uat_seed.put('pr.ruan', public.save_progress_report(uat_seed.id('l.ruan'), uat_seed.id('term.2026.4'),
  'Ruan maak goeie vordering in wiskunde. (Draft - not yet published.)',
  '[{"subject_code":"mathematics","achievement_level_code":"4","strengths":"Algebra","areas_for_improvement":"Geometry proofs","recommended_intervention":""}]',
  false, ''));

select uat_seed.act_as('u.precious');
select uat_seed.put('pr.ayanda', public.save_progress_report(uat_seed.id('l.ayanda'), uat_seed.id('term.2026.4'),
  'Ayanda now knows her tables; fractions are the focus for the rest of term. (Draft.)',
  '[{"subject_code":"mathematics","achievement_level_code":"4","strengths":"Times tables","areas_for_improvement":"Fractions","recommended_intervention":"Fraction strips at home"}]',
  false, ''));

update public.progress_reports pr set published_at = v.at::timestamptz, issued_on = v.at::date,
       created_at = v.at::timestamptz - interval '1 day'
from (values ('pr.lwazi','2026-11-13 16:00+02'), ('pr.kamo','2026-11-13 17:00+02'),
             ('pr.neo','2026-11-16 18:00+02')) v(k, at)
where pr.id = uat_seed.id(v.k);

-- Attendance notes from the actual register up to the report date.
update public.progress_reports pr
   set attendance_note = format('Attended %s of %s sessions up to %s.', a.attended, a.total,
                                to_char(coalesce(pr.issued_on, date '2026-11-19'), 'FMDD Mon'))
from (select r.id,
             count(*) filter (where ar.status in ('present', 'late')) as attended,
             count(*) as total
        from public.progress_reports r
        join public.attendance_records ar on ar.learner_id = r.learner_id
        join public.class_sessions cs on cs.id = ar.class_session_id
                                     and cs.session_date <= coalesce(r.issued_on, date '2026-11-19')
       group by r.id) a
where a.id = pr.id;

insert into public.report_acknowledgements (progress_report_id, guardian_id, acknowledged_at, comment) values
  (uat_seed.id('pr.lwazi'), uat_seed.id('u.sipho'), '2026-11-14 19:22+02', 'Thank you Mr Mokgatle, we read together every evening now.'),
  (uat_seed.id('pr.kamo'),  uat_seed.id('u.grace'), '2026-11-14 07:05+02', 'Kamo is enjoying maths again. Thank you!');

-- 12. Messages ---------------------------------------------------------------
-- start_thread as the first sender; replies are plain inserts like the API's.
create function uat_seed.say(p_thread text, p_sender text, p_body text, p_at timestamptz) returns void
language sql as $fn$
  insert into public.messages (thread_id, sender_id, body, created_at)
  values (uat_seed.id(p_thread), uat_seed.id(p_sender), p_body, p_at)
$fn$;

create function uat_seed.thread(
  p_key text, p_from text, p_to text[], p_subject text, p_body text, p_learner text, p_at timestamptz
) returns void
language plpgsql as $fn$
declare v_thread uuid;
begin
  perform uat_seed.act_as(p_from);
  v_thread := public.start_thread(p_subject, p_body,
    (select array_agg(uat_seed.id(k)) from unnest(p_to) k),
    case when p_learner is null then null else uat_seed.id('l.' || p_learner) end);
  perform uat_seed.put(p_key, v_thread);
  update public.message_threads set created_at = p_at where id = v_thread;
  update public.messages set created_at = p_at where thread_id = v_thread;
  update public.thread_participants set added_at = p_at where thread_id = v_thread;
end $fn$;

select uat_seed.thread('m.neo', 'u.grace', array['u.johan'], 'Neo - Physical Sciences exam',
  'Good evening Mr van der Merwe, Neo says the Physical Sciences paper is on 24 November. Is there anything extra he should practise?',
  'neo', '2026-11-16 20:14+02');
select uat_seed.say('m.neo', 'u.johan', 'Evening Mrs Molefe. Free-body diagrams and the 2024 Paper 1 Q5. I''ll send a past paper pack on Saturday.', '2026-11-16 21:02+02');
select uat_seed.say('m.neo', 'u.grace', 'Thank you so much!', '2026-11-16 21:10+02');

select uat_seed.thread('m.ruan', 'u.marlene', array['u.lindiwe'], 'Aanlyn klas skakel / online class link',
  'Hi Lindiwe, Ruan could not find the link for Wednesday''s Fisiese Wetenskappe class. Where does it show?',
  'ruan', '2026-11-11 17:45+02');
select uat_seed.say('m.ruan', 'u.lindiwe', 'Hi Marlene, it appears on the parent timetable under each Wednesday session about an hour before. I''ve checked and tonight''s link is there now.', '2026-11-11 18:05+02');

select uat_seed.thread('m.zanele', 'u.lindiwe', array['u.nomsa'], 'Zanele - account reminder',
  'Hi Nomsa, a friendly reminder that R650 is outstanding on your account for November including the late fee. Please let us know if a payment plan would help.',
  'zanele', '2026-11-13 10:00+02');

select uat_seed.thread('m.ayanda', 'u.sipho', array['u.precious'], 'Ayanda fractions homework',
  'Hi Ms Ndlovu, Ayanda is stuck on the fractions homework (adding thirds and sixths). Can you show her again on Tuesday?',
  'ayanda', '2026-11-19 19:30+02');

select uat_seed.thread('m.staff', 'u.lindiwe', array['u.johan','u.kagiso','u.boitumelo','u.precious','u.thabiso'], 'Term 4 reports',
  'Hi all, draft Term 4 reports for every learner by Friday 4 December please, published by 8 December.',
  null, '2026-11-17 08:15+02');

-- Who has read what (mark_thread_read as each reader).
select uat_seed.act_as('u.johan');   select public.mark_thread_read(uat_seed.id('m.neo'));
                                    select public.mark_thread_read(uat_seed.id('m.staff'));
select uat_seed.act_as('u.grace');   select public.mark_thread_read(uat_seed.id('m.neo'));
select uat_seed.act_as('u.lindiwe'); select public.mark_thread_read(uat_seed.id('m.ruan'));
select uat_seed.act_as('u.kagiso');  select public.mark_thread_read(uat_seed.id('m.staff'));
update public.message_reads mr set read_at = m.created_at + interval '40 minutes'
from public.messages m where m.id = mr.message_id;
-- Unread on purpose: Marlene (Lindiwe's reply), Nomsa (reminder), Precious (Sipho), Boitumelo/Precious/Thabiso (staff note).

-- 13. Announcements ------------------------------------------------------------
insert into public.notifications (title, body, created_by, created_at) values
  ('Welcome to Skolopals - Term 4 starts Tuesday 13 October',
   'Classes start on Tuesday. Please sign your child in at reception and make sure everyone collecting is on the authorised list.',
   uat_seed.id('u.lindiwe'), '2026-10-12 09:00+02'),
  ('Load-shedding: Wednesday 4 November sessions cancelled',
   'Eskom stage 4 leaves the centre without power from 14:00 to 18:30. Wednesday in-centre sessions are cancelled; the online class continues.',
   uat_seed.id('u.lindiwe'), '2026-11-03 16:30+02'),
  ('December Holiday Revision - bookings open',
   'Grade 10-12 Maths and Science revision, 14-18 December, 09:00-12:00. R750. 12 places.',
   uat_seed.id('u.lindiwe'), '2026-11-16 09:00+02'),
  ('Staff: Term 4 reports due 4 December',
   'Drafts by 4 December, published by 8 December.', uat_seed.id('u.lindiwe'), '2026-11-17 08:00+02');

insert into uat_seed.ref (key, id)
select case when title like 'Welcome%' then 'n.welcome' when title like 'Load%' then 'n.loadshedding'
            when title like 'December%' then 'n.december' else 'n.staff' end, id
from public.notifications;

-- Parents of learners active at the time; read state varies.
insert into public.notification_recipients (notification_id, profile_id, read_at)
select uat_seed.id(n.k), g.id,
       case when g.k in ('u.nomsa', 'u.dineo') and n.k <> 'n.welcome' then null
            else n.sent + interval '3 hours' end
from (values ('n.welcome', timestamptz '2026-10-12 09:00+02'),
             ('n.loadshedding', timestamptz '2026-11-03 16:30+02')) n(k, sent)
cross join lateral (
  select r.key as k, r.id from uat_seed.ref r
  where r.key in ('u.sipho','u.grace','u.marlene','u.pieter','u.nomsa','u.fatima','u.lerato','u.boitumelo')
     or (r.key = 'u.dineo' and n.k <> 'n.welcome')
) g;

insert into public.notification_recipients (notification_id, profile_id, read_at)
select uat_seed.id('n.december'), uat_seed.id(k), r::timestamptz
from (values ('u.grace','2026-11-16 12:40+02'), ('u.marlene','2026-11-17 07:30+02'),
             ('u.pieter', null), ('u.dineo', null)) v(k, r);

insert into public.notification_recipients (notification_id, profile_id, read_at)
select uat_seed.id('n.staff'), uat_seed.id(k), r::timestamptz
from (values ('u.johan','2026-11-17 09:00+02'), ('u.kagiso','2026-11-17 13:10+02'),
             ('u.boitumelo', null), ('u.precious', null), ('u.thabiso', null)) v(k, r);

-- 14. Enquiries (website form, WhatsApp, walk-ins) --------------------------
insert into public.contact_enquiries (full_name, email, phone, topic, message, source, status,
                                      handled_by, handled_at, converted_learner_id, created_at)
values
  ('Thomas Baloyi', '', '0725550190', 'Grade 9 maths', 'Looking for maths help for my son.', 'phone', 'closed',
   null, null, null, '2025-10-01 10:00+02'),
  ('Grace Molefe', 'grace.molefe@uat.skolopals.test', '0735550121', 'Matric support', 'Do you help with Grade 11 Physical Sciences and Accounting?',
   'facebook', 'enrolled', uat_seed.id('u.lindiwe'), '2026-09-26 09:00+02', uat_seed.id('l.neo'), '2026-09-25 21:40+02'),
  ('Dineo Mahlangu', '', '0795550125', 'Grade 12 finals', 'My son writes finals soon - maths and science. Can you still take him?',
   'whatsapp', 'enrolled', uat_seed.id('u.lindiwe'), '2026-10-21 08:30+02', uat_seed.id('l.tshepo'), '2026-10-20 22:05+02'),
  ('Busisiwe Zulu', '', '0765550128', 'Grade 6', 'Walked in to ask about Grade 6 maths and science.',
   'walk_in', 'contacted', uat_seed.id('u.lindiwe'), '2026-10-02 15:00+02', null, '2026-10-02 14:40+02'),
  ('Kabelo Motaung', 'kabelo.m@example.org', '0825550191', 'Afrikaans FAL', 'Grade 9 Afrikaans first additional language tutoring?',
   'phone', 'closed', uat_seed.id('u.lindiwe'), '2026-10-21 11:00+02', null, '2026-10-20 10:15+02'),
  ('Ntombi Sibiya', 'ntombi.sibiya@example.org', '', 'Grade R', 'Do you offer Grade R school readiness in January?',
   'website', 'new', null, null, null, '2026-11-09 20:30+02'),
  ('Johannes Pretorius', '', '0835550192', 'Matric rewrite', 'Matric rewrite support for 2027 - maths and physics.',
   'flyer', 'new', null, null, null, '2026-11-17 12:10+02'),
  ('Palesa Moloi', 'palesa.moloi@example.org', '0715550193', 'Two children', 'Referred by Grace Molefe. Two kids in Grade 4 and Grade 6 - fees?',
   'referral', 'new', null, null, null, '2026-11-19 18:45+02');

-- 15. Resources ------------------------------------------------------------
insert into public.resources (title, subject_code, url, created_by, created_at) values
  ('Times tables practice sheets 1-12', 'mathematics', 'https://example.org/uat/times-tables.pdf', uat_seed.id('u.precious'), '2026-10-20 14:00+02'),
  ('Grade 12 Maths P1 November 2024 + memo', 'mathematics', 'https://example.org/uat/gr12-p1-2024.pdf', uat_seed.id('u.johan'), '2026-10-27 09:00+02'),
  ('Free-body diagrams - worked examples', 'physical_sciences', 'https://example.org/uat/free-body.pdf', uat_seed.id('u.johan'), '2026-11-16 21:00+02'),
  ('Phonics sound chart (English/Setswana)', 'reading', 'https://example.org/uat/phonics.pdf', uat_seed.id('u.kagiso'), '2026-10-15 15:30+02'),
  ('Centre rules and collection procedure', null, 'https://example.org/uat/centre-rules.pdf', uat_seed.id('u.lindiwe'), '2026-10-12 09:00+02');

insert into public.resource_audiences (resource_id, audience_type, learner_id, class_group_id, grade_code)
select r.id, v.atype,
       case when v.atype = 'learner' then uat_seed.id(v.target) end,
       case when v.atype = 'class_group' then uat_seed.id(v.target) end,
       case when v.atype = 'grade' then v.target end
from public.resources r
join (values
  ('Times tables practice sheets 1-12',       'class_group', 'c.maths46'),
  ('Grade 12 Maths P1 November 2024 + memo',  'grade',       'grade_12'),
  ('Free-body diagrams - worked examples',    'learner',     'l.neo'),
  ('Phonics sound chart (English/Setswana)',  'class_group', 'c.reading'),
  ('Centre rules and collection procedure',   'all',         null)
) v(title, atype, target) on v.title = r.title;

-- 16. Reviews (published ones show on /tutors) -------------------------------
insert into public.reviews (tutor_id, guardian_id, learner_id, rating, comment, status, created_at, published_at, moderated_by)
values
  (uat_seed.id('t.johan'),    uat_seed.id('u.grace'),   uat_seed.id('l.neo'),    5, 'Neo''s maths went from 58% to 67% in a month. Patient and very clear.', 'published', '2026-11-15 10:00+02', '2026-11-16 09:00+02', uat_seed.id('u.lindiwe')),
  (uat_seed.id('t.johan'),    uat_seed.id('u.marlene'), uat_seed.id('l.ruan'),   4, 'Baie dankie - Ruan verstaan nou eindelik meganika.', 'published', '2026-11-17 19:00+02', '2026-11-18 08:30+02', uat_seed.id('u.lindiwe')),
  (uat_seed.id('t.kagiso'),   uat_seed.id('u.sipho'),   uat_seed.id('l.lwazi'),  5, 'Lwazi actually wants to read at bedtime now.', 'published', '2026-11-14 19:30+02', '2026-11-16 09:05+02', uat_seed.id('u.lindiwe')),
  (uat_seed.id('t.precious'), uat_seed.id('u.sipho'),   uat_seed.id('l.ayanda'), 4, 'Kind and encouraging.', 'published', '2026-11-14 19:35+02', '2026-11-16 09:06+02', uat_seed.id('u.lindiwe')),
  (uat_seed.id('t.johan'),    uat_seed.id('u.fatima'),  uat_seed.id('l.owen'),   3, 'Good tutor but the class was too advanced for Owen.', 'pending', '2026-11-15 13:00+02', null, null),
  (uat_seed.id('t.kagiso'),   uat_seed.id('u.nomsa'),   uat_seed.id('l.zanele'), 2, 'Call me on 061 555 0124 to discuss.', 'rejected', '2026-11-10 21:00+02', null, uat_seed.id('u.lindiwe'));

-- 17. Expenses (BP section 17 categories) ------------------------------------
insert into public.expenses (category_code, incurred_on, amount_cents, description, recorded_by)
select v.cat, v.d::date, v.rand * 100, v.descr, uat_seed.id('u.lindiwe')
from (values
  ('maintenance',        '2026-09-18', 4800, 'Paint and repairs before opening'),
  ('marketing',          '2026-09-20', 3200, 'Launch flyers (2,000) and two banners'),
  ('printing_materials', '2026-09-24', 2600, 'Workbooks, stationery and whiteboard markers'),
  ('administration',     '2026-09-25',  950, 'CIPC annual return and bank fees'),
  ('rent',               '2026-10-01', 5000, 'October rent'),
  ('internet',           '2026-10-01',  699, 'Fibre - October'),
  ('electricity_water',  '2026-10-05', 1380, 'Prepaid electricity and municipal water'),
  ('marketing',          '2026-10-08', 1200, 'Facebook ads - opening week'),
  ('printing_materials', '2026-10-14',  850, 'Assessment packs'),
  ('emergency_other',    '2026-10-22',  350, 'Generator fuel - load-shedding'),
  ('cleaning',           '2026-10-30',  800, 'Cleaning service - October'),
  ('administration',     '2026-10-30',  480, 'Bank fees and SMS bundle'),
  ('tutor_payments',     '2026-10-31', 9850, 'Tutor pay - October'),
  ('rent',               '2026-11-01', 5000, 'November rent'),
  ('internet',           '2026-11-01',  699, 'Fibre - November'),
  ('emergency_other',    '2026-11-04',  520, 'Generator fuel - load-shedding'),
  ('electricity_water',  '2026-11-05', 1500, 'Prepaid electricity and municipal water'),
  ('maintenance',        '2026-11-09',  650, 'Replaced broken window, Room B'),
  ('marketing',          '2026-11-10',  600, 'Facebook ads - December programme'),
  ('printing_materials', '2026-11-12',  420, 'Past-paper packs')
) as v(cat, d, rand, descr);

-- 18. Clean up helpers, show what was built ----------------------------------
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);

create temporary table uat_summary as
select 'accounts' as item, count(*)::text as value from auth.users where email like '%@uat.skolopals.test'
union all select 'tutors (active/suspended)', count(*) filter (where status = 'active') || '/' || count(*) filter (where status = 'suspended') from public.tutors
union all select 'learners by status', string_agg(status || '=' || n, ', ' order by status) from (select status, count(*) n from public.learners group by status) s
union all select 'enrolments by status', string_agg(status || '=' || n, ', ' order by status) from (select status, count(*) n from public.enrolments group by status) s
union all select 'class sessions (held/cancelled/scheduled)', count(*) filter (where status='held') || '/' || count(*) filter (where status='cancelled') || '/' || count(*) filter (where status='scheduled') from public.class_sessions
union all select 'attendance records', count(*)::text from public.attendance_records
union all select 'invoices', count(*) || ' (last ' || max(invoice_number) || ')' from public.invoices
union all select 'invoiced R / collected R', (sum(total_cents)/100)::bigint || ' / ' || (sum(settled_cents)/100)::bigint from public.v_invoice_status
union all select 'outstanding: ' || guardian_name, 'R' || (outstanding_cents/100)::bigint || ', ' || open_invoices || ' open, max ' || max_days_overdue || ' days overdue' from public.v_outstanding_fees
union all select 'retention due', string_agg(subject_label, ', ') from public.v_retention_due;

drop schema uat_seed cascade;

commit;

select * from uat_summary;
