let pdfWorkerReady = false

async function ensurePdfWorker(): Promise<typeof import('pdfjs-dist')> {
  const pdfjs = await import('pdfjs-dist')
  if (!pdfWorkerReady) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
    pdfWorkerReady = true
  }
  return pdfjs
}

export type PdfDocumentHandle = {
  doc: Awaited<ReturnType<Awaited<ReturnType<typeof ensurePdfWorker>>['getDocument']>['promise']>
  numPages: number
}

export async function openPdfFile(
  pdfFile: File,
  maxPages = 80,
): Promise<PdfDocumentHandle> {
  const pdfjs = await ensurePdfWorker()
  const data = await pdfFile.arrayBuffer()
  const doc = await pdfjs.getDocument({ data }).promise
  const numPages = Math.min(doc.numPages, maxPages)
  if (doc.numPages > maxPages) {
    console.warn(`PDF 共 ${doc.numPages} 页，仅渲染前 ${maxPages} 页`)
  }
  return { doc, numPages }
}

export async function renderPdfPageUrl(
  doc: PdfDocumentHandle['doc'],
  pageNumber: number,
  scale = 2,
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
        'image/png',
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

export async function renderPdfFileToPageUrls(
  pdfFile: File,
  options?: { maxPages?: number; scale?: number } & RenderPdfProgress,
): Promise<string[]> {
  const scale = options?.scale ?? 2
  const { doc, numPages } = await openPdfFile(pdfFile, options?.maxPages)
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
