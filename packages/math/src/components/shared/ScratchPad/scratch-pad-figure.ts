export function fitFigureLayout(
  naturalW: number,
  naturalH: number,
  canvasW: number,
  canvasH: number,
): { x: number; y: number; w: number; h: number } {
  const maxW = canvasW * 0.88
  const maxH = canvasH * 0.5
  const topPad = 68
  const scale = Math.min(maxW / naturalW, maxH / naturalH, 1)
  const w = naturalW * scale
  const h = naturalH * scale
  const x = (canvasW - w) / 2
  const y = topPad + Math.max(0, (maxH - h) / 2)
  return { x, y, w, h }
}

export function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

export async function rasterizeSvgElement(
  svg: SVGSVGElement,
): Promise<{ src: string; width: number; height: number } | null> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  }
  const rect = svg.getBoundingClientRect()
  const vb = svg.viewBox?.baseVal
  const width = rect.width > 0 ? rect.width : vb?.width || 320
  const height = rect.height > 0 ? rect.height : vb?.height || 240
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))

  const xml = new XMLSerializer().serializeToString(clone)
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)

  try {
    const img = await loadHtmlImage(objectUrl)
    return { src: objectUrl, width: img.naturalWidth || width, height: img.naturalHeight || height }
  } catch {
    URL.revokeObjectURL(objectUrl)
    return null
  }
}
