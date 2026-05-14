'use client'

import { useEffect, useState } from 'react'

interface AnalysisImageProps {
  src: string
  alt?: string
}

export default function AnalysisImage({ src, alt = '题解图' }: AnalysisImageProps) {
  const [open, setOpen] = useState(false)
  const [rotated, setRotated] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setRotated(false)
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Temporarily relax the viewport meta so mobile users can pinch-to-zoom the
    // image. The app sets maximumScale=1 globally for a native-app feel, which
    // also blocks image zoom.
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    const prevViewport = meta?.content ?? ''
    if (meta) {
      meta.content = 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes'
    }

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      if (meta) meta.content = prevViewport
    }
  }, [open])

  function closeModal() {
    setOpen(false)
    setRotated(false)
  }

  // When rotated 90°, swap the max-width / max-height constraints so the rotated
  // image still fits the viewport (CSS rotate doesn't change the bounding box).
  const imgSizeStyle = rotated
    ? { maxWidth: '92vh', maxHeight: '96vw' }
    : { maxWidth: '96vw', maxHeight: '92vh' }

  return (
    <>
      <div className="mt-2.5 flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative cursor-zoom-in"
          aria-label="放大查看题解图"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="w-full max-w-md rounded-lg border border-sky-200 bg-white transition-transform group-hover:scale-[1.01]"
          />
          <span className="pointer-events-none absolute right-1.5 bottom-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            点击放大 🔍
          </span>
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={closeModal}
          className="fixed inset-0 z-[9999] flex cursor-zoom-out items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            style={{
              ...imgSizeStyle,
              transform: rotated ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease, max-width 0.3s ease, max-height 0.3s ease',
            }}
            className="cursor-default rounded-lg bg-white object-contain shadow-2xl"
          />

          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 right-4 flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => setRotated((v) => !v)}
              className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-sm font-semibold text-gray-700 shadow-lg transition hover:bg-white"
              aria-label="旋转 90°"
              title="旋转 90°"
            >
              <span className="text-base">↻</span>
              <span>旋转</span>
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/95 text-xl font-bold text-gray-700 shadow-lg transition hover:bg-white"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  )
}
