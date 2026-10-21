-- Direct foreign keys so PostgREST can embed related rows.
--
-- tutor_competencies already has a COMPOSITE foreign key to
-- subject_offerings (subject_code, grade_code), which is the real constraint:
-- a tutor may only be competent in something the centre actually offers at
-- that grade. But PostgREST resolves embeds from single-column foreign keys,
-- so `select subjects(name)` from tutor_competencies fails at runtime without
-- these - it is not merely a typing inconvenience.
--
-- These are redundant in the sense that the composite key already guarantees
-- the referenced rows exist. They are kept because the alternative - joining
-- manually in every query, or embedding through subject_offerings - makes the
-- common read path worse for no modelling gain. No data is duplicated; only
-- the referential statement is.

alter table public.tutor_competencies
  add constraint tutor_competencies_subject_code_fkey
    foreign key (subject_code) references public.subjects (code),
  add constraint tutor_competencies_grade_code_fkey
    foreign key (grade_code) references public.grades (code);

comment on constraint tutor_competencies_subject_code_fkey on public.tutor_competencies is
  'For PostgREST embedding. The composite FK to subject_offerings is the real rule.';
