#!/usr/bin/env bash
# Exercises RLS and the business-rule triggers with real queries as real roles.
# Everything runs in one transaction and is rolled back, so it leaves no data.
#
# Static checks in verify.sh prove policies EXIST. This proves they WORK.
set -euo pipefail
DB="${DATABASE_URL:?DATABASE_URL not set}"

psql "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
begin;

-- Fixtures ----------------------------------------------------------------
-- Inserting into auth.users fires handle_new_user, which creates the profile,
-- the parent role and the guardian row.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'guardian.a@test', '{"full_name":"Guardian A"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'guardian.b@test', '{"full_name":"Guardian B"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'tutor@test',      '{"full_name":"Naledi Tutor"}'),
  ('dddddddd-0000-0000-0000-000000000004', 'admin@test',      '{"full_name":"Winnie Admin"}'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'learner.a@test',  '{"full_name":"Learner A"}');

insert into public.user_roles (user_id, role) values
  ('cccccccc-0000-0000-0000-000000000003', 'tutor'),
  ('dddddddd-0000-0000-0000-000000000004', 'admin'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'learner');

insert into public.learners (id, profile_id, full_name, date_of_birth, grade_code, status, joined_on) values
  ('11111111-0000-0000-0000-00000000000a', 'eeeeeeee-0000-0000-0000-000000000005',
   'Learner A', '2013-04-02', 'grade_7', 'active', current_date),
  ('22222222-0000-0000-0000-00000000000b', null,
   'Learner B', '2014-08-11', 'grade_7', 'active', current_date);

insert into public.learner_guardians (learner_id, guardian_id, relationship, is_primary, is_billing_contact) values
  ('11111111-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'mother', true, true),
  ('22222222-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', 'father', true, true);

insert into public.learner_medical_notes (learner_id, allergies) values
  ('11111111-0000-0000-0000-00000000000a', 'Peanuts'),
  ('22222222-0000-0000-0000-00000000000b', 'None');

insert into public.learner_emergency_contacts (learner_id, full_name, relationship, phone, priority) values
  ('11111111-0000-0000-0000-00000000000a', 'Aunt A', 'aunt', '0600000001', 1);

insert into public.authorised_collectors (id, learner_id, full_name, relationship, phone) values
  ('33333333-0000-0000-0000-00000000000c', '11111111-0000-0000-0000-00000000000a', 'Aunt A', 'aunt', '0600000001');

insert into public.tutors (id, profile_id, slug, employment_type, status) values
  ('44444444-0000-0000-0000-00000000000d', 'cccccccc-0000-0000-0000-000000000003',
   'naledi-tutor', 'sessional', 'active');

-- Teaches Mathematics at Grade 7, in English only.
insert into public.tutor_competencies (id, tutor_id, subject_code, grade_code) values
  ('55555555-0000-0000-0000-00000000000e', '44444444-0000-0000-0000-00000000000d', 'mathematics', 'grade_7');
insert into public.tutor_competency_media (competency_id, language_code) values
  ('55555555-0000-0000-0000-00000000000e', 'english');

insert into public.terms (id, year, term_number, starts_on, ends_on) values
  ('66666666-0000-0000-0000-00000000000f', 2026, 4, '2026-10-06', '2026-12-09');
insert into public.rooms (id, name, capacity) values
  ('77777777-0000-0000-0000-000000000010', 'Main Room', 12);

insert into public.class_groups (id, name, subject_code, language_code, tutor_id, term_id,
                                 delivery_mode, room_id, capacity) values
  ('88888888-0000-0000-0000-000000000011', 'Grade 7 Mathematics (English)', 'mathematics', 'english',
   '44444444-0000-0000-0000-00000000000d', '66666666-0000-0000-0000-00000000000f',
   'in_centre', '77777777-0000-0000-0000-000000000010', 6);
insert into public.class_group_grades (class_group_id, grade_code) values
  ('88888888-0000-0000-0000-000000000011', 'grade_7');
insert into public.class_schedules (class_group_id, day_of_week, starts_at_time, ends_at_time) values
  ('88888888-0000-0000-0000-000000000011', 2, '14:00', '15:00');
insert into public.class_sessions (id, class_group_id, session_date, starts_at, ends_at) values
  ('99999999-0000-0000-0000-000000000012', '88888888-0000-0000-0000-000000000011',
   '2026-10-20', '2026-10-20 14:00+02', '2026-10-20 15:00+02');

-- Consents, then an enrolment that can legally go active.
insert into public.consents (consent_type_code, guardian_id, learner_id, granted, policy_version)
select ct.code, 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-00000000000a', true, '1.0'
from public.consent_types ct where ct.is_required;

insert into public.enrolments (id, learner_id, package_code, status, start_date, assigned_tutor_id) values
  ('aaaa1111-0000-0000-0000-000000000013', '11111111-0000-0000-0000-00000000000a',
   'group_2', 'active', current_date, '44444444-0000-0000-0000-00000000000d');
insert into public.enrolment_subjects (enrolment_id, subject_code, preferred_language_code) values
  ('aaaa1111-0000-0000-0000-000000000013', 'mathematics', 'english'),
  ('aaaa1111-0000-0000-0000-000000000013', 'english',     'english');

insert into public.class_enrolments (class_group_id, learner_id, enrolment_id) values
  ('88888888-0000-0000-0000-000000000011', '11111111-0000-0000-0000-00000000000a',
   'aaaa1111-0000-0000-0000-000000000013');

-- Phase 2 fixtures: billing, assessment, reviews, enquiries.
insert into public.billing_accounts (id, guardian_id) values
  ('bbbb2222-0000-0000-0000-000000000014','aaaaaaaa-0000-0000-0000-000000000001');
insert into public.invoices (id, billing_account_id, invoice_number, issued_on, due_on, status) values
  ('1111aaaa-0000-0000-0000-000000000101','bbbb2222-0000-0000-0000-000000000014',
   'SKP-2026-0001','2026-10-18','2026-11-01','issued');
insert into public.invoice_lines (invoice_id, line_type, description, learner_id, unit_amount_cents) values
  ('1111aaaa-0000-0000-0000-000000000101','package','October tuition',
   '11111111-0000-0000-0000-00000000000a', 75000);
insert into public.payments (id, billing_account_id, paid_on, amount_cents, method) values
  ('4444aaaa-0000-0000-0000-000000000104','bbbb2222-0000-0000-0000-000000000014','2026-10-20',75000,'eft');

insert into public.assessments (id, learner_id, assessment_type_code, grade_code, administered_by) values
  ('8888aaaa-0000-0000-0000-000000000108','11111111-0000-0000-0000-00000000000a','initial','grade_7',
   '44444444-0000-0000-0000-00000000000d');
insert into public.assessment_scores (assessment_id, domain_code, raw_score, max_score) values
  ('8888aaaa-0000-0000-0000-000000000108','reading', 22, 50);

-- One published report and one unpublished draft.
insert into public.progress_reports (id, learner_id, term_id, tutor_id, summary) values
  ('aaaabbbb-0000-0000-0000-00000000010a','11111111-0000-0000-0000-00000000000a',
   '66666666-0000-0000-0000-00000000000f','44444444-0000-0000-0000-00000000000d','Draft, not yet shown');
insert into public.progress_report_subjects (progress_report_id, subject_code, achievement_level_code) values
  ('aaaabbbb-0000-0000-0000-00000000010a','mathematics',4);

insert into public.contact_enquiries (full_name, message) values ('Passer By','Do you take Grade 3?');
insert into public.reviews (tutor_id, guardian_id, rating, comment, status) values
  ('44444444-0000-0000-0000-00000000000d','aaaaaaaa-0000-0000-0000-000000000001',5,'Excellent','pending');

\echo ''
\echo '=== GUARDIAN A ==='
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true);
do $$ begin
  perform dev.assert((select count(*) from public.learners) = 1,
    'sees exactly 1 learner (own child), not both');
  perform dev.assert(exists(select 1 from public.learners where full_name='Learner A'),
    'sees own child');
  perform dev.assert((select count(*) from public.learner_medical_notes) = 1,
    'sees own child health notes');
  perform dev.assert((select count(*) from public.learner_emergency_contacts) = 1,
    'sees own child emergency contacts');
  perform dev.assert((select count(*) from public.enrolments) = 1,
    'sees own enrolment');
  perform dev.assert((select count(*) from public.billing_settings) = 0,
    'cannot see internal billing settings');
  perform dev.assert((select count(*) from public.tutor_documents) = 0,
    'cannot see tutor vetting documents');
  perform dev.assert((select count(*) from public.invoices) = 1,
    'sees own invoice');
  perform dev.assert((select count(*) from public.payments) = 1,
    'sees own payment');
  perform dev.assert((select count(*) from public.v_account_statement) = 2,
    'sees own statement (invoice + payment)');
  perform dev.assert((select count(*) from public.progress_reports) = 0,
    'CANNOT see an UNPUBLISHED report - a draft is the tutor working copy');
  perform dev.assert((select count(*) from public.assessments) = 1,
    'sees own child assessment');
  perform dev.assert((select count(*) from public.contact_enquiries) = 0,
    'cannot read enquiries');
  perform dev.assert((select count(*) from public.expenses) = 0,
    'cannot read centre expenses');
end $$;

reset role;
\echo ''
\echo '=== GUARDIAN B (must not see Guardian A data) ==='
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}',true);
do $$ begin
  perform dev.assert((select count(*) from public.learners) = 1,
    'sees exactly 1 learner');
  perform dev.assert(not exists(select 1 from public.learners where full_name='Learner A'),
    'CANNOT see the other family child');
  perform dev.assert(not exists(select 1 from public.learner_medical_notes
                                where allergies = 'Peanuts'),
    'CANNOT see the other family health notes');
  perform dev.assert((select count(*) from public.enrolments) = 0,
    'CANNOT see the other family enrolment');
  perform dev.assert((select count(*) from public.invoices) = 0,
    'CANNOT see the other family invoices');
  perform dev.assert((select count(*) from public.payments) = 0,
    'CANNOT see the other family payments');
  perform dev.assert((select count(*) from public.assessments) = 0,
    'CANNOT see the other family assessments');
end $$;

reset role;
\echo ''
\echo '=== TUTOR (teaches Learner A) ==='
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}',true);
do $$ begin
  perform dev.assert((select count(*) from public.learners) = 1,
    'sees the learner they teach');
  perform dev.assert(exists(select 1 from public.learners where full_name='Learner A'),
    'sees Learner A');
  perform dev.assert((select count(*) from public.learner_medical_notes) = 0,
    'DENIED health notes (POPIA s26)');
  perform dev.assert((select count(*) from public.learner_emergency_contacts) = 0,
    'DENIED emergency contacts');
  perform dev.assert((select count(*) from public.authorised_collectors) = 0,
    'DENIED authorised collectors');
  perform dev.assert((select count(*) from public.billing_settings) = 0,
    'DENIED billing settings');
  perform dev.assert((select count(*) from public.consents) = 0,
    'DENIED consent records');
  perform dev.assert((select count(*) from public.class_sessions) = 1,
    'sees own class sessions');
  perform dev.assert((select count(*) from public.invoices) = 0,
    'DENIED invoices');
  perform dev.assert((select count(*) from public.invoice_lines) = 0,
    'DENIED invoice lines');
  perform dev.assert((select count(*) from public.payments) = 0,
    'DENIED payments');
  perform dev.assert((select count(*) from public.billing_accounts) = 0,
    'DENIED billing accounts');
  perform dev.assert((select count(*) from public.v_account_statement) = 0,
    'DENIED the account statement view');
  perform dev.assert((select count(*) from public.expenses) = 0,
    'DENIED centre expenses');
  perform dev.assert((select count(*) from public.contact_enquiries) = 0,
    'DENIED enquiries');
  perform dev.assert((select count(*) from public.assessments) = 1,
    'CAN see assessments for a learner they teach');
  perform dev.assert((select count(*) from public.progress_reports) = 1,
    'CAN see their own draft report');
end $$;

-- A tutor marks the register for their own session.
insert into public.attendance_records (class_session_id, learner_id, status, marked_by)
values ('99999999-0000-0000-0000-000000000012', '11111111-0000-0000-0000-00000000000a',
        'present', 'cccccccc-0000-0000-0000-000000000003');
do $$ begin
  perform dev.assert((select count(*) from public.attendance_records) = 1,
    'CAN mark the register for own session');
end $$;

reset role;
\echo ''
\echo '=== LEARNER A (own login) ==='
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"eeeeeeee-0000-0000-0000-000000000005","role":"authenticated"}',true);
do $$ begin
  perform dev.assert((select count(*) from public.learners) = 1,
    'sees only themselves');
  perform dev.assert((select count(*) from public.learner_medical_notes) = 0,
    'DENIED health notes');
  perform dev.assert((select count(*) from public.enrolments) = 0,
    'DENIED billing/enrolment detail');
  perform dev.assert((select count(*) from public.attendance_records) = 1,
    'sees own attendance');
end $$;

reset role;
\echo ''
\echo '=== ANONYMOUS VISITOR ==='
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
  perform dev.assert((select count(*) from public.learners) = 0,
    'sees NO learners');
  perform dev.assert((select count(*) from public.learner_medical_notes) = 0,
    'sees NO health notes');
  perform dev.assert((select count(*) from public.consents) = 0,
    'sees NO consent records');
  perform dev.assert((select count(*) from public.tutors) = 1,
    'sees the public staff directory');
  perform dev.assert((select count(*) from public.packages) = 10,
    'sees the price list');
  perform dev.assert((select count(*) from public.v_public_timetable) = 1,
    'sees the published timetable');
  perform dev.assert((select count(*) from public.class_sessions) = 0,
    'sees NO class sessions, so no meeting links leak');
  perform dev.assert((select count(*) from public.invoices) = 0,
    'sees NO invoices');
  perform dev.assert((select count(*) from public.payments) = 0,
    'sees NO payments');
  perform dev.assert((select count(*) from public.assessments) = 0,
    'sees NO assessments');
  perform dev.assert((select count(*) from public.progress_reports) = 0,
    'sees NO progress reports');
  perform dev.assert((select count(*) from public.contact_enquiries) = 0,
    'sees NO enquiries, including its own submissions');
  perform dev.assert((select count(*) from public.reviews) = 0,
    'sees NO unmoderated reviews');
  perform dev.assert((select count(*) from public.expenses) = 0,
    'sees NO expenses');
end $$;
-- An anonymous visitor CAN submit an enquiry.
insert into public.contact_enquiries (full_name, message) values ('Anon Visitor','Saturday classes?');
do $$ begin
  perform dev.assert(true, 'CAN submit a contact enquiry');
end $$;

reset role;
\echo ''
\echo '=== ADMIN ==='
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"dddddddd-0000-0000-0000-000000000004","role":"authenticated"}',true);
do $$ begin
  perform dev.assert((select count(*) from public.learners) = 2, 'sees all learners');
  perform dev.assert((select count(*) from public.learner_medical_notes) = 2, 'sees all health notes');
  perform dev.assert((select count(*) from public.billing_settings) = 1, 'sees billing settings');
  perform dev.assert((select count(*) from public.consents) = 3, 'sees consent records');
  perform dev.assert((select count(*) from public.invoices) = 1, 'sees invoices');
  perform dev.assert((select count(*) from public.contact_enquiries) = 2, 'sees enquiries');
  perform dev.assert((select count(*) from public.reviews) = 1, 'sees unmoderated reviews');
end $$;

reset role;
rollback;
SQL
