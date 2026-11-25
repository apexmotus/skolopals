-- Schedules the late-pickup check (20261125000010) inside the database.
--
-- The API runs on Vercel Hobby, whose cron jobs are daily only, and the alert
-- needs a check every 10 minutes while classes run. Supabase Cron (pg_cron)
-- runs it in Postgres instead: no HTTP call and no secret. It calls the same
-- idempotent private.alert_late_pickups() that the door screens call, so a run
-- that overlaps with a staff visit sends nothing twice.
--
-- Every 10 minutes, 13:00-20:59 SAST (11-18 UTC), Monday to Saturday.
-- Skipped on a Postgres without pg_cron (a local database built from these
-- migrations); the door screens still run the check whenever they are opened.

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron is not available here; late-pickup alerts will run only from the door screens.';
    return;
  end if;

  create extension if not exists pg_cron with schema pg_catalog;
  grant usage on schema cron to postgres;
  grant all privileges on all tables in schema cron to postgres;

  -- cron.schedule replaces a job of the same name, so re-running this is safe.
  perform cron.schedule(
    'skolopals-late-pickups',
    '*/10 11-18 * * 1-6',
    'select private.alert_late_pickups()'
  );
end
$$;
