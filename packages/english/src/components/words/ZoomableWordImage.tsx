'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface ZoomableWordImageProps {
  src: string
  word: string
  containerClassName: string
  imageClassName: string
}

export default function ZoomableWordImage({ src, word, containerClassName, imageClassName }: ZoomableWordImageProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
        className={`${containerClassName} cursor-zoom-in`}
        aria-label={`放大预览 ${word}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`${word} 配图`} className={imageClassName} />
      </button>

      {open && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${word} 配图预览`}
          onClick={(event) => {
            event.stopPropagation()
            setOpen(false)
          }}
          className="fixed inset-0 z-[9999] flex cursor-zoom-out items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={word}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[92vh] max-w-[96vw] cursor-default rounded-lg bg-white object-contain shadow-2xl"
          />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setOpen(false)
            }}
            className="absolute top-4 right-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/95 text-xl font-bold text-gray-700 shadow-lg transition hover:bg-white"
            aria-label="关闭"
          >
            ×
          </button>
        </div>,
        document.body,
      )}
    </>
  )
}
