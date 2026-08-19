-- Grammar module: book-tail extension columns (补充练习 / 学习指导 / 附录).
-- 延展位条目（unit_number 116+）与正文单元锚点字段，均为可选 jsonb，免改写现有行。

-- ── 补充练习条目：对应正文单元列表（如 Units 1-2 → [1,2]） ─────────────────────
ALTER TABLE public.grammar_units
  ADD COLUMN IF NOT EXISTS units JSONB DEFAULT NULL;

COMMENT ON COLUMN public.grammar_units.units IS
  '补充练习条目（category=supplementary）覆盖的正文单元编号数组，如 [1,2,5,6,7,9]；其他条目为 NULL。';

-- ── 正文单元锚点：被哪些补充练习条目覆盖（延展位 unit_number 列表） ─────────────
ALTER TABLE public.grammar_units
  ADD COLUMN IF NOT EXISTS supp_entries JSONB DEFAULT NULL;

COMMENT ON COLUMN public.grammar_units.supp_entries IS
  '正文单元被补充练习覆盖时，对应补充练习条目的延展位 unit_number 数组（如 [123,127]）；无则 NULL。';

-- ── 正文单元锚点：学习指导题目引用的单元列表 ────────────────────────────────────
ALTER TABLE public.grammar_units
  ADD COLUMN IF NOT EXISTS study_guide_units JSONB DEFAULT NULL;

COMMENT ON COLUMN public.grammar_units.study_guide_units IS
  '正文单元被学习指导题目引用时，引用该单元的 studyUnits 汇总数组；无则 NULL。';

-- ── Ledger record ───────────────────────────────────────────────────────────
INSERT INTO public.schema_migrations (version)
VALUES ('0028_grammar_backmatter_extension_columns')
ON CONFLICT DO NOTHING;
