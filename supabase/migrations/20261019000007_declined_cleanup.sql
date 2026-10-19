-- A declined payment shouldn't leave a phantom cancelled lesson in the student's history.
create or replace function public.book_lesson(
  p_slot_id uuid,
  p_subject text,
  p_learning_goal text,
  p_duration_minutes integer,
  p_card_last4 text
)
returns table (booking_id uuid, payment_status public.payment_status)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_slot public.availability_slots;
  v_tutor public.tutors;
  v_price integer;
  v_booking uuid;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if p_duration_minutes not in (30, 45, 60, 90) then raise exception 'Invalid duration'; end if;

  select * into v_slot from public.availability_slots where id = p_slot_id for update;
  if not found or v_slot.is_booked or v_slot.starts_at < now() then
    raise exception 'This time is no longer available';
  end if;

  select * into v_tutor from public.tutors where id = v_slot.tutor_id and status = 'approved';
  if not found then raise exception 'Tutor unavailable'; end if;

  -- Simulated card capture: a card ending 0002 is declined.
  if p_card_last4 = '0002' then
    return query select null::uuid, 'declined'::public.payment_status;
    return;
  end if;

  v_price := round(v_tutor.hourly_rate_cents * p_duration_minutes / 60.0);

  insert into public.bookings (student_id, tutor_id, slot_id, subject, learning_goal, starts_at, duration_minutes, price_cents, status)
  values (v_uid, v_tutor.id, v_slot.id, p_subject, coalesce(p_learning_goal, ''), v_slot.starts_at, p_duration_minutes, v_price, 'confirmed')
  returning id into v_booking;

  insert into public.payments (booking_id, amount_cents, status, card_last4)
  values (v_booking, v_price, 'paid', left(p_card_last4, 4));

  update public.availability_slots set is_booked = true where id = v_slot.id;

  return query select v_booking, 'paid'::public.payment_status;
end;
$$;
