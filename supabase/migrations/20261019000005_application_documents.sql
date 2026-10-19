-- Private bucket for tutor application uploads (ID, certificates, intro video).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tutor-documents', 'tutor-documents', false, 52428800,
  array['image/jpeg', 'image/png', 'application/pdf', 'video/mp4']
)
on conflict (id) do nothing;

-- Applicants (signed in or not) may upload; nobody but admins may read.
create policy "tutor docs: upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'tutor-documents');
create policy "tutor docs: admin read" on storage.objects for select to authenticated
  using (bucket_id = 'tutor-documents' and (select private.is_admin()));
