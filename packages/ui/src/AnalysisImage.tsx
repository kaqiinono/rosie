'use client'

import { useEffect, useState } from 'react'

type AnalysisImageProps = {
  src: string
  alt?: string
  onLoad?: () => void
}

export default function AnalysisImage({ src, alt = '题解图', onLoad }: AnalysisImageProps) {
  const [open, setOpen] = useState(false)
  const [rotated, setRotated] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setRotated(false)
      }
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    const previousViewport = meta?.content ?? ''
    if (meta) {
      meta.content = 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes'
    }
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      if (meta) meta.content = previousViewport
    }
  }, [open])

  const close = () => {
    setOpen(false)
    setRotated(false)
  }
  const imageStyle = rotated
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
            onLoad={onLoad}
            className="h-auto max-h-none max-w-full rounded-lg border border-sky-200 bg-white object-contain transition-transform group-hover:scale-[1.01]"
          />
          <span className="pointer-events-none absolute right-1.5 bottom-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            点击放大 🔍
          </span>
        </button>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={close}
          className="fixed inset-0 z-[9999] flex cursor-zoom-out items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onClick={(event) => event.stopPropagation()}
            style={{
              ...imageStyle,
              transform: rotated ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease, max-width 0.3s ease, max-height 0.3s ease',
            }}
            className="cursor-default rounded-lg bg-white object-contain shadow-2xl"
          />
          <div
            onClick={(event) => event.stopPropagation()}
            className="absolute top-4 right-4 flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => setRotated((value) => !value)}
              className="flex h-10 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-sm font-semibold text-gray-700 shadow-lg"
              aria-label="旋转 90°"
            >
              ↻ <span>旋转</span>
            </button>
            <button
              type="button"
              onClick={close}
              className="flex size-10 items-center justify-center rounded-full bg-white/95 text-xl font-bold text-gray-700 shadow-lg"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
