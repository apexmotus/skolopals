-- POPIA consent types and retention policy.
-- Mirrors docs/POPIA-policy.md Annex B8 and A8. Idempotent.
--
-- The two required consents block enrolment. The two optional ones MUST
-- default to off in the UI and MUST NOT block submission - bundling them
-- would invalidate the consent entirely. health_s27 is retired (the centre
-- doesn't collect health information): kept for consents already given, never
-- asked for. See 20261125000007_retire_health_consent.sql.

insert into public.consent_types (code, name, description, statute_ref, is_required, sort_order, is_active) values
  ('enrolment_s35', 'Processing the learner''s personal information',
   'I am the parent or legal guardian of this learner and I consent to Skolopals processing their personal information as described in the Privacy Notice.',
   'POPIA s35', true, 1, true),
  ('health_s27', 'Health and allergy information',
   'I consent to Skolopals holding my child''s health and allergy information so that staff can keep them safe.',
   'POPIA s27', false, 2, false),
  ('cross_border_s72', 'Storing information outside South Africa',
   'I understand that Skolopals systems are hosted outside South Africa, in the United Kingdom, under protections substantially similar to POPIA.',
   'POPIA s72', true, 3, true),
  ('marketing_photos', 'Photographs and schoolwork in marketing',
   'I consent to Skolopals using photographs of my child or their work in its marketing. I may withdraw this at any time.',
   '', false, 4, true),
  ('marketing_updates', 'WhatsApp and email updates',
   'I would like to receive updates about programmes and centre news.',
   '', false, 5, true)
on conflict (code) do update set
  name = excluded.name, description = excluded.description,
  statute_ref = excluded.statute_ref, is_required = excluded.is_required,
  sort_order = excluded.sort_order, is_active = excluded.is_active;

-- Retention: 5 years, aligned to SARS record-keeping (decision 2026-10-20).
insert into public.data_retention_policies (record_class, description, retention_months, basis) values
  ('learner_records',   'Learner identity, academic records, reports, attendance and authorised collectors',              60, 'Aligned to SARS 5-year record-keeping; POPIA s14'),
  ('financial_records', 'Invoices, payments and accounting records',                                                       60, 'Tax Administration Act record-keeping'),
  ('tutor_records',     'Tutor employment records, qualifications and vetting',                                            60, 'Employment and tax record-keeping'),
  ('enquiries',         'Website enquiries that did not become enrolments',                                                12, 'POPIA s14 minimality'),
  ('messages',          'Portal messages',                                                                                 60, 'Aligned to learner records'),
  ('aptitude_results',  'Aptitude test attempts, answers and results',                                                     60, 'Aligned to learner records; POPIA s35 (child)'),
  ('tutor_applications','Tutor applications that were not successful, with the ID, selfie and documents sent with them',  12, 'POPIA s14 minimality')
on conflict (record_class) do update set
  description = excluded.description, retention_months = excluded.retention_months,
  basis = excluded.basis;
