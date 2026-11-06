-- Fix: check_programme_capacity() counted bookings without locking the
-- programme row first, unlike check_class_capacity() (already fixed, see
-- 20261020000006_timetable_attendance.sql). Two concurrent bookings into a
-- near-full programme could both read the same stale count under READ
-- COMMITTED and both pass, oversubscribing the programme. Mirrors
-- check_class_capacity()'s pattern: lock the capacity-bearing row with
-- `for update` before counting, so the second transaction serialises behind
-- the first instead of racing it.
create or replace function private.check_programme_capacity()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
declare v_capacity smallint; v_taken integer;
begin
  if new.status = 'cancelled' then return new; end if;

  select capacity into v_capacity
  from public.programmes where id = new.programme_id
  for update;

  select count(*) into v_taken from public.programme_enrolments
   where programme_id = new.programme_id and status = 'booked'
     and id is distinct from new.id;
  if v_taken + 1 > v_capacity then
    raise exception 'Programme is full (capacity %)', v_capacity
      using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;
