export type NormalizedRect = {
  x: number
  y: number
  w: number
  h: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('无法加载页图'))
    img.src = src
  })
}

export async function cropImageBlob(
  pageUrl: string,
  rect: NormalizedRect,
): Promise<{ blob: Blob; url: string }> {
  const img = await loadImage(pageUrl)
  const sx = Math.round(rect.x * img.naturalWidth)
  const sy = Math.round(rect.y * img.naturalHeight)
  const sw = Math.max(1, Math.round(rect.w * img.naturalWidth))
  const sh = Math.max(1, Math.round(rect.h * img.naturalHeight))

  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D 不可用')
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('无法导出裁剪图'))),
      'image/png',
      0.92,
    )
  })
  return { blob, url: URL.createObjectURL(blob) }
}

/** Intersection-over-union for normalized rects. */
export function rectIoU(a: NormalizedRect, b: NormalizedRect): number {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)
  if (x2 <= x1 || y2 <= y1) return 0
  const inter = (x2 - x1) * (y2 - y1)
  const union = a.w * a.h + b.w * b.h - inter
  return union > 0 ? inter / union : 0
}
