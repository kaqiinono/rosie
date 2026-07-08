/** 草稿纸可滚动画布：比可视区域更大，窄屏也能获得更多作画空间 */
export function computeScratchSurfaceSize(viewportW: number, viewportH: number): {
  width: number
  height: number
} {
  const width = Math.max(Math.ceil(viewportW * 1.5), 720)
  const height = Math.max(Math.ceil(viewportH * 2), 1000)
  return { width, height }
}
