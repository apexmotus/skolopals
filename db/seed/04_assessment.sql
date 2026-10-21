-- Assessment types and domains. BP section 12. Factual, production-safe.

insert into public.assessment_types (code, name, description, sort_order) values
  ('initial',   'Initial assessment',   'On joining: establishes the learner''s starting level', 1),
  ('monthly',   'Monthly monitoring',   'Short monthly check of progress',                       2),
  ('diagnostic','Diagnostic',           'Targeted check where a difficulty is suspected',        3),
  ('exam_prep', 'Examination practice', 'Practice paper under examination conditions',           4)
on conflict (code) do update set
  name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;

-- The six areas the plan names for the initial assessment.
insert into public.assessment_domains (code, name, description, sort_order) values
  ('reading',       'Reading',       'Fluency, accuracy and decoding',        1),
  ('spelling',      'Spelling',      'Spelling accuracy',                     2),
  ('comprehension', 'Comprehension', 'Understanding of what is read',         3),
  ('writing',       'Writing',       'Handwriting, structure and expression', 4),
  ('mathematics',   'Mathematics',   'Number sense and operations',           5),
  ('language',      'Language',      'Vocabulary, grammar and expression',    6)
on conflict (code) do update set
  name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;
