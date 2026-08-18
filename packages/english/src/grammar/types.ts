/**
 * Grammar module data contract — the "framework" side of content-driven rendering.
 *
 * Content is jsonb blocks discriminated by `type`; the render layer is a
 * type → component registry (see LessonView/ExerciseView). Unknown block types
 * are normalized to `unsupported` so pages degrade gracefully instead of
 * crashing when future units introduce new shapes.
 *
 * Extending the framework (new content shape) is a four-step flow — see
 * docs/superpowers/specs/2026-08-18-grammar-framework-design.md §5.
 */

// ── Lesson content blocks ─────────────────────────────────────────────────────

export interface GrammarExample {
  en: string
  zh: string
  bold?: string[]
  note?: string | null
}

export interface ExampleSetBlock {
  type: 'example_set'
  /** 情境描述，如「Lisa 自我介绍」 */
  context: string
  items: GrammarExample[]
}

export interface GrammarTableBlock {
  type: 'grammar_table'
  title: string
  headers: string[]
  rows: string[][]
}

export interface ContractionNoteBlock {
  type: 'contraction_note'
  items: { full: string; short: string }[]
}

export interface ExamplesBlock {
  type: 'examples'
  items: GrammarExample[]
}

export interface RuleTextBlock {
  type: 'rule_text'
  text: string
}

export interface TipBlock {
  type: 'tip'
  text: string
}

/** 未知 block 类型的兜底形态：保留原始信息，渲染层降级展示 */
export interface UnsupportedBlock {
  type: 'unsupported'
  originalType: string
  text: string
}

export type GrammarBlock =
  | ExampleSetBlock
  | GrammarTableBlock
  | ContractionNoteBlock
  | ExamplesBlock
  | RuleTextBlock
  | TipBlock
  | UnsupportedBlock

export interface GrammarSection {
  label: string | null
  title: string | null
  /** 原书印刷页码（逐页提取时注入） */
  bookPage?: number
  blocks: GrammarBlock[]
}

export interface CrossReference {
  text: string
  targetUnit: number | null
}

export interface GrammarLesson {
  sections: GrammarSection[]
  crossReferences: CrossReference[]
}

// ── Exercises ─────────────────────────────────────────────────────────────────

export type GrammarExerciseType =
  | 'fill_blank'
  | 'sentence_completion'
  | 'short_answer'
  | 'transformation'
  | 'multiple_choice'

const KNOWN_EXERCISE_TYPES: readonly string[] = [
  'fill_blank',
  'sentence_completion',
  'short_answer',
  'transformation',
  'multiple_choice',
]

export interface GrammarExerciseItem {
  number: number
  type: GrammarExerciseType
  /** 题干；填空处用 6 个下划线 ______ 表示 */
  prompt: string
  /** 空字符串 = 开放题，展示不判分 */
  answer: string
  options?: string[] | null
}

export interface GrammarExerciseGroup {
  section: string
  instruction: string
  /** 原书印刷页码（逐页提取时注入） */
  bookPage?: number
  items: GrammarExerciseItem[]
}

// ── Unit aggregate & DB shapes ────────────────────────────────────────────────

export interface GrammarUnitDetail {
  unitNumber: number
  title: string
  titleZh: string
  category: string
  categoryZh: string
  difficulty: number
  /** 原书印刷页码，如 [21, 22] */
  bookPages: number[]
  lesson: GrammarLesson
  exercises: GrammarExerciseGroup[]
}

export interface GrammarUnitSummary {
  unitNumber: number
  title: string
  titleZh: string
  category: string
  categoryZh: string
  difficulty: number
  bookPages: number[]
}

export type GrammarMasteryMap = Record<
  number,
  { correct: number; total: number; mastered: boolean; lastPracticedAt: string }
>

/** 静态索引条目（Phase 2 由 grammar:extract --toc 生成） */
export interface GrammarIndexEntry {
  unitNumber: number
  title: string
  titleZh: string
  category: string
  categoryZh: string
  bookPages: [number, number]
}

export interface GrammarUnitRow {
  unit_number: number
  title: string
  title_zh: string | null
  category: string | null
  category_zh: string | null
  difficulty: number | null
  book_pages: number[] | null
  lesson: unknown
  exercises: unknown
}

// ── Normalizers (jsonb → typed, crash-proof) ──────────────────────────────────

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function normalizeExampleItems(raw: unknown): GrammarExample[] {
  if (!Array.isArray(raw)) return []
  const out: GrammarExample[] = []
  for (const item of raw) {
    const rec = asRecord(item)
    if (!rec) continue
    out.push({
      en: asString(rec.en),
      zh: asString(rec.zh),
      bold: Array.isArray(rec.bold) ? rec.bold.map(String) : undefined,
      note: typeof rec.note === 'string' ? rec.note : null,
    })
  }
  return out
}

export function normalizeBlocks(raw: unknown): GrammarBlock[] {
  if (!Array.isArray(raw)) return []
  const out: GrammarBlock[] = []
  for (const item of raw) {
    const rec = asRecord(item)
    if (!rec) continue
    const type = asString(rec.type)
    switch (type) {
      case 'example_set':
        out.push({ type, context: asString(rec.context), items: normalizeExampleItems(rec.items) })
        break
      case 'examples':
        out.push({ type, items: normalizeExampleItems(rec.items) })
        break
      case 'grammar_table':
        out.push({
          type,
          title: asString(rec.title),
          headers: Array.isArray(rec.headers) ? rec.headers.map(String) : [],
          rows: Array.isArray(rec.rows)
            ? (rec.rows as unknown[]).map((r) => (Array.isArray(r) ? r.map(String) : []))
            : [],
        })
        break
      case 'contraction_note':
        out.push({
          type,
          items: Array.isArray(rec.items)
            ? (rec.items as unknown[]).map((c) => {
                const cr = asRecord(c)
                return { full: asString(cr?.full), short: asString(cr?.short) }
              })
            : [],
        })
        break
      case 'rule_text':
      case 'tip':
        out.push({ type, text: asString(rec.text) })
        break
      default:
        out.push({ type: 'unsupported', originalType: type || 'unknown', text: JSON.stringify(item) })
    }
  }
  return out
}

export function normalizeLesson(raw: unknown): GrammarLesson {
  const rec = asRecord(raw) ?? {}
  const sections: GrammarSection[] = []
  if (Array.isArray(rec.sections)) {
    for (const s of rec.sections) {
      const sr = asRecord(s)
      if (!sr) continue
      sections.push({
        label: typeof sr.label === 'string' ? sr.label : null,
        title: typeof sr.title === 'string' ? sr.title : null,
        bookPage: typeof sr.bookPage === 'number' ? sr.bookPage : undefined,
        blocks: normalizeBlocks(sr.blocks),
      })
    }
  }
  const crossReferences: CrossReference[] = []
  if (Array.isArray(rec.crossReferences)) {
    for (const c of rec.crossReferences) {
      const cr = asRecord(c)
      if (!cr) continue
      crossReferences.push({
        text: asString(cr.text),
        targetUnit: typeof cr.targetUnit === 'number' ? cr.targetUnit : null,
      })
    }
  }
  return { sections, crossReferences }
}

export function normalizeExercises(raw: unknown): GrammarExerciseGroup[] {
  if (!Array.isArray(raw)) return []
  const groups: GrammarExerciseGroup[] = []
  for (const g of raw) {
    const rec = asRecord(g)
    if (!rec) continue
    const items: GrammarExerciseItem[] = []
    if (Array.isArray(rec.items)) {
      for (const it of rec.items) {
        const ir = asRecord(it)
        if (!ir) continue
        const t = asString(ir.type)
        items.push({
          number: asNumber(ir.number, items.length + 1),
          // 未知题型归一为 short_answer：展示不判分，永不崩溃
          type: (KNOWN_EXERCISE_TYPES.includes(t) ? t : 'short_answer') as GrammarExerciseType,
          prompt: asString(ir.prompt),
          answer: asString(ir.answer),
          options: Array.isArray(ir.options) ? ir.options.map(String) : null,
        })
      }
    }
    groups.push({
      section: asString(rec.section),
      instruction: asString(rec.instruction),
      bookPage: typeof rec.bookPage === 'number' ? rec.bookPage : undefined,
      items,
    })
  }
  return groups
}

export function parseGrammarUnitRow(row: GrammarUnitRow): GrammarUnitDetail {
  return {
    unitNumber: row.unit_number,
    title: row.title,
    titleZh: row.title_zh ?? '',
    category: row.category ?? '',
    categoryZh: row.category_zh ?? '',
    difficulty: row.difficulty ?? 1,
    bookPages: Array.isArray(row.book_pages) ? row.book_pages : [],
    lesson: normalizeLesson(row.lesson),
    exercises: normalizeExercises(row.exercises),
  }
}

export function toSummary(d: GrammarUnitDetail): GrammarUnitSummary {
  return {
    unitNumber: d.unitNumber,
    title: d.title,
    titleZh: d.titleZh,
    category: d.category,
    categoryZh: d.categoryZh,
    difficulty: d.difficulty,
    bookPages: d.bookPages,
  }
}
