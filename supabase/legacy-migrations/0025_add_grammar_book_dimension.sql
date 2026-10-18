-- Grammar module: add `book` dimension so multiple grammar books can coexist.
-- Current book: 'essential' = Essential Grammar in Use（剑桥初级英语语法，116 units）.
-- Future books: 'intermediate'（English Grammar in Use）/ 'advanced'（Advanced Grammar in Use）.
-- Unit numbering restarts at 1 per book, so (book, unit_number) is the identity.

-- ── 1. grammar_mastery: drop FK first (depends on grammar_units_pkey) ───────
ALTER TABLE public.grammar_mastery DROP CONSTRAINT grammar_mastery_unit_number_fkey;

-- ── 2. grammar_units: book column + composite PK ─────────────────────────────
ALTER TABLE public.grammar_units
  ADD COLUMN IF NOT EXISTS book TEXT NOT NULL DEFAULT 'essential';

ALTER TABLE public.grammar_units DROP CONSTRAINT grammar_units_pkey;
ALTER TABLE public.grammar_units ADD PRIMARY KEY (book, unit_number);

-- Relax the unit range check (was 1-116, essential-specific).
ALTER TABLE public.grammar_units DROP CONSTRAINT grammar_units_unit_number_check;
ALTER TABLE public.grammar_units
  ADD CONSTRAINT grammar_units_unit_number_chk CHECK (unit_number BETWEEN 1 AND 200);

-- ── 3. grammar_mastery: book column + composite PK + FK re-target ────────────
ALTER TABLE public.grammar_mastery DROP CONSTRAINT grammar_mastery_pkey;
ALTER TABLE public.grammar_mastery
  ADD COLUMN IF NOT EXISTS book TEXT NOT NULL DEFAULT 'essential';
ALTER TABLE public.grammar_mastery ADD PRIMARY KEY (user_id, book, unit_number);

ALTER TABLE public.grammar_mastery
  ADD CONSTRAINT grammar_mastery_unit_fkey
  FOREIGN KEY (book, unit_number)
  REFERENCES public.grammar_units (book, unit_number)
  ON DELETE CASCADE;

-- Existing rows are backfilled to 'essential' via the column DEFAULT.
-- No GRANT changes: table identities unchanged (April 2026 Data API grants persist).

-- ── Ledger record ───────────────────────────────────────────────────────────
-- After applying this migration, also run:
INSERT INTO public.schema_migrations (version)
VALUES ('0025_add_grammar_book_dimension')
ON CONFLICT DO NOTHING;
