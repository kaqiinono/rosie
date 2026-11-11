'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useBaiduMediaError } from '@rosie/core'
import { IconButton, Spinner } from '@rosie/ui/themes'

type ReadingAudioButtonProps = {
  /** Public Storage URL or authenticated same-origin reading-audio stream. */
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
  const [failed, setFailed] = useState(false)
  const disabled = !src
  const mediaError = useBaiduMediaError(audioRef, src ?? '')

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
      setFailed(false)
      const el = audioRef.current
      if (!el) return

      if (!el.paused) {
        el.pause()
        if (isListCoordination) onActivate?.(null)
        return
      }

      if (el.error) el.load()
      if (isListCoordination) onActivate?.(passageKey!)
      void el.play().catch(() => {
        setPlaying(false)
        setBuffering(false)
        setFailed(true)
      })
    },
    [src, isListCoordination, onActivate, passageKey],
  )

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
            setFailed(true)
          }}
        />
      )}
      <IconButton
        type="button"
        disabled={disabled}
        aria-label={
          disabled
            ? '暂无朗读音频'
            : failed
              ? '朗读失败，点击重试'
              : buffering
                ? '缓冲中'
                : playing
                  ? '暂停朗读'
                  : '播放朗读'
        }
        title={
          disabled
            ? '请先上传音频'
            : failed
              ? mediaError || '音频暂时无法播放，请重试。'
              : mode === 'loop'
                ? '循环朗读'
                : '朗读一遍'
        }
        onClick={toggle}
        variant={playing ? 'solid' : 'outline'}
        color="orange"
        size={size === 'sm' ? '2' : '3'}
        radius="full"
        className={clsx('shrink-0', className)}
      >
        {buffering ? <Spinner /> : playing ? '⏸' : '🔊'}
      </IconButton>
      {failed && mediaError && (
        <span role="alert" className="text-sm text-red-700">
          {mediaError}
        </span>
      )}
    </>
  )
}
