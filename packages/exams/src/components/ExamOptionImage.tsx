'use client'

import { useState } from 'react'
import type { ExamOption } from '../types/content'
import { ExamMaterialImage } from './ExamMaterialImage'
import { useExamImageFocus } from './ExamImageFocusContext'

/** Viewport coordinates refer to the immutable bound image, not its PDF page. */
export function ExamOptionImage({ src, alt, region, displayWidth }: { src: string; alt: string; region?: ExamOption['imageRegion']; displayWidth?: number }) {
  const [size, setSize] = useState<{ src: string; width: number; height: number } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const { expanded } = useExamImageFocus()
  if (!region) return <ExamMaterialImage src={src} alt={alt} displayWidth={displayWidth} />
  const loaded = size?.src === src ? size : null
  return <div className="w-full" style={{ maxWidth: expanded ? undefined : displayWidth }}>
    {/* eslint-disable-next-line @next/next/no-img-element -- hidden intrinsic-size probe for authenticated media */}
    <img src={src} alt="" aria-hidden="true" hidden onError={() => setFailed(src)} onLoad={event => { setFailed(null); setSize({ src, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }) }} />
    {!loaded && <ExamMaterialImage alt={alt} message={failed === src ? '图片暂时无法读取' : '正在读取图片…'} />}
    {loaded && <svg role="img" aria-label={alt} className="h-auto w-full" viewBox={`${region.x * loaded.width} ${region.y * loaded.height} ${region.width * loaded.width} ${region.height * loaded.height}`}>
      <image href={src} width={loaded.width} height={loaded.height} />
    </svg>}
  </div>
}
