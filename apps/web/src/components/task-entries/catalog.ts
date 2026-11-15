import { readAll } from './catalogData'
import { chineseCatalog } from './chineseCatalog'
import { attachResources, sentenceContent } from './resources'
import { practiceSelectionPath, type PracticeEntryRow } from '@rosie/tasks'

export type CatalogKind = 'math' | 'chineseCourse' | 'chineseChars' | 'chineseReading' | 'englishCards' | 'englishPractice' | 'englishReading' | 'englishGrammar' | 'englishSentences' | 'chinesePoems' | 'chineseAccumulation' | 'chineseRecognize' | 'chineseWords'
export interface CatalogGroup { id: string; label: string; rows: PracticeEntryRow[] }
export interface Catalog { path: string; subject: 'math' | 'chinese' | 'english'; groups: CatalogGroup[] }
export const CATALOG_LABELS: Record<CatalogKind, string> = {
  chineseCourse: '语文课程',
  chinesePoems: '语文古诗', chineseAccumulation: '语文日积月累', chineseRecognize: '语文会认字', chineseWords: '语文词语', englishSentences: '英语逐句听读',
  math: '数学题目', chineseChars: '语文生字练习', chineseReading: '语文课文',
  englishCards: '英语单词卡', englishPractice: '英语单词练习', englishReading: '英语阅读', englishGrammar: '英语语法',
}
export const CATALOG_KINDS_BY_SUBJECT: Record<'math' | 'chinese' | 'english' | 'life', CatalogKind[]> = {
  math: ['math'],
  chinese: ['chineseChars', 'chineseReading', 'chinesePoems', 'chineseAccumulation', 'chineseRecognize', 'chineseWords'],
  english: ['englishCards', 'englishPractice', 'englishReading', 'englishSentences', 'englishGrammar'],
  life: [],
}
async function buildRawCatalog(kind: CatalogKind, section: string): Promise<Catalog> {
  if (kind === 'math') {
    const [{ SEA_LESSONS }, { lessonByKey }, { sectionSourceLabel }] = await Promise.all([
      import('@rosie/math/utils/sea-data'), import('@rosie/math-kit/utils/lesson-registry'), import('@rosie/math-kit/utils/problem-location'),
    ])
    const groups: CatalogGroup[] = []
    for (const lesson of [...SEA_LESSONS].sort((a, b) => {
      const x = lessonByKey(a.id); const y = lessonByKey(b.id)
      return (x?.grade ?? 0) - (y?.grade ?? 0) || (x?.seq ?? 0) - (y?.seq ?? 0)
    })) {
      const meta = lessonByKey(lesson.id)
      if (!meta) continue
      const problems = lesson.problems[section as keyof typeof lesson.problems]
      if (!problems?.length) continue
      groups.push({ id: lesson.id, label: lesson.title, rows: problems.map((p, index) => ({
        id: `math:${lesson.id}:${section}:${p.id}`, label: `${lesson.shortTitle} · ${sectionSourceLabel(lesson.id, section)} · ${index + 1}题（${p.id}）`,
        selectionPath: [{ level: '年级', id: String(meta.grade), label: `${meta.grade}年级` }, { level: '课程', id: lesson.id, label: lesson.title }, { level: '题目类型', id: section, label: sectionSourceLabel(lesson.id, section) }],
        values: { grade: String(meta.grade), seq: String(meta.seq), section, index: String(index + 1), problemId: p.id },
      })) })
    }
    return { subject: 'math', path: '/math/ny/{grade}/{seq}/{section}/{problemId}', groups }
  }
  if (kind.startsWith('chinese')) return chineseCatalog(kind)
  if (kind === 'englishReading' || kind === 'englishSentences') {
    const { readingPassages, readingSegments } = await import('@rosie/english')
    const groups = new Map<string, CatalogGroup>()
    const passages = [...readingPassages].sort((a, b) => `${a.stage}\t${a.unit}\t${a.lesson}`.localeCompare(`${b.stage}\t${b.unit}\t${b.lesson}`, 'en', { numeric: true }))
    for (const passage of passages) {
      const key = JSON.stringify([passage.stage, passage.unit])
      const group = groups.get(key) ?? { id: key, label: `${passage.stage} · ${passage.unit}`, rows: [] }
      if (kind === 'englishSentences') {
        passage.paragraphs.forEach((_, paragraph) => {
          readingSegments(passage, paragraph).forEach((text, sentence) => {
            const sentenceId = `${paragraph}-${sentence}`
            group.rows.push({ id: `sentence:${passage.key}:${sentenceId}`, label: `${passage.title} · ${paragraph + 1}-${sentence + 1} · ${text}`,
              selectionPath: [{ level: '教材', id: passage.stage, label: passage.stage }, { level: '单元', id: passage.unit, label: passage.unit }, { level: '课程', id: passage.key, label: `${passage.lesson} · ${passage.title}` }],
              values: { key: passage.key, sentenceId, stage: passage.stage, unit: passage.unit, lesson: passage.lesson },
              content: sentenceContent(passage.key, sentenceId, text) })
          })
        })
      } else group.rows.push({ id: `reading:${passage.key}`, label: `${passage.stage} · ${passage.unit} · ${passage.lesson} · ${passage.title}`,
        values: { key: passage.key, stage: passage.stage, unit: passage.unit, lesson: passage.lesson },
        content: [{ title: passage.title, text: passage.paragraphs.join('\n\n') }] })
      groups.set(key, group)
    }
    return { subject: 'english', path: '/english/words/reading/{key}', groups: [...groups.values()] }
  }
  if (kind === 'englishGrammar') {
    const { GRAMMAR_BOOKS } = await import('@rosie/english')
    const units = await readAll<{ book: string; unit_number: number; title: string; title_zh: string | null }>(
      'grammar_units', 'book,unit_number,title,title_zh', 'book,unit_number')
    const groups: CatalogGroup[] = Object.values(GRAMMAR_BOOKS).map((book) => ({
      id: book.id, label: book.labelZh,
      rows: units.filter((unit) => unit.book === book.id && unit.unit_number >= 1 && unit.unit_number <= (book.id === 'essential' ? 169 : book.maxUnits))
        .sort((a, b) => a.unit_number - b.unit_number).map((unit) => ({
          id: `grammar:${book.id}:${unit.unit_number}`, label: `${book.labelZh} · Unit ${unit.unit_number} · ${unit.title_zh || unit.title}`,
          selectionPath: [{ level: '教材', id: book.id, label: book.labelZh }],
          values: { book: book.id, unitId: String(unit.unit_number) },
        })),
    })).filter((group) => group.rows.length > 0)
    return { subject: 'english', path: '/english/grammar/{book}/{unitId}', groups }
  }
  const words = await readAll<{ stage: string | null; unit: string; lesson: string }>('word_entries', 'id,stage,unit,lesson', 'id')
  const groups = new Map<string, CatalogGroup>()
  const seen = new Set<string>()
  const sorted = [...words].sort((a, b) => `${a.stage}\t${a.unit}\t${a.lesson}`.localeCompare(`${b.stage}\t${b.unit}\t${b.lesson}`, 'en', { numeric: true }))
  for (const word of sorted) {
    if (!word.stage) continue
    const key = JSON.stringify([word.stage, word.unit, word.lesson])
    if (seen.has(key)) continue
    seen.add(key)
    const groupKey = JSON.stringify([word.stage, word.unit])
    const group = groups.get(groupKey) ?? { id: groupKey, label: `${word.stage} · ${word.unit}`, rows: [] }
    group.rows.push({ id: `english:${key}`, label: `${word.stage} · ${word.unit} · ${word.lesson}`,
      values: { stage: word.stage, unit: word.unit, lesson: word.lesson, lessonKey: `${word.unit}::${word.lesson}` } })
    groups.set(groupKey, group)
  }
  return { subject: 'english', path: `/english/words/${kind === 'englishCards' ? 'cards' : 'practice'}?stage={stage}&units={unit}&lessons={lessonKey}`, groups: [...groups.values()] }
}

/** Shared metadata for both first-use presets and the course picker. */
export async function buildCatalog(kind: CatalogKind, section: string): Promise<Catalog> {
  const catalog = await buildRawCatalog(kind, section)
  const contentType = kind === 'math' ? 'math-question' : kind === 'englishReading' ? 'english-reading'
    : kind === 'englishSentences' ? 'english-sentence' : kind === 'chineseCourse' ? 'chinese-course' : undefined
  return { ...catalog, groups: catalog.groups.map((group) => ({ ...group, rows: group.rows.map((row) => ({
    ...row,
    selectionPath: practiceSelectionPath(row),
    values: contentType ? { ...row.values, contentType } : row.values,
  })) })) }
}

/** Only pass newly selected catalog rows: saved rows must retain user edits and ordering. */
export async function generateCatalogRows(catalog: Catalog, selected = catalog.groups.flatMap((group) => group.rows)): Promise<PracticeEntryRow[]> {
  const order = new Map(catalog.groups.flatMap((group) => group.rows).map((row, index) => [row.id, index]))
  const rows = [...selected].sort((a, b) => {
    if (catalog.subject === 'english' && a.values.stage && b.values.stage) {
      for (const key of ['stage', 'unit', 'lesson', 'sentenceId']) {
        const difference = (a.values[key] ?? '').localeCompare(b.values[key] ?? '', 'en', { numeric: true })
        if (difference) return difference
      }
    }
    return (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  })
  return rows.length ? attachResources(rows) : []
}

export async function loadCatalog(kind: CatalogKind, section: string): Promise<Catalog> {
  const catalog = await buildCatalog(kind, section)
  const rows = await generateCatalogRows(catalog)
  const byId = new Map(rows.map((row) => [row.id, row]))
  return { ...catalog, groups: catalog.groups.map((group) => ({ ...group, rows: group.rows.map((row) => byId.get(row.id)!) })) }
}
