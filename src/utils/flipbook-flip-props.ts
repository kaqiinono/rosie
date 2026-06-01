import type { CSSProperties } from 'react'

/**
 * Tuned for an evenly weighted flip — forward and back read the same,
 * just mirrored. Slower flippingTime gives the curl room to breathe;
 * higher shadow opacity grounds the page on the stage.
 */
export const FLIPBOOK_BASE_PROPS = {
  style: {} as CSSProperties,
  startPage: 0,
  startZIndex: 0,
  drawShadow: true,
  flippingTime: 820,
  useMouseEvents: true,
  swipeDistance: 30,
  clickEventForward: true,
  disableFlipByClick: false,
  showPageCorners: true,
  autoSize: true,
  maxShadowOpacity: 0.55,
} as const
