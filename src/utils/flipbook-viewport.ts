/** Compute flipbook page dimensions to fill available viewport. */
export function computeFlipbookViewportSize(
  viewportW: number,
  viewportH: number,
  chrome: { top: number; bottom: number; horizontalPad: number },
  pageAspect = 1.35,
): { width: number; height: number } {
  const availW = Math.max(200, viewportW - chrome.horizontalPad * 2)
  const availH = Math.max(280, viewportH - chrome.top - chrome.bottom)

  let width = availW
  let height = Math.round(width * pageAspect)
  if (height > availH) {
    height = availH
    width = Math.round(height / pageAspect)
  }
  return { width, height }
}
