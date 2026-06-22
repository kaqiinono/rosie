import { FLIPBOOK_MAX_PAGES } from './flipbook-types'
import {
  FLIPBOOK_CLOUD_PAGE_BASENAME_RE,
  FLIPBOOK_FLAT_IMAGE_GROUP,
  flipbookBasename,
  flipbookPageImageGroupKey,
  flipbookStemFromImageGroupKey,
} from './flipbook-naming'

export { FLIPBOOK_FLAT_IMAGE_GROUP } from './flipbook-naming'

const PAGE_IMAGE_EXT = /\.(png|jpe?g|webp)$/i

export function isFlipbookRasterImageFile(filename: string): boolean {
  return PAGE_IMAGE_EXT.test(flipbookBasename(filename))
}

/** 解析与云端一致的页图文件名，如 0001.png → 页码 1 */
export function parseCloudPageImageFilename(filename: string): number | null {
  const m = flipbookBasename(filename).match(FLIPBOOK_CLOUD_PAGE_BASENAME_RE)
  if (!m) return null
  const page = parseInt(m[1], 10)
  return Number.isFinite(page) && page >= 1 ? page : null
}

export function isValidCloudPageImageFilename(filename: string): boolean {
  return parseCloudPageImageFilename(filename) !== null
}

/** 按云端页码 0001、0002… 排序 */
export function sortFlipbookPageImageFiles(files: File[]): File[] {
  const entries = files.map((file) => ({
    file,
    page: parseCloudPageImageFilename(file.name),
  }))
  const valid = entries.filter((e) => e.page !== null)
  if (valid.length !== files.length) {
    return [...files].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
    )
  }
  return valid.sort((a, b) => a.page! - b.page!).map((e) => e.file)
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = url
  })
}

/** 已是 WebP 则直接上传，PNG/JPG 才经 Canvas 转为 WebP */
export async function imageFileToWebpBlob(file: File, quality = 0.85): Promise<Blob> {
  if (flipbookBasename(file.name).toLowerCase().endsWith('.webp')) {
    return file
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D 不可用')
    ctx.drawImage(img, 0, 0)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('无法转为 WebP'))),
        'image/webp',
        quality,
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export type FlipbookPageImageConvertProgress = {
  onConverted?: (done: number, total: number) => void
}

export async function flipbookPageImageFilesToWebpBlobs(
  files: File[],
  options?: FlipbookPageImageConvertProgress,
): Promise<Blob[]> {
  const sorted = sortFlipbookPageImageFiles(files)
  if (sorted.length === 0) return []
  if (sorted.length > FLIPBOOK_MAX_PAGES) {
    throw new Error(`页图最多 ${FLIPBOOK_MAX_PAGES} 张，当前 ${sorted.length} 张`)
  }
  const blobs: Blob[] = []
  for (let i = 0; i < sorted.length; i++) {
    blobs.push(await imageFileToWebpBlob(sorted[i]))
    options?.onConverted?.(i + 1, sorted.length)
  }
  return blobs
}

/** 按文件夹（webkitRelativePath）或单本书扁平分组 */
export function groupFlipbookPageImagesByFolder(files: File[]): Map<string, File[]> {
  const map = new Map<string, File[]>()
  for (const file of files) {
    if (!isValidCloudPageImageFilename(file.name)) continue
    const key = flipbookPageImageGroupKey(file)
    const list = map.get(key) ?? []
    list.push(file)
    map.set(key, list)
  }
  for (const [key, list] of map) {
    map.set(key, sortFlipbookPageImageFiles(list))
  }
  return map
}

export function flipbookImageGroupStem(groupKey: string): string {
  return flipbookStemFromImageGroupKey(groupKey)
}
