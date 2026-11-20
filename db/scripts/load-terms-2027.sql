-- 2027 public school terms (learner dates), Government Gazette No. 52178, 25 Feb 2025.
-- Not a seed: terms are admin-entered (BRS D-01), so verify.sh expects them empty.
-- Run by hand:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/load-terms-2027.sql
-- Educator-only days (11 Jan, 10 Dec) are excluded.
insert into public.terms (year, term_number, starts_on, ends_on) values
  (2027, 1, '2027-01-13', '2027-03-19'),
  (2027, 2, '2027-04-06', '2027-06-25'),
  (2027, 3, '2027-07-20', '2027-09-22'),
  (2027, 4, '2027-10-05', '2027-12-08')
on conflict (year, term_number) do update
  set starts_on = excluded.starts_on, ends_on = excluded.ends_on;
