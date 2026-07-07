import { renderPdfFilesToPageUrls, type PdfPageMeta } from '@rosie/math/utils/math-pdf'

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'])

export function isPdfMaterialFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'
}

export function isRasterImageMaterialFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ext ? IMAGE_EXT.has(ext) : false
}

export type LoadMaterialProgress = {
  onPageRendered?: (info: {
    fileIndex: number
    fileCount: number
    pageInFile: number
    pagesInFile: number
    pageGlobal: number
  }) => void
}

export async function loadMaterialFilesToPageUrls(
  files: File[],
  options?: { maxPages?: number; scale?: number } & LoadMaterialProgress,
): Promise<{ urls: string[]; meta: PdfPageMeta[] }> {
  const urls: string[] = []
  const meta: PdfPageMeta[] = []
  let pageGlobal = 0

  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const file = files[fileIndex]!
    if (isPdfMaterialFile(file)) {
      const { urls: pdfUrls, meta: pdfMeta } = await renderPdfFilesToPageUrls([file], {
        maxPages: options?.maxPages,
        scale: options?.scale,
        onPageRendered: (info) => {
          pageGlobal = info.pageGlobal
          options?.onPageRendered?.({
            ...info,
            fileIndex: fileIndex + 1,
            fileCount: files.length,
          })
        },
      })
      urls.push(...pdfUrls)
      meta.push(...pdfMeta)
    } else if (isRasterImageMaterialFile(file)) {
      urls.push(URL.createObjectURL(file))
      meta.push({ fileName: file.name, pageInFile: 1 })
      pageGlobal++
      options?.onPageRendered?.({
        fileIndex: fileIndex + 1,
        fileCount: files.length,
        pageInFile: 1,
        pagesInFile: 1,
        pageGlobal,
      })
    }
  }

  return { urls, meta }
}
