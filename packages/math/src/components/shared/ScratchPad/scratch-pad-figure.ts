import { toPng } from 'html-to-image'

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
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous'
    }
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
    const canvas = document.createElement('canvas')
    const scale = 2
    canvas.width = Math.ceil(width * scale)
    canvas.height = Math.ceil(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, width, height)
    URL.revokeObjectURL(objectUrl)
    return { src: canvas.toDataURL('image/png'), width, height }
  } catch {
    URL.revokeObjectURL(objectUrl)
    return null
  }
}

function isExportRoot(el: HTMLElement): boolean {
  return (
    el.hasAttribute('data-scratch-puzzle-grid') ||
    el.hasAttribute('data-scratch-answer-export')
  )
}

/** 在不受浮层 overflow 约束时测量完整内容尺寸 */
function measureExportSize(el: HTMLElement): { width: number; height: number } {
  const base = el.getBoundingClientRect()
  let right = base.left + base.width
  let bottom = base.top + base.height

  for (const node of el.querySelectorAll('*')) {
    if (!(node instanceof HTMLElement)) continue
    const r = node.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) continue
    right = Math.max(right, r.right)
    bottom = Math.max(bottom, r.bottom)
  }

  const width = Math.max(
    Math.ceil(right - base.left),
    el.scrollWidth,
    el.offsetWidth,
    Math.ceil(base.width),
    1,
  )
  const height = Math.max(
    Math.ceil(bottom - base.top),
    el.scrollHeight,
    el.offsetHeight,
    Math.ceil(base.height),
    1,
  )
  return { width, height }
}

function waitForLayout(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

/**
 * 将 DOM 区块栅格化为 PNG。
 * 草稿浮层有 overflow:hidden，直接在原位截图会裁掉竖式右侧列；
 * 先克隆到离屏沙箱再按完整宽高截取。
 */
export async function rasterizeDomElement(
  el: HTMLElement,
): Promise<{ src: string; width: number; height: number } | null> {
  const measured = measureExportSize(el)

  const sandbox = document.createElement('div')
  sandbox.setAttribute('aria-hidden', 'true')
  sandbox.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'transform:translateX(-200vw)',
    'pointer-events:none',
    'overflow:visible',
    'background:#ffffff',
    'z-index:-1',
    'width:max-content',
    'max-width:none',
  ].join(';')

  const clone = el.cloneNode(true) as HTMLElement
  clone.style.overflow = 'visible'
  clone.style.maxWidth = 'none'
  clone.style.width = 'max-content'
  clone.style.flexShrink = '0'
  sandbox.appendChild(clone)
  document.body.appendChild(sandbox)

  await waitForLayout()

  const w = Math.max(measured.width, clone.scrollWidth, clone.offsetWidth, 1)
  const h = Math.max(measured.height, clone.scrollHeight, clone.offsetHeight, 1)

  try {
    const src = await toPng(clone, {
      width: w,
      height: h,
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#ffffff',
      style: {
        overflow: 'visible',
        maxWidth: 'none',
        width: `${w}px`,
      },
    })
    return { src, width: w, height: h }
  } catch {
    return null
  } finally {
    sandbox.remove()
  }
}

/** @deprecated 使用 rasterizeDomElement */
export const rasterizeHtmlElement = rasterizeDomElement

export function pickExportDomElement(
  hosts: Array<HTMLElement | null | undefined>,
): HTMLElement | null {
  const selectors = ['[data-scratch-puzzle-grid]', '[data-scratch-answer-export]']

  for (const host of hosts) {
    if (!host) continue
    if (isExportRoot(host) && host.getBoundingClientRect().width > 0) return host
    for (const sel of selectors) {
      const found = host.querySelector(sel)
      if (found instanceof HTMLElement && found.getBoundingClientRect().width > 0) {
        return found
      }
    }
    if (host.getBoundingClientRect().width > 0) return host
  }
  return null
}

export function findSvgInHosts(
  hosts: Array<HTMLElement | null | undefined>,
): SVGSVGElement | null {
  for (const host of hosts) {
    const svg = host?.querySelector('svg')
    if (svg) return svg
  }
  return null
}
