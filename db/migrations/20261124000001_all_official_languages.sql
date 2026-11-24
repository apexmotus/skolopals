-- All twelve official languages of South Africa, and a flag for the ones the
-- centre teaches in.
--
-- public.languages serves three purposes: a learner's home language, the
-- languages a tutor speaks, and the medium of instruction. Home and spoken
-- languages need the full list; medium of instruction must not, or a parent
-- could ask for Mathematics in Xitsonga. Setswana is a medium: Foundation
-- Phase is taught in it, and so is Setswana the subject. is_instruction_medium keeps the two
-- apart without a second table.
--
-- South African Sign Language became the twelfth official language in 2023
-- (Constitution Eighteenth Amendment Act).

alter table public.languages
  add column if not exists is_instruction_medium boolean not null default false;

comment on column public.languages.is_instruction_medium is
  'True when the centre teaches in this language. Medium-of-instruction pickers '
  'filter on it; home and spoken language pickers show every row.';

insert into public.languages (code, name, sort_order, is_instruction_medium) values
  ('english',    'English',                     1, true),
  ('afrikaans',  'Afrikaans',                   2, true),
  ('setswana',   'Setswana',                    3, true),
  ('sesotho',    'Sesotho',                     4, false),
  ('isizulu',    'isiZulu',                     5, false),
  ('isixhosa',   'isiXhosa',                    6, false),
  ('sepedi',     'Sepedi',                      7, false),
  ('isindebele', 'isiNdebele',                  8, false),
  ('siswati',    'siSwati',                     9, false),
  ('tshivenda',  'Tshivenda',                  10, false),
  ('xitsonga',   'Xitsonga',                   11, false),
  ('sasl',       'South African Sign Language',12, false)
on conflict (code) do update set
  name                  = excluded.name,
  sort_order            = excluded.sort_order,
  is_instruction_medium = excluded.is_instruction_medium;
