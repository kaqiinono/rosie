import type { PracticeEntry, PracticeEntryRow } from '@rosie/tasks'
import { refreshEnglishPlanRows } from './englishPlans'
import { attachResources } from './resources'
import { loadScopeCatalog, sameCatalogItem, scopeNodes, type LearningMode, type ScopeNode } from './scopeCatalog'

/** Refresh one saved list: refill the courses it already contains, then reread automatic resources. */
export async function refreshSavedRows(entry: Pick<PracticeEntry, 'subject' | 'rows'>): Promise<PracticeEntryRow[]> {
  const saved = entry.rows
  if (!saved.length) return saved
  if (saved.some((row) => row.values.contentType === 'english-plan')) return refreshEnglishPlanRows(saved)
  const refreshed = await attachResources(saved, true)
  if (entry.subject === 'life') return refreshed
  const mode: LearningMode = saved.some((row) => row.values.sentenceId) ? 'listening' : 'reading'
  const catalog = await loadScopeCatalog(entry.subject, mode)
  const catalogRows = catalog.groups.flatMap((group) => group.rows)
  const matchedIds = new Set(catalogRows.filter((row) => saved.some((item) => sameCatalogItem(item, row))).map((row) => row.id))
  const selectedIds = new Set<string>()
  const collect = (nodes: ScopeNode[]) => {
    for (const node of nodes) {
      if (!node.children.length) {
        if (node.rowIds.some((id) => matchedIds.has(id))) for (const id of node.rowIds) selectedIds.add(id)
      } else collect(node.children)
    }
  }
  collect(scopeNodes(catalogRows))
  const covered = new Set<string>()
  for (const row of catalogRows) if (saved.some((item) => sameCatalogItem(item, row))) covered.add(row.id)
  const additions = catalogRows.filter((row) => selectedIds.has(row.id) && !covered.has(row.id))
  let resolved: PracticeEntryRow[] = []
  if (additions.length) {
    try { resolved = await attachResources(additions) }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : '资源读取失败，请重试'
      resolved = additions.map((row) => ({ ...row, resourceStatus: 'error', resourceError: message }))
    }
  }
  const catalogIndex = new Map(catalogRows.map((row, index) => [row.id, index]))
  const indexOf = (row: PracticeEntryRow) => {
    const match = catalogRows.find((item) => sameCatalogItem(item, row))
    return match ? catalogIndex.get(match.id) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER
  }
  const rows = [...refreshed]
  for (const row of resolved.sort((a, b) => (catalogIndex.get(a.id) ?? 0) - (catalogIndex.get(b.id) ?? 0))) {
    const index = catalogIndex.get(row.id) ?? Number.MAX_SAFE_INTEGER
    const insertAt = rows.findIndex((item) => indexOf(item) > index)
    if (insertAt === -1) rows.push(row)
    else rows.splice(insertAt, 0, row)
  }
  return rows
}
