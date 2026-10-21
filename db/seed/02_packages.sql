-- Pricing from the business plan section 9, effective 2026-01-01.
-- Factual business data, safe for production. Idempotent.

insert into public.packages (code, name, description, service_type, billing_period, subject_allowance, sort_order) values
  ('group_1',       'Group - 1 subject',      'Small-group tutoring in one subject',        'group',             'monthly',       1, 1),
  ('group_2',       'Group - 2 subjects',     'Small-group tutoring in two subjects',       'group',             'monthly',       2, 2),
  ('group_3',       'Group - 3 subjects',     'Small-group tutoring in three subjects',     'group',             'monthly',       3, 3),
  ('all_subject',   'All-subject support',    'Support across all subjects',                'group',             'monthly',    null, 4),
  ('homework',      'Homework assistance',    'Structured homework support',                'homework',          'monthly',    null, 5),
  ('academic_plus', 'Academic Plus',          'All subjects plus extended support',         'academic_plus',     'monthly',    null, 6),
  ('one_on_one_hr', 'One-on-one - 1 hour',    'Individual tutoring, charged hourly',        'one_on_one',        'per_hour',      1, 7),
  ('one_on_one_4',  'One-on-one - 4 lessons', 'Block of four individual lessons',           'one_on_one',        'per_block',     1, 8),
  ('registration',  'Registration',           'Once-off registration fee',                  'registration',      'once_off',   null, 9),
  ('holiday',       'Holiday programme',      'School-holiday revision programme',          'holiday_programme', 'per_programme', null, 10)
on conflict (code) do update set
  name = excluded.name, description = excluded.description,
  service_type = excluded.service_type, billing_period = excluded.billing_period,
  subject_allowance = excluded.subject_allowance, sort_order = excluded.sort_order;

-- Holiday programmes are priced per programme (R350-R750), so no package
-- price row: each programme carries its own.
insert into public.package_prices (package_code, amount_cents, effective_from)
select v.code, v.cents, date '2026-01-01'
from (values
  ('group_1',        45000),
  ('group_2',        75000),
  ('group_3',        95000),
  ('all_subject',   110000),
  ('homework',       50000),
  ('academic_plus', 125000),
  ('one_on_one_hr',  18000),
  ('one_on_one_4',   65000),
  ('registration',   15000)
) as v(code, cents)
where not exists (
  select 1 from public.package_prices pp
  where pp.package_code = v.code and pp.effective_from = date '2026-01-01');

-- Billing rules resolved 2026-10-20 (SPEC section 9).
insert into public.billing_settings
  (invoice_prefix, issue_day, due_day, grace_days, late_fee_cents, effective_from)
select 'SKP', 15, 1, 3, 15000, date '2026-01-01'
where not exists (select 1 from public.billing_settings);
