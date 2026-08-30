import manifest from '../../data/link-manifest.json'
import type { AgentAction, KnowledgeSearchHit, LinkManifestEntry } from '../../types'

const entries = manifest as LinkManifestEntry[]

const ALLOWED_PREFIXES = ['/math/', '/english/', '/chinese/', '/ai/']

export function getLinkManifest(): LinkManifestEntry[] {
  return entries
}

export function findManifestBySourceRef(sourceRef: string): LinkManifestEntry | undefined {
  return entries.find((e) => e.sourceRef === sourceRef)
}

export function findManifestByProblemId(problemId: string): LinkManifestEntry | undefined {
  return entries.find((e) => e.problemId === problemId)
}

export function findManifestByHref(href: string): LinkManifestEntry | undefined {
  const normalized = href.length > 1 ? href.replace(/\/$/, '') : href
  const grammarMatch = normalized.match(
    /^\/english\/grammar\/(essential|intermediate|advanced)\/(\d+)$/,
  )
  if (grammarMatch) {
    return findManifestBySourceRef(`grammar_units:${grammarMatch[1]}:${grammarMatch[2]}`)
  }
  return entries.find((entry) => {
    const entryHref = entry.href.length > 1 ? entry.href.replace(/\/$/, '') : entry.href
    return entryHref === normalized
  })
}

export function isAllowedHref(href: string): boolean {
  return ALLOWED_PREFIXES.some((prefix) => href.startsWith(prefix))
}

export function resolveActionsForSourceRefs(sourceRefs: string[]): AgentAction[] {
  const actions: AgentAction[] = []
  const seen = new Set<string>()

  for (const sourceRef of sourceRefs) {
    const entry = findManifestBySourceRef(sourceRef)
    if (!entry || !isAllowedHref(entry.href)) continue

    if (entry.problemId && !seen.has(`problem:${entry.problemId}`)) {
      seen.add(`problem:${entry.problemId}`)
      actions.push({
        type: 'open_problem',
        problemId: entry.problemId,
        label: entry.title ? `去看：${entry.title} 🎯` : '去看这道题 🎯',
        title: entry.title,
      })
      continue
    }

    if (entry.href.includes('/reading/') && !seen.has(`reading:${entry.href}`)) {
      seen.add(`reading:${entry.href}`)
      actions.push({
        type: 'open_reading',
        href: entry.href,
        label: '读全文 📖',
      })
      continue
    }

    if (entry.wordKey && !seen.has(`word:${entry.href}`)) {
      seen.add(`word:${entry.href}`)
      actions.push({
        type: 'navigate',
        href: entry.href,
        label: '去练这个单词 ✨',
      })
      continue
    }

    if (!seen.has(`nav:${entry.href}`)) {
      seen.add(`nav:${entry.href}`)
      actions.push({
        type: 'navigate',
        href: entry.href,
        label: entry.title ? `打开：${entry.title}` : '打开内容',
      })
    }
  }

  return actions
}

export function resolveActionsForHits(hits: KnowledgeSearchHit[]): AgentAction[] {
  const actions = resolveActionsForSourceRefs(
    hits.flatMap((hit) =>
      typeof hit.metadata.sourceRef === 'string' ? [hit.metadata.sourceRef] : [],
    ),
  )
  const seenHrefs = new Set(
    actions.flatMap((action) => (action.type === 'navigate' ? [action.href] : [])),
  )

  for (const hit of hits) {
    const href = typeof hit.metadata.href === 'string' ? hit.metadata.href : null
    if (!href || !isAllowedHref(href) || seenHrefs.has(href)) continue
    seenHrefs.add(href)
    const title = typeof hit.metadata.title === 'string' ? hit.metadata.title : '学习内容'
    actions.push({ type: 'navigate', href, label: `打开：${title}` })
  }
  return actions
}

export function resolveProblemAction(problemId: string, title?: string): AgentAction {
  return {
    type: 'open_problem',
    problemId,
    label: title ? `去看：${title} 🎯` : '去看这道题 🎯',
    title,
  }
}
