-- Private storage for learner documents and proofs of payment.
-- SPEC-2026-11-enrolment-payments-ux.md §0.2 rules 3 and 6, §3.3, §4.2.
--
-- learner-documents: report cards (and later other learner documents). Child
--   data under POPIA s35, so the bucket is private.
-- payment-proofs:    PayShap proof-of-payment screenshots and PDFs.
--
-- Neither bucket gets a storage policy for parents or tutors. Every upload and
-- download goes through a short-lived signed URL that the API issues after its
-- own access check, so the only reader outside the API is an administrator.
-- iPhone photos arrive as HEIC/HEIF; the API converts them to JPEG on confirm.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('learner-documents', 'learner-documents', false, 10485760,
   array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf']),
  ('payment-proofs', 'payment-proofs', false, 10485760,
   array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update set
  public             = false,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "learner docs: admin read" on storage.objects;
drop policy if exists "payment proofs: admin read" on storage.objects;

create policy "learner docs: admin read" on storage.objects for select to authenticated
  using (bucket_id = 'learner-documents' and (select private.is_admin()));

create policy "payment proofs: admin read" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and (select private.is_admin()));
