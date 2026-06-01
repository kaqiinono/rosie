import type {
  FlipbookPageCue,
  FlipbookPageKind,
  FlipbookSyncManifest,
  FlipbookSyncStats,
} from '@/utils/flipbook-types'

const MIN_SEGMENT_SEC = 0.5
const KIND_PRIORITY: Record<FlipbookPageKind | 'unknown', number> = {
  content: 3,
  cover: 2,
  skip: 1,
  unknown: 0,
}

export type FlipbookPlaybackWindow = {
  start: number
  end: number
  /** 是否应播放该页口播（skip / noAudio 为 false） */
  playable: boolean
}

function parsePageKind(raw: unknown): FlipbookPageKind | undefined {
  if (raw === 'cover' || raw === 'content' || raw === 'skip') return raw
  return undefined
}

function parseRawCue(item: unknown): FlipbookPageCue | null {
  if (!item || typeof item !== 'object') return null
  const p = item as Record<string, unknown>
  const page = Number(p.page)
  const start = Number(p.start)
  const end = Number(p.end)
  if (!Number.isFinite(page) || page < 1) return null
  if (!Number.isFinite(start) || start < 0) return null
  if (!Number.isFinite(end)) return null

  const cue: FlipbookPageCue = {
    page: Math.floor(page),
    start,
    end,
    pageKind: parsePageKind(p._pageKind),
    fallback: p._fallback === true,
    intro: p._intro === true,
    tailAudio: p._tailAudio === true,
    noAudio: p._noAudio === true,
  }
  if (typeof p._score === 'number' && Number.isFinite(p._score)) {
    cue.score = p._score
  }
  return cue
}

function parseStats(raw: unknown): FlipbookSyncStats | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const s = raw as Record<string, unknown>
  const stats: FlipbookSyncStats = {}
  if (typeof s.fallbackPages === 'number') stats.fallbackPages = s.fallbackPages
  if (typeof s.alignedPages === 'number') stats.alignedPages = s.alignedPages
  if (typeof s.coverPages === 'number') stats.coverPages = s.coverPages
  if (typeof s.contentPages === 'number') stats.contentPages = s.contentPages
  if (typeof s.skipPages === 'number') stats.skipPages = s.skipPages
  if (typeof s.narrationEndSec === 'number' && Number.isFinite(s.narrationEndSec)) {
    stats.narrationEndSec = s.narrationEndSec
  }
  return stats
}

/** 修复 end<=start、尾部 skip 零时长等，与 generate_sync.py 输出兼容 */
export function normalizeSyncPages(
  pages: FlipbookPageCue[],
  opts?: { audioDurationSec?: number; narrationEndSec?: number },
): FlipbookPageCue[] {
  if (pages.length === 0) return []
  const sorted = [...pages].sort((a, b) => a.page - b.page)
  const narrEnd =
    opts?.narrationEndSec ??
    opts?.audioDurationSec ??
    sorted[sorted.length - 1]?.end ??
    0
  const fileEnd = opts?.audioDurationSec ?? narrEnd

  return sorted.map((cue, i) => {
    const { start } = cue
    let end = cue.end
    const next = sorted[i + 1]

    if (end <= start) {
      if (next) {
        end = next.start
      } else if (cue.tailAudio) {
        end = Math.max(narrEnd, start + MIN_SEGMENT_SEC)
      } else {
        end = Math.min(fileEnd, start + MIN_SEGMENT_SEC)
      }
    }
    if (end <= start) {
      end = start + MIN_SEGMENT_SEC
    }

    if (
      (cue.pageKind === 'skip' || cue.noAudio) &&
      start >= narrEnd - 0.05 &&
      end <= narrEnd + 0.05
    ) {
      end = start + MIN_SEGMENT_SEC
    }

    if (cue.tailAudio && opts?.narrationEndSec != null) {
      end = Math.max(end, opts.narrationEndSec)
    }

    return { ...cue, start, end: Math.min(end, fileEnd) }
  })
}

export function parseSyncManifest(raw: unknown): FlipbookSyncManifest | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.version !== 1) return null
  if (!Array.isArray(o.pages)) return null

  const rawPages: FlipbookPageCue[] = []
  for (const item of o.pages) {
    const cue = parseRawCue(item)
    if (!cue) return null
    rawPages.push(cue)
  }
  if (rawPages.length === 0) return null

  const source =
    o._source && typeof o._source === 'object'
      ? (o._source as Record<string, unknown>)
      : null
  const audioDurationSec =
    typeof source?.audioDurationSec === 'number' ? source.audioDurationSec : undefined
  const stats = parseStats(o._stats)
  const narrationEndSec = stats?.narrationEndSec

  const pages = normalizeSyncPages(rawPages, { audioDurationSec, narrationEndSec })
  const mode = o.mode === 'highlight_only' ? 'highlight_only' : 'auto_turn'

  return {
    version: 1,
    mode,
    pages,
    narrationEndSec,
    audioDurationSec,
    stats,
    generatedBy:
      typeof o._generatedBy === 'string' ? o._generatedBy : undefined,
  }
}

export function getNarrationEndSec(manifest: FlipbookSyncManifest): number | undefined {
  return (
    manifest.narrationEndSec ??
    manifest.stats?.narrationEndSec ??
    manifest.audioDurationSec
  )
}

/** 阅读器用的口播区间（会截断 _tailAudio 的长 end） */
export function getPlaybackWindow(
  cue: FlipbookPageCue,
  manifest: FlipbookSyncManifest,
): FlipbookPlaybackWindow {
  const narrEnd = getNarrationEndSec(manifest) ?? cue.end

  if (cue.noAudio) {
    return { start: cue.start, end: cue.end, playable: false }
  }

  if (
    cue.pageKind === 'skip' &&
    cue.start >= narrEnd - 0.05 &&
    cue.end <= cue.start + MIN_SEGMENT_SEC + 0.05
  ) {
    return { start: cue.start, end: cue.end, playable: false }
  }

  let end = cue.end
  if (cue.tailAudio && manifest.narrationEndSec != null) {
    end = manifest.narrationEndSec
  } else if (cue.pageKind === 'content' && end > narrEnd + 1) {
    end = narrEnd
  }

  if (end <= cue.start) {
    end = cue.start + MIN_SEGMENT_SEC
  }

  const playable = end > cue.start + 0.05 && cue.start < narrEnd + 0.5
  return { start: cue.start, end, playable }
}

export function pageForAudioTime(manifest: FlipbookSyncManifest, timeSec: number): number {
  const t = Math.max(0, timeSec)

  let best: { page: number; priority: number; start: number } | null = null

  for (const cue of manifest.pages) {
    if (t < cue.start || t >= cue.end) continue
    const kind = cue.pageKind ?? 'content'
    const priority = KIND_PRIORITY[kind] ?? 0
    if (
      !best ||
      priority > best.priority ||
      (priority === best.priority && cue.start >= best.start)
    ) {
      best = { page: cue.page, priority, start: cue.start }
    }
  }

  if (best) return best.page

  let lastStarted = manifest.pages[0]?.page ?? 1
  for (const cue of manifest.pages) {
    if (t >= cue.start) lastStarted = cue.page
  }
  return lastStarted
}

export function audioStartForPage(manifest: FlipbookSyncManifest, page: number): number {
  const cue = manifest.pages.find((c) => c.page === page)
  return cue?.start ?? manifest.pages[0]?.start ?? 0
}

export function findNextPlayablePage(
  manifest: FlipbookSyncManifest,
  afterPage: number,
): number | null {
  for (const cue of manifest.pages) {
    if (cue.page <= afterPage) continue
    if (getPlaybackWindow(cue, manifest).playable) return cue.page
  }
  return null
}

export function shouldSyncFlipFromAudio(
  manifest: FlipbookSyncManifest,
  targetPage: number,
): boolean {
  if (manifest.mode !== 'auto_turn') return false
  const cue = manifest.pages.find((c) => c.page === targetPage)
  if (!cue) return true
  return getPlaybackWindow(cue, manifest).playable || cue.pageKind !== 'skip'
}

export function validateManifestAgainstPageCount(
  manifest: FlipbookSyncManifest,
  pageCount: number,
): string | null {
  for (const cue of manifest.pages) {
    if (cue.page > pageCount) {
      return `同步配置第 ${cue.page} 页超出总页数（${pageCount}）`
    }
  }
  return null
}
