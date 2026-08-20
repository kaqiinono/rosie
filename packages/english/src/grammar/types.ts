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

// ── Book identity ─────────────────────────────────────────────────────────────

/** 已知语法书 ID（对应 DB grammar_units.book 列） */
export type GrammarBookId = 'essential' | 'intermediate' | 'advanced'

export interface GrammarBookMeta {
  id: GrammarBookId
  label: string
  labelZh: string
  maxUnits: number
}

/**
 * 已知语法书注册表。新增一本书时在此追加条目，DB 无需 migration
 * （book 列已为 TEXT）。
 */
export const GRAMMAR_BOOKS: Record<GrammarBookId, GrammarBookMeta> = {
  essential: { id: 'essential', label: 'Essential Grammar in Use', labelZh: '剑桥初级英语语法', maxUnits: 115 },
  intermediate: { id: 'intermediate', label: 'English Grammar in Use', labelZh: '剑桥中级英语语法', maxUnits: 145 },
  advanced: { id: 'advanced', label: 'Advanced Grammar in Use', labelZh: '剑桥高级英语语法', maxUnits: 120 },
}

// ── Storage ────────────────────────────────────────────────────────────────────

/** Supabase Storage bucket for grammar page images */
export const GRAMMAR_PAGES_BUCKET = 'grammar-pages'

/**
 * 教学内容区域包围盒（提取时由 Vision LLM 输出）。
 * 坐标归一化到 0-1000（图像左上角 (0,0)，右下角 (1000,1000)），
 * 渲染时按图片自然分辨率换算即可裁出无白边的内容区。
 */
export interface GrammarPageCrop {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface GrammarPageImage {
  /** 书内印刷页码 */
  page: number
  /** Supabase Storage path: {book}/unit{NNN}/page-{NNNN}.png */
  path: string
  /** 页面类型：讲解页 / 练习页 */
  type: 'lesson' | 'exercise'
  /** 内容区域坐标；旧提取数据无此字段，缺省时展示整页 */
  crop?: GrammarPageCrop
}

/** 构造 Storage public URL（无需 Supabase client，仅拼 URL） */
export function grammarPageImageUrl(path: string, supabaseUrl?: string): string {
  const base = (supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')
  if (!base) return ''
  return `${base}/storage/v1/object/public/${GRAMMAR_PAGES_BUCKET}/${path}`
}

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

export interface SpellingRuleBlock {
  type: 'spelling_rule'
  /** 规则说明文字（可含换行） */
  text: string
  /** 拼写变化示例：base → form（如 come → coming） */
  examples: { base: string; form: string }[]
}

export interface ImageDescriptionBlock {
  type: 'image_description'
  /** 教学内容插图的逐字描述（可含换行） */
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
  | SpellingRuleBlock
  | ImageDescriptionBlock
  | TipBlock
  | UnsupportedBlock

export interface GrammarSection {
  label: string | null
  title: string | null
  /** 原书印刷页码（逐页提取时注入） */
  bookPage?: number
  /** Section 级插图（admin 从原书页图裁切插入，按插入顺序渲染） */
  figures?: GrammarFigure[]
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
  | 'matching'

const KNOWN_EXERCISE_TYPES: readonly string[] = [
  'fill_blank',
  'sentence_completion',
  'short_answer',
  'transformation',
  'multiple_choice',
  'matching',
]

export interface GrammarExerciseItem {
  number: number
  type: GrammarExerciseType
  /** 题干；填空处用 6 个下划线 ______ 表示 */
  prompt: string
  /** 空字符串 = 开放题，展示不判分 */
  answer: string
  options?: string[] | null
  /** 学习指导题目右侧标注的相关学习单元（可多个） */
  studyUnits?: number[]
}

/** 插图：从原书页图裁切后上传 Storage 的独立图片（讲解 Section / 练习组共用） */
export interface GrammarFigure {
  /** Storage path: {book}/unit{NNN}/figures/fig-{timestamp}.png（grammar-pages bucket） */
  path: string
  /** 裁剪来源的书内印刷页码（追溯用） */
  page: number
}

export interface GrammarExerciseGroup {
  section: string
  instruction: string
  /** 原书印刷页码（逐页提取时注入） */
  bookPage?: number
  /** 组级插图（admin 从原书页图裁切插入） */
  figure?: GrammarFigure
  items: GrammarExerciseItem[]
}

// ── Unit aggregate & DB shapes ────────────────────────────────────────────────

export interface GrammarUnitDetail {
  book: GrammarBookId
  unitNumber: number
  title: string
  titleZh: string
  category: string
  categoryZh: string
  difficulty: number
  /** 原书印刷页码，如 [21, 22] */
  bookPages: number[]
  /** 原文图片（Storage 路径） */
  pageImages: GrammarPageImage[]
  lesson: GrammarLesson
  exercises: GrammarExerciseGroup[]
  /** 补充练习条目对应的正文单元（练习表第三列，仅补充练习条目有） */
  units?: number[]
  /** 锚定到本单元的补充练习延展位（仅正文单元有，迁移 0028 后回写） */
  suppEntries?: number[]
  /** studyUnits 含本单元的学习指导条目延展位（仅正文单元有） */
  studyGuideUnits?: number[]
}

export interface GrammarUnitSummary {
  book: GrammarBookId
  unitNumber: number
  title: string
  titleZh: string
  category: string
  categoryZh: string
  difficulty: number
  bookPages: number[]
  units?: number[]
  suppEntries?: number[]
  studyGuideUnits?: number[]
}

/** 首页高级检索索引条目（search_text 懒加载缓存） */
export interface GrammarSearchIndexEntry {
  book: GrammarBookId
  unitNumber: number
  searchText: string
}

export type GrammarMasteryMap = Record<
  string,
  { correct: number; total: number; mastered: boolean; lastPracticedAt: string }
>

/** 静态索引条目（Phase 2 由 grammar:extract --toc 生成） */
export interface GrammarIndexEntry {
  book: GrammarBookId
  unitNumber: number
  title: string
  titleZh: string
  category: string
  categoryZh: string
  bookPages: [number, number]
}

export interface GrammarUnitRow {
  book: string
  unit_number: number
  title: string
  title_zh: string | null
  category: string | null
  category_zh: string | null
  difficulty: number | null
  book_pages: number[] | null
  page_images: unknown
  lesson: unknown
  exercises: unknown
  /** 迁移 0028 新增列（未应用时为 undefined） */
  units?: unknown
  supp_entries?: unknown
  study_guide_units?: unknown
  /** 迁移 0029 新增列（未应用时为 undefined） */
  search_text?: string | null
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

/** 解析 crop：4 个 0-1000 坐标且 x1<x2、y1<y2 才有效，否则 undefined（crash-proof） */
function normalizePageCrop(raw: unknown): GrammarPageCrop | undefined {
  const rec = asRecord(raw)
  if (!rec) return undefined
  const x1 = asNumber(rec.x1, -1)
  const y1 = asNumber(rec.y1, -1)
  const x2 = asNumber(rec.x2, -1)
  const y2 = asNumber(rec.y2, -1)
  const inRange = (n: number) => n >= 0 && n <= 1000
  if (![x1, y1, x2, y2].every(inRange) || x2 <= x1 || y2 <= y1) return undefined
  return { x1, y1, x2, y2 }
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
      case 'spelling_rule':
        out.push({
          type,
          text: asString(rec.text),
          examples: Array.isArray(rec.examples)
            ? (rec.examples as unknown[]).map((e) => {
                const er = asRecord(e)
                return { base: asString(er?.base), form: asString(er?.form) }
              })
            : [],
        })
        break
      case 'image_description':
        out.push({ type, text: asString(rec.text) })
        break
      case 'cross_reference':
        // 误放入 blocks 的交叉引用：降级为 tip 展示，不丢失信息
        out.push({ type: 'tip', text: `→ ${asString(rec.text)}` })
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
        figures: Array.isArray(sr.figures)
          ? sr.figures
              .map(normalizeFigure)
              .filter((f): f is GrammarFigure => f !== undefined)
          : undefined,
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

function normalizeFigure(raw: unknown): GrammarFigure | undefined {
  const rec = asRecord(raw)
  if (!rec) return undefined
  const path = asString(rec.path)
  if (!path) return undefined
  return { path, page: asNumber(rec.page) }
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
          ...(() => {
            const studyUnits = Array.isArray(ir.studyUnits)
              ? ir.studyUnits.map((n) => asNumber(n, NaN)).filter((n) => Number.isFinite(n))
              : undefined
            return studyUnits && studyUnits.length > 0 ? { studyUnits } : {}
          })(),
        })
      }
    }
    groups.push({
      section: asString(rec.section),
      instruction: asString(rec.instruction),
      bookPage: typeof rec.bookPage === 'number' ? rec.bookPage : undefined,
      figure: normalizeFigure(rec.figure),
      items,
    })
  }
  return groups
}

/** 数字数组列归一（units / supp_entries / study_guide_units）；非法/缺失返回 undefined */
function normalizeNumberArray(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out = raw.map((n) => asNumber(n, NaN)).filter((n) => Number.isFinite(n))
  return out.length > 0 ? out : undefined
}

export function parseGrammarUnitRow(row: GrammarUnitRow): GrammarUnitDetail {
  const pageImages: GrammarPageImage[] = []
  if (Array.isArray(row.page_images)) {
    for (const item of row.page_images) {
      const rec = asRecord(item)
      if (!rec) continue
      const page = asNumber(rec.page, 0)
      const path = asString(rec.path)
      const type = rec.type === 'exercise' ? 'exercise' as const : 'lesson' as const
      const crop = normalizePageCrop(rec.crop)
      if (path) pageImages.push({ page, path, type, ...(crop ? { crop } : {}) })
    }
  }
  return {
    book: (row.book || 'essential') as GrammarBookId,
    unitNumber: row.unit_number,
    title: row.title,
    titleZh: row.title_zh ?? '',
    category: row.category ?? '',
    categoryZh: row.category_zh ?? '',
    difficulty: row.difficulty ?? 1,
    bookPages: Array.isArray(row.book_pages) ? row.book_pages : [],
    pageImages,
    lesson: normalizeLesson(row.lesson),
    exercises: normalizeExercises(row.exercises),
    ...(normalizeNumberArray(row.units) ? { units: normalizeNumberArray(row.units) } : {}),
    ...(normalizeNumberArray(row.supp_entries) ? { suppEntries: normalizeNumberArray(row.supp_entries) } : {}),
    ...(normalizeNumberArray(row.study_guide_units) ? { studyGuideUnits: normalizeNumberArray(row.study_guide_units) } : {}),
  }
}

export function toSummary(d: GrammarUnitDetail): GrammarUnitSummary {
  return {
    book: d.book,
    unitNumber: d.unitNumber,
    title: d.title,
    titleZh: d.titleZh,
    category: d.category,
    categoryZh: d.categoryZh,
    difficulty: d.difficulty,
    bookPages: d.bookPages,
    ...(d.units ? { units: d.units } : {}),
    ...(d.suppEntries ? { suppEntries: d.suppEntries } : {}),
    ...(d.studyGuideUnits ? { studyGuideUnits: d.studyGuideUnits } : {}),
  }
}
