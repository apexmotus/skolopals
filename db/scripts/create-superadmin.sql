-- Create a superadmin account from scratch.
--
-- 'superadmin' is deliberately unassignable through the app: neither RLS policy
-- on public.user_roles nor configure_invited_user() will grant it. This script
-- is the only way in, and must be run as a privileged role (Supabase SQL
-- editor, or psql as postgres) so that RLS is bypassed.
--
-- Creates the Supabase auth user (email + password, already confirmed), lets
-- the on_auth_user_created trigger build the profile, then swaps the default
-- 'parent' role for 'superadmin'. If the email already has an account, the
-- account and its password are left alone and only the role is granted.
--
-- Targets hosted Supabase (real GoTrue auth schema), not the db/local shim.
--
-- Usage: set the four values below, then run the whole file. Safe to re-run.
-- Do not commit this file with a real password in it; change the password
-- after first sign-in.

do $$
declare
  v_email      text := 'mollodagod@gmail.com';
  v_password   text := 'CHANGE_ME';
  v_first_name text := 'CHANGE_ME';
  v_last_name  text := 'CHANGE_ME';
  v_user_id    uuid;
  v_created    boolean := false;
begin
  v_email := lower(trim(v_email));

  select id into v_user_id from auth.users where lower(email) = v_email;

  if v_user_id is null then
    if v_password = 'CHANGE_ME' or length(v_password) < 12 then
      raise exception 'Set v_password to a real password of at least 12 characters';
    end if;
    if 'CHANGE_ME' in (v_first_name, v_last_name) then
      raise exception 'Set v_first_name and v_last_name';
    end if;

    v_user_id := gen_random_uuid();
    v_created := true;

    -- The token columns must be '' rather than null, or GoTrue fails the
    -- sign-in with "converting NULL to string is unsupported".
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      v_email, crypt(v_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'first_name', trim(v_first_name),
        'last_name',  trim(v_last_name),
        'full_name',  trim(v_first_name) || ' ' || trim(v_last_name)
      ),
      now(), now(), '', '', '', ''
    );

    -- Without an email identity GoTrue cannot sign the user in by password.
    insert into auth.identities (
      user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      v_user_id, 'email', v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      now(), now(), now()
    );
  end if;

  -- handle_new_user normally creates this; covers accounts that predate the trigger.
  insert into public.profiles (id, full_name)
  select u.id,
         coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1))
    from auth.users u
   where u.id = v_user_id
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'superadmin')
  on conflict (user_id, role) do nothing;

  -- A freshly created staff account drops the default self-signup 'parent'
  -- role and guardian row, as configure_invited_user() does. A pre-existing
  -- account keeps them: that person may be a real parent at the centre.
  if v_created then
    delete from public.user_roles where user_id = v_user_id and role = 'parent';
    delete from public.guardians
     where profile_id = v_user_id
       and not exists (select 1 from public.learner_guardians lg where lg.guardian_id = v_user_id);
  end if;

  raise notice '% superadmin % (%)',
    case when v_created then 'Created' else 'Granted existing account' end, v_email, v_user_id;
end $$;

-- Verify: lists every superadmin.
select u.email, p.full_name, array_agg(ur.role order by ur.role) as roles
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  join auth.users u on u.id = ur.user_id
 where ur.user_id in (select user_id from public.user_roles where role = 'superadmin')
 group by u.email, p.full_name;
