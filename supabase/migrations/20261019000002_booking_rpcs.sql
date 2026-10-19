-- Booking + payment in one transaction. Payment capture is simulated until a
-- payment provider is wired in: card numbers are never sent to or stored by us,
-- only the last 4 digits for the receipt. A card ending 0002 simulates a decline.
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
  v_status public.payment_status;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if p_duration_minutes not in (30, 45, 60, 90) then raise exception 'Invalid duration'; end if;

  select * into v_slot from public.availability_slots where id = p_slot_id for update;
  if not found or v_slot.is_booked or v_slot.starts_at < now() then
    raise exception 'This time is no longer available';
  end if;

  select * into v_tutor from public.tutors where id = v_slot.tutor_id and status = 'approved';
  if not found then raise exception 'Tutor unavailable'; end if;

  v_price := round(v_tutor.hourly_rate_cents * p_duration_minutes / 60.0);
  v_status := case when p_card_last4 = '0002' then 'declined' else 'paid' end;

  insert into public.bookings (student_id, tutor_id, slot_id, subject, learning_goal, starts_at, duration_minutes, price_cents, status)
  values (v_uid, v_tutor.id, v_slot.id, p_subject, coalesce(p_learning_goal, ''), v_slot.starts_at, p_duration_minutes, v_price,
          case when v_status = 'paid' then 'confirmed'::public.booking_status else 'cancelled'::public.booking_status end)
  returning id into v_booking;

  insert into public.payments (booking_id, amount_cents, status, card_last4)
  values (v_booking, v_price, v_status, left(p_card_last4, 4));

  if v_status = 'paid' then
    update public.availability_slots set is_booked = true where id = v_slot.id;
  end if;

  return query select v_booking, v_status;
end;
$$;

revoke execute on function public.book_lesson from anon, public;
grant execute on function public.book_lesson to authenticated;

-- Cancelling frees the slot again.
create or replace function public.cancel_booking(p_booking_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or (v_booking.student_id <> (select auth.uid()) and v_booking.tutor_id is distinct from (select public.my_tutor_id())) then
    raise exception 'Booking not found';
  end if;
  if v_booking.status not in ('pending', 'confirmed') then raise exception 'Booking can no longer be cancelled'; end if;
  update public.bookings set status = 'cancelled' where id = p_booking_id;
  update public.payments set status = 'refunded' where booking_id = p_booking_id and status = 'paid';
  if v_booking.slot_id is not null then
    update public.availability_slots set is_booked = false where id = v_booking.slot_id;
  end if;
end;
$$;

revoke execute on function public.cancel_booking from anon, public;
grant execute on function public.cancel_booking to authenticated;

-- Admin decision on an application; approval creates/activates the tutor listing.
create or replace function public.review_application(p_application_id uuid, p_decision public.tutor_status, p_notes text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_app public.tutor_applications;
begin
  if not (select public.is_admin()) then raise exception 'Admins only'; end if;
  if p_decision not in ('approved', 'declined', 'more_info') then raise exception 'Invalid decision'; end if;

  update public.tutor_applications
    set status = p_decision, admin_notes = p_notes, reviewed_at = now()
    where id = p_application_id
    returning * into v_app;
  if not found then raise exception 'Application not found'; end if;

  if p_decision = 'approved' and v_app.user_id is not null then
    update public.profiles set role = 'tutor' where id = v_app.user_id;
    insert into public.tutors (profile_id, slug, full_name, headline, qualifications, subjects, grades, hourly_rate_cents, status)
    values (v_app.user_id,
            lower(regexp_replace(v_app.full_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || left(v_app.id::text, 6),
            v_app.full_name, v_app.subjects, v_app.qualifications,
            string_to_array(regexp_replace(v_app.subjects, '\s*,\s*', ',', 'g'), ','),
            v_app.grades, 4000, 'approved')
    on conflict (profile_id) do update set status = 'approved';
  end if;

  if v_app.user_id is not null then
    insert into public.notifications (user_id, title, body)
    values (v_app.user_id,
      case p_decision when 'approved' then 'Application approved'
                      when 'declined' then 'Application declined'
                      else 'More information needed' end,
      coalesce(p_notes, ''));
  end if;
end;
$$;

revoke execute on function public.review_application from anon, public;
grant execute on function public.review_application to authenticated;
