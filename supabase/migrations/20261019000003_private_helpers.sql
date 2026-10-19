-- Keep RLS helpers and trigger functions out of the exposed API schema.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

alter function public.current_role() set schema private;
alter function public.is_admin() set schema private;
alter function public.my_tutor_id() set schema private;
alter function public.handle_new_user() set schema private;
alter function public.refresh_tutor_rating() set schema private;

revoke execute on function private.handle_new_user() from public, anon, authenticated;
revoke execute on function private.refresh_tutor_rating() from public, anon, authenticated;
