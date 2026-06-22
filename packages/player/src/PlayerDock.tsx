'use client'

import { useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import type { PlaylistPlayer } from './usePlaylistPlayer'
import type { LoopMode } from './audio-manager-types'

const LOOP_MODE_LABEL: Record<LoopMode, string> = { order: '顺序', one: '单曲', all: '列表' }

type Props = {
  player: PlaylistPlayer
  /** 当前曲是否已在「我的最爱」。省略则不渲染收藏桃心（例如 reading 自管队列、无收藏夹）。 */
  isFavorite?: boolean
  /** 由调用方接 collections.toggleFavorite(player.current)。省略则隐藏桃心。 */
  onToggleFavorite?: () => void
  theme?: 'dark' | 'light'
}

/**
 * 全站唯一的播放器视图。它渲染唯一的媒体元素（用 <video> 同时兼容纯音频与视频，
 * 纯音频时隐藏画面、视频时弹出浮层），并把 player.audioRef 绑上去。
 * 视觉：暖橙拟物条，两种主题共用同一橙色外观，仅外发光略有差异。
 */
export default function PlayerDock({ player, isFavorite, onToggleFavorite, theme = 'dark' }: Props) {
  const [videoMinimized, setVideoMinimized] = useState(false)
  const [showQueue, setShowQueue] = useState(false)

  // Destructure so render only reads state/callbacks, not the ref-bearing player object.
  const {
    audioRef,
    queue,
    index,
    current,
    isPlaying,
    isPaused,
    loopMode,
    loopCount,
    togglePause,
    prev,
    next,
    jumpTo,
    removeAt,
    cycleLoopMode,
    cycleLoopCount,
    stop,
    onEnded,
    notifyPlay,
    notifyPause,
  } = player

  const isVideo = current?.mediaType === 'video'
  const showVideoOverlay = isVideo && !videoMinimized
  const live = isPlaying && !isPaused
  const loopActive = loopMode !== 'order'

  const total = queue.length

  return (
    <>
      {/* 浮动视频画面：始终在 DOM，纯音频时移出视口以保持 ref 稳定。 */}
      <div
        className="fixed z-40 overflow-hidden rounded-2xl bg-black transition-all duration-300"
        style={
          showVideoOverlay
            ? { bottom: '88px', right: '16px', width: '280px', boxShadow: '0 12px 40px rgba(0,0,0,0.45)', opacity: 1 }
            : { bottom: '-400px', right: '16px', width: '280px', opacity: 0, pointerEvents: 'none' }
        }
      >
        <video
          ref={audioRef}
          className="block max-h-[200px] w-full object-contain"
          preload="none"
          playsInline
          onEnded={onEnded}
          onPlay={notifyPlay}
          onPause={notifyPause}
        />
        <div className="flex items-center justify-between bg-black/60 px-3 py-1.5">
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

      {/* 底部停靠条（队列空时不显示；上面的媒体元素始终挂载，保证首次播放可控制） */}
      {total > 0 && (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-3">
        {/* 播放列表面板 */}
        {showQueue && (
          <div className="pointer-events-auto mx-auto mb-2 max-w-2xl overflow-hidden rounded-2xl bg-[#1b1410]/96 ring-1 ring-white/10 backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
              <span className="text-[12px] font-bold text-white/85">播放列表 · {total}</span>
              <button
                type="button"
                onClick={() => setShowQueue(false)}
                className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white/55 transition hover:bg-white/10 hover:text-white"
              >
                收起
              </button>
            </div>
            <ul className="max-h-[44vh] overflow-y-auto p-1.5">
              {queue.map((t, i) => {
                const playing = i === index
                return (
                  <li key={`${t.url}-${i}`} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => jumpTo(i)}
                      className={clsx(
                        'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left transition',
                        playing ? 'bg-orange-400/15' : 'hover:bg-white/5',
                      )}
                    >
                      <span
                        className={clsx(
                          'w-5 shrink-0 text-center font-mono text-[11px]',
                          playing ? 'text-orange-300' : 'text-white/35',
                        )}
                      >
                        {playing ? '♪' : i + 1}
                      </span>
                      <span
                        className={clsx(
                          'truncate text-[13px]',
                          playing ? 'font-bold text-orange-200' : 'text-white/80',
                        )}
                      >
                        {t.label}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      aria-label="从播放列表移除"
                      title="移除"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] text-white/40 transition hover:bg-red-500/20 hover:text-red-300"
                    >
                      <CloseIcon />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div
          className="pointer-events-auto relative isolate mx-auto flex max-w-2xl flex-col gap-2 overflow-hidden rounded-[1.6rem] px-2.5 py-2.5 ring-1 ring-orange-600/40 sm:flex-row sm:items-center sm:gap-2 sm:py-2"
          style={{
            background: 'linear-gradient(135deg,#fb923c 0%,#f59e0b 52%,#f97316 100%)',
            boxShadow: live
              ? `0 10px 34px -6px rgba(245,158,11,0.6), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -2px 0 rgba(0,0,0,0.18)${theme === 'dark' ? ', 0 0 0 1px rgba(255,255,255,0.06)' : ''}`
              : '0 7px 22px -6px rgba(245,158,11,0.45), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(0,0,0,0.18)',
            animation: live ? 'var(--animate-player-glow)' : undefined,
          }}
        >
          {/* 顶部高光 */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent"
          />
          <span
            aria-hidden
            className={clsx(
              'pointer-events-none absolute inset-x-4 top-0 h-px',
              live ? 'bg-white/80' : 'bg-white/40',
            )}
          />

          {/* 信息行：均衡器 + 曲目（小屏单独占一行） */}
          <div className="flex min-w-0 items-center gap-2 sm:flex-1">
            {/* 均衡器 */}
            <Equalizer live={live} />

            {/* 曲目信息 */}
            <div className="relative min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-extrabold text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.12)]">
                {current?.label ?? '—'}
              </span>
              {current?.refLink && (
                <Link
                  href={current.refLink}
                  title="跳转"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] text-white/70 transition hover:bg-white/20 hover:text-white"
                >
                  →
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowQueue((s) => !s)}
                aria-label="播放列表"
                title="查看播放列表"
                className={clsx(
                  'flex items-center gap-1 rounded-full px-1.5 font-mono text-[10px] tracking-wide transition',
                  showQueue ? 'bg-white/25 text-white' : 'text-white/70 hover:bg-white/15 hover:text-white',
                )}
              >
                <ListIcon />
                {index + 1} / {total}
              </button>
              {isVideo && videoMinimized && (
                <button
                  type="button"
                  onClick={() => setVideoMinimized(false)}
                  className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white transition hover:bg-white/30"
                >
                  展开视频
                </button>
              )}
            </div>
            </div>
          </div>

          {/* 控件行：小屏换到第二行、可自动换行避免压缩 */}
          <div className="flex w-full flex-wrap items-center justify-center gap-1.5 sm:w-auto sm:flex-nowrap">
            <GhostButton label="上一首" onClick={prev}>
              <PrevIcon />
            </GhostButton>
          <PrimaryDial label={isPaused ? '继续播放' : '暂停'} onClick={togglePause} pulse={live}>
            {isPaused ? <PlayIcon /> : <PauseIcon />}
          </PrimaryDial>
          <GhostButton label="下一首" onClick={next}>
            <NextIcon />
          </GhostButton>

          {/* 循环模式 */}
          <button
            type="button"
            onClick={cycleLoopMode}
            title={`${LOOP_MODE_LABEL[loopMode]}播放（点击切换）`}
            aria-label={`循环模式：${LOOP_MODE_LABEL[loopMode]}`}
            className={clsx(
              'group relative flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-bold transition active:scale-95',
              loopActive
                ? 'bg-white text-orange-600 shadow-[0_2px_6px_rgba(0,0,0,0.18)] ring-1 ring-orange-200/70'
                : 'bg-black/15 text-white/90 ring-1 ring-black/10 hover:bg-black/25',
            )}
          >
            <span className="transition-transform group-active:rotate-180">
              <LoopIcon />
            </span>
            <span className="tabular-nums">{LOOP_MODE_LABEL[loopMode]}</span>
          </button>

          {/* 循环次数 */}
          <button
            type="button"
            onClick={cycleLoopCount}
            title="循环次数（点击切换）"
            aria-label={`循环次数：${loopCount === Infinity ? '无限' : loopCount}`}
            className="flex h-8 shrink-0 items-center justify-center rounded-full bg-black/15 px-2 font-mono text-[12px] font-bold tabular-nums text-white ring-1 ring-black/10 transition hover:bg-black/25 active:scale-95"
          >
            {loopCount === Infinity ? '∞' : `×${loopCount}`}
          </button>

          {/* 桃心收藏（仅在调用方提供 onToggleFavorite 时渲染） */}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={onToggleFavorite}
              aria-label={isFavorite ? '从我的最爱移除' : '加入我的最爱'}
              title={isFavorite ? '从我的最爱移除' : '加入我的最爱'}
              className={clsx(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition active:scale-90',
                isFavorite
                  ? 'bg-white text-pink-500 shadow-[0_2px_6px_rgba(0,0,0,0.18)] ring-1 ring-pink-200'
                  : 'bg-black/15 text-white/85 ring-1 ring-black/10 hover:bg-black/25 hover:text-white',
              )}
            >
              <HeartIcon filled={!!isFavorite} />
            </button>
          )}

          {/* 关闭 */}
          <button
            type="button"
            onClick={stop}
            aria-label="停止播放"
            title="停止播放"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/15 text-[12px] text-white/85 ring-1 ring-black/10 transition hover:bg-red-500 hover:text-white"
          >
            <CloseIcon />
          </button>
          </div>
        </div>
      </div>
      )}
    </>
  )
}

function Equalizer({ live }: { live: boolean }) {
  const bars = [{ delay: '0ms' }, { delay: '180ms' }, { delay: '90ms' }, { delay: '260ms' }]
  return (
    <div
      aria-hidden
      className="relative flex h-9 w-9 shrink-0 items-end justify-center gap-[3px] rounded-2xl bg-white/15 px-1.5 py-2 ring-1 ring-white/25"
    >
      {bars.map((b, i) => (
        <span
          key={i}
          className={clsx(
            'block w-[3px] origin-bottom rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.6)]',
            live ? 'h-5' : 'h-1.5',
          )}
          style={live ? { animation: 'var(--animate-eq)', animationDelay: b.delay } : undefined}
        />
      ))}
    </div>
  )
}

function PrimaryDial({
  label,
  children,
  onClick,
  pulse,
}: {
  label: string
  children: React.ReactNode
  onClick: () => void
  pulse?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-orange-600',
        'shadow-[0_3px_8px_rgba(0,0,0,0.28),inset_0_-1px_0_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.9)]',
        'ring-1 ring-orange-200/70 transition-transform active:scale-90',
      )}
    >
      {pulse && (
        <span
          aria-hidden
          className="absolute inset-0 animate-ping rounded-full bg-white/40"
          style={{ animationDuration: '1.6s' }}
        />
      )}
      <span className="relative">{children}</span>
    </button>
  )
}

function GhostButton({
  label,
  children,
  onClick,
}: {
  label: string
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/90 transition hover:bg-white/20 hover:text-white active:scale-90"
    >
      {children}
    </button>
  )
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.4-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6.5" y="5" width="4" height="14" rx="1.2" />
      <rect x="13.5" y="5" width="4" height="14" rx="1.2" />
    </svg>
  )
}

function PrevIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="5" width="2.5" height="14" rx="0.6" />
      <path d="M19 5.6v12.8a.8.8 0 0 1-1.26.65L8.5 12.65a.8.8 0 0 1 0-1.3l9.24-6.4A.8.8 0 0 1 19 5.6Z" />
    </svg>
  )
}

function NextIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 5.6v12.8a.8.8 0 0 0 1.26.65L15.5 12.65a.8.8 0 0 0 0-1.3L6.26 4.95A.8.8 0 0 0 5 5.6Z" />
      <rect x="16.5" y="5" width="2.5" height="14" rx="0.6" />
    </svg>
  )
}

function LoopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2.5L20.5 6 17 9.5" />
      <path d="M3.5 11V9a3 3 0 0 1 3-3H20" />
      <path d="M7 21.5L3.5 18 7 14.5" />
      <path d="M20.5 13v2a3 3 0 0 1-3 3H4" />
    </svg>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
