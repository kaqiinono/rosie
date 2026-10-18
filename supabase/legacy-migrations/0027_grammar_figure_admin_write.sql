-- Grammar figures: allow admin to crop/insert exercise figures.
-- Figures live in Storage bucket 'grammar-pages' under {book}/unit{NNN}/figures/.
-- See docs/superpowers/specs/2026-08-19-grammar-figure-crop-design.md

-- ── grammar_units: admin UPDATE (figure mutations on exercises jsonb) ─────────
DROP POLICY IF EXISTS grammar_units_update_admin ON public.grammar_units;
CREATE POLICY grammar_units_update_admin
  ON public.grammar_units FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

GRANT UPDATE ON public.grammar_units TO authenticated;

-- ── storage.objects: admin write restricted to figures/ subpaths ──────────────
-- Prevents overwriting whole-page images (page-{NNNN}.png) uploaded by the CLI.
DROP POLICY IF EXISTS "grammar-pages: admin figures write" ON storage.objects;
CREATE POLICY "grammar-pages: admin figures write"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'grammar-pages' AND (SELECT public.is_admin())
         AND name LIKE '%/figures/%')
  WITH CHECK (bucket_id = 'grammar-pages' AND (SELECT public.is_admin())
         AND name LIKE '%/figures/%');

-- ── Ledger record ───────────────────────────────────────────────────────────
INSERT INTO public.schema_migrations (version)
VALUES ('0027_grammar_figure_admin_write')
ON CONFLICT DO NOTHING;
