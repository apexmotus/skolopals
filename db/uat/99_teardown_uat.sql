-- UAT ONLY: wipe all operational data so 01_seed_uat.sql can run again.
--
-- Target: Supabase project dhmjzshlznhqohvkdcpz (UAT). NEVER production.
--
-- Removes EVERYTHING operational - seeded rows and anything testers created
-- (learners, tutors, terms, rooms, invoices, messages, ...) - plus the seeded
-- @uat.skolopals.test accounts and the E2E plan's @test.local accounts.
-- Keeps the reference seeds (CAPS curriculum, packages, prices, consent types,
-- billing settings) and every other auth account, e.g. a real superadmin.
--
-- Same guard as the seed: run via db/scripts/seed-uat.sh --teardown, or in the
-- SQL editor with this line added at the very top:
--   set skp.project_ref = 'dhmjzshlznhqohvkdcpz';

begin;

do $$
begin
  if coalesce(current_setting('skp.project_ref', true), '') <> 'dhmjzshlznhqohvkdcpz' then
    raise exception 'Refusing to run: skp.project_ref is not the UAT project ref. This teardown is for UAT (dhmjzshlznhqohvkdcpz) only.'
      using hint = 'In the UAT SQL editor, add this as the first line and run again: '
                   'set skp.project_ref = ''dhmjzshlznhqohvkdcpz'';  (seed-uat.sh sets it for you)';
  end if;
end $$;

truncate
  public.learners,
  public.tutors,
  public.terms,
  public.rooms,
  public.billing_accounts,
  public.invoice_sequences,
  public.programmes,
  public.message_threads,
  public.notifications,
  public.contact_enquiries,
  public.resources,
  public.expenses,
  public.consents,
  public.data_retention_log
cascade;

-- Seeded and E2E-plan test accounts. Cascades to profiles, roles, guardians.
delete from auth.users
 where email like '%@uat.skolopals.test'
    or email like '%@test.local';

select (select count(*) from public.learners)      as learners_left,
       (select count(*) from public.invoices)      as invoices_left,
       (select count(*) from public.packages)      as packages_kept,
       (select count(*) from auth.users)           as auth_users_kept;

commit;
