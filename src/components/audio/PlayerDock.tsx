'use client'

import { useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import type { PlaylistPlayer } from '@/hooks/usePlaylistPlayer'
import type { LoopMode } from '@/utils/audio-manager-types'

const LOOP_MODE_LABEL: Record<LoopMode, string> = { order: '顺序', one: '单曲', all: '列表' }

type Props = {
  player: PlaylistPlayer
  /** 当前曲是否已在「我的最爱」。 */
  isFavorite: boolean
  /** 由调用方接 collections.toggleFavorite(player.current)。 */
  onToggleFavorite: () => void
  theme?: 'dark' | 'light'
}

/**
 * 全站唯一的播放器视图。它渲染唯一的媒体元素（用 <video> 同时兼容纯音频与视频，
 * 纯音频时隐藏画面、视频时弹出浮层），并把 player.audioRef 绑上去。
 */
export default function PlayerDock({ player, isFavorite, onToggleFavorite, theme = 'dark' }: Props) {
  const [videoMinimized, setVideoMinimized] = useState(false)

  const current = player.current
  const isVideo = current?.mediaType === 'video'
  const showVideoOverlay = isVideo && !videoMinimized
  const live = player.isPlaying && !player.isPaused
  const dark = theme === 'dark'

  // 没有队列就不渲染（媒体元素也无需存在）。
  if (player.queue.length === 0) return null

  const total = player.queue.length

  return (
    <>
      {/* 浮动视频画面：始终在 DOM，纯音频时移出视口以保持 ref 稳定。 */}
      <div
        className="fixed z-40 overflow-hidden rounded-2xl bg-black transition-all duration-300"
        style={
          showVideoOverlay
            ? { bottom: '84px', right: '16px', width: '280px', boxShadow: '0 12px 40px rgba(0,0,0,0.45)', opacity: 1 }
            : { bottom: '-400px', right: '16px', width: '280px', opacity: 0, pointerEvents: 'none' }
        }
      >
        <video
          ref={player.audioRef}
          className="block max-h-[200px] w-full object-contain"
          preload="none"
          playsInline
          onEnded={player.onEnded}
          onPlay={player.notifyPlay}
          onPause={player.notifyPause}
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

      {/* 底部停靠条 */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-3">
        <div
          className={clsx(
            'pointer-events-auto mx-auto flex max-w-2xl items-center gap-2 rounded-[1.4rem] px-2.5 py-2 ring-1 backdrop-blur',
            dark
              ? 'bg-[#1b1410]/92 ring-white/10'
              : 'bg-white/92 ring-orange-200',
          )}
          style={{
            boxShadow: dark
              ? '0 -2px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)'
              : '0 -2px 24px rgba(245,158,11,0.18), inset 0 1px 0 rgba(255,255,255,0.7)',
            animation: live ? 'var(--animate-player-glow)' : undefined,
          }}
        >
          {/* 均衡器 / 状态灯 */}
          <Equalizer live={live} dark={dark} />

          {/* 曲目信息 */}
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-1.5">
              <span
                className={clsx(
                  'truncate text-[13px] font-extrabold',
                  dark ? 'text-white' : 'text-slate-800',
                )}
              >
                {current?.label ?? '—'}
              </span>
              {current?.refLink && (
                <Link
                  href={current.refLink}
                  title="跳转"
                  className={clsx(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] transition',
                    dark
                      ? 'text-white/45 hover:bg-white/10 hover:text-white'
                      : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
                  )}
                >
                  →
                </Link>
              )}
            </div>
            <div className={clsx('font-mono text-[10px]', dark ? 'text-white/45' : 'text-slate-400')}>
              {player.index + 1} / {total}
              {isVideo && videoMinimized && (
                <button
                  type="button"
                  onClick={() => setVideoMinimized(false)}
                  className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-orange-500 ring-1 ring-orange-300/50 transition hover:bg-orange-500/10"
                >
                  展开视频
                </button>
              )}
            </div>
          </div>

          {/* 传输控件 */}
          <GhostButton label="上一首" onClick={player.prev} dark={dark}>
            <PrevIcon />
          </GhostButton>
          <PrimaryDial
            label={player.isPaused ? '继续播放' : '暂停'}
            onClick={player.togglePause}
          >
            {player.isPaused ? <PlayIcon /> : <PauseIcon />}
          </PrimaryDial>
          <GhostButton label="下一首" onClick={player.next} dark={dark}>
            <NextIcon />
          </GhostButton>

          {/* 循环模式 */}
          <button
            type="button"
            onClick={player.cycleLoopMode}
            title={`${LOOP_MODE_LABEL[player.loopMode]}播放（点击切换）`}
            aria-label={`循环模式：${LOOP_MODE_LABEL[player.loopMode]}`}
            className={clsx(
              'flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-bold transition active:scale-95',
              player.loopMode === 'order'
                ? dark
                  ? 'bg-white/8 text-white/60 ring-1 ring-white/10'
                  : 'bg-slate-100 text-slate-400 ring-1 ring-slate-200'
                : 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-400/40',
            )}
          >
            <LoopIcon />
            <span className="tabular-nums">{LOOP_MODE_LABEL[player.loopMode]}</span>
          </button>

          {/* 循环次数 */}
          <button
            type="button"
            onClick={player.cycleLoopCount}
            title="循环次数（点击切换）"
            aria-label={`循环次数：${player.loopCount === Infinity ? '无限' : player.loopCount}`}
            className={clsx(
              'flex h-8 shrink-0 items-center justify-center rounded-full px-2 font-mono text-[12px] font-bold tabular-nums transition active:scale-95',
              dark ? 'bg-white/8 text-white/75 ring-1 ring-white/10' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
            )}
          >
            {player.loopCount === Infinity ? '∞' : `×${player.loopCount}`}
          </button>

          {/* 桃心收藏 */}
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={isFavorite ? '从我的最爱移除' : '加入我的最爱'}
            title={isFavorite ? '从我的最爱移除' : '加入我的最爱'}
            className={clsx(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition active:scale-90',
              isFavorite
                ? 'bg-pink-500/20 text-pink-500 ring-1 ring-pink-400/50'
                : dark
                  ? 'text-white/45 hover:bg-white/10 hover:text-pink-400'
                  : 'text-slate-400 hover:bg-pink-50 hover:text-pink-500',
            )}
          >
            <HeartIcon filled={isFavorite} />
          </button>

          {/* 关闭 */}
          <button
            type="button"
            onClick={player.stop}
            aria-label="停止播放"
            title="停止播放"
            className={clsx(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] transition hover:bg-red-500/70 hover:text-white',
              dark ? 'bg-white/8 text-white/60' : 'bg-slate-100 text-slate-400',
            )}
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    </>
  )
}

function Equalizer({ live, dark }: { live: boolean; dark: boolean }) {
  const bars = [{ delay: '0ms' }, { delay: '180ms' }, { delay: '90ms' }, { delay: '260ms' }]
  return (
    <div aria-hidden className="flex h-9 w-9 shrink-0 items-end justify-center gap-[3px] rounded-xl bg-gradient-to-br from-orange-400/20 to-orange-500/5 px-1.5 py-2">
      {bars.map((b, i) => (
        <span
          key={i}
          className={clsx(
            'block w-[3px] origin-bottom rounded-full',
            dark ? 'bg-orange-300' : 'bg-orange-500',
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
      className={clsx(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-orange-600',
        'shadow-[0_2px_6px_rgba(0,0,0,0.25),inset_0_-1px_0_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.9)]',
        'ring-1 ring-orange-200/60 transition-transform active:scale-90',
      )}
    >
      {children}
    </button>
  )
}

function GhostButton({
  label,
  children,
  onClick,
  dark,
}: {
  label: string
  children: React.ReactNode
  onClick: () => void
  dark: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition active:scale-90',
        dark ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
      )}
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
      <path d="M12 21s-7.5-4.6-10-9.2C.6 9 1.6 5.6 4.6 4.7c2-.6 3.9.3 5 1.9 1.1-1.6 3-2.5 5-1.9 3 .9 4 4.3 2.6 7.1C19.5 16.4 12 21 12 21Z" />
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
