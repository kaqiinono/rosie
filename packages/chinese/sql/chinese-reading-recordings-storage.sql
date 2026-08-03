-- packages/chinese/sql/chinese-reading-recordings-storage.sql
-- Prereq (Dashboard): create a PRIVATE bucket named `chinese-reading-recordings`.
-- Then run this script for object policies.

DROP POLICY IF EXISTS "chinese_reading_recordings_select_own" ON storage.objects;
CREATE POLICY "chinese_reading_recordings_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chinese-reading-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "chinese_reading_recordings_insert_own" ON storage.objects;
CREATE POLICY "chinese_reading_recordings_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chinese-reading-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "chinese_reading_recordings_delete_own" ON storage.objects;
CREATE POLICY "chinese_reading_recordings_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chinese-reading-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
