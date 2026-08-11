# English Grammar Module Design

> **Date**: 2026-08-11
> **Status**: Draft
> **Source**: Cambridge Essential Grammar in Use (剑桥初级英语语法)
> **Package**: `@rosie/english`

## 1. Overview

Add a grammar learning module to the English package, covering all ~116 grammar units from
Cambridge Essential Grammar in Use. The module provides three layers:

1. **Structured knowledge** — explanations, rules, and examples per grammar unit
2. **Practice exercises** — multiple question types (choice, fill-blank, error correction, transformation, sentence completion)
3. **AI-powered learning** — RAG integration for intelligent quiz generation and grammar Q&A

### 1.1 Design Principles

- **Static index + DB detail**: lightweight category/unit metadata in TS (~20KB); full content in Supabase (fetched on demand)
- **Follows existing patterns**: hook structure mirrors `useWordData` / `useWordMastery`; routes live in `apps/web/src/app/english/grammar/**`
- **No cross-module dependency**: grammar stays within `@rosie/english`, only imports from `core` / `ui` / `player` / `rewards`
- **Session-scoped caching**: uses `createUserSessionStore` to avoid redundant fetches within a session

### 1.2 Data Size Estimate

| Item | Per Unit | 116 Units Total |
|------|----------|-----------------|
| Index entry (static) | ~150B | ~17KB |
| Explanation + rules + examples (DB) | 2-5KB | 230-580KB |
| Exercises 5-10/unit (DB) | 1-2KB | 115-230KB |

Static index bundle cost: **~20KB**. Detailed content is fetched per-unit on demand.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Static Index (TS file, always loaded)                   │
│  grammar-index.ts — categories + unit metadata (~20KB)   │
│  Fields: unitId, title, category, difficulty, order      │
└────────────────────────┬─────────────────────────────────┘
                         │ lightweight, bundled
                         ▼
┌──────────────────────────────────────────────────────────┐
│  Supabase (detailed content, fetched on demand)          │
│  grammar_units      — explanation, examples, rules, tips │
│  grammar_exercises  — questions (choice/fill/fix/transform)│
│  grammar_mastery    — per-user progress tracking         │
└────────────────────────┬─────────────────────────────────┘
                         │ sessionStore cached fetch
                         ▼
┌──────────────────────────────────────────────────────────┐
│  RAG Knowledge Base                                      │
│  knowledge_chunks  — grammar knowledge vectors           │
│  (reuses existing RAG architecture)                      │
│  Enables: AI quiz generation + grammar Q&A               │
└──────────────────────────────────────────────────────────┘
```

### 2.1 Data Flow

1. **PDF extraction** — local script (`scripts/extract-grammar-pdf.mjs`) extracts text per page
2. **Structuring** — `scripts/build-grammar-data.mjs` (LLM-assisted) produces:
   - `packages/english/src/utils/grammar-index.ts` (static index, bundled)
   - `sql/grammar-seed.sql` (INSERT statements for `grammar_units` + `grammar_exercises`)
3. **RAG sync** — `scripts/sync-grammar-to-rag.mjs` ingests grammar content into `knowledge_chunks`
4. **Runtime** — user opens grammar page → static index renders category navigation → clicks a unit → fetches full content from DB → practices exercises → mastery updated

---

## 3. Data Model

### 3.1 TypeScript Types

File: `packages/english/src/utils/grammar-types.ts`

```typescript
export type GrammarExerciseType =
  | 'choice'                // multiple choice
  | 'fill_blank'           // fill in the blank
  | 'error_correction'     // find and fix the error
  | 'transformation'       // sentence transformation
  | 'sentence_completion'  // complete the sentence

export interface GrammarRule {
  title: string       // e.g. "一般现在时的构成"
  description: string // Chinese explanation of the rule
  pattern?: string    // e.g. "S + V(s/es) + O"
}

export interface GrammarExample {
  en: string    // "She works in a bank."
  zh: string    // "她在银行工作。"
  note?: string // optional annotation, e.g. "第三人称单数加 -s"
}

/** Static index entry — bundled in JS (~150B per unit). */
export interface GrammarIndexEntry {
  id: string            // 'unit-001'
  unitNumber: number    // 1-116, original book numbering
  title: string         // "am / is / are"
  titleZh: string       // "be 动词（现在时）"
  category: string      // 'present_tense'
  categoryZh: string    // '现在时'
  difficulty: number    // 1-5
  exerciseCount: number // number of exercises for this unit
}

export interface GrammarCategory {
  id: string          // 'present_tense'
  name: string        // '现在时'
  description: string // category description
  unitIds: string[]   // unit ids belonging to this category
}

/** Full unit detail returned from DB (loaded on demand). */
export interface GrammarUnitDetail {
  id: string
  unitNumber: number
  title: string
  titleZh: string
  category: string
  difficulty: number
  explanation: string     // Markdown-supported Chinese explanation
  rules: GrammarRule[]
  examples: GrammarExample[]
  tips: string | null
  notes: string | null
}

/** Single exercise row from DB. */
export interface GrammarExerciseRow {
  id: string
  unitId: string
  exerciseNumber: number
  type: GrammarExerciseType
  question: string
  options: string[] | null  // for choice type
  answer: string
  explanation: string | null
  difficulty: number
}

/** Per-user mastery for a grammar unit (lightweight shape — excludes id, userId, createdAt). */
export interface GrammarMasteryRow {
  unitId: string
  correctCount: number
  wrongCount: number
  masteryLevel: number      // 0-5, aligned with masteryUtils
  lastPracticedAt: string | null
  nextReviewAt: string | null
}
```

### 3.2 Static Index File

File: `packages/english/src/utils/grammar-index.ts` (~20KB)

```typescript
import type { GrammarCategory, GrammarIndexEntry } from './grammar-types'

export const GRAMMAR_CATEGORIES: GrammarCategory[] = [
  {
    id: 'present_tense',
    name: '现在时',
    description: 'be 动词、一般现在时、现在进行时等',
    unitIds: ['unit-001', 'unit-002', 'unit-003'],
  },
  // ~20 categories total
]

export const GRAMMAR_INDEX: GrammarIndexEntry[] = [
  {
    id: 'unit-001',
    unitNumber: 1,
    title: 'am / is / are',
    titleZh: 'be 动词（现在时）',
    category: 'present_tense',
    categoryZh: '现在时',
    difficulty: 1,
    exerciseCount: 8,
  },
  // ... 116 entries
]

/** Lookup helpers */
export function findGrammarUnit(unitId: string): GrammarIndexEntry | undefined {
  return GRAMMAR_INDEX.find(u => u.id === unitId)
}

export function findGrammarCategory(categoryId: string): GrammarCategory | undefined {
  return GRAMMAR_CATEGORIES.find(c => c.id === categoryId)
}

export function grammarUnitsByCategory(categoryId: string): GrammarIndexEntry[] {
  const cat = findGrammarCategory(categoryId)
  if (!cat) return []
  return GRAMMAR_INDEX.filter(u => cat.unitIds.includes(u.id))
}
```

### 3.3 Supabase Tables

```sql
-- ============================================================
-- grammar_units: full content per grammar unit (read-only for users)
-- ============================================================
CREATE TABLE grammar_units (
  id            text PRIMARY KEY,                    -- 'unit-001'
  unit_number   int NOT NULL,                        -- book unit number
  title         text NOT NULL,                       -- "am / is / are"
  title_zh      text NOT NULL,                       -- "be 动词（现在时）"
  category      text NOT NULL,                       -- category id
  difficulty    int NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),

  -- core content
  explanation   text NOT NULL,                       -- Chinese explanation (Markdown)
  rules         jsonb NOT NULL DEFAULT '[]'::jsonb,  -- GrammarRule[]
  examples      jsonb NOT NULL DEFAULT '[]'::jsonb,  -- GrammarExample[]
  tips          text,                                -- common mistakes / notes
  notes         text,                                -- supplementary info

  display_order int NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_grammar_units_category ON grammar_units(category);
CREATE INDEX idx_grammar_units_display_order ON grammar_units(display_order);

-- ============================================================
-- grammar_exercises: practice questions per unit
-- ============================================================
CREATE TABLE grammar_exercises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         text NOT NULL REFERENCES grammar_units(id),
  exercise_number int NOT NULL,                       -- order within unit

  type            text NOT NULL CHECK (type IN (
                    'choice', 'fill_blank', 'error_correction',
                    'transformation', 'sentence_completion')),
  question        text NOT NULL,                      -- question stem
  options         jsonb,                              -- ["A. ...", "B. ...", ...] for choice
  answer          text NOT NULL,                      -- correct answer (format by type: choice → 'A'/'B'/letter; fill_blank → missing text; error_correction → corrected sentence; transformation → transformed sentence; sentence_completion → completion text)
  explanation     text,                               -- answer explanation
  difficulty      int NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(unit_id, exercise_number)
);

CREATE INDEX idx_grammar_exercises_unit ON grammar_exercises(unit_id);

-- ============================================================
-- grammar_mastery: per-user mastery tracking
-- ============================================================
CREATE TABLE grammar_mastery (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id           text NOT NULL REFERENCES grammar_units(id),
  correct_count     int NOT NULL DEFAULT 0,
  wrong_count       int NOT NULL DEFAULT 0,
  mastery_level     int NOT NULL DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 5),
  last_practiced_at timestamptz,
  next_review_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, unit_id)
);

CREATE INDEX idx_grammar_mastery_user ON grammar_mastery(user_id);
CREATE INDEX idx_grammar_mastery_review ON grammar_mastery(user_id, next_review_at);

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE grammar_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammar_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammar_mastery ENABLE ROW LEVEL SECURITY;

-- grammar_units: all authenticated users can read
CREATE POLICY "grammar_units_read" ON grammar_units
  FOR SELECT TO authenticated USING (true);

-- grammar_units: only admins can write
CREATE POLICY "grammar_units_admin_write" ON grammar_units
  FOR ALL TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

-- grammar_exercises: all authenticated users can read
CREATE POLICY "grammar_exercises_read" ON grammar_exercises
  FOR SELECT TO authenticated USING (true);

-- grammar_exercises: only admins can write
CREATE POLICY "grammar_exercises_admin_write" ON grammar_exercises
  FOR ALL TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

-- grammar_mastery: users can only read/write their own data
CREATE POLICY "grammar_mastery_own" ON grammar_mastery
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## 4. Hooks

### 4.1 `useGrammarUnit(unitId)`

File: `packages/english/src/hooks/useGrammarUnit.ts`

```typescript
/**
 * Fetches a single grammar unit's full content + exercises from Supabase.
 * Cached via createUserSessionStore — same session won't refetch.
 *
 * Returns: { unit, exercises, loading, error }
 */
export function useGrammarUnit(unitId: string | null): {
  unit: GrammarUnitDetail | null
  exercises: GrammarExerciseRow[]
  loading: boolean
  error: string | null
}
```

Internally uses `createUserSessionStore` keyed by `grammar_unit:{unitId}` for the unit detail
and `grammar_exercises:{unitId}` for exercises. Both are content tables (not user-scoped),
so the cache key does not include userId.

### 4.2 `useGrammarMastery(user)`

File: `packages/english/src/hooks/useGrammarMastery.ts`

```typescript
/**
 * Manages per-user grammar mastery data.
 * Pattern follows useWordMastery.
 *
 * Returns: { masteryMap, recordAnswer, getUnitProgress, loading }
 */
export function useGrammarMastery(user: User | null): {
  /** Map<unitId, GrammarMasteryRow> */
  masteryMap: Map<string, GrammarMasteryRow>
  /** Record answers for a unit and update mastery_level via spaced repetition */
  recordAnswer: (unitId: string, correct: number, total: number) => Promise<void>
  /** Get progress summary for a specific unit */
  getUnitProgress: (unitId: string) => {
    level: number
    correctRate: number
    lastPracticed: string | null
    dueForReview: boolean
  }
  loading: boolean
}
```

Mastery level calculation aligns with `@rosie/core`'s `masteryUtils`:
- Level 0: never practiced
- Level 1: attempted once
- Level 2-5: progressive levels based on correct rate and consecutive practice sessions
- `next_review_at` follows the same spaced-repetition intervals as word mastery

### 4.3 `useGrammarOverview(user)`

File: `packages/english/src/hooks/useGrammarOverview.ts`

```typescript
/**
 * Aggregates overall grammar progress for the home page.
 * Lightweight — only fetches mastery rows, joins with static index.
 *
 * Returns: { totalUnits, studiedCount, averageLevel, categoryProgress, dueUnits }
 */
export function useGrammarOverview(user: User | null): {
  totalUnits: number          // from GRAMMAR_INDEX.length
  studiedCount: number        // units with masteryLevel > 0
  averageLevel: number        // weighted average mastery
  categoryProgress: Array<{
    categoryId: string
    name: string
    total: number
    studied: number
    avgLevel: number
  }>
  dueUnits: string[]          // unit ids where next_review_at <= now
  loading: boolean
}
```

---

## 5. Routes & Components

### 5.1 Route Structure

```
apps/web/src/app/english/grammar/
├── page.tsx              → Grammar home (category nav + progress overview)
├── [unitId]/
│   ├── page.tsx          → Unit detail (explanation + rules + examples)
│   └── practice/
│       └── page.tsx      → Unit practice (exercises + feedback + results)
```

### 5.2 Component Tree

```
packages/english/src/components/grammar/
├── GrammarHomePage.tsx          — category accordion + progress rings + stats
├── GrammarCategorySection.tsx   — collapsible category with unit grid
├── GrammarUnitCard.tsx          — unit card (title + difficulty stars + mastery badge)
├── GrammarUnitView.tsx          — unit detail page body
├── GrammarRuleCard.tsx          — single rule card (title + description + pattern)
├── GrammarExampleList.tsx       — bilingual example list with TTS
├── GrammarTipsCard.tsx          — tips/common-mistakes callout card
├── GrammarPracticeSession.tsx   — exercise runner (progressive, with instant feedback)
├── GrammarExerciseRenderer.tsx  — dispatcher: renders correct component by exercise type
├── GrammarChoiceQuestion.tsx    — multiple choice UI
├── GrammarFillBlank.tsx         — fill-in-the-blank UI
├── GrammarErrorCorrection.tsx   — error correction UI
├── GrammarTransformation.tsx    — sentence transformation UI
├── GrammarResultSummary.tsx     — post-practice summary (accuracy, time, encouragement)
└── GrammarMasteryBadge.tsx      — mastery level indicator (0-5 stars or bar)
```

### 5.3 English Home Page Entry Point

Add to `STATIC_LINKS` in `packages/english/src/components/EnglishQuickLinkGrid.tsx`:

```typescript
{
  href: `${BASE}/grammar`,
  icon: '📝',
  label: '语法',
  description: '语法讲解 · 例句学习 · 专项练习',
  gradient: 'linear-gradient(135deg, #fef9c3 0%, #fde68a 50%, #fcd34d 100%)',
  border: 'rgba(217,119,6,.35)',
  shadow: '0 4px 20px rgba(217,119,6,.12)',
  text: '#92400e',
}
```

### 5.4 Page Interactions

**Grammar Home** (`/english/grammar`):
- Top: overall progress (studied N/116 units, mastery distribution pie/bar)
- Body: collapsible categories, each containing a grid of unit cards
- Each unit card shows: title, difficulty stars (1-5), mastery badge (0-5)
- "Start practice" button at bottom → auto-selects next due or new unit

**Unit Detail** (`/english/grammar/[unitId]`):
- Header: unit title + number + difficulty indicator
- Explanation section: Chinese paragraphs (Markdown rendered)
- Rule cards: expandable/collapsible rule list
- Examples: bilingual (EN + ZH) with TTS playback (reuses `SpeakButton`)
- Tips card (if present): common mistakes highlight
- Bottom CTA: "Practice N questions" button

**Practice** (`/english/grammar/[unitId]/practice`):
- Progressive mode: progress bar, instant feedback per question (correct/wrong + explanation)
- Each question renders by type (choice / fill-blank / error-correction / transformation)
- After all questions: result summary (accuracy rate, time spent, weak points)
- On completion: `recordAnswer()` updates `grammar_mastery`

---

## 6. PDF Extraction & Data Import Pipeline

### 6.1 Extraction Script

File: `scripts/extract-grammar-pdf.mjs`

Reuses the local-script architecture from the RAG design:
- **Text PDF**: `pdf-parse` per-page text extraction
- **Scanned PDF** (OCR): fallback to `Tesseract.js` for pages with <20 chars
- **Resume support**: `.cache/grammar-pdf/` caches processed pages
- **Output**: `output/grammar-raw.json` (per-page raw text)

Dependencies (root `devDependencies`):
- `pdf-parse`: "^1.1.1"
- `tesseract.js`: "^5.0.0"
- `cli-progress`: "^3.12.0"

### 6.2 Structuring Script

File: `scripts/build-grammar-data.mjs`

Reads `output/grammar-raw.json`, uses LLM (百炼 qwen-plus) to assist parsing, produces:
- `packages/english/src/utils/grammar-index.ts` — static index
- `sql/grammar-seed.sql` — INSERT statements for `grammar_units` + `grammar_exercises`

### 6.3 npm Scripts

Add to root `package.json`:

```json
{
  "scripts": {
    "grammar:extract": "node scripts/extract-grammar-pdf.mjs docs/english/剑桥初级英语语法.pdf",
    "grammar:build": "node scripts/build-grammar-data.mjs",
    "grammar:seed": "pnpm supabase db execute --file sql/grammar-seed.sql",
    "grammar:sync-rag": "node scripts/sync-grammar-to-rag.mjs"
  }
}
```

### 6.4 Pipeline Flow

```
PDF file (docs/english/剑桥初级英语语法.pdf)
  │
  ▼
pnpm grammar:extract
  │  → output/grammar-raw.json (per-page text)
  ▼
pnpm grammar:build
  │  → packages/english/src/utils/grammar-index.ts  (static index)
  │  → sql/grammar-seed.sql                         (DB seed data)
  ▼
pnpm grammar:seed
  │  → Supabase: grammar_units + grammar_exercises populated
  ▼
pnpm grammar:sync-rag  (optional, Phase 3)
  │  → Supabase: knowledge_chunks populated with grammar vectors
  ▼
Done — grammar module fully operational
```

---

## 7. RAG Integration

### 7.1 Knowledge Chunks

Each grammar unit becomes one or more chunks in `knowledge_chunks`:

| Field | Value |
|-------|-------|
| `subject` | `'english'` |
| `knowledge_type` | `'grammar'` |
| `metadata` | `{ unitId: "unit-001", category: "present_tense", difficulty: 1 }` |
| `content` | Concatenation of: explanation text + rules + examples (as natural language) |

Chunking strategy: 1 chunk per unit (typically 300-800 chars). Units exceeding 800 chars are
split by rules/examples boundaries.

### 7.2 AI Feature Integration

Existing RAG features serve grammar without new API routes:

- **Knowledge Q&A**: "什么是现在进行时?" → RAG retrieves grammar chunks → generates answer
  (via existing `/api/ai/chat`)
- **Intelligent quiz**: quiz by weak grammar point → retrieves low-mastery units → LLM generates
  questions based on unit content (via existing `/api/ai/quiz`, adding `knowledge_type: 'grammar'`
  filter)
- **Weakness training**: `ai_training_plans` English weakness items can include grammar weak points
  (via existing `/api/ai/training/generate`, adding grammar mastery to the weakness analysis query)

No new API routes needed — only extend existing routes to recognize `knowledge_type: 'grammar'`.

---

## 8. Implementation Phases

### Phase 1: Foundation (core framework + UI + data pipeline)

**Goal**: end-to-end working grammar module with 5-10 manually-seeded units for validation.

1. Create DB migration (`supabase/migrations/YYYYMMDD_grammar_tables.sql`)
2. Implement `grammar-types.ts` + `grammar-index.ts` (with initial 5-10 units hardcoded)
3. Implement hooks: `useGrammarUnit`, `useGrammarMastery`, `useGrammarOverview`
4. Build UI components: home page, unit detail, practice session
5. Add routes: `/english/grammar`, `/english/grammar/[unitId]`, `/english/grammar/[unitId]/practice`
6. Add grammar entry card to `EnglishQuickLinkGrid`
7. Export new components/hooks from barrel `index.ts`
8. Manually seed 5-10 units via SQL for end-to-end testing
9. Run `pnpm typecheck` + `pnpm build` to verify

### Phase 2: Full Data (extract + ingest all 116 units)

**Goal**: complete grammar content from the book.

1. Implement `scripts/extract-grammar-pdf.mjs`
2. Implement `scripts/build-grammar-data.mjs`
3. Run extraction pipeline on the PDF
4. Review and refine generated `grammar-index.ts` + `grammar-seed.sql`
5. Seed all 116 units into Supabase
6. Verify data quality: spot-check explanations, examples, exercises
7. Update `exerciseCount` in static index to match actual DB counts

### Phase 3: RAG + AI Features

**Goal**: grammar-aware AI tutoring.

1. Implement `scripts/sync-grammar-to-rag.mjs`
2. Run RAG sync to populate `knowledge_chunks` with grammar content
3. Extend `/api/ai/quiz` to support `knowledge_type: 'grammar'` filter
4. Extend `/api/ai/training/generate` to include grammar weakness analysis
5. Verify: ask AI a grammar question, generate grammar quiz, check weakness training

**Phase review gates**: per user requirement, each phase requires plan doc review + code review
before proceeding to the next phase.

---

## 9. Barrel Exports

Add to `packages/english/src/index.ts`:

```typescript
// Grammar types
export type {
  GrammarExerciseType,
  GrammarRule,
  GrammarExample,
  GrammarIndexEntry,
  GrammarCategory,
  GrammarUnitDetail,
  GrammarExerciseRow,
  GrammarMasteryRow,
} from './utils/grammar-types'

// Grammar static index
export {
  GRAMMAR_CATEGORIES,
  GRAMMAR_INDEX,
  findGrammarUnit,
  findGrammarCategory,
  grammarUnitsByCategory,
} from './utils/grammar-index'

// Grammar hooks
export { useGrammarUnit } from './hooks/useGrammarUnit'
export { useGrammarMastery } from './hooks/useGrammarMastery'
export { useGrammarOverview } from './hooks/useGrammarOverview'

// Grammar components
export { default as GrammarHomePage } from './components/grammar/GrammarHomePage'
export { default as GrammarCategorySection } from './components/grammar/GrammarCategorySection'
export { default as GrammarUnitCard } from './components/grammar/GrammarUnitCard'
export { default as GrammarUnitView } from './components/grammar/GrammarUnitView'
export { default as GrammarRuleCard } from './components/grammar/GrammarRuleCard'
export { default as GrammarExampleList } from './components/grammar/GrammarExampleList'
export { default as GrammarTipsCard } from './components/grammar/GrammarTipsCard'
export { default as GrammarPracticeSession } from './components/grammar/GrammarPracticeSession'
export { default as GrammarExerciseRenderer } from './components/grammar/GrammarExerciseRenderer'
export { default as GrammarResultSummary } from './components/grammar/GrammarResultSummary'
export { default as GrammarMasteryBadge } from './components/grammar/GrammarMasteryBadge'
```

---

## 10. Assumptions & Constraints

1. The PDF is assumed to be text-extractable (not purely scanned). If it turns out to be
   scan-heavy, the extraction script will fall back to Tesseract.js OCR (slower but functional).
2. Grammar content is treated as **read-only reference material** — no admin CRUD UI is built
   in Phase 1. Content updates go through SQL seed scripts.
3. The `masteryUtils` spaced-repetition logic from `@rosie/core` is reused as-is for grammar
   mastery level calculation. If grammar-specific tuning is needed, it can be added in Phase 2+.
4. RAG integration (Phase 3) depends on the RAG knowledge base system being implemented first
   (design: `docs/superpowers/specs/2026-08-10-rag-knowledge-base-design.md`).
5. Grammar exercises are **not** included in the existing weekly plan system. Grammar practice is
   self-directed (user picks a unit and practices). Weekly plan integration can be added later.
6. All grammar UI uses Tailwind utility classes only; no module-specific CSS file is needed
   (unlike reading/phonics which have custom CSS variables). Re-evaluate if custom styling
   becomes necessary during implementation.
