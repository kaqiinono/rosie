'use client'

import { useEffect, useRef, useState } from 'react'
import { useBaiduMediaError } from '@rosie/core'
import { Button } from '@rosie/ui/themes'
import type { ListeningClip } from '../../utils/listening-clips'

// Keep three seconds of the recorded writing pause after the first reading.
const SINGLE_READ_WAIT_SECONDS = 3
const CLIP_GAP_MS = 1000

type Props = {
  passageKey: string
  clips: ListeningClip[]
  index: number
  select: (index: number) => void
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  paused: boolean
  setPaused: (paused: boolean) => void
  selected: number[]
  setSelected: (indices: number[]) => void
  close: () => void
}

export default function ListeningDrawer({
  passageKey,
  clips,
  index,
  select,
  close,
  collapsed,
  setCollapsed,
  paused,
  setPaused,
  selected,
  setSelected,
}: Props) {
  const [choosing, setChoosing] = useState(false)
  const pickerButton = useRef<HTMLButtonElement>(null)
  const selectedOption = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (choosing) selectedOption.current?.focus()
  }, [choosing])
  const [single, setSingle] = useState(false)
  const [loop, setLoop] = useState(false)
  const [translate, setTranslate] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [failedKey, setFailedKey] = useState('')
  const [finishedKey, setFinishedKey] = useState('')
  const audio = useRef<HTMLAudioElement>(null)
  const previousClip = useRef('')
  const clip = clips[index]
  const [startedClip, setStartedClip] = useState('')
  const currentKey = clip.sourceUrl ?? passageKey + '-' + index
  const mediaError = useBaiduMediaError(audio, currentKey)
  const multiple = selected.length > 1
  const position = selected.indexOf(index)
  const nextIndex = multiple ? selected[(position + 1) % selected.length] : index + 1
  const previousIndex = multiple
    ? selected[(position + selected.length - 1) % selected.length]
    : index - 1

  useEffect(() => {
    if (paused || !multiple || finishedKey !== currentKey) return
    const timer = window.setTimeout(() => select(nextIndex), CLIP_GAP_MS)
    return () => window.clearTimeout(timer)
  }, [paused, multiple, finishedKey, currentKey, nextIndex, select])

  useEffect(() => {
    setFinishedKey('')
    setFailedKey('')
    const el = audio.current
    if (!el) return
    if (previousClip.current !== currentKey && el.readyState >= 1) el.currentTime = 0
    previousClip.current = currentKey
    if (paused) return
    let current = true
    if (el.error) el.load()
    void el.play().catch(() => {
      if (current) setFailedKey(currentKey)
    })
    return () => {
      current = false
      el.pause()
    }
  }, [currentKey, attempt, paused])

  function toggleClip(i: number) {
    const next = selected.includes(i)
      ? selected.filter((n) => n !== i)
      : [...selected, i].sort((a, b) => a - b)
    setSelected(next)
    if (next.length && !next.includes(index)) select(next[0])
    if (!next.length || (finishedKey === currentKey && next.length < 2)) setPaused(true)
  }

  function finishClip() {
    if (paused) return
    if (multiple) setFinishedKey(currentKey)
    else setPaused(true)
  }

  const failed = failedKey === currentKey
  function togglePlayback() {
    if (paused || failed) {
      if (!selected.length) setSelected([index])
      setPaused(false)
      setAttempt((value) => value + 1)
    } else {
      audio.current?.pause()
      setPaused(true)
    }
  }

  const [settingsOpen, setSettingsOpen] = useState(false)
  const switchLabel =
    'inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-slate-700'
  const switchInput =
    'h-4 w-7 shrink-0 cursor-pointer appearance-none rounded-full bg-slate-300 p-0.5 before:block before:size-3 before:rounded-full before:bg-white before:shadow-sticker-sm checked:bg-orange-700 checked:before:translate-x-3 focus-visible:outline-2 focus-visible:outline-offset-2'

  return (
    <section
      id="reading-listening-drawer"
      aria-label="听记练习"
      className={`border-kid-line shadow-sticker-sm fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[52dvh] max-w-2xl overflow-y-auto rounded-t-3xl border-2 bg-stone-50 px-4 text-slate-900 sm:px-6 ${collapsed ? 'flex-wrap items-center pt-1 pb-[calc(0.25rem_+_env(safe-area-inset-bottom,0px))]' : 'flex-col pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]'}`}
    >
      <header
        className={
          collapsed
            ? 'order-1 ml-auto'
            : 'flex shrink-0 items-center justify-between gap-2 border-b border-orange-100 pb-2'
        }
      >
        {!collapsed && (
          <div className="flex items-center gap-3 font-bold text-slate-900">
            <span>🎧 听记</span>
            <Button
              ref={pickerButton}
              type="button"
              aria-label={`选择听记片段，当前第 ${index + 1} 段`}
              aria-expanded={choosing}
              aria-controls="listening-clip-options"
              variant="ghost"
              color="gray"
              size="2"
              className="tabular-nums"
              onClick={() => setChoosing(!choosing)}
            >
              第 {String(index + 1).padStart(2, '0')} / {clips.length} 段
              {multiple && ' · 已选 ' + selected.length}
              <svg
                aria-hidden="true"
                viewBox="0 0 12 8"
                className={`w-3 transition-transform ${choosing ? 'rotate-180' : ''}`}
              >
                <path d="m1 1 5 5 5-5" stroke="currentColor" fill="none" strokeWidth="1.5" />
              </svg>
            </Button>
          </div>
        )}
        <div className="flex items-center text-sm font-bold text-slate-600">
          <Button
            type="button"
            aria-expanded={!collapsed}
            aria-controls="listening-clip-text listening-clip-options"
            variant="ghost"
            color="gray"
            size="2"
            onClick={() => {
              setChoosing(false)
              setSettingsOpen(false)
              setCollapsed(!collapsed)
            }}
          >
            {collapsed ? '展开' : '收起'}
          </Button>
          <Button
            type="button"
            aria-label="关闭听记"
            variant="ghost"
            color="gray"
            size="2"
            onClick={close}
          >
            关闭
          </Button>
        </div>
      </header>
      <div
        id="listening-clip-options"
        hidden={collapsed || !choosing}
        aria-label="听记片段"
        role="group"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setChoosing(false)
            pickerButton.current?.focus()
          }
        }}
        className="my-2 min-h-16 overflow-y-auto overscroll-contain rounded-xl border border-orange-100 bg-orange-50/40 p-1"
      >
        {clips.map((item, i) => (
          <label
            key={i}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-slate-700 hover:bg-orange-50 has-checked:bg-orange-100"
          >
            <input
              type="checkbox"
              ref={i === index ? selectedOption : undefined}
              checked={selected.includes(i)}
              onChange={() => toggleClip(i)}
              className="size-4 accent-orange-700"
            />
            <span className="font-bold text-orange-800 tabular-nums">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span lang="en" className="min-w-0 flex-1 truncate">
              {item.english}
            </span>
          </label>
        ))}
      </div>
      <div
        id="listening-clip-text"
        hidden={collapsed || choosing}
        className="min-h-16 overflow-y-auto py-3 sm:py-4"
      >
        <p lang="en" className="text-2xl leading-[1.45] font-semibold text-slate-900">
          <mark className="rounded-sm bg-amber-100 box-decoration-clone text-inherit">
            {clip.english}
          </mark>
        </p>
        {translate && (
          <p className="mt-2 text-base leading-relaxed text-slate-600">{clip.chinese}</p>
        )}
        {failed && <p role="alert">{mediaError || '这段音频暂时无法播放，请重试。'}</p>}
      </div>
      {[index, nextIndex]
        .filter((i, pos, indices) => i >= 0 && i < clips.length && indices.indexOf(i) === pos)
        .map((i) => {
          const active = i === index
          const number = String(i + 1).padStart(2, '0')
          return (
            <audio
              key={passageKey + '-' + i}
              ref={active ? audio : undefined}
              src={clips[i].sourceUrl ?? '/api/baidu/audio/' + passageKey + '?clip=' + number}
              preload={!paused && (active || startedClip === currentKey) ? 'auto' : 'none'}
              loop={active && loop && !multiple}
              onLoadedMetadata={
                active && single
                  ? (e) => {
                      e.currentTarget.currentTime = clips[i].singleRead[0]
                    }
                  : undefined
              }
              onPlay={
                active && single
                  ? (e) => {
                      const el = e.currentTarget
                      const [start, end] = clip.singleRead
                      if (
                        el.currentTime < start ||
                        el.currentTime >= end + SINGLE_READ_WAIT_SECONDS
                      )
                        el.currentTime = start
                    }
                  : undefined
              }
              onTimeUpdate={
                active && single
                  ? (e) => {
                      const el = e.currentTarget
                      if (
                        el.paused ||
                        el.currentTime < clip.singleRead[1] + SINGLE_READ_WAIT_SECONDS
                      )
                        return
                      if (multiple || !loop) {
                        el.pause()
                        finishClip()
                      }
                      el.currentTime = clip.singleRead[0]
                    }
                  : undefined
              }
              onPlaying={
                active
                  ? () => {
                      setStartedClip(currentKey)
                    }
                  : undefined
              }
              onEnded={active ? finishClip : undefined}
              onError={active && !paused ? () => setFailedKey(currentKey) : undefined}
            />
          )
        })}
      <div
        className={`flex flex-wrap items-center gap-1 text-sm ${collapsed ? 'grow' : 'border-kid-line shrink-0 border-t pt-1'}`}
      >
        <Button
          type="button"
          variant="ghost"
          color="gray"
          size="2"
          disabled={previousIndex < 0}
          onClick={() => select(previousIndex)}
        >
          上一段
        </Button>
        <Button
          type="button"
          variant="solid"
          color="orange"
          size="2"
          className="min-w-16"
          onClick={togglePlayback}
        >
          {paused ? '播放' : failed ? '重试' : '暂停'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          color="gray"
          size="2"
          disabled={nextIndex >= clips.length}
          onClick={() => select(nextIndex)}
        >
          下一段
        </Button>
        <Button
          type="button"
          aria-expanded={settingsOpen}
          aria-controls="listening-settings"
          onClick={() => setSettingsOpen(!settingsOpen)}
          variant="ghost"
          color="gray"
          size="2"
          className="ml-auto"
        >
          设置 {settingsOpen ? '▴' : '▾'}
        </Button>
      </div>
      {settingsOpen && (
        <div
          id="listening-settings"
          className="border-kid-line order-last flex w-full shrink-0 flex-wrap items-center gap-x-5 border-t"
        >
          <label className={switchLabel}>
            <input
              type="checkbox"
              role="switch"
              className={switchInput}
              checked={translate}
              onChange={(e) => setTranslate(e.target.checked)}
            />
            显示翻译
          </label>
          <label className={switchLabel}>
            <input
              type="checkbox"
              role="switch"
              className={switchInput}
              checked={single}
              onChange={(e) => {
                const enabled = e.target.checked
                if (audio.current) audio.current.currentTime = enabled ? clip.singleRead[0] : 0
                setSingle(enabled)
              }}
            />
            只听一遍
          </label>
          {multiple ? (
            <span className="text-sm text-slate-600">已启用多段循环</span>
          ) : (
            <label className={switchLabel}>
              <input
                type="checkbox"
                role="switch"
                className={switchInput}
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
              />
              单段循环
            </label>
          )}
        </div>
      )}
    </section>
  )
}
