import { FLIPBOOK_MAX_PAGES } from '@/utils/flipbook-types'

let pdfWorkerReady = false

async function ensurePdfWorker(): Promise<typeof import('pdfjs-dist')> {
  const pdfjs = await import('pdfjs-dist')
  if (!pdfWorkerReady) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
    pdfWorkerReady = true
  }
  return pdfjs
}

export async function countPdfPages(pdfUrl: string): Promise<number> {
  const pdfjs = await ensurePdfWorker()
  const task = pdfjs.getDocument(pdfUrl)
  const doc = await task.promise
  const n = doc.numPages
  await doc.destroy()
  return n
}

export type PdfDocumentHandle = {
  doc: Awaited<ReturnType<Awaited<ReturnType<typeof ensurePdfWorker>>['getDocument']>['promise']>
  numPages: number
}

export async function openPdfDocument(
  pdfUrl: string,
  maxPages = FLIPBOOK_MAX_PAGES,
): Promise<PdfDocumentHandle> {
  const pdfjs = await ensurePdfWorker()
  const doc = await pdfjs.getDocument(pdfUrl).promise
  const numPages = Math.min(doc.numPages, maxPages)
  if (doc.numPages > maxPages) {
    console.warn(`PDF 共 ${doc.numPages} 页，仅渲染前 ${maxPages} 页`)
  }
  return { doc, numPages }
}

export async function renderPdfPageUrl(
  doc: PdfDocumentHandle['doc'],
  pageNumber: number,
  scale = 1.5,
): Promise<string> {
  const page = await doc.getPage(pageNumber)
  try {
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D 不可用')
    await page.render({ canvasContext: ctx, viewport }).promise
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('无法导出页图'))),
        'image/webp',
        0.92,
      )
    })
    return URL.createObjectURL(blob)
  } finally {
    page.cleanup()
  }
}

export type RenderPdfProgress = {
  onPageRendered?: (rendered: number, total: number) => void
}

export async function renderPdfToPageUrls(
  pdfUrl: string,
  options?: { maxPages?: number; scale?: number } & RenderPdfProgress,
): Promise<string[]> {
  const scale = options?.scale ?? 1.5
  const { doc, numPages } = await openPdfDocument(pdfUrl, options?.maxPages)
  const urls: string[] = []
  try {
    for (let i = 1; i <= numPages; i++) {
      urls.push(await renderPdfPageUrl(doc, i, scale))
      options?.onPageRendered?.(i, numPages)
    }
  } finally {
    await doc.destroy()
  }
  return urls
}

export function revokePageUrls(urls: string[]): void {
  for (const url of urls) URL.revokeObjectURL(url)
}

/** Render a local PDF file to WebP blobs (upload these; do not store the PDF). */
export async function renderPdfFileToPageBlobs(
  pdfFile: File,
  options?: { maxPages?: number; scale?: number } & RenderPdfProgress,
): Promise<Blob[]> {
  const blobUrl = URL.createObjectURL(pdfFile)
  try {
    const urls = await renderPdfToPageUrls(blobUrl, options)
    try {
      return await Promise.all(urls.map((u) => fetch(u).then((r) => r.blob())))
    } finally {
      revokePageUrls(urls)
    }
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}
