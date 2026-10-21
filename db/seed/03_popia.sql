-- POPIA consent types and retention policy.
-- Mirrors docs/POPIA-policy.md Annex B8 and A8. Idempotent.
--
-- The three required consents block enrolment. The two optional ones MUST
-- default to off in the UI and MUST NOT block submission - bundling them
-- would invalidate the consent entirely.

insert into public.consent_types (code, name, description, statute_ref, is_required, sort_order) values
  ('enrolment_s35', 'Processing the learner''s personal information',
   'I am the parent or legal guardian of this learner and I consent to Skolopals processing their personal information as described in the Privacy Notice.',
   'POPIA s35', true, 1),
  ('health_s27', 'Health and allergy information',
   'I consent to Skolopals holding my child''s health and allergy information so that staff can keep them safe.',
   'POPIA s27', true, 2),
  ('cross_border_s72', 'Storing information outside South Africa',
   'I understand that Skolopals systems are hosted outside South Africa, in the United Kingdom, under protections substantially similar to POPIA.',
   'POPIA s72', true, 3),
  ('marketing_photos', 'Photographs and schoolwork in marketing',
   'I consent to Skolopals using photographs of my child or their work in its marketing. I may withdraw this at any time.',
   '', false, 4),
  ('marketing_updates', 'WhatsApp and email updates',
   'I would like to receive updates about programmes and centre news.',
   '', false, 5)
on conflict (code) do update set
  name = excluded.name, description = excluded.description,
  statute_ref = excluded.statute_ref, is_required = excluded.is_required,
  sort_order = excluded.sort_order;

-- Retention: 5 years, aligned to SARS record-keeping (decision 2026-10-20).
insert into public.data_retention_policies (record_class, description, retention_months, basis) values
  ('learner_records',   'Learner identity, academic records, reports, attendance, health notes and authorised collectors', 60, 'Aligned to SARS 5-year record-keeping; POPIA s14'),
  ('financial_records', 'Invoices, payments and accounting records',                                                       60, 'Tax Administration Act record-keeping'),
  ('tutor_records',     'Tutor employment records, qualifications and vetting',                                            60, 'Employment and tax record-keeping'),
  ('enquiries',         'Website enquiries that did not become enrolments',                                                12, 'POPIA s14 minimality'),
  ('messages',          'Portal messages',                                                                                 60, 'Aligned to learner records')
on conflict (record_class) do update set
  description = excluded.description, retention_months = excluded.retention_months,
  basis = excluded.basis;
