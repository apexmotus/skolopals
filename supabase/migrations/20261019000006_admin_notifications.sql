-- Admins can notify users (e.g. account suspended/reactivated).
create policy "notifications: admin insert" on public.notifications for insert to authenticated
  with check ((select private.is_admin()));
create policy "notifications: admin read" on public.notifications for select to authenticated
  using ((select private.is_admin()));
