'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { LoopMode, PlayerState } from '@/utils/audio-manager-types'

const LOOP_LABELS: Record<LoopMode, string> = { none: '顺序', one: '单曲', all: '列表' }
const LOOP_NEXT: Record<LoopMode, LoopMode> = { none: 'one', one: 'all', all: 'none' }

type Props = {
  state: PlayerState | null
  onStateChange: (s: PlayerState | null) => void
}

export default function AudioPlayerBar({ state, onStateChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoMinimized, setVideoMinimized] = useState(false)

  // Update src and play/pause when track changes
  useEffect(() => {
    const el = videoRef.current
    if (!el || !state) return
    const track = state.tracks[state.currentIndex]
    if (!track) return
    el.src = track.url
    if (state.isPlaying) void el.play()
    else el.pause()
  }, [state?.currentIndex, state?.tracks]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync play/pause without changing track
  useEffect(() => {
    const el = videoRef.current
    if (!el || !state) return
    if (state.isPlaying) void el.play()
    else el.pause()
  }, [state?.isPlaying]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleEnded = useCallback(() => {
    if (!state) return
    if (state.loopMode === 'one') {
      const el = videoRef.current
      if (el) {
        el.currentTime = 0
        void el.play()
      }
    } else if (state.loopMode === 'all') {
      const nextIndex = (state.currentIndex + 1) % state.tracks.length
      onStateChange({ ...state, currentIndex: nextIndex, isPlaying: true })
    } else {
      if (state.currentIndex < state.tracks.length - 1) {
        onStateChange({ ...state, currentIndex: state.currentIndex + 1, isPlaying: true })
      } else {
        onStateChange({ ...state, isPlaying: false })
      }
    }
  }, [state, onStateChange])

  if (!state || state.tracks.length === 0) return null

  const current = state.tracks[state.currentIndex]
  const isVideo = current?.mediaType === 'video'
  const showVideoOverlay = isVideo && !videoMinimized

  function prev() {
    if (!state) return
    const i =
      state.loopMode === 'all'
        ? (state.currentIndex - 1 + state.tracks.length) % state.tracks.length
        : Math.max(0, state.currentIndex - 1)
    onStateChange({ ...state, currentIndex: i, isPlaying: true })
  }

  function next() {
    if (!state) return
    const i =
      state.loopMode === 'all'
        ? (state.currentIndex + 1) % state.tracks.length
        : Math.min(state.tracks.length - 1, state.currentIndex + 1)
    onStateChange({ ...state, currentIndex: i, isPlaying: true })
  }

  function toggleLoop() {
    if (!state) return
    onStateChange({ ...state, loopMode: LOOP_NEXT[state.loopMode] })
  }

  function handleClose() {
    videoRef.current?.pause()
    onStateChange(null)
    setVideoMinimized(false)
  }

  return (
    <>
      {/* Floating video overlay — always in DOM so ref stays stable */}
      <div
        className="fixed z-40 overflow-hidden rounded-2xl transition-all duration-300"
        style={
          showVideoOverlay
            ? {
                bottom: '76px',
                right: '16px',
                width: '280px',
                background: '#000',
                boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
                opacity: 1,
                pointerEvents: 'auto',
              }
            : {
                bottom: '-400px',
                right: '16px',
                width: '280px',
                background: '#000',
                opacity: 0,
                pointerEvents: 'none',
              }
        }
      >
        <video
          ref={videoRef}
          onEnded={handleEnded}
          style={{ width: '100%', display: 'block', maxHeight: '200px', objectFit: 'contain' }}
        />
        {/* Video overlay controls */}
        <div
          className="flex items-center justify-between px-3 py-1.5"
          style={{ background: 'rgba(0,0,0,0.6)' }}
        >
          <span className="truncate text-[11px] font-bold text-white/80">{current?.label}</span>
          <button
            type="button"
            onClick={() => setVideoMinimized(true)}
            className="ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            收起
          </button>
        </div>
      </div>

      {/* Player bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-3 px-5 py-3"
        style={{
          background: 'rgba(255,255,255,0.97)',
          borderTop: '1px solid rgba(245,158,11,0.18)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.06)',
        }}
      >
        {/* Media type icon */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[18px]"
          style={{
            background: isVideo
              ? 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(79,70,229,0.08))'
              : 'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(180,83,9,0.08))',
          }}
        >
          {isVideo ? '🎬' : '🎵'}
        </div>

        {/* Track info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-extrabold text-slate-800">
              {current?.label}
            </span>
            {current?.refLink && (
              <Link
                href={current.refLink}
                className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                title="跳转"
              >
                →
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            {state.tracks.length > 1 && (
              <span className="text-[11px] text-slate-400">
                {state.currentIndex + 1} / {state.tracks.length}
              </span>
            )}
            {isVideo && videoMinimized && (
              <button
                type="button"
                onClick={() => setVideoMinimized(false)}
                className="cursor-pointer rounded-full px-2 py-0.5 text-[10px] font-bold text-indigo-600 transition hover:bg-indigo-50"
                style={{ border: '1px solid rgba(99,102,241,0.3)' }}
              >
                展开视频
              </button>
            )}
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex shrink-0 items-center gap-1.5">
          {state.tracks.length > 1 && (
            <button
              type="button"
              onClick={prev}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[14px] font-black text-slate-500 transition hover:bg-slate-100"
            >
              ◂
            </button>
          )}
          <button
            type="button"
            onClick={() => onStateChange({ ...state, isPlaying: !state.isPlaying })}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[17px] text-white shadow-md transition hover:scale-105"
            style={{
              background: isVideo
                ? 'linear-gradient(135deg,#6366f1,#4f46e5)'
                : 'linear-gradient(135deg,#f59e0b,#b45309)',
              boxShadow: isVideo
                ? '0 3px 10px rgba(99,102,241,0.4)'
                : '0 3px 10px rgba(245,158,11,0.4)',
            }}
          >
            {state.isPlaying ? '⏸' : '▶'}
          </button>
          {state.tracks.length > 1 && (
            <button
              type="button"
              onClick={next}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[14px] font-black text-slate-500 transition hover:bg-slate-100"
            >
              ▸
            </button>
          )}
        </div>

        {/* Loop mode */}
        <button
          type="button"
          onClick={toggleLoop}
          className="shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-[10px] font-extrabold transition hover:scale-105"
          style={{
            background:
              state.loopMode !== 'none' ? 'rgba(245,158,11,0.12)' : 'rgba(15,23,42,0.05)',
            color: state.loopMode !== 'none' ? '#b45309' : '#94a3b8',
            border:
              state.loopMode !== 'none'
                ? '1.5px solid rgba(245,158,11,0.35)'
                : '1.5px solid rgba(15,23,42,0.1)',
          }}
        >
          {LOOP_LABELS[state.loopMode]}循环
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={handleClose}
          className="shrink-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[12px] text-slate-300 transition hover:bg-slate-100 hover:text-slate-600"
        >
          ✕
        </button>
      </div>
    </>
  )
}
