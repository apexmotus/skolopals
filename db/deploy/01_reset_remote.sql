-- ============================================================================
-- Skolopals — remove the old marketplace schema before the first deploy
--
-- RUN THIS ONCE, in the Supabase SQL Editor for project clnlvmnfhzyumykbzrjz.
--
-- WHAT IT DELETES
--   The 12 tables, 4 enum types and 8 functions of the old marketplace
--   schema, and the `private` schema. Specifically:
--     3 demo tutors, 3 demo bookings, 3 demo payments, 3 demo reviews,
--     150 demo availability slots, 1 demo tutor application, 2 demo messages,
--     2 demo progress reports, 6 profile rows.
--
-- WHAT IT KEEPS
--   The `auth` schema, untouched. All six accounts survive, including the
--   two real ones:
--     mollodagod+stshepana@gmail.com  (Tshepo Stshepana)
--     thyufilus.com@yahoo.com         (Theophilus)
--   They keep their passwords and can still log in. Migration 023 gives them
--   a profile under the new schema, so their accounts work rather than
--   authenticating into nothing.
--
--   Storage objects are also untouched (there are none).
--
-- A JSON snapshot of everything being deleted is in db/backups/ locally.
-- ============================================================================

begin;

-- The old trigger points at private.handle_new_user, which goes below.
drop trigger if exists on_auth_user_created on auth.users;

-- Old storage policies, replaced by migration 022.
drop policy if exists "tutor docs: upload"     on storage.objects;
drop policy if exists "tutor docs: admin read" on storage.objects;

-- Tables, children first so the cascades stay small and predictable.
drop table if exists public.payments            cascade;
drop table if exists public.bookings            cascade;
drop table if exists public.availability_slots  cascade;
drop table if exists public.tutor_applications  cascade;
drop table if exists public.progress_reports    cascade;
drop table if exists public.resources           cascade;
drop table if exists public.reviews             cascade;
drop table if exists public.messages            cascade;
drop table if exists public.notifications       cascade;
drop table if exists public.contact_messages    cascade;
drop table if exists public.tutors              cascade;
drop table if exists public.profiles            cascade;

-- Marketplace RPCs.
drop function if exists public.book_lesson(uuid, text, text, integer, text) cascade;
drop function if exists public.cancel_booking(uuid)                          cascade;
drop function if exists public.review_application(uuid, public.tutor_status, text) cascade;

-- Enums. The new schema defines its own.
drop type if exists public.booking_status cascade;
drop type if exists public.payment_status cascade;
drop type if exists public.tutor_status   cascade;
drop type if exists public.user_role      cascade;

-- Helper functions lived here; the new schema recreates the schema itself.
drop schema if exists private cascade;

commit;

-- Expect: tables_left = 0, auth_users_preserved = 6
select (select count(*) from pg_tables where schemaname = 'public') as tables_left,
       (select count(*) from auth.users)                            as auth_users_preserved;
