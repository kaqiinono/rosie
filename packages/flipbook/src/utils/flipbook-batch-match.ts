import {
  FLIPBOOK_FLAT_IMAGE_GROUP,
  FLIPBOOK_PAGES_SUBDIR,
  flipbookBookFolderFromFile,
  flipbookBookFolderKey,
  flipbookFileStem,
  flipbookMatchFileStemToBookFolder,
  flipbookRelativePathParts,
  flipbookSyncCandidatePriority,
  flipbookTitleFromFiles,
  isFlipbookSyncCandidate,
  isGenericSyncFilename,
  titleLabelFromStem,
} from './flipbook-naming'
import {
  flipbookImageGroupStem,
  groupFlipbookPageImagesByFolder,
  sortFlipbookPageImageFiles,
} from './flipbook-page-images'

export { flipbookFileStem, flipbookTitleFromFiles, titleLabelFromStem } from './flipbook-naming'

export type FlipbookBatchPair = {
  stem: string
  title: string
  source: 'pdf' | 'images'
  pdf: File | null
  pageImages: File[]
  audio: File | null
  sync: File | null
}

export type FlipbookBatchMatchResult = {
  pairs: FlipbookBatchPair[]
  unmatchedAudios: File[]
  unmatchedSyncs: File[]
  conflicts: string[]
  /** 扁平页图但无法唯一对应到一本（需文件夹或多本音频） */
  flatImageErrors: string[]
}

type PairDraft = {
  stem: string
  pdf: File | null
  pageImages: File[]
  audio: File | null
  sync: File | null
}

function resolveTitle(draft: PairDraft, manualTitle?: string, preferFolderTitle = false): string {
  const manual = manualTitle?.trim()
  if (manual) return manual
  if (preferFolderTitle) return titleLabelFromStem(draft.stem)
  return (
    flipbookTitleFromFiles({
      audio: draft.audio,
      sync:
        draft.sync && !isGenericSyncFilename(draft.sync.name) ? draft.sync : null,
    }) || titleLabelFromStem(draft.stem)
  )
}

function upsertDraft(map: Map<string, PairDraft>, stem: string): PairDraft {
  const key = stem.toLowerCase()
  let d = map.get(key)
  if (!d) {
    d = { stem: key, pdf: null, pageImages: [], audio: null, sync: null }
    map.set(key, d)
  }
  return d
}

function assignBookDirMedia(
  map: Map<string, PairDraft>,
  file: File,
  kind: 'pdf' | 'audio',
): boolean {
  const folder = flipbookBookFolderFromFile(file)
  if (!folder) return false
  let key = flipbookBookFolderKey(folder)
  if (!map.has(key) && kind === 'audio') {
    const stem = flipbookFileStem(file.name)
    const matched = flipbookMatchFileStemToBookFolder(stem, [...map.keys()])
    if (matched) key = matched
  }
  const d = upsertDraft(map, key)
  if (kind === 'pdf') d.pdf = file
  else d.audio = file
  return true
}

type SyncPick = { file: File | null; conflict: string | null }

/** 同书目录内：sync.json > *.sync.json > 其它 .json；同档多文件 → conflict */
function pickSyncFile(candidates: File[]): SyncPick {
  const eligible = candidates.filter((f) => isFlipbookSyncCandidate(f.name))
  if (eligible.length === 0) return { file: null, conflict: null }
  const best = Math.min(...eligible.map((f) => flipbookSyncCandidatePriority(f.name)!))
  const tier = eligible.filter((f) => flipbookSyncCandidatePriority(f.name) === best)
  if (tier.length > 1) {
    return {
      file: null,
      conflict: `多个 sync 文件无法取舍：${tier.map((f) => f.name).join('、')}`,
    }
  }
  return { file: tier[0] ?? null, conflict: null }
}

function resolveSyncDraftKey(
  file: File,
  bookDirLayout: boolean,
  drafts: Map<string, PairDraft>,
): string | null {
  const folder = flipbookBookFolderFromFile(file)
  if (folder) {
    const key = flipbookBookFolderKey(folder)
    if (drafts.has(key) || !bookDirLayout) return key
  }
  if (bookDirLayout) {
    const stem = flipbookFileStem(file.name)
    return flipbookMatchFileStemToBookFolder(stem, [...drafts.keys()])
  }
  const stem = flipbookFileStem(file.name)
  const matched = flipbookMatchFileStemToBookFolder(stem, [...drafts.keys()])
  return matched ?? stem
}

function assignSyncFiles(
  map: Map<string, PairDraft>,
  syncs: File[],
  bookDirLayout: boolean,
  conflicts: string[],
): void {
  const byKey = new Map<string, File[]>()
  for (const f of syncs) {
    if (!isFlipbookSyncCandidate(f.name)) continue
    const key = resolveSyncDraftKey(f, bookDirLayout, map)
    if (!key) continue
    const list = byKey.get(key) ?? []
    list.push(f)
    byKey.set(key, list)
  }
  for (const [key, files] of byKey) {
    const { file, conflict } = pickSyncFile(files)
    if (conflict) {
      conflicts.push(`${key}: ${conflict}`)
      continue
    }
    if (file) upsertDraft(map, key).sync = file
  }
}

function assignLegacyMediaToDrafts(
  map: Map<string, PairDraft>,
  file: File,
  kind: 'pdf' | 'audio',
): void {
  const folder = flipbookBookFolderFromFile(file)
  if (folder) {
    assignBookDirMedia(map, file, kind)
    return
  }
  const stem = flipbookFileStem(file.name)
  const bookKeys = [...map.keys()]
  const matched = flipbookMatchFileStemToBookFolder(stem, bookKeys)
  const draftKey = matched ?? stem
  const d = upsertDraft(map, draftKey)
  if (kind === 'pdf') d.pdf = file
  else d.audio = file
}

/** 是否存在 `{书目录}/pages/` 布局（mp3/json 仅按目录配对，不要求文件名与目录一致） */
function usesBookDirLayout(
  pageImages: File[],
  audios: File[],
  syncs: File[],
  pdfs: File[],
): boolean {
  const all = [...pageImages, ...audios, ...syncs, ...pdfs]
  for (const f of all) {
    const parts = flipbookRelativePathParts(f)
    if (parts.length >= 3 && parts[parts.length - 2].toLowerCase() === FLIPBOOK_PAGES_SUBDIR) {
      return true
    }
  }
  return false
}

/**
 * 配对规则：
 * - **目录模式**：页图在 `{目录}/pages/`；mp3 任意文件名；sync 优先 sync.json → *.sync.json，同档多文件报冲突。
 * - **扁平模式**：页图须命名为 0001.png；多本书时页图放在子文件夹，文件夹名与音频/sync 主干一致。
 */
export function matchFlipbookBatchFiles(
  pdfs: File[],
  pageImages: File[],
  audios: File[],
  syncs: File[],
): FlipbookBatchMatchResult {
  const drafts = new Map<string, PairDraft>()
  const conflicts: string[] = []
  const flatImageErrors: string[] = []
  const bookDirLayout = usesBookDirLayout(pageImages, audios, syncs, pdfs)

  for (const pdf of pdfs) {
    if (bookDirLayout) assignBookDirMedia(drafts, pdf, 'pdf')
    else assignLegacyMediaToDrafts(drafts, pdf, 'pdf')
  }

  const imageGroups = groupFlipbookPageImagesByFolder(pageImages)
  const flatImages = imageGroups.get(FLIPBOOK_FLAT_IMAGE_GROUP) ?? []
  imageGroups.delete(FLIPBOOK_FLAT_IMAGE_GROUP)

  for (const [groupKey, imgs] of imageGroups) {
    const stem = flipbookImageGroupStem(groupKey)
    if (!stem) continue
    const d = upsertDraft(drafts, stem)
    if (d.pageImages.length > 0) {
      conflicts.push(stem)
      continue
    }
    if (d.pdf) {
      conflicts.push(stem)
      continue
    }
    d.pageImages = imgs
  }

  assignSyncFiles(drafts, syncs, bookDirLayout, conflicts)
  for (const f of audios) {
    if (bookDirLayout) assignBookDirMedia(drafts, f, 'audio')
    else assignLegacyMediaToDrafts(drafts, f, 'audio')
  }

  if (flatImages.length > 0) {
    const sortedFlat = sortFlipbookPageImageFiles(flatImages)
    const mediaStems = [
      ...new Set([
        ...audios.map((f) => flipbookFileStem(f.name)),
        ...syncs.map((f) => flipbookFileStem(f.name)),
      ]),
    ]

    if (mediaStems.length === 1) {
      const stem = mediaStems[0]
      const d = upsertDraft(drafts, stem)
      if (d.pageImages.length > 0) {
        conflicts.push(stem)
      } else if (d.pdf) {
        conflicts.push(stem)
      } else {
        d.pageImages = sortedFlat
      }
    } else if (mediaStems.length === 0) {
      flatImageErrors.push(
        '根目录页图（0001.png 等）须同时提供音频或 sync 文件以确定书名；多本书请放入子文件夹',
      )
    } else {
      flatImageErrors.push(
        '多本书时根目录页图无法区分，请将页图放入子文件夹（文件夹名与音频文件名一致，如 第43讲-课前测/0001.png）',
      )
    }
  }

  const usedAudio = new Set<File>()
  const usedSync = new Set<File>()
  const pairs: FlipbookBatchPair[] = []

  for (const d of drafts.values()) {
    if (d.pdf && d.pageImages.length > 0) {
      if (!conflicts.includes(d.stem)) conflicts.push(d.stem)
      continue
    }
    if (!d.pdf && d.pageImages.length === 0) continue

    if (d.audio) usedAudio.add(d.audio)
    if (d.sync) usedSync.add(d.sync)

    const source = d.pdf ? 'pdf' : 'images'
    pairs.push({
      stem: d.stem,
      title: resolveTitle(d, undefined, bookDirLayout),
      source,
      pdf: d.pdf,
      pageImages: d.pageImages,
      audio: d.audio,
      sync: d.sync,
    })
  }

  pairs.sort((a, b) => a.stem.localeCompare(b.stem, undefined, { numeric: true }))

  return {
    pairs,
    unmatchedAudios: audios.filter((f) => !usedAudio.has(f)),
    unmatchedSyncs: syncs.filter((f) => !usedSync.has(f)),
    conflicts,
    flatImageErrors,
  }
}
