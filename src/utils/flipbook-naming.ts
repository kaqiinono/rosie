/** 与 Storage 页图一致：0001.webp → 本地建议 0001.png */
export const FLIPBOOK_CLOUD_PAGE_BASENAME_RE = /^(\d{4})\.(png|jpe?g|webp)$/i

export const FLIPBOOK_FLAT_IMAGE_GROUP = '__flat__'

export function flipbookBasename(filename: string): string {
  return filename.split(/[/\\]/).pop() ?? filename
}

/** 音频 / PDF / sync 的文件名主干（不含扩展名） */
export function flipbookFileStem(filename: string): string {
  const base = flipbookBasename(filename)
  const noExt = base.replace(/\.(pdf|mp3|m4a|wav|aac|ogg|json|sync\.json)$/i, '')
  return noExt.replace(/\.sync$/i, '').trim().toLowerCase()
}

export function titleLabelFromStem(stem: string): string {
  return stem.replace(/[-_]+/g, ' ').trim() || stem
}

/** 书名：优先手动 → 音频文件名 → sync 文件名 */
export function flipbookTitleFromFiles(opts: {
  manual?: string
  audio?: File | null
  sync?: File | null
}): string {
  const manual = opts.manual?.trim()
  if (manual) return manual
  if (opts.audio) return titleLabelFromStem(flipbookFileStem(opts.audio.name))
  if (opts.sync) return titleLabelFromStem(flipbookFileStem(opts.sync.name))
  return ''
}

export function flipbookPageImageGroupKey(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath?.trim()
  if (rel && rel.includes('/')) {
    return rel.split('/').slice(0, -1).join('/').toLowerCase()
  }
  return FLIPBOOK_FLAT_IMAGE_GROUP
}

/** 子文件夹名或分组路径最后一段，用于与音频/sync 主干配对 */
export function flipbookStemFromImageGroupKey(groupKey: string): string {
  if (groupKey === FLIPBOOK_FLAT_IMAGE_GROUP) return ''
  const parts = groupKey.split('/')
  return (parts[parts.length - 1] ?? groupKey).trim().toLowerCase()
}

export function formatCloudPageBasename(page: number, ext = 'png'): string {
  return `${String(page).padStart(4, '0')}.${ext}`
}
