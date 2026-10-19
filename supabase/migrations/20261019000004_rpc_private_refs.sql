-- Re-create RPCs so they call the helpers in the private schema.
-- Cancelling frees the slot again.
create or replace function public.cancel_booking(p_booking_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or (v_booking.student_id <> (select auth.uid()) and v_booking.tutor_id is distinct from (select private.my_tutor_id())) then
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
  if not (select private.is_admin()) then raise exception 'Admins only'; end if;
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
