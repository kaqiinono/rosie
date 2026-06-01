import {
  FLIPBOOK_FLAT_IMAGE_GROUP,
  flipbookFileStem,
  flipbookTitleFromFiles,
  titleLabelFromStem,
} from '@/utils/flipbook-naming'
import {
  flipbookImageGroupStem,
  groupFlipbookPageImagesByFolder,
  sortFlipbookPageImageFiles,
} from '@/utils/flipbook-page-images'

export { flipbookFileStem, flipbookTitleFromFiles, titleLabelFromStem } from '@/utils/flipbook-naming'

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

function resolveTitle(draft: PairDraft, manualTitle?: string): string {
  return (
    flipbookTitleFromFiles({
      manual: manualTitle,
      audio: draft.audio,
      sync: draft.sync,
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

/**
 * 配对规则：
 * - 页图须命名为 0001.png（与云端 0001.webp 一致）
 * - 多本书时页图放在子文件夹，文件夹名与音频/sync 主干一致
 * - 书名优先取自音频，其次 sync；预览列表可改
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

  for (const pdf of pdfs) {
    upsertDraft(drafts, flipbookFileStem(pdf.name)).pdf = pdf
  }
  for (const f of audios) {
    upsertDraft(drafts, flipbookFileStem(f.name)).audio = f
  }
  for (const f of syncs) {
    upsertDraft(drafts, flipbookFileStem(f.name)).sync = f
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
      title: resolveTitle(d),
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
