'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

type ReadingAudioButtonProps = {
  /** URL from Supabase Storage (public). */
  src: string | null
  mode: 'loop' | 'once'
  /** For list page: only one passage may loop at a time. */
  activeKey?: string | null
  passageKey?: string
  onActivate?: (key: string | null) => void
  className?: string
  size?: 'sm' | 'md'
}

export default function ReadingAudioButton({
  src,
  mode,
  activeKey,
  passageKey,
  onActivate,
  className,
  size = 'md',
}: ReadingAudioButtonProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const disabled = !src

  const isListCoordination = mode === 'loop' && onActivate !== undefined && passageKey !== undefined

  useEffect(() => {
    if (!isListCoordination) return
    if (activeKey !== passageKey) {
      audioRef.current?.pause()
    }
  }, [activeKey, passageKey, isListCoordination])

  const toggle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!src) return
      const el = audioRef.current
      if (!el) return

      if (!el.paused) {
        el.pause()
        if (isListCoordination) onActivate?.(null)
        return
      }

      if (isListCoordination) onActivate?.(passageKey!)
      void el.play().catch(() => {
        setPlaying(false)
        setBuffering(false)
      })
    },
    [src, isListCoordination, onActivate, passageKey],
  )

  const sizeClass = size === 'sm' ? 'h-8 w-8 text-[14px]' : 'h-9 w-9 text-[15px]'

  return (
    <>
      {src && (
        <audio
          ref={audioRef}
          src={src}
          preload="none"
          loop={mode === 'loop'}
          onPlay={() => setPlaying(true)}
          onPause={() => {
            setPlaying(false)
            setBuffering(false)
          }}
          onEnded={() => setPlaying(false)}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          onCanPlay={() => setBuffering(false)}
          onError={() => {
            setPlaying(false)
            setBuffering(false)
          }}
        />
      )}
      <button
        type="button"
        disabled={disabled}
        aria-label={
          disabled
            ? '暂无朗读音频'
            : buffering
              ? '缓冲中'
              : playing
                ? '暂停朗读'
                : '播放朗读'
        }
        title={disabled ? '请先上传音频' : mode === 'loop' ? '循环朗读' : '朗读一遍'}
        onClick={toggle}
        className={clsx(
          'inline-flex shrink-0 items-center justify-center rounded-full ring-1 transition active:scale-95',
          sizeClass,
          disabled
            ? 'cursor-not-allowed bg-gray-100 text-gray-400 ring-gray-200'
            : playing
              ? 'cursor-pointer bg-gradient-to-br from-orange-400 to-amber-400 text-white ring-orange-300 shadow-sm'
              : 'cursor-pointer bg-white/90 text-orange-700 ring-orange-200 hover:bg-white',
          className,
        )}
      >
        {buffering ? (
          <span
            aria-hidden
            className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : playing ? (
          '⏸'
        ) : (
          '🔊'
        )}
      </button>
    </>
  )
}
