-- CAPS reference data. Factual curriculum information, safe for every
-- environment including production. Idempotent.
--
-- NOT seeded here, by decision: terms (BRS D-01, admin-entered) and rooms
-- (centre-specific). Both are entered by an administrator before go-live.

-- Phases -------------------------------------------------------------------
insert into public.school_phases (code, name, sort_order) values
  ('foundation',   'Foundation Phase',                1),
  ('intermediate', 'Intermediate Phase',              2),
  ('senior',       'Senior Phase',                    3),
  ('fet',          'Further Education and Training',  4)
on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Grades -------------------------------------------------------------------
insert into public.grades (code, name, phase_code, sort_order) values
  ('grade_r',  'Grade R',  'foundation',    0),
  ('grade_1',  'Grade 1',  'foundation',    1),
  ('grade_2',  'Grade 2',  'foundation',    2),
  ('grade_3',  'Grade 3',  'foundation',    3),
  ('grade_4',  'Grade 4',  'intermediate',  4),
  ('grade_5',  'Grade 5',  'intermediate',  5),
  ('grade_6',  'Grade 6',  'intermediate',  6),
  ('grade_7',  'Grade 7',  'senior',        7),
  ('grade_8',  'Grade 8',  'senior',        8),
  ('grade_9',  'Grade 9',  'senior',        9),
  ('grade_10', 'Grade 10', 'fet',          10),
  ('grade_11', 'Grade 11', 'fet',          11),
  ('grade_12', 'Grade 12', 'fet',          12)
on conflict (code) do update set name = excluded.name, phase_code = excluded.phase_code;

-- Languages ----------------------------------------------------------------
-- Setswana first after the official languages of instruction: the centre is in
-- Damonsville, North West, where Setswana is the dominant home language.
insert into public.languages (code, name, sort_order) values
  ('english',  'English',  1),
  ('afrikaans','Afrikaans',2),
  ('setswana', 'Setswana', 3),
  ('sesotho',  'Sesotho',  4),
  ('isizulu',  'isiZulu',  5),
  ('isixhosa', 'isiXhosa', 6)
on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Achievement levels -------------------------------------------------------
insert into public.achievement_levels (code, label, description, min_percent, max_percent) values
  (7, 'Outstanding Achievement',  'Consistently exceeds the requirements',       80, 100),
  (6, 'Meritorious Achievement',  'Exceeds the requirements',                    70,  79),
  (5, 'Substantial Achievement',  'Meets the requirements well',                 60,  69),
  (4, 'Adequate Achievement',     'Meets the requirements',                      50,  59),
  (3, 'Moderate Achievement',     'Partially meets the requirements',            40,  49),
  (2, 'Elementary Achievement',   'Barely meets the requirements; support needed',30, 39),
  (1, 'Not Achieved',             'Does not meet the requirements',               0,  29)
on conflict (code) do update set
  label = excluded.label, description = excluded.description,
  min_percent = excluded.min_percent, max_percent = excluded.max_percent;

-- Subjects -----------------------------------------------------------------
insert into public.subjects (code, name, description, is_language, sort_order) values
  ('english',               'English',                          'Home or First Additional Language',       true,   1),
  ('afrikaans',             'Afrikaans',                        'Home or First Additional Language',       true,   2),
  ('setswana',              'Setswana',                         'Home or First Additional Language',       true,   3),
  ('mathematics',           'Mathematics',                      '',                                        false,  4),
  ('mathematical_literacy', 'Mathematical Literacy',            'FET alternative to Mathematics',          false,  5),
  ('reading',               'Reading',                          'Reading intervention and fluency',        false,  6),
  ('writing',               'Writing',                          'Handwriting, spelling and composition',   false,  7),
  ('life_skills',           'Life Skills',                      '',                                        false,  8),
  ('natural_sciences',      'Natural Sciences',                 '',                                        false,  9),
  ('social_sciences',       'Social Sciences',                  'Geography and History, Grades 4-9',       false, 10),
  ('technology',            'Technology',                       '',                                        false, 11),
  ('ems',                   'Economic and Management Sciences', '',                                        false, 12),
  ('geography',             'Geography',                        '',                                        false, 13),
  ('history',               'History',                          '',                                        false, 14),
  ('life_sciences',         'Life Sciences',                    '',                                        false, 15),
  ('physical_sciences',     'Physical Sciences',                '',                                        false, 16),
  ('accounting',            'Accounting',                       '',                                        false, 17),
  ('business_studies',      'Business Studies',                 '',                                        false, 18),
  ('economics',             'Economics',                        '',                                        false, 19)
on conflict (code) do update set
  name = excluded.name, description = excluded.description,
  is_language = excluded.is_language, sort_order = excluded.sort_order;

-- Subject offerings --------------------------------------------------------
-- Grade bands follow actual CAPS, which in three places is narrower than the
-- business plan's prose:
--   * BP section 5 lists Natural Sciences for "Senior Phase and FET". In CAPS
--     it ends at Grade 9 and splits into Life Sciences / Physical Sciences at
--     FET, both of which the plan also lists. Offered here as Grades 4-9.
--   * BP lists EMS under "Senior Phase and FET". In CAPS it is Grades 7-9 only,
--     becoming Accounting / Business Studies / Economics at FET. Offered 7-9.
--   * BP lists Social Sciences under Intermediate. In CAPS it runs 4-9,
--     splitting into Geography / History at FET. Offered 4-9.
-- Adjust here if the centre decides to offer something off-curriculum.
with band as (
  select s.code as subject_code, g.code as grade_code, g.sort_order as g
  from public.subjects s cross join public.grades g
)
insert into public.subject_offerings (subject_code, grade_code)
select subject_code, grade_code from band
where (subject_code = 'english'               and g between  0 and 12)
   or (subject_code = 'afrikaans'             and g between  0 and 12)
   or (subject_code = 'setswana'              and g between  0 and 12)
   or (subject_code = 'mathematics'           and g between  0 and 12)
   or (subject_code = 'mathematical_literacy' and g between 10 and 12)
   or (subject_code = 'reading'               and g between  0 and  3)
   or (subject_code = 'writing'               and g between  0 and  3)
   or (subject_code = 'life_skills'           and g between  0 and  6)
   or (subject_code = 'natural_sciences'      and g between  4 and  9)
   or (subject_code = 'social_sciences'       and g between  4 and  9)
   or (subject_code = 'technology'            and g between  4 and  9)
   or (subject_code = 'ems'                   and g between  7 and  9)
   or (subject_code = 'geography'             and g between 10 and 12)
   or (subject_code = 'history'               and g between 10 and 12)
   or (subject_code = 'life_sciences'         and g between 10 and 12)
   or (subject_code = 'physical_sciences'     and g between 10 and 12)
   or (subject_code = 'accounting'            and g between 10 and 12)
   or (subject_code = 'business_studies'      and g between 10 and 12)
   or (subject_code = 'economics'             and g between 10 and 12)
on conflict do nothing;

-- Centre operating hours ---------------------------------------------------
-- Business plan section 11.
insert into public.centre_operating_hours (day_of_week, opens_at, closes_at, purpose) values
  (1, '13:00', '18:00', 'tutoring'),        -- Monday
  (2, '13:00', '18:00', 'tutoring'),        -- Tuesday
  (3, '13:00', '18:00', 'tutoring'),        -- Wednesday
  (4, '13:00', '18:00', 'tutoring'),        -- Thursday
  (5, '13:00', '17:00', 'administration'),  -- Friday: tests, catch-up, parent meetings
  (6, '08:00', '13:00', 'tutoring')         -- Saturday: exam prep and high-school subjects
on conflict (day_of_week, opens_at) do update set
  closes_at = excluded.closes_at, purpose = excluded.purpose;
