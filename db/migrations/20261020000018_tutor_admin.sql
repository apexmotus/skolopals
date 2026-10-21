-- Administrator tutor management.
--
-- Tutors are created by the centre, never by self-application (BR-23). The
-- person signs up as an ordinary account first; an administrator then grants
-- the tutor role and creates the staff record.
--
-- This needs a lookup in auth.users, which PostgREST does not expose, so it
-- is a SECURITY DEFINER function rather than a client query. The alternative -
-- copying email onto profiles - would duplicate a fact auth.users already
-- owns, and the two would drift the first time someone changes their address.

create or replace function public.create_tutor(
  p_email           text,
  p_slug            text,
  p_employment_type text,
  p_headline        text default ''
)
returns uuid
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_user  uuid;
  v_tutor uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;

  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No account exists for %. Ask them to sign up first, then add them here.', p_email
      using errcode = 'P0001';
  end if;

  if exists (select 1 from public.tutors where profile_id = v_user) then
    raise exception 'That person is already a tutor' using errcode = 'unique_violation';
  end if;

  insert into public.user_roles (user_id, role) values (v_user, 'tutor')
  on conflict (user_id, role) do nothing;

  insert into public.tutors (profile_id, slug, employment_type, headline)
  values (v_user, p_slug, p_employment_type, coalesce(p_headline, ''))
  returning id into v_tutor;

  return v_tutor;
end;
$fn$;

revoke execute on function public.create_tutor(text, text, text, text) from public, anon;
grant execute on function public.create_tutor(text, text, text, text) to authenticated;

-- Record one teaching competency and the languages it is taught in.
-- Grouped into a function because a competency without a medium is useless:
-- no class can ever be assigned to it, so the two belong in one step.
create or replace function public.set_tutor_competency(
  p_tutor_id   uuid,
  p_subject    text,
  p_grade      text,
  p_languages  text[]
)
returns uuid
language plpgsql security definer set search_path = ''
as $fn$
declare v_id uuid; v_lang text;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_languages, 1), 0) = 0 then
    raise exception 'Choose at least one language of instruction' using errcode = 'check_violation';
  end if;

  insert into public.tutor_competencies (tutor_id, subject_code, grade_code)
  values (p_tutor_id, p_subject, p_grade)
  on conflict (tutor_id, subject_code, grade_code) do update set tutor_id = excluded.tutor_id
  returning id into v_id;

  delete from public.tutor_competency_media where competency_id = v_id;
  foreach v_lang in array p_languages loop
    insert into public.tutor_competency_media (competency_id, language_code) values (v_id, v_lang);
  end loop;

  return v_id;
end;
$fn$;

revoke execute on function public.set_tutor_competency(uuid, text, text, text[]) from public, anon;
grant execute on function public.set_tutor_competency(uuid, text, text, text[]) to authenticated;

-- Set a pay rate, closing the previous one so the periods never overlap.
create or replace function public.set_tutor_pay_rate(
  p_tutor_id       uuid,
  p_pay_basis      text,
  p_amount_cents   integer,
  p_effective_from date default current_date
)
returns uuid
language plpgsql security definer set search_path = ''
as $fn$
declare v_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;

  -- The exclusion constraint forbids overlap, so close the open rate first
  -- rather than leaving the caller to discover the clash.
  update public.tutor_pay_rates
     set effective_to = p_effective_from
   where tutor_id = p_tutor_id
     and effective_to is null
     and effective_from < p_effective_from;

  insert into public.tutor_pay_rates (tutor_id, pay_basis, amount_cents, effective_from)
  values (p_tutor_id, p_pay_basis, p_amount_cents, p_effective_from)
  returning id into v_id;

  return v_id;
end;
$fn$;

revoke execute on function public.set_tutor_pay_rate(uuid, text, integer, date) from public, anon;
grant execute on function public.set_tutor_pay_rate(uuid, text, integer, date) to authenticated;
