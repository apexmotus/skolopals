-- Private storage for tutor vetting documents.
--
-- tutor_documents.storage_path has always implied a bucket; this creates it.
-- Identity documents, qualification certificates and police clearances are
-- among the most sensitive things the centre holds, so the bucket is private
-- and only administrators may read or write it (POPIA policy, Annex B5).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tutor-documents', 'tutor-documents', false, 52428800,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Administrators only, in both directions. There is no public tutor
-- application, so nobody else ever needs to put a file here.
drop policy if exists "tutor docs: admin read" on storage.objects;
drop policy if exists "tutor docs: admin write" on storage.objects;

create policy "tutor docs: admin read" on storage.objects for select to authenticated
  using (bucket_id = 'tutor-documents' and (select private.is_admin()));

create policy "tutor docs: admin write" on storage.objects for all to authenticated
  using (bucket_id = 'tutor-documents' and (select private.is_admin()))
  with check (bucket_id = 'tutor-documents' and (select private.is_admin()));
