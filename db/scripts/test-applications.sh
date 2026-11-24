#!/usr/bin/env bash
# Applications from acceptance to a seat in class (SPEC-2026-11-enrolment-payments-ux.md
# §3, §4.4–§4.7, §5): pro-rata on the fixed dates the spec names, the offer
# invoice, decline, PayShap proof → verify/reject, automatic placement,
# billing after activation, the day-3/day-7 offer job, re-quotes, derived
# progress and report-card access. Rolls back.
set -euo pipefail
DB="${DATABASE_URL:?DATABASE_URL not set}"

psql "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
begin;
set constraints all immediate;

\set consents '(select jsonb_agg(jsonb_build_object(''consent_type_code'', code, ''granted'', true)) from public.consent_types where is_required)'
\set contact '''[{"full_name":"Aunt Palesa","relationship":"aunt","phone":"0721234567","priority":1}]''::jsonb'
\set admin '''{"sub":"dddddddd-0000-0000-0000-000000000004","role":"authenticated"}'''
\set parent_a '''{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}'''
\set parent_b '''{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}'''
\set naledi '''{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}'''
\set other_tutor '''{"sub":"eeeeeeee-0000-0000-0000-000000000005","role":"authenticated"}'''

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001','a@test','{"full_name":"Thandi Mokoena"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002','b@test','{"full_name":"Lindi Khumalo"}'),
  ('cccccccc-0000-0000-0000-000000000003','naledi@test','{"full_name":"Naledi Dube"}'),
  ('eeeeeeee-0000-0000-0000-000000000005','sipho@test','{"full_name":"Sipho Ndlovu"}'),
  ('dddddddd-0000-0000-0000-000000000004','admin@test','{"full_name":"Winnie Thobela"}');
insert into public.user_roles values
  ('cccccccc-0000-0000-0000-000000000003','tutor'),
  ('eeeeeeee-0000-0000-0000-000000000005','tutor'),
  ('dddddddd-0000-0000-0000-000000000004','admin');

-- Naledi teaches Grade 7 Maths and English; Sipho teaches Grade 7 Maths.
insert into public.tutors (id, profile_id, slug, employment_type) values
  ('44444444-0000-0000-0000-00000000000d','cccccccc-0000-0000-0000-000000000003','naledi-dube','sessional'),
  ('44444444-0000-0000-0000-00000000000e','eeeeeeee-0000-0000-0000-000000000005','sipho-ndlovu','sessional');
insert into public.tutor_competencies (id, tutor_id, subject_code, grade_code) values
  ('55555555-0000-0000-0000-000000000001','44444444-0000-0000-0000-00000000000d','mathematics','grade_7'),
  ('55555555-0000-0000-0000-000000000002','44444444-0000-0000-0000-00000000000d','english','grade_7'),
  ('55555555-0000-0000-0000-000000000003','44444444-0000-0000-0000-00000000000e','mathematics','grade_7');
insert into public.tutor_competency_media values
  ('55555555-0000-0000-0000-000000000001','english'),
  ('55555555-0000-0000-0000-000000000002','english'),
  ('55555555-0000-0000-0000-000000000003','english');

-- A term around today, so automatic placement has somewhere to place.
insert into public.terms (id, year, term_number, starts_on, ends_on) values
  ('66666666-0000-0000-0000-000000000001', 2026, 4, current_date - 20, current_date + 30);
insert into public.rooms (id, name, capacity) values ('77777777-0000-0000-0000-000000000001','Test Room A',12);

-- Maths with Sipho on Monday 15:00; Maths with Naledi on Tuesday; English with
-- Naledi on Monday 15:30 (clashes with Sipho's maths) and on Wednesday.
insert into public.class_groups (id, name, subject_code, language_code, tutor_id, term_id, delivery_mode, room_id, capacity, created_at) values
  ('88888888-0000-0000-0000-000000000001','Gr 7 Maths (Sipho)','mathematics','english','44444444-0000-0000-0000-00000000000e','66666666-0000-0000-0000-000000000001','in_centre','77777777-0000-0000-0000-000000000001',4, now() - interval '4 days'),
  ('88888888-0000-0000-0000-000000000002','Gr 7 Maths (Naledi)','mathematics','english','44444444-0000-0000-0000-00000000000d','66666666-0000-0000-0000-000000000001','in_centre','77777777-0000-0000-0000-000000000001',6, now() - interval '3 days'),
  ('88888888-0000-0000-0000-000000000003','Gr 7 English Mon','english','english','44444444-0000-0000-0000-00000000000d','66666666-0000-0000-0000-000000000001','in_centre','77777777-0000-0000-0000-000000000001',6, now() - interval '2 days'),
  ('88888888-0000-0000-0000-000000000004','Gr 7 English Wed','english','english','44444444-0000-0000-0000-00000000000d','66666666-0000-0000-0000-000000000001','in_centre','77777777-0000-0000-0000-000000000001',6, now() - interval '1 day');
insert into public.class_group_grades
  select id, 'grade_7' from public.class_groups where id::text like '88888888-0000-0000-0000-00000000000%';
insert into public.class_schedules (class_group_id, day_of_week, starts_at_time, ends_at_time) values
  ('88888888-0000-0000-0000-000000000001', 1, '15:00', '16:00'),
  ('88888888-0000-0000-0000-000000000002', 2, '15:00', '16:00'),
  ('88888888-0000-0000-0000-000000000003', 1, '15:30', '16:30'),
  ('88888888-0000-0000-0000-000000000004', 3, '15:00', '16:00');

\echo ''
\echo '=== pro-rata and quotes on the spec''s fixed dates (§5, D8, D13) ==='
do $$ begin
  perform dev.assert(private.prorata_cents(45000, '2026-11-21') = 15000, '21 Nov at R450: 10 of 30 days = R150');
  perform dev.assert(private.prorata_cents(45000, '2026-11-20') = 16500, '20 Nov at R450: 11 of 30 days = R165');
  perform dev.assert(private.prorata_cents(45000, '2026-11-01') = 45000, '1 Nov: the whole month');
  perform dev.assert(private.prorata_cents(45000, '2026-11-15') = 24000, '15 Nov: 16 of 30 days = R240');
  perform dev.assert(private.prorata_cents(45000, '2026-11-30') = 1500, 'last day of a 30-day month: R15');
  perform dev.assert(private.prorata_cents(45000, '2027-01-31') = 1500, '31 Jan: 1 of 31 days, R14.52 rounds to R15');
  perform dev.assert(private.prorata_cents(45000, '2027-02-28') = 1600, '28 Feb 2027: 1 of 28 days, R16.07 rounds to R16');
  perform dev.assert(private.prorata_cents(45000, '2028-02-29') = 1600, '29 Feb 2028 (leap): 1 of 29 days, R15.52 rounds to R16');
  perform dev.assert((public.enrolment_quote('group_1', '2026-11-21') ->> 'totalCents')::int = 30000,
    'quote on 21 Nov for the R450 package: exactly R300 (R150 registration + R150 tuition)');
  perform dev.assert((public.enrolment_quote('group_1', '2026-11-20') ->> 'totalCents')::int = 31500,
    'quote on 20 Nov: R315');
end $$;

\echo ''
\echo '=== FAMILY A applies for Thabo (Maths + English, prefers Sipho) ==='
set local role authenticated;
select set_config('request.jwt.claims', :parent_a, true) \g /dev/null
select set_config('t.thabo', (private.submit_enrolment(
  '{"full_name":"Thabo Mokoena","date_of_birth":"2013-04-02","grade_code":"grade_7","relationship":"mother"}'::jsonb,
  'group_2', '[{"subject_code":"mathematics","preferred_language_code":"english"},{"subject_code":"english","preferred_language_code":"english"}]'::jsonb,
  :contact, '[]'::jsonb, :consents, '1.0',
  '{"stagingPath":"staging/aaaaaaaa-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000001.pdf","year":2026,"term":3,"originalName":"report.pdf","mime":"application/pdf","sizeBytes":1000}'::jsonb,
  '44444444-0000-0000-0000-00000000000e') ->> 'enrolmentId'), true) \g /dev/null
select set_config('t.sipho_child', (private.submit_enrolment(
  '{"full_name":"Sipho Mokoena","date_of_birth":"2013-05-02","grade_code":"grade_7","relationship":"mother"}'::jsonb,
  'group_1', '[{"subject_code":"mathematics","preferred_language_code":"english"}]'::jsonb,
  :contact, '[]'::jsonb, :consents, '1.0',
  '{"stagingPath":"staging/aaaaaaaa-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000002.pdf","mime":"application/pdf","sizeBytes":1000}'::jsonb,
  null) ->> 'enrolmentId'), true) \g /dev/null

do $$ begin
  perform dev.assert((select stage from public.v_enrolment_progress where enrolment_id = current_setting('t.thabo')::uuid) = 'assessment',
    'stage: assessment (report card in, test not done)');
end $$;

reset role;
insert into public.aptitude_attempts
  (learner_id, enrolment_id, bank_version, status, current_difficulty, completed_at, final_band, level_label, literacy_pct, logic_pct, low_confidence)
select e.learner_id, e.id, b.version, 'completed', 3, now(), 3, 'Developing', 60, 60, false
  from public.enrolments e, public.aptitude_banks b
 where b.is_current and e.id in (current_setting('t.thabo')::uuid, current_setting('t.sipho_child')::uuid);

set local role authenticated;
select set_config('request.jwt.claims', :parent_a, true) \g /dev/null
do $$ begin
  perform dev.assert((select stage from public.v_enrolment_progress where enrolment_id = current_setting('t.thabo')::uuid) = 'review',
    'stage: review once the test is done');
end $$;

\echo ''
\echo '--- report card access (D5) ---'
do $$
declare v_doc uuid := (select d.id from public.learner_documents d join public.enrolments e on e.learner_id = d.learner_id
                         where e.id = current_setting('t.thabo')::uuid);
begin
  perform dev.assert(private.learner_document_download(v_doc) ->> 'storagePath' like 'learners/%', 'the guardian can open the report card');
  perform set_config('t.doc', v_doc::text, true);
  perform private.replace_report_card(current_setting('t.thabo')::uuid,
    '{"stagingPath":"staging/aaaaaaaa-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000003.png","mime":"image/png","sizeBytes":2000}'::jsonb);
  perform dev.assert((select count(*) from public.learner_documents d join public.enrolments e on e.learner_id = d.learner_id
                       where e.id = current_setting('t.thabo')::uuid and d.superseded_at is null) = 1,
    'a replaced report card leaves exactly one current copy');
end $$;

select set_config('request.jwt.claims', :parent_b, true) \g /dev/null
do $$ begin
  begin
    perform private.learner_document_download(current_setting('t.doc')::uuid);
    raise exception 'FAILED: another parent opened the report card';
  exception when raise_exception then
    raise notice '  PASS  rejected: another parent opening the report card';
  end;
end $$;
select set_config('request.jwt.claims', :other_tutor, true) \g /dev/null
do $$ begin
  begin
    perform private.learner_document_download(current_setting('t.doc')::uuid);
    raise exception 'FAILED: a tutor with no link to the learner opened the report card';
  exception when raise_exception then
    raise notice '  PASS  rejected: a tutor who does not teach the learner';
  end;
end $$;

\echo ''
\echo '=== ADMIN declines Sipho, accepts Thabo ==='
select set_config('request.jwt.claims', :admin, true) \g /dev/null
do $$ begin
  perform dev.assert((select count(*) from public.document_access_log) = 1, 'the guardian''s download was logged');
  begin
    perform public.decline_enrolment(current_setting('t.sipho_child')::uuid, '  ');
    raise exception 'FAILED: declined without a reason';
  exception when check_violation then
    raise notice '  PASS  rejected: declining without a reason';
  end;
  perform public.decline_enrolment(current_setting('t.sipho_child')::uuid, 'No class available for this grade/subject', 'We will call you when a seat opens.');
  perform dev.assert((select status from public.enrolments where id = current_setting('t.sipho_child')::uuid) = 'declined', 'Sipho is declined');
  perform dev.assert((select offer_invoice_id from public.enrolments where id = current_setting('t.sipho_child')::uuid) is null,
    'a declined application never has an invoice');
  begin
    perform public.accept_enrolment(current_setting('t.sipho_child')::uuid);
    raise exception 'FAILED: accepted a declined application';
  exception when raise_exception then
    raise notice '  PASS  rejected: accepting an application that was declined (not lapsed)';
  end;

  perform public.accept_enrolment(current_setting('t.thabo')::uuid);
  perform dev.assert((select stage from public.v_enrolment_progress where enrolment_id = current_setting('t.thabo')::uuid) = 'payment',
    'stage: payment after acceptance');
  perform dev.assert((select offer_expires_on from public.v_enrolment_progress where enrolment_id = current_setting('t.thabo')::uuid)
                     = current_date + 7, 'the offer expires 7 days after acceptance');
  perform public.set_payment_settings('0821234567', 'Skolopals Tutoring Centre', 'FNB');
end $$;

\echo ''
\echo '=== FAMILY A pays with PayShap ==='
select set_config('request.jwt.claims', :parent_a, true) \g /dev/null
do $$
declare
  v_invoice uuid := (select offer_invoice_id from public.v_enrolment_progress where enrolment_id = current_setting('t.thabo')::uuid);
  v_start jsonb;
begin
  perform dev.assert((select payshap_id from public.payment_settings where effective_to is null) = '0821234567',
    'the parent can read the centre''s ShapID');
  begin
    perform public.set_payment_settings('000', 'Not me');
    raise exception 'FAILED: a parent changed the ShapID';
  exception when raise_exception then
    raise notice '  PASS  rejected: a parent changing the payment details';
  end;

  v_start := private.start_payment_submission(v_invoice);
  perform set_config('t.sub_a', v_start ->> 'submissionId', true);
  perform dev.assert(v_start ->> 'status' = 'awaiting_proof' and not (v_start ->> 'requoted')::boolean, '"I have made the payment" opens a submission');
  perform dev.assert(private.start_payment_submission(v_invoice) ->> 'submissionId' = v_start ->> 'submissionId',
    'pressing it again returns the same submission');
  perform dev.assert((select stage from public.v_enrolment_progress where enrolment_id = current_setting('t.thabo')::uuid) = 'proof',
    'stage: proof');

  begin
    perform private.attach_payment_proof((v_start ->> 'submissionId')::uuid,
      '{"stagingPath":"staging/bbbbbbbb-0000-0000-0000-000000000002/00000000-0000-4000-8000-000000000009.png","mime":"image/png"}'::jsonb);
    raise exception 'FAILED: attached another user''s upload as proof';
  exception when raise_exception then
    raise notice '  PASS  rejected: proof from another user''s staging folder';
  end;

  perform dev.assert(private.attach_payment_proof((v_start ->> 'submissionId')::uuid, jsonb_build_object(
      'stagingPath', 'staging/aaaaaaaa-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000004.jpg',
      'mime', 'image/jpeg',
      'claimedAmountCents', (select total_cents from public.v_invoice_status where id = v_invoice),
      'claimedPaidOn', current_date, 'payerReference', 'THABO'))
    ->> 'storagePath' like '%/' || (v_start ->> 'submissionId') || '/%.jpg', 'proof is filed under the account and submission');
  perform dev.assert((select stage from public.v_enrolment_progress where enrolment_id = current_setting('t.thabo')::uuid) = 'verification',
    'stage: verification');
end $$;

select set_config('request.jwt.claims', :parent_b, true) \g /dev/null
do $$ begin
  perform dev.assert((select count(*) from public.payment_submissions) = 0, 'another family cannot see the submission');
end $$;

\echo ''
\echo '=== ADMIN verifies: activation and automatic placement (§4.7) ==='
select set_config('request.jwt.claims', :admin, true) \g /dev/null
do $$
declare
  v_result jsonb;
  v_amount integer := (select claimed_amount_cents from public.payment_submissions where id = current_setting('t.sub_a')::uuid);
begin
  perform dev.assert((select count(*) from public.notification_recipients nr join public.notifications n on n.id = nr.notification_id
                       where nr.profile_id = 'dddddddd-0000-0000-0000-000000000004' and n.title = 'Proof of payment to check') = 1,
    'admins are told there is proof to check');

  v_result := private.verify_payment_submission(current_setting('t.sub_a')::uuid, v_amount, current_date, '');
  perform dev.assert((v_result ->> 'activated')::boolean, 'paying the offer invoice activates the enrolment');
  perform dev.assert((select method from public.payments where id = (v_result ->> 'paymentId')::uuid) = 'payshap', 'recorded as a PayShap payment');
  perform dev.assert((select status from public.enrolments where id = current_setting('t.thabo')::uuid) = 'active', 'Thabo is active');

  perform dev.assert(exists (select 1 from public.class_enrolments where class_group_id = '88888888-0000-0000-0000-000000000001'
                              and placement_method = 'auto'), 'Maths: placed with the preferred tutor first');
  perform dev.assert(exists (select 1 from public.class_enrolments where class_group_id = '88888888-0000-0000-0000-000000000004'),
    'English: the Wednesday class, because Monday 15:30 clashes with Maths');
  perform dev.assert(not exists (select 1 from public.class_enrolments where class_group_id = '88888888-0000-0000-0000-000000000003'),
    'never placed in the clashing class');
  perform dev.assert((select assigned_tutor_id from public.enrolments where id = current_setting('t.thabo')::uuid)
                     = '44444444-0000-0000-0000-00000000000e', 'assigned tutor: the preferred tutor, who got a class');
  perform dev.assert((select stage from public.v_enrolment_progress where enrolment_id = current_setting('t.thabo')::uuid) = 'active',
    'stage: active');
  perform dev.assert(((v_result ->> 'nextInvoiceId') is not null) = (extract(day from current_date) >= 15),
    'next month is billed at once only when its run date (the 15th) has passed (D9)');

  begin
    perform private.verify_payment_submission(current_setting('t.sub_a')::uuid, v_amount, current_date, '');
    raise exception 'FAILED: verified twice';
  exception when raise_exception then
    if sqlerrm not like 'Already verified by Winnie Thobela at %' then raise; end if;
    raise notice '  PASS  rejected: verifying twice ("%")', sqlerrm;
  end;
end $$;

\echo ''
\echo '--- a tutor who now teaches Thabo can open his report card ---'
select set_config('t.doc2', (select d.id::text from public.learner_documents d join public.enrolments e on e.learner_id = d.learner_id
                             where e.id = current_setting('t.thabo')::uuid and d.superseded_at is null), true) \g /dev/null
select set_config('request.jwt.claims', :naledi, true) \g /dev/null
do $$ begin
  perform dev.assert(private.learner_document_download(current_setting('t.doc2')::uuid) is not null,
    'Naledi (English Wednesday) can open it');
end $$;

\echo ''
\echo '=== FAMILY B: rejected proof, part payment, no class for a subject ==='
select set_config('request.jwt.claims', :parent_b, true) \g /dev/null
select set_config('t.lerato', (private.submit_enrolment(
  '{"full_name":"Lerato Khumalo","date_of_birth":"2013-04-02","grade_code":"grade_7","relationship":"mother"}'::jsonb,
  'group_1', '[{"subject_code":"natural_sciences","preferred_language_code":"english"}]'::jsonb,
  :contact, '[]'::jsonb, :consents, '1.0',
  '{"stagingPath":"staging/bbbbbbbb-0000-0000-0000-000000000002/00000000-0000-4000-8000-000000000005.pdf","mime":"application/pdf","sizeBytes":1000}'::jsonb,
  null) ->> 'enrolmentId'), true) \g /dev/null
reset role;
insert into public.aptitude_attempts
  (learner_id, enrolment_id, bank_version, status, current_difficulty, completed_at, final_band, level_label, literacy_pct, logic_pct, low_confidence)
select e.learner_id, e.id, b.version, 'completed', 3, now(), 3, 'Developing', 60, 60, false
  from public.enrolments e, public.aptitude_banks b where b.is_current and e.id = current_setting('t.lerato')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', :admin, true) \g /dev/null
select public.accept_enrolment(current_setting('t.lerato')::uuid) \g /dev/null

select set_config('request.jwt.claims', :parent_b, true) \g /dev/null
select set_config('t.inv_b', (select offer_invoice_id::text from public.enrolments where id = current_setting('t.lerato')::uuid), true) \g /dev/null
select set_config('t.sub_b1', private.start_payment_submission(current_setting('t.inv_b')::uuid) ->> 'submissionId', true) \g /dev/null
select private.attach_payment_proof(current_setting('t.sub_b1')::uuid,
  '{"stagingPath":"staging/bbbbbbbb-0000-0000-0000-000000000002/00000000-0000-4000-8000-000000000006.png","mime":"image/png","claimedAmountCents":10000}'::jsonb) \g /dev/null

select set_config('request.jwt.claims', :admin, true) \g /dev/null
do $$ begin
  begin
    perform private.reject_payment_submission(current_setting('t.sub_b1')::uuid, '');
    raise exception 'FAILED: rejected without a reason';
  exception when check_violation then
    raise notice '  PASS  rejected: rejecting proof without a reason';
  end;
  perform private.reject_payment_submission(current_setting('t.sub_b1')::uuid, 'Amount does not match');
  perform dev.assert((select stage from public.v_enrolment_progress where enrolment_id = current_setting('t.lerato')::uuid) = 'payment',
    'after a rejection the parent is back at payment');
  perform dev.assert((select offer_expires_on from public.v_enrolment_progress where enrolment_id = current_setting('t.lerato')::uuid)
                     = current_date + 7, 'a rejection today does not shorten the 7 days');
end $$;

select set_config('request.jwt.claims', :parent_b, true) \g /dev/null
do $$
declare v_sub uuid;
begin
  perform dev.assert((select count(*) from public.notification_recipients nr join public.notifications n on n.id = nr.notification_id
                       where n.title = 'We could not confirm your payment') = 1, 'the parent is told why the proof was rejected');
  v_sub := (private.start_payment_submission(current_setting('t.inv_b')::uuid) ->> 'submissionId')::uuid;
  perform dev.assert(v_sub <> current_setting('t.sub_b1')::uuid, 'a new submission after a rejection');
  perform private.attach_payment_proof(v_sub,
    '{"stagingPath":"staging/bbbbbbbb-0000-0000-0000-000000000002/00000000-0000-4000-8000-000000000007.png","mime":"image/png","claimedAmountCents":10000}'::jsonb);
  perform set_config('t.sub_b2', v_sub::text, true);
end $$;

select set_config('request.jwt.claims', :admin, true) \g /dev/null
do $$
declare v_result jsonb;
begin
  v_result := private.verify_payment_submission(current_setting('t.sub_b2')::uuid, 10000, current_date, 'LERATO');
  perform dev.assert(not (v_result ->> 'activated')::boolean, 'a part payment does not activate');
  perform dev.assert((select status from public.enrolments where id = current_setting('t.lerato')::uuid) = 'accepted', 'Lerato stays accepted');
  perform dev.assert((select stage from public.v_enrolment_progress where enrolment_id = current_setting('t.lerato')::uuid) = 'payment',
    'stage: payment, the rest is still due');
end $$;

select set_config('request.jwt.claims', :parent_b, true) \g /dev/null
select set_config('t.sub_b3', private.start_payment_submission(current_setting('t.inv_b')::uuid) ->> 'submissionId', true) \g /dev/null
select private.attach_payment_proof(current_setting('t.sub_b3')::uuid,
  '{"stagingPath":"staging/bbbbbbbb-0000-0000-0000-000000000002/00000000-0000-4000-8000-000000000008.png","mime":"image/png"}'::jsonb) \g /dev/null

select set_config('request.jwt.claims', :admin, true) \g /dev/null
do $$
declare v_result jsonb;
begin
  v_result := private.verify_payment_submission(current_setting('t.sub_b3')::uuid,
    (select balance_cents from public.v_invoice_status where id = current_setting('t.inv_b')::uuid)::integer, current_date, '');
  perform dev.assert((v_result ->> 'activated')::boolean, 'the balance completes the payment and activates');
  perform dev.assert(jsonb_array_length(v_result -> 'placement' -> 'unplaced') = 1, 'Natural Sciences has no class, so it is unplaced');
  perform dev.assert((select stage from public.v_enrolment_progress where enrolment_id = current_setting('t.lerato')::uuid) = 'needs_placement',
    'stage: needs_placement');
  perform dev.assert(exists (select 1 from public.notifications where title = 'Lerato Khumalo needs placing'), 'admins are told to place her');
end $$;

\echo ''
\echo '=== billing after activation (§5.3) on fixed dates ==='
reset role;
select set_config('request.jwt.claims', :admin, true) \g /dev/null
do $$
declare v_e uuid; v_next uuid;
begin
  -- A second Thabo-family child accepted on 20 Nov 2026 and paid the same day.
  v_e := (select id from public.enrolments where id = current_setting('t.sipho_child')::uuid);
  update public.enrolments set status = 'pending', decline_reason = null, declined_at = null where id = v_e;
  perform private.accept_enrolment_on(v_e, '2026-11-20');
  perform dev.assert((select total_cents from public.v_invoice_status v join public.enrolments e on e.offer_invoice_id = v.id where e.id = v_e) = 31500,
    'accepted 20 Nov: first payment R315 (R150 + 11/30 of R450)');
  perform public.record_payment((select billing_account_id from public.invoices i join public.enrolments e on e.offer_invoice_id = i.id where e.id = v_e),
    31500, 'eft', 'X', '2026-11-20');
  perform private.activate_enrolment_core(v_e, null);
  perform dev.assert((select start_date from public.enrolments where id = v_e) = '2026-11-20', 'the place starts on the acceptance date');

  v_next := private.bill_after_activation(v_e, '2026-11-20');
  perform dev.assert((select total_cents from public.v_invoice_status where id = v_next) = 45000, 'paid after the 15th: a R450 December invoice (D9)');
  perform dev.assert((select due_on from public.invoices where id = v_next) = '2026-12-01', 'due on 1 December');
  perform dev.assert(private.bill_after_activation(v_e, '2026-11-20') is null, 'and only once');

  perform public.run_monthly_invoices('2026-12-01');
  perform dev.assert((select count(*) from public.invoice_lines where enrolment_id = v_e and period_month = '2026-11-01' and voided_at is null) = 1,
    'the December run does not bill November again');
  perform dev.assert((select count(*) from public.invoice_lines where enrolment_id = v_e and period_month = '2026-12-01' and voided_at is null) = 1,
    'nor December twice');
end $$;

\echo ''
\echo '=== the daily offer job (§5.4, D14) ==='
-- Four more family-B applications, each accepted on a different day.
set local role authenticated;
select set_config('request.jwt.claims', :parent_b, true) \g /dev/null
select set_config('t.e' || n, (private.submit_enrolment(
  jsonb_build_object('full_name', 'Child ' || n, 'date_of_birth', '2013-01-01', 'grade_code', 'grade_7', 'relationship', 'mother'),
  'group_1', '[{"subject_code":"mathematics","preferred_language_code":"english"}]'::jsonb,
  :contact, '[]'::jsonb, :consents, '1.0',
  jsonb_build_object('stagingPath', format('staging/bbbbbbbb-0000-0000-0000-000000000002/00000000-0000-4000-8000-0000000001%s.pdf', lpad(n::text, 2, '0')),
                     'mime', 'application/pdf', 'sizeBytes', 1000),
  null) ->> 'enrolmentId'), true)
from generate_series(1, 5) n \g /dev/null
reset role;
insert into public.aptitude_attempts
  (learner_id, enrolment_id, bank_version, status, current_difficulty, completed_at, final_band, level_label, literacy_pct, logic_pct, low_confidence)
select e.learner_id, e.id, b.version, 'completed', 3, now(), 3, 'Developing', 60, 60, false
  from public.enrolments e, public.aptitude_banks b
 where b.is_current and e.id in (select current_setting('t.e' || n)::uuid from generate_series(1, 5) n);

select set_config('request.jwt.claims', :admin, true) \g /dev/null
select private.accept_enrolment_on(current_setting('t.e1')::uuid, current_date - 3) \g /dev/null   -- reminder due
select private.accept_enrolment_on(current_setting('t.e2')::uuid, current_date - 7) \g /dev/null   -- lapses
select private.accept_enrolment_on(current_setting('t.e3')::uuid, current_date - 8) \g /dev/null   -- proof waiting
select private.accept_enrolment_on(current_setting('t.e4')::uuid, current_date - 7) \g /dev/null   -- proof rejected today

set local role authenticated;
select set_config('request.jwt.claims', :parent_b, true) \g /dev/null
select set_config('t.s3', private.start_payment_submission((select offer_invoice_id from public.enrolments where id = current_setting('t.e3')::uuid)) ->> 'submissionId', true) \g /dev/null
select private.attach_payment_proof(current_setting('t.s3')::uuid,
  '{"stagingPath":"staging/bbbbbbbb-0000-0000-0000-000000000002/00000000-0000-4000-8000-000000000203.png","mime":"image/png"}'::jsonb) \g /dev/null
select set_config('t.s4', private.start_payment_submission((select offer_invoice_id from public.enrolments where id = current_setting('t.e4')::uuid)) ->> 'submissionId', true) \g /dev/null
select private.attach_payment_proof(current_setting('t.s4')::uuid,
  '{"stagingPath":"staging/bbbbbbbb-0000-0000-0000-000000000002/00000000-0000-4000-8000-000000000204.png","mime":"image/png"}'::jsonb) \g /dev/null
select set_config('request.jwt.claims', :admin, true) \g /dev/null
select private.reject_payment_submission(current_setting('t.s4')::uuid, 'Blurry photo') \g /dev/null

reset role;
do $$
declare v_old uuid := (select offer_invoice_id from public.enrolments where id = current_setting('t.e2')::uuid);
begin
  begin
    perform private.process_enrolment_offers(current_date + 1);
    raise exception 'FAILED: the job ran for a future date';
  exception when raise_exception then
    raise notice '  PASS  rejected: running the offer job for a future date';
  end;

  perform private.process_enrolment_offers(current_date);
  perform private.process_enrolment_offers(current_date);   -- repeated run is harmless

  perform dev.assert((select count(*) from public.enrolment_offer_events where enrolment_id = current_setting('t.e1')::uuid and kind = 'reminder') = 1,
    'day 3: exactly one reminder, even when the job runs twice');
  perform dev.assert((select status from public.enrolments where id = current_setting('t.e1')::uuid) = 'accepted', 'day 3: still accepted');

  perform dev.assert((select decline_reason from public.enrolments where id = current_setting('t.e2')::uuid) = 'Offer lapsed', 'day 7: the offer lapses');
  perform dev.assert((select status from public.invoices where id = v_old) = 'cancelled', 'its invoice is cancelled');
  perform dev.assert(not exists (select 1 from public.invoice_lines where invoice_id = v_old and voided_at is null), 'and its lines voided');

  perform dev.assert((select status from public.enrolments where id = current_setting('t.e3')::uuid) = 'accepted',
    'a proof waiting for verification stops the clock');
  perform dev.assert((select status from public.enrolments where id = current_setting('t.e4')::uuid) = 'accepted',
    'a proof rejected today gives 2 more days');
  perform dev.assert((select offer_expires_on from public.v_enrolment_progress where enrolment_id = current_setting('t.e4')::uuid) = current_date + 2,
    'the new deadline is shown');

  -- Re-accepting a lapsed offer: fresh invoice, same month, no clash with the voided one.
  perform set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000004","role":"authenticated"}', true);
  perform public.accept_enrolment(current_setting('t.e2')::uuid);
  perform dev.assert((select status from public.enrolments where id = current_setting('t.e2')::uuid) = 'accepted', 'a lapsed offer can be accepted again');
  perform dev.assert((select offer_invoice_id from public.enrolments where id = current_setting('t.e2')::uuid) <> v_old, 'with a fresh invoice');
end $$;

\echo ''
\echo '--- an offer invoice from last month is re-quoted when the parent pays (§5.3) ---'
-- Accepted three days before this month began (after the job ran, so it has not lapsed).
select private.accept_enrolment_on(current_setting('t.e5')::uuid, (date_trunc('month', current_date) - interval '3 days')::date) \g /dev/null
set local role authenticated;
select set_config('request.jwt.claims', :parent_b, true) \g /dev/null
do $$
declare
  v_old uuid := (select offer_invoice_id from public.enrolments where id = current_setting('t.e5')::uuid);
  v_start jsonb := private.start_payment_submission(v_old);
begin
  perform dev.assert((v_start ->> 'requoted')::boolean, 'the old invoice is re-quoted');
  perform dev.assert((v_start ->> 'invoiceId')::uuid <> v_old, 'payment opens on the new invoice');
  perform dev.assert((select issued_on from public.invoices where id = (v_start ->> 'invoiceId')::uuid) = current_date, 'issued today');
  perform dev.assert((select offer_invoice_id from public.enrolments where id = current_setting('t.e5')::uuid) = (v_start ->> 'invoiceId')::uuid,
    'and linked to the application');
end $$;

\echo ''
\echo 'applications: all checks passed'
rollback;
SQL
