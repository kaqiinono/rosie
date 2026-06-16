/** 与 Storage 页图一致：0001.webp → 本地建议 0001.png */
export const FLIPBOOK_CLOUD_PAGE_BASENAME_RE = /^(\d{4})\.(png|jpe?g|webp)$/i

export const FLIPBOOK_FLAT_IMAGE_GROUP = '__flat__'

export function flipbookBasename(filename: string): string {
  return filename.split(/[/\\]/).pop() ?? filename
}

export const FLIPBOOK_PAGES_SUBDIR = 'pages'

export function flipbookRelativePathParts(file: File): string[] {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath?.trim()
  if (!rel) return []
  return rel.replace(/\\/g, '/').split('/').filter(Boolean)
}

/** 批量上传提示用：优先显示相对路径 */
export function flipbookFileDisplayPath(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath?.trim()
  return rel || file.name
}

/** 规范化词库/目录名用于配对（小写、统一空格与撇号） */
export function flipbookNormalizeBookKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 书名前的数字编号，如 `01 winnie` → `01` */
export function flipbookLeadingIndex(name: string): string | null {
  const m = name.trim().match(/^(\d{1,3})\b/)
  return m ? m[1].padStart(2, '0') : null
}

/**
 * 判断音频/PDF 等根目录文件是否属于某本书文件夹。
 * 优先按开头编号（01、02…）匹配，否则按规范化书名。
 */
export function flipbookMatchBookFolder(fileStem: string, bookFolder: string): boolean {
  const a = flipbookLeadingIndex(fileStem)
  const b = flipbookLeadingIndex(bookFolder)
  if (a && b) return a === b
  return flipbookNormalizeBookKey(fileStem) === flipbookNormalizeBookKey(bookFolder)
}

export function flipbookBookFolderKey(folderName: string): string {
  return flipbookNormalizeBookKey(folderName)
}

/**
 * 从 webkitRelativePath 提取书目录名。
 * 支持 `{…}/{book}/pages/0001.webp`、`{…}/{book}/sync.json`、`{…}/{book}/narration.mp3`（中间可有任意层前缀）。
 */
export function flipbookBookFolderFromFile(file: File): string | null {
  const parts = flipbookRelativePathParts(file)
  if (parts.length < 2) return null
  const parent = parts[parts.length - 2]
  if (parent.toLowerCase() === FLIPBOOK_PAGES_SUBDIR && parts.length >= 3) {
    return parts[parts.length - 3]
  }
  return parts[parts.length - 2]
}

export function isGenericSyncFilename(filename: string): boolean {
  const stem = flipbookFileStem(filename)
  return stem === 'sync'
}

/** generate_sync 等工具产物，不作为 sync 配对候选 */
const FLIPBOOK_NON_SYNC_JSON = new Set([
  'ocr.json',
  'text_compare.json',
])

/**
 * sync 候选优先级（越小越优先）：sync.json → *.sync.json → 其它 .json。
 * 非候选（如 ocr.json）返回 null。
 */
export function flipbookSyncCandidatePriority(filename: string): number | null {
  const base = flipbookBasename(filename).toLowerCase()
  if (FLIPBOOK_NON_SYNC_JSON.has(base)) return null
  if (base === 'sync.json') return 0
  if (base.endsWith('.sync.json')) return 1
  if (base.endsWith('.json')) return 2
  return null
}

export function isFlipbookSyncCandidate(filename: string): boolean {
  return flipbookSyncCandidatePriority(filename) !== null
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
  const parts = flipbookRelativePathParts(file)
  if (parts.length >= 3 && parts[parts.length - 2].toLowerCase() === FLIPBOOK_PAGES_SUBDIR) {
    return flipbookBookFolderKey(parts[parts.length - 3])
  }
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

/** 在已知书目录列表中为根目录文件（如 `01 Winnie The Witch.mp3`）查找配对目录 */
export function flipbookMatchFileStemToBookFolder(
  fileStem: string,
  bookFolderKeys: string[],
): string | null {
  for (const key of bookFolderKeys) {
    if (flipbookMatchBookFolder(fileStem, key)) return key
  }
  return null
}

export function formatCloudPageBasename(page: number, ext = 'png'): string {
  return `${String(page).padStart(4, '0')}.${ext}`
}
