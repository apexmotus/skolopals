#!/usr/bin/env bash
# Tutor applications (SPEC-2026-11-tutor-applications.md): the admin's on/off
# switch and rounds, submission rules (documents, identity, police clearance,
# staging ownership, REST guard), applicant visibility, review, police
# clearance on request, approval into a suspended tutor, and the invite path
# still working through private.make_tutor. Rolls back.
set -euo pipefail
DB="${DATABASE_URL:?DATABASE_URL not set}"

psql "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
begin;
set constraints all immediate;

\set admin   '''{"sub":"dddddddd-0000-0000-0000-000000000004","role":"authenticated"}'''
\set zanele  '''{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}'''
\set kagiso  '''{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}'''
\set tutor   '''{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}'''
\set invitee '''{"sub":"eeeeeeee-0000-0000-0000-000000000005","role":"authenticated"}'''

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001','zanele@test','{"full_name":"Zanele Mthembu"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002','kagiso@test','{"full_name":"Kagiso Molefe"}'),
  ('cccccccc-0000-0000-0000-000000000003','naledi@test','{"full_name":"Naledi Dube"}'),
  ('eeeeeeee-0000-0000-0000-000000000005','invitee@test','{"full_name":"Invited Person"}'),
  ('dddddddd-0000-0000-0000-000000000004','admin@test','{"full_name":"Winnie Thobela"}');
insert into public.user_roles values
  ('cccccccc-0000-0000-0000-000000000003','tutor'),
  ('dddddddd-0000-0000-0000-000000000004','admin');
insert into public.tutors (profile_id, slug, employment_type)
values ('cccccccc-0000-0000-0000-000000000003','naledi-dube','sessional');

-- A complete application for a given applicant; tests override pieces of it.
create function pg_temp.app(p_uid text, p_docs jsonb default null) returns jsonb language sql as $$
  select jsonb_build_object(
    'firstName', 'Zanele', 'lastName', 'Mthembu',
    'phone', '+27721234567', 'whatsappNumber', '',
    'address', jsonb_build_object('line1', '12 Mampe St', 'line2', '', 'city', 'Brits',
                                  'province', 'North West', 'country', 'South Africa'),
    'competencies', jsonb_build_array(
      jsonb_build_object('subjectCode', 'mathematics', 'gradeCode', 'grade_7', 'languageCodes', jsonb_build_array('english')),
      jsonb_build_object('subjectCode', 'mathematics', 'gradeCode', 'grade_6', 'languageCodes', jsonb_build_array('english', 'setswana'))),
    'documents', coalesce(p_docs, jsonb_build_array(
      jsonb_build_object('docType', 'cv',            'stagingPath', 'staging/' || p_uid || '/00000000-0000-4000-8000-000000000001.pdf', 'mime', 'application/pdf', 'sizeBytes', 1000, 'originalName', 'cv.pdf'),
      jsonb_build_object('docType', 'qualification', 'stagingPath', 'staging/' || p_uid || '/00000000-0000-4000-8000-000000000002.pdf', 'mime', 'application/pdf', 'sizeBytes', 1000, 'title', 'BEd Senior Phase', 'institution', 'NWU', 'yearAwarded', 2019),
      jsonb_build_object('docType', 'id',            'stagingPath', 'staging/' || p_uid || '/00000000-0000-4000-8000-000000000003.jpg', 'mime', 'image/jpeg', 'sizeBytes', 1000),
      jsonb_build_object('docType', 'selfie',        'stagingPath', 'staging/' || p_uid || '/00000000-0000-4000-8000-000000000004.jpg', 'mime', 'image/jpeg', 'sizeBytes', 1000))),
    'references', jsonb_build_array(
      jsonb_build_object('fullName', 'Mr Sello', 'relationship', 'Former principal', 'phone', '0820000001'),
      jsonb_build_object('fullName', 'Ms Dlamini', 'relationship', 'HOD', 'phone', '0820000002', 'email', 'd@school.test'),
      jsonb_build_object('fullName', 'Mrs Botha', 'relationship', 'Colleague', 'phone', '0820000003')),
    'consents', jsonb_build_object('popia', true, 'referencesAgreed', true, 'declaration', true))
$$;
grant execute on function pg_temp.app(text, jsonb) to authenticated;

\echo ''
\echo '=== the switch ==='
set local role anon;
do $$ begin
  perform dev.assert((public.tutor_recruitment_status() ->> 'isOpen')::boolean = false, 'anon sees applications closed');
end $$;

set local role authenticated;
select set_config('request.jwt.claims', :zanele, true) \g /dev/null
do $$ begin
  begin
    perform public.open_tutor_recruitment();
    raise exception 'FAILED: a non-admin opened applications';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    raise notice '  PASS  rejected: a non-admin opening applications';
  end;
  begin
    perform private.submit_tutor_application(pg_temp.app('aaaaaaaa-0000-0000-0000-000000000001'));
    raise exception 'FAILED: applied while closed';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    perform dev.assert(sqlerrm = 'Applications are closed', 'refused while closed: ' || sqlerrm);
  end;
end $$;

select set_config('request.jwt.claims', :admin, true) \g /dev/null
select set_config('t.round1', public.open_tutor_recruitment(now() + interval '20 days', 'We need maths tutors', '{mathematics}', false)::text, true) \g /dev/null
do $$ begin
  begin
    perform public.open_tutor_recruitment();
    raise exception 'FAILED: opened a second round';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    raise notice '  PASS  rejected: opening while already open';
  end;
end $$;

set local role anon;
do $$ declare s jsonb := public.tutor_recruitment_status(); begin
  perform dev.assert((s ->> 'isOpen')::boolean, 'anon sees applications open');
  perform dev.assert(s ->> 'message' = 'We need maths tutors', 'message shown');
  perform dev.assert(s -> 'needs' -> 0 ->> 'code' = 'mathematics', 'needed subject listed');
  perform dev.assert((s ->> 'policeClearanceRequired')::boolean = false, 'police clearance not required');
end $$;

\echo ''
\echo '=== submitting ==='
set local role authenticated;
select set_config('request.jwt.claims', :tutor, true) \g /dev/null
do $$ begin
  begin
    perform private.submit_tutor_application(pg_temp.app('cccccccc-0000-0000-0000-000000000003'));
    raise exception 'FAILED: an existing tutor applied';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    raise notice '  PASS  rejected: an existing tutor applying';
  end;
end $$;

select set_config('request.jwt.claims', :zanele, true) \g /dev/null
do $$ declare a jsonb := pg_temp.app('aaaaaaaa-0000-0000-0000-000000000001'); begin
  -- Someone else's staged file.
  begin
    perform private.submit_tutor_application(jsonb_set(a, '{documents,0,stagingPath}',
      '"staging/bbbbbbbb-0000-0000-0000-000000000002/00000000-0000-4000-8000-000000000009.pdf"'));
    raise exception 'FAILED: filed another user''s upload';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    raise notice '  PASS  rejected: another user''s staged file';
  end;
  -- A PDF as the selfie.
  begin
    perform private.submit_tutor_application(jsonb_set(a, '{documents,3,stagingPath}',
      '"staging/aaaaaaaa-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000004.pdf"'));
    raise exception 'FAILED: accepted a PDF selfie';
  exception when check_violation then
    raise notice '  PASS  rejected: a PDF as the selfie';
  end;
  -- No selfie at all.
  begin
    perform private.submit_tutor_application(jsonb_set(a, '{documents}', (a -> 'documents') - 3));
    raise exception 'FAILED: accepted no selfie';
  exception when check_violation then
    perform dev.assert(sqlerrm = 'Take a selfie', 'refused without a selfie');
  end;
  -- Two references.
  begin
    perform private.submit_tutor_application(jsonb_set(a, '{references}', (a -> 'references') - 2));
    raise exception 'FAILED: accepted two references';
  exception when check_violation then
    raise notice '  PASS  rejected: two references';
  end;
  -- A consent left unticked.
  begin
    perform private.submit_tutor_application(jsonb_set(a, '{consents,declaration}', 'false'));
    raise exception 'FAILED: accepted without the declaration';
  exception when check_violation then
    raise notice '  PASS  rejected: declaration not ticked';
  end;
  -- A subject the centre does not offer at that grade.
  begin
    perform private.submit_tutor_application(jsonb_set(a, '{competencies,0,gradeCode}', '"grade_nope"'));
    raise exception 'FAILED: accepted an unknown offering';
  exception when foreign_key_violation then
    raise notice '  PASS  rejected: subject not offered at that grade';
  end;
end $$;

-- Over REST (PostgREST sets request.method).
select set_config('request.method', 'POST', true) \g /dev/null
do $$ begin
  begin
    perform private.submit_tutor_application(pg_temp.app('aaaaaaaa-0000-0000-0000-000000000001'));
    raise exception 'FAILED: submitted over REST';
  exception when insufficient_privilege then
    raise notice '  PASS  rejected: submission over the REST API';
  end;
end $$;
select set_config('request.method', '', true) \g /dev/null

select set_config('t.zanele_app',
  private.submit_tutor_application(pg_temp.app('aaaaaaaa-0000-0000-0000-000000000001')) ->> 'applicationId', true) \g /dev/null
do $$
declare a public.tutor_applications;
begin
  select * into a from public.tutor_applications where id = current_setting('t.zanele_app')::uuid;
  perform dev.assert(a.status = 'submitted', 'Zanele''s application submitted');
  perform dev.assert(a.whatsapp_number = '+27721234567', 'WhatsApp copied from phone when left blank');
  perform dev.assert(not a.police_clearance_required, 'police clearance recorded as not required');
  perform dev.assert((select count(*) from public.tutor_application_documents where application_id = a.id) = 4, 'four documents filed');
  perform dev.assert((select bool_and(storage_path like 'applications/' || a.id || '/%') from public.tutor_application_documents where application_id = a.id),
    'documents filed under applications/<id>/');
  perform dev.assert((select count(*) from public.tutor_application_competency_media m
                        join public.tutor_application_competencies c on c.id = m.competency_id
                       where c.application_id = a.id) = 3, 'three competency/language pairs');
  begin
    perform private.submit_tutor_application(pg_temp.app('aaaaaaaa-0000-0000-0000-000000000001'));
    raise exception 'FAILED: applied twice in one round';
  exception when unique_violation then
    raise notice '  PASS  rejected: applying twice in a round';
  end;
end $$;

reset role;
do $$ begin
  perform dev.assert((select count(*) from public.notification_recipients r join public.notifications n on n.id = r.notification_id
                       where n.title = 'New tutor application'
                         and r.profile_id = 'dddddddd-0000-0000-0000-000000000004') = 1, 'admin notified');
end $$;
set local role authenticated;

\echo ''
\echo '=== police clearance switched on mid-round ==='
select set_config('request.jwt.claims', :admin, true) \g /dev/null
select public.update_tutor_recruitment(now() + interval '20 days', 'We need maths tutors', '{mathematics}', true) \g /dev/null

select set_config('request.jwt.claims', :kagiso, true) \g /dev/null
do $$ begin
  begin
    perform private.submit_tutor_application(pg_temp.app('bbbbbbbb-0000-0000-0000-000000000002'));
    raise exception 'FAILED: accepted without a police clearance';
  exception when check_violation then
    perform dev.assert(sqlerrm = 'Upload your police clearance certificate', 'refused without the required clearance');
  end;
end $$;
select set_config('t.kagiso_app', private.submit_tutor_application(
  pg_temp.app('bbbbbbbb-0000-0000-0000-000000000002') #- '{documents}' ||
  jsonb_build_object('documents', (pg_temp.app('bbbbbbbb-0000-0000-0000-000000000002') -> 'documents') ||
    jsonb_build_array(jsonb_build_object('docType', 'police_clearance',
      'stagingPath', 'staging/bbbbbbbb-0000-0000-0000-000000000002/00000000-0000-4000-8000-000000000005.pdf',
      'mime', 'application/pdf', 'sizeBytes', 1000)))) ->> 'applicationId', true) \g /dev/null

do $$ begin
  perform dev.assert((select police_clearance_required from public.tutor_applications where id = current_setting('t.kagiso_app')::uuid),
    'Kagiso''s application records clearance as required');
  perform dev.assert((select count(*) from public.tutor_applications) = 1, 'an applicant sees only their own application');
  perform dev.assert((select count(*) from public.tutor_application_documents) = 5, 'and only their own documents');
end $$;

\echo ''
\echo '=== review ==='
select set_config('request.jwt.claims', :zanele, true) \g /dev/null
do $$ begin
  begin
    perform public.list_tutor_applications();
    raise exception 'FAILED: an applicant listed applications';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    raise notice '  PASS  rejected: an applicant using the admin list';
  end;
  begin
    perform public.set_tutor_application_status(current_setting('t.zanele_app')::uuid, 'shortlisted');
    raise exception 'FAILED: an applicant shortlisted themselves';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    raise notice '  PASS  rejected: applicant changing their own status';
  end;
end $$;

select set_config('request.jwt.claims', :admin, true) \g /dev/null
select public.set_tutor_application_status(current_setting('t.zanele_app')::uuid, 'shortlisted') \g /dev/null
select public.request_police_clearance(current_setting('t.zanele_app')::uuid, null, 'Please upload by 15 Jan') \g /dev/null

select set_config('request.jwt.claims', :zanele, true) \g /dev/null
do $$ begin
  begin
    perform private.withdraw_tutor_application(current_setting('t.zanele_app')::uuid);
    raise exception 'FAILED: withdrew a shortlisted application';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    raise notice '  PASS  rejected: withdrawing after review started';
  end;
  perform dev.assert((select police_clearance_requested_at is not null from public.tutor_applications
                       where id = current_setting('t.zanele_app')::uuid), 'clearance request visible to applicant');
end $$;
select private.add_police_clearance(jsonb_build_object(
  'stagingPath', 'staging/aaaaaaaa-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000006.pdf',
  'mime', 'application/pdf', 'sizeBytes', 1000, 'originalName', 'saps.pdf')) \g /dev/null
do $$ begin
  perform dev.assert((select police_clearance_requested_at is null from public.tutor_applications
                       where id = current_setting('t.zanele_app')::uuid), 'request cleared on upload');
  perform dev.assert((select count(*) from public.tutor_application_documents
                       where application_id = current_setting('t.zanele_app')::uuid and doc_type = 'police_clearance') = 1,
    'clearance filed on the application');
end $$;

\echo ''
\echo '=== approve ==='
select set_config('request.jwt.claims', :admin, true) \g /dev/null
do $$ declare r record; begin
  select * into r from public.list_tutor_applications(p_application_id => current_setting('t.zanele_app')::uuid);
  perform dev.assert(r.email = 'zanele@test', 'admin list carries the applicant''s email');
  perform dev.assert(r.has_police_clearance, 'admin list shows the clearance arrived');
  perform dev.assert(r.subjects -> 0 ->> 'subject' = 'Mathematics' and jsonb_array_length(r.subjects -> 0 -> 'grades') = 2,
    'admin list groups grades under the subject');
  perform dev.assert((select count(*) from public.list_tutor_applications('needs_action')) = 2, 'both applications need action');
end $$;
select public.mark_tutor_application_identity_checked(current_setting('t.zanele_app')::uuid) \g /dev/null
select set_config('t.approved', public.approve_tutor_application(current_setting('t.zanele_app')::uuid)::text, true) \g /dev/null

do $$
declare
  v_tutor public.tutors;
  v_res   jsonb := current_setting('t.approved')::jsonb;
begin
  select * into v_tutor from public.tutors where id = (v_res ->> 'tutorId')::uuid;
  perform dev.assert(v_tutor.status = 'suspended', 'approved tutor starts suspended');
  perform dev.assert(v_tutor.slug = 'zanele-mthembu', 'slug from the name');
  perform dev.assert(v_tutor.application_id = current_setting('t.zanele_app')::uuid, 'tutor linked to the application');
  perform dev.assert(jsonb_array_length(v_res -> 'skippedCompetencies') = 0, 'no competencies skipped');
  perform dev.assert(exists (select 1 from public.user_roles where user_id = v_tutor.profile_id and role = 'tutor'), 'tutor role granted');
  perform dev.assert(not exists (select 1 from public.user_roles where user_id = v_tutor.profile_id and role = 'parent'), 'self-signup parent role removed');
  perform dev.assert(not exists (select 1 from public.guardians where profile_id = v_tutor.profile_id), 'empty guardian row removed');
  perform dev.assert((select count(*) from public.tutor_competencies where tutor_id = v_tutor.id) = 2, 'two competencies copied');
  perform dev.assert((select count(*) from public.tutor_competency_media m join public.tutor_competencies c on c.id = m.competency_id
                       where c.tutor_id = v_tutor.id) = 3, 'their languages copied');
  perform dev.assert((select count(*) from public.tutor_documents where tutor_id = v_tutor.id) = 5, 'five documents copied');
  perform dev.assert((select count(*) from public.tutor_documents where tutor_id = v_tutor.id
                       and doc_type in ('id', 'selfie') and verified_at is not null) = 2, 'ID and selfie verified by the identity check');
  perform dev.assert((select count(*) from public.tutor_documents where tutor_id = v_tutor.id
                       and doc_type not in ('id', 'selfie') and verified_at is null) = 3, 'other documents unverified');
  perform dev.assert((select count(*) from public.tutor_references where tutor_id = v_tutor.id and outcome is null) = 3, 'three references to check');
  perform dev.assert((select title from public.tutor_qualifications where tutor_id = v_tutor.id) = 'BEd Senior Phase', 'qualification recorded');
  perform dev.assert((select phone from public.profiles where id = v_tutor.profile_id) = '+27721234567', 'phone on the profile');
  perform dev.assert(not exists (select 1 from public.tutors t where t.id = v_tutor.id and t.status = 'active'),
    'not in the public directory until activated');
  begin
    perform public.approve_tutor_application(current_setting('t.zanele_app')::uuid);
    raise exception 'FAILED: approved twice';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    raise notice '  PASS  rejected: approving a decided application';
  end;
end $$;

-- Approved but suspended: the tutor cannot activate themselves.
select set_config('request.jwt.claims', :zanele, true) \g /dev/null
do $$ begin
  begin
    update public.tutors set status = 'active' where profile_id = 'aaaaaaaa-0000-0000-0000-000000000001';
    raise exception 'FAILED: a suspended tutor activated themselves';
  exception when insufficient_privilege then
    raise notice '  PASS  rejected: a tutor changing their own status';
  end;
  update public.tutors set headline = 'Maths made simple' where profile_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform dev.assert(found, 'a tutor can still edit their own headline');
end $$;
select set_config('request.jwt.claims', :admin, true) \g /dev/null

-- A clearance requested from the tutor after approval.
select public.request_police_clearance(null, (current_setting('t.approved')::jsonb ->> 'tutorId')::uuid, '') \g /dev/null

select set_config('request.jwt.claims', :zanele, true) \g /dev/null
select private.add_police_clearance(jsonb_build_object(
  'stagingPath', 'staging/aaaaaaaa-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000007.pdf',
  'mime', 'application/pdf', 'sizeBytes', 1000)) \g /dev/null
do $$ begin
  perform dev.assert((select police_clearance_requested_at is null from public.tutors
                       where profile_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'tutor''s upload clears the request');
end $$;
reset role;
do $$ begin
  perform dev.assert((select count(*) from public.tutor_documents d join public.tutors t on t.id = d.tutor_id
                       where t.profile_id = 'aaaaaaaa-0000-0000-0000-000000000001' and d.doc_type = 'police_clearance') = 2,
    'second clearance filed on the tutor record');
end $$;
set local role authenticated;
select set_config('request.jwt.claims', :admin, true) \g /dev/null
select public.set_tutor_application_status(current_setting('t.kagiso_app')::uuid, 'rejected', 'Not enough experience') \g /dev/null
do $$ begin
  perform dev.assert((select status from public.tutor_applications where id = current_setting('t.kagiso_app')::uuid) = 'rejected', 'Kagiso rejected');
end $$;

\echo ''
\echo '=== retention: unsuccessful applications deleted after 12 months, on confirmation ==='
do $$ begin
  begin
    perform public.purge_tutor_application(current_setting('t.kagiso_app')::uuid);
    raise exception 'FAILED: purged an application before it was due';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    raise notice '  PASS  rejected: deleting before the 12 months are up';
  end;
  perform dev.assert(not exists (select 1 from public.v_tutor_application_retention_due), 'nothing due yet');
end $$;
reset role;
update public.tutor_applications set reviewed_at = now() - interval '13 months'
 where id in (current_setting('t.kagiso_app')::uuid, current_setting('t.zanele_app')::uuid);
set local role authenticated;
select set_config('request.jwt.claims', :kagiso, true) \g /dev/null
do $$ begin
  perform dev.assert(not exists (select 1 from public.v_tutor_application_retention_due), 'an applicant cannot see the due list');
  begin
    perform public.purge_tutor_application(current_setting('t.kagiso_app')::uuid);
    raise exception 'FAILED: a non-admin purged an application';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    raise notice '  PASS  rejected: a non-admin deleting an application';
  end;
end $$;
select set_config('request.jwt.claims', :admin, true) \g /dev/null
do $$ declare r jsonb; begin
  perform dev.assert((select count(*) from public.v_tutor_application_retention_due) = 1,
    'only the rejected application is due (the approved one stays with the tutor record)');
  r := public.purge_tutor_application(current_setting('t.kagiso_app')::uuid);
  perform dev.assert(jsonb_array_length(r -> 'storagePaths') = 5, 'returns the five files to delete from storage');
  perform dev.assert(not exists (select 1 from public.tutor_applications where id = current_setting('t.kagiso_app')::uuid),
    'application deleted');
  perform dev.assert(not exists (select 1 from public.tutor_application_documents where application_id = current_setting('t.kagiso_app')::uuid)
    and not exists (select 1 from public.tutor_application_references where application_id = current_setting('t.kagiso_app')::uuid),
    'its documents and references deleted with it');
  perform dev.assert((select subject_label from public.data_retention_log where subject_id = current_setting('t.kagiso_app')::uuid)
    not like '%Kagiso%', 'the deletion is logged without the applicant''s name');
  perform dev.assert((select action from public.data_retention_log where subject_id = current_setting('t.kagiso_app')::uuid) = 'deleted',
    'logged as deleted');
end $$;

\echo ''
\echo '=== closing, expiry and the next round ==='
select public.close_tutor_recruitment() \g /dev/null
set local role anon;
do $$ begin
  perform dev.assert((public.tutor_recruitment_status() ->> 'isOpen')::boolean = false, 'closed after Close now');
end $$;
set local role authenticated;
select set_config('request.jwt.claims', :admin, true) \g /dev/null
select set_config('t.round2', public.open_tutor_recruitment(now() + interval '1 day')::text, true) \g /dev/null
reset role;
update public.tutor_recruitment_rounds set opened_at = now() - interval '3 days', closes_at = now() - interval '1 minute'
 where id = current_setting('t.round2')::uuid;
set local role anon;
do $$ begin
  perform dev.assert((public.tutor_recruitment_status() ->> 'isOpen')::boolean = false, 'a past closing date closes the round');
end $$;
set local role authenticated;
select set_config('request.jwt.claims', :admin, true) \g /dev/null
select set_config('t.round3', public.open_tutor_recruitment()::text, true) \g /dev/null
do $$ begin
  perform dev.assert((select closed_at from public.tutor_recruitment_rounds where id = current_setting('t.round2')::uuid) is not null,
    'the expired round is closed when the next opens');
end $$;

select set_config('request.jwt.claims', :kagiso, true) \g /dev/null
do $$ begin
  perform private.submit_tutor_application(pg_temp.app('bbbbbbbb-0000-0000-0000-000000000002'));
  raise notice '  PASS  a rejected applicant can apply in a later round';
end $$;

\echo ''
\echo '=== the invite path still works through make_tutor ==='
select set_config('request.jwt.claims', :admin, true) \g /dev/null
select public.configure_invited_user('eeeeeeee-0000-0000-0000-000000000005', 'Invited', 'Person', 'tutor') \g /dev/null
do $$ begin
  perform dev.assert((select status from public.tutors where profile_id = 'eeeeeeee-0000-0000-0000-000000000005') = 'active',
    'invited tutor is active, as before');
  perform dev.assert(not exists (select 1 from public.user_roles where user_id = 'eeeeeeee-0000-0000-0000-000000000005' and role = 'parent'),
    'invited tutor loses the parent role');
end $$;

rollback;
SQL

echo "tutor applications: all passed"
