-- Expense categories with the planning budget from BP section 17 (R22,000/mo).
-- Budgets are planning figures; actual expenses are recorded against them.

insert into public.expense_categories (code, name, budget_cents, sort_order) values
  ('rent',               'Rent',                 500000, 1),
  ('electricity_water',  'Electricity and water',150000, 2),
  ('internet',           'Internet',              70000, 3),
  ('tutor_payments',     'Tutor payments',      1000000, 4),
  ('printing_materials', 'Printing and materials',100000, 5),
  ('marketing',          'Marketing',            100000, 6),
  ('cleaning',           'Cleaning',              80000, 7),
  ('administration',     'Administration',        50000, 8),
  ('maintenance',        'Maintenance',           50000, 9),
  ('emergency_other',    'Emergency and other',  100000, 10)
on conflict (code) do update set
  name = excluded.name, budget_cents = excluded.budget_cents, sort_order = excluded.sort_order;
