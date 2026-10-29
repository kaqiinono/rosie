import type { CatalogReadiness, CatalogResource, CatalogSelection, CatalogSnapshotRequest, CatalogSnapshotResult, ProblemGroup, ProblemOption, Subject, TaskCatalogAdapter, TeachingSegment } from '@rosie/tasks'
import { buildCourseCatalogSnapshot, catalogConfigurationIssues, type OrderedCatalogLesson } from '../../lib/task-catalog-snapshot'

export const PROBLEM_GROUPS: readonly ProblemGroup[] = ['pretest', 'lesson', 'homework', 'workbook', 'supplement']
export const CATALOG_READY: CatalogReadiness = { status: 'ready', complete: true, error: null }
const unavailable: CatalogReadiness = { status: 'loading', complete: false, error: null }
export function catalogReadiness(ready: boolean, error: unknown | null): CatalogReadiness {
  return { status: error ? 'error' : ready ? 'ready' : 'loading', complete: ready && !error, error: error ? error instanceof Error ? error.message : String(error) : null }
}

export type ChineseCatalogBook = { book: string; lessons: { lessonKey: string; lessonTitle: string; unit: number; lessonKind: string; sortOrder: number; lesson?: number }[]; resources?: Record<string, CatalogResource[]> }
export function adaptChineseCatalog(books: ChineseCatalogBook[]): OrderedCatalogLesson[] {
  return books.flatMap((book, bookOrder) => book.lessons.slice().sort((a, b) => a.sortOrder - b.sortOrder).map((row, order) => {
    const key = row.lessonKey.includes('::') ? row.lessonKey : `${book.book}::${row.lessonKey}`
    if (!key.startsWith(`${book.book}::`)) throw new Error('chinese_book_key_mismatch')
    return { key, title: row.lessonTitle, book: book.book, unit: String(row.unit), kind: row.lessonKind, lesson: row.lesson, order: bookOrder * 100000 + order, href: `/chinese/${book.book}/units/${row.unit}`, resources: book.resources?.[row.lessonKey.split('::').pop()!] ?? [{ kind: 'audio', status: 'unverified' }] }
  }))
}
export type ChineseResourceSource = {
  passages: { lessonKey: string; paragraphs: string[] }[]
  poems: { source: string; unit: number; lesson?: number }[]
  accumulation: { unit: number; items: unknown[] }[]
  dictation: { lessonKey: string }[]
  chars: { lessonKey: string; recognize: string[]; write: string[] }[]
}
/** Source presence is evidence of text/characters only; narration is separately verified. */
export function chineseResources(localKey: string, unit: number, lesson: number, kind: string, source: ChineseResourceSource): CatalogResource[] {
  const chars = source.chars.find(row => row.lessonKey.split('::').pop() === localKey)
  const passage = source.passages.find(row => row.lessonKey === localKey)
  const poemCount = source.poems.filter(row => row.unit === unit && (kind === 'garden' ? row.source === 'garden' : row.source === 'lesson' && row.lesson === lesson)).length
  const accumulationCount = kind === 'garden' ? source.accumulation.filter(row => row.unit === unit).reduce((sum, row) => sum + row.items.length, 0) : 0
  const dictationCount = source.dictation.filter(row => row.lessonKey === localKey).length
  return [
    { kind: 'passage', status: passage?.paragraphs.some(text => text.trim()) ? 'available' : 'missing' },
    { kind: 'recognize', status: chars ? chars.recognize.length ? 'available' : 'missing' : 'unverified', ...(chars ? { count: chars.recognize.length } : {}) },
    { kind: 'write', status: chars ? chars.write.length ? 'available' : 'missing' : 'unverified', ...(chars ? { count: chars.write.length } : {}) },
    { kind: 'poem', status: poemCount ? 'available' : 'missing', count: poemCount },
    { kind: 'accumulation', status: accumulationCount ? 'available' : 'missing', count: accumulationCount },
    { kind: 'dictation', status: dictationCount ? 'available' : 'missing', count: dictationCount },
    { kind: 'audio', status: 'unverified' },
  ]
}
export type VocabularyCatalogRow = { stage?: string; unit: string; lesson: string; word: string }
export type PassageCatalogRow = { key: string; stage: string; unit: string; lesson: string; title: string; paragraphs: string[]; learningSections?: { type: string; grammarRefs?: { book: string; unitNumber: number }[] }[] }
function ordinal(value: string, prefix: string): number {
  const match = new RegExp(`^${prefix}\\s+(\\d+)$`, 'i').exec(value.trim())
  if (!match || Number(match[1]) < 1) throw new Error(`invalid_${prefix.toLowerCase()}_label`)
  return Number(match[1])
}
export function adaptEnglishCatalog(vocab: VocabularyCatalogRow[], passages: PassageCatalogRow[]): OrderedCatalogLesson[] {
  const entries = new Map<string, { stage: string; unit: number; lesson: number; words: Set<string>; passage?: PassageCatalogRow }>()
  const ensure = (row: { stage?: string; unit: string; lesson: string }) => {
    if (!row.stage || !/^\d+[A-Z]$/.test(row.stage)) return null
    const unit = ordinal(row.unit, 'Unit'), lesson = ordinal(row.lesson, 'Lesson')
    const key = `${row.stage.toLowerCase()}-u${unit}l${lesson}`
    if (!entries.has(key)) entries.set(key, { stage: row.stage, unit, lesson, words: new Set() })
    return entries.get(key)!
  }
  for (const row of vocab) ensure(row)?.words.add(row.word)
  for (const row of passages) {
    const entry = ensure(row)
    if (entry) {
      if (row.key !== `${row.stage.toLowerCase()}-u${entry.unit}l${entry.lesson}` || entry.passage) throw new Error('invalid_passage_identity')
      entry.passage = row
    }
  }
  return [...entries.entries()].sort(([, a], [, b]) => a.stage.localeCompare(b.stage, 'en', { numeric: true }) || a.unit - b.unit || a.lesson - b.lesson).map(([key, entry], order) => {
    const { stage, unit, lesson, words, passage } = entry
    const hasPassage = !!passage?.paragraphs.some(text => text.trim())
    const href = hasPassage ? `/english/words/reading/${key}` : undefined
    const resources: CatalogResource[] = [
      ...(words.size ? [{ kind: 'vocabulary' as const, status: 'available' as const, count: words.size }] : [{ kind: 'vocabulary' as const, status: 'missing' as const }]),
      { kind: 'passage', status: hasPassage ? 'available' : 'missing', ...(href ? { ref: href } : {}) },
      { kind: 'grammar', status: passage?.learningSections?.some(section => section.type === 'grammar') ? 'available' : 'missing' },
      { kind: 'writing', status: passage?.learningSections?.some(section => section.type === 'writing') ? 'available' : 'missing' },
      { kind: 'audio', status: 'unverified' },
    ]
    return { key, title: `Unit ${unit} · L${lesson}${passage ? ` · ${passage.title}` : ''}`, book: stage, unit: String(unit), lesson, kind: 'lesson', order, ...(href ? { href } : {}), resources }
  })
}

export type MathCatalogEntry = { lessonKey: string; grade: number; seq: number }
export type MathProblemRow = { id: string; displayId?: string; title: string; tag: string }
export type MathProblemBank = Partial<Record<ProblemGroup, MathProblemRow[]>>
export function adaptMathCatalog(lessons: readonly MathCatalogEntry[]): OrderedCatalogLesson[] {
  return lessons.map((lesson, order) => ({ key: lesson.lessonKey, title: `${lesson.grade} 年级 · 第 ${lesson.seq} 讲`, book: `${lesson.grade} 年级`, unit: String(lesson.seq), kind: 'lesson', order, href: `/math/ny/${lesson.grade}/${lesson.seq}`, resources: [{ kind: 'problems', status: 'unverified' }, { kind: 'replay', status: 'unverified' }] }))
}
export function adaptMathProblems(lesson: MathCatalogEntry, bank: MathProblemBank, verifiedReplays: Record<string, string> = {}): ProblemOption[] {
  const rows = PROBLEM_GROUPS.flatMap(group => (bank[group] ?? []).map((problem, order) => {
    const key = `${group}:${problem.id}`
    return { key, stable_key: `${encodeURIComponent(lesson.lessonKey)}:${group}:${encodeURIComponent(problem.id)}`, id: problem.id, lesson_key: lesson.lessonKey, group, displayId: problem.displayId?.trim() || problem.id.replace(/^\d+(?:-\d+)?-(?=[PLHWS]\d)/, ''), order, tags: problem.tag ? [problem.tag] : [], title: problem.title, href: `/math/ny/${lesson.grade}/${lesson.seq}/${group}/${encodeURIComponent(problem.id)}`, ...(verifiedReplays[key] ? { replay_ref: verifiedReplays[key] } : {}) }
  }))
  if (rows.some(row => !row.id) || new Set(rows.map(row => row.stable_key)).size !== rows.length) throw new Error('invalid_problem_identity')
  return rows
}
/** Explicit opt-in helper only; group classification is never inferred to be teaching order. */
export function mathGroupSegment(lessonKey: string, group: ProblemGroup, problems: ProblemOption[]): TeachingSegment[] {
  return [group].flatMap(group => {
    const rows = problems.filter(problem => problem.group === group)
    return rows.length ? [{ key: `${encodeURIComponent(lessonKey)}:${group}`, lesson_key: lessonKey, title: ({ pretest: '课前测', lesson: '课堂例题', homework: '课后巩固', workbook: '练习册', supplement: '补充题' })[group], problem_keys: rows.map(problem => problem.stable_key) }] : []
  })
}
export type CatalogAdapterSources = {
  chinese: OrderedCatalogLesson[]; english: OrderedCatalogLesson[]; math: OrderedCatalogLesson[]; manual?: OrderedCatalogLesson[]
  readiness: Partial<Record<Subject, CatalogReadiness>>
  readinessFor?: (subject: Subject, selection?: CatalogSelection) => CatalogReadiness
  loadMathProblems: (key: string) => Promise<ProblemOption[]>
  materials?: TaskCatalogAdapter['materials']
}
export function createTaskCatalogAdapter(sources: CatalogAdapterSources): TaskCatalogAdapter & { prepareSnapshot: (request: CatalogSnapshotRequest) => Promise<CatalogSnapshotResult> } {
  const readinessFor = sources.readinessFor ?? ((subject: Subject) => sources.readiness[subject] ?? unavailable)
  return { chinese: sources.chinese, english: sources.english, math: sources.math, loadMathProblems: sources.loadMathProblems, materials: sources.materials, readiness: sources.readiness, readinessFor,
    prepareSnapshot: async request => {
      const readiness = request.source === 'manual' ? CATALOG_READY : readinessFor(request.subject, request.selection)
      if (readiness.status !== 'ready' || !readiness.complete || readiness.error) return { status: 'unavailable', readiness, code: 'catalog_not_ready' }
      try {
        let math = sources.math
        const segments = request.teaching_segments ?? []
        if (request.subject === 'math' && request.source !== 'manual') {
          const selected = sources.math.filter(row => (!request.selection?.book || row.book === request.selection.book) && (!request.selection?.units || request.selection.units.includes(row.unit)) && (!request.selection?.lesson_keys || request.selection.lesson_keys.includes(row.key)))
          const knownProblems = new Set<string>()
          math = [...sources.math]
          for (const row of selected) {
            const problems = await sources.loadMathProblems(row.key)
            if (!problems.length) throw new Error(`missing_math_problems:${row.key}`)
            problems.forEach(problem => knownProblems.add(problem.stable_key))
            math = math.map(lesson => lesson.key === row.key ? { ...lesson, resources: [{ kind: 'problems', status: 'available', count: problems.length }, { kind: 'replay', status: 'unverified' }] } : lesson)
          }
          if (segments.some(segment => segment.problem_keys.some(key => !knownProblems.has(key)))) throw new Error('unknown_segment_problem')
        }
        const snapshot = buildCourseCatalogSnapshot({ ...request, chinese: sources.chinese, english: sources.english, math, manual: request.manual_lessons ?? sources.manual ?? [], teaching_segments: segments, readiness })
        return { status: 'ready', snapshot, issues: catalogConfigurationIssues(snapshot) }
      } catch (error) {
        const code = error instanceof Error ? error.message : String(error)
        return { status: 'unavailable', readiness: { status: 'error', complete: false, error: code }, code }
      }
    },
  }
}
