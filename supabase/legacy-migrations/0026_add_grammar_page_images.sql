-- Grammar module: add page_images column for original book page images.
-- Images stored in Supabase Storage bucket 'grammar-pages' (public, read-only for anon).
-- Path convention: {book}/unit{NNN}/page-{NNNN}.png

-- ── grammar_units: page_images column ──────────────────────────────────────────
ALTER TABLE public.grammar_units
  ADD COLUMN IF NOT EXISTS page_images JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.grammar_units.page_images IS
  'Array of {page:number, path:string, type:"lesson"|"exercise"} — Supabase Storage paths in grammar-pages bucket.';

-- ── Storage bucket ─────────────────────────────────────────────────────────────
-- Create bucket (idempotent — does nothing if already exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('grammar-pages', 'grammar-pages', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS is already enabled on storage.objects by Supabase.
-- Just create bucket-scoped policies (idempotent: drop-if-exists first).

-- Read policy for authenticated users
DROP POLICY IF EXISTS "grammar-pages: authenticated read" ON storage.objects;
CREATE POLICY "grammar-pages: authenticated read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'grammar-pages' AND auth.role() = 'authenticated');

-- Write policy for service_role only (CLI uploads)
DROP POLICY IF EXISTS "grammar-pages: service_role write" ON storage.objects;
CREATE POLICY "grammar-pages: service_role write"
  ON storage.objects FOR ALL
  USING (bucket_id = 'grammar-pages' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'grammar-pages' AND auth.role() = 'service_role');

-- ── Ledger record ───────────────────────────────────────────────────────────
INSERT INTO public.schema_migrations (version)
VALUES ('0026_add_grammar_page_images')
ON CONFLICT DO NOTHING;
