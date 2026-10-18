-- Grammar module: pre-generated search index column for home-page keyword search.
-- 内容由提取脚本（scripts/extract-grammar-unit.mjs）从 lesson 展平生成，
-- 不含练习题与答案（防答案泄露）。

ALTER TABLE public.grammar_units
  ADD COLUMN IF NOT EXISTS search_text TEXT DEFAULT NULL;

COMMENT ON COLUMN public.grammar_units.search_text IS
  '讲解内容展平文本（标题/分类 + 规则要点 + 例句），首页高级检索用；提取时生成，无 lesson 的条目仅含元数据。';

-- ── Ledger record ───────────────────────────────────────────────────────────
INSERT INTO public.schema_migrations (version)
VALUES ('0029_add_grammar_search_text')
ON CONFLICT DO NOTHING;
