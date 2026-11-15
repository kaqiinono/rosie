import { practiceSelectionPath, type PracticeEntryRow } from '@rosie/tasks'
import { LESSON_SOURCE_BTNS } from '@rosie/math-kit/utils/lesson-source-btns'
import { buildCatalog, type Catalog } from './catalog'

export type LearningMode = 'reading' | 'listening'

/** Scope construction is metadata-only. Resolve media only for the selected range. */
export async function loadScopeCatalog(subject: 'math' | 'english' | 'chinese', mode: LearningMode): Promise<Catalog> {
  if (subject === 'math') {
    const catalogs = await Promise.all(['lesson', 'homework', 'pretest', 'workbook', 'supplement'].map(section => buildCatalog('math', section)))
    const groups = catalogs.flatMap(catalog => catalog.groups).sort((a, b) => {
      const x = a.rows[0].values; const y = b.rows[0].values
      return Number(x.grade) - Number(y.grade) || Number(x.seq) - Number(y.seq) || (LESSON_SOURCE_BTNS[`${x.grade}-${x.seq}`]?.findIndex(item => item.key === x.section) ?? 0) - (LESSON_SOURCE_BTNS[`${y.grade}-${y.seq}`]?.findIndex(item => item.key === y.section) ?? 0)
    })
    return { ...catalogs[0], groups: groups.map(group => ({ ...group, id: `${group.id}:${group.rows[0].values.section}` })) }
  }
  return buildCatalog(subject === 'chinese' ? 'chineseCourse' : mode === 'listening' ? 'englishSentences' : 'englishReading', '')
}

/** Match a saved row to the current catalog row even when only the business key is shared. */
export function sameCatalogItem(a: PracticeEntryRow, b: PracticeEntryRow): boolean {
  if (a.id === b.id) return true
  if (a.values.problemId || b.values.problemId) return a.values.problemId === b.values.problemId && a.values.section === b.values.section
  if (a.values.key || b.values.key) return a.values.key === b.values.key && (a.values.sentenceId ?? '') === (b.values.sentenceId ?? '')
  return a.values.contentType === 'chinese-course' && b.values.contentType === 'chinese-course'
    && a.values.bookSlug === b.values.bookSlug && a.values.lessonKey === b.values.lessonKey
}

export interface ScopeNode { id: string; label: string; level: string; rowIds: string[]; children: ScopeNode[] }
export function scopeNodes(rows: PracticeEntryRow[]): ScopeNode[] {
  const roots: ScopeNode[] = []
  for (const row of rows) {
    const path = [...practiceSelectionPath(row)]
    // Reading rows need a lesson leaf; sentence rows already contain one.
    if (row.values.key && !path.some(node => node.id === row.values.key)) path.push({ id: row.values.key, level: '课程', label: row.label })
    let siblings = roots
    for (const part of path) {
      let node = siblings.find(node => node.id === part.id)
      if (!node) { node = { ...part, rowIds: [], children: [] }; siblings.push(node) }
      node.rowIds.push(row.id)
      siblings = node.children
    }
  }
  return roots
}
