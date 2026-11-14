begin;
-- Restrictive policy also protects temporary originals from older broad Storage policies.
-- Only the service-role server adapter may access this bucket; no signed public URLs.
create policy exam_image_sources_server_only on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'exam-image-sources')
  with check (bucket_id <> 'exam-image-sources');
commit;
