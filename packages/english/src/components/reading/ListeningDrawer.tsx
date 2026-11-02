'use client'

import { useEffect, useRef, useState } from 'react'
import type { ListeningClip } from '../../utils/listening-clips'

// Keep three seconds of the recorded writing pause after the first reading.
const SINGLE_READ_WAIT_SECONDS = 3

type Props = {
  passageKey: string
  clips: ListeningClip[]
  index: number
  select: (index: number) => void
  close: () => void
}

export default function ListeningDrawer({ passageKey, clips, index, select, close }: Props) {
  const [choosing, setChoosing] = useState(false)
  const pickerButton = useRef<HTMLButtonElement>(null)
  const selectedOption = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (choosing) selectedOption.current?.focus()
  }, [choosing])
  const [single, setSingle] = useState(false)
  const [loop, setLoop] = useState(false)
  const [translate, setTranslate] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<'loading' | 'playing' | 'paused' | 'error'>('loading')
  const audio = useRef<HTMLAudioElement>(null)
  const clip = clips[index]
  const [startedClip, setStartedClip] = useState('')
  const currentKey = passageKey + '-' + index
  useEffect(() => {
    const el = audio.current
    if (!el) return
    let current = true
    if (el.error) el.load()
    setState('loading')
    void el.play().catch(() => { if (current) setState('error') })
    return () => {
      current = false
      el.pause()
    }
  }, [index, attempt, passageKey])
  const button = 'min-h-11 rounded-xl bg-slate-100 px-3 font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-40'
  const option = 'min-h-10 rounded-lg px-2 text-sm font-semibold text-slate-600 aria-pressed:bg-white aria-pressed:text-orange-800 aria-pressed:shadow-sm'
  return (
    <section id="reading-listening-drawer" aria-label="听记练习" className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[52dvh] max-w-2xl flex-col overflow-y-auto rounded-t-3xl border border-orange-200 bg-white px-4 pt-3 text-slate-900 sm:px-6 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-orange-100 pb-2">
        <div className="flex items-center gap-3 font-bold text-slate-900">
          <span>🎧 听记</span>
          <button ref={pickerButton} aria-label={`选择听记片段，当前第 ${index + 1} 段`}
            aria-expanded={choosing} aria-controls="listening-clip-options"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-orange-50 px-4 text-sm font-bold tabular-nums text-orange-900 ring-1 ring-inset ring-orange-200 hover:bg-orange-100"
            onClick={() => setChoosing(!choosing)}>
            第 {String(index + 1).padStart(2, '0')} / {clips.length} 段
            <svg aria-hidden="true" viewBox="0 0 12 8" className={`w-3 transition-transform ${choosing ? 'rotate-180' : ''}`}><path d="m1 1 5 5 5-5" stroke="currentColor" fill="none" strokeWidth="1.5" /></svg>
          </button>
        </div>
        <button className="min-h-11 px-2 text-sm font-bold text-slate-600" onClick={close}>收起</button>
      </header>
      <div id="listening-clip-options" hidden={!choosing} aria-label="听记片段" role="group"
        onKeyDown={e => {
          if (e.key === 'Escape') {
            setChoosing(false)
            pickerButton.current?.focus()
          }
        }}
        className="my-2 min-h-16 overflow-y-auto overscroll-contain rounded-xl border border-orange-100 bg-orange-50/40 p-1">
        {clips.map((item, i) => (
          <button key={i} ref={i === index ? selectedOption : undefined} aria-current={i === index || undefined}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-slate-700 hover:bg-orange-50 focus-visible:outline-orange-600 aria-current:bg-orange-100 aria-current:font-bold aria-current:text-orange-900"
            onClick={() => {
              select(i)
              setChoosing(false)
              pickerButton.current?.focus()
            }}>
            <span className="font-bold tabular-nums text-orange-800">{String(i + 1).padStart(2, '0')}</span>
            <span lang="en" className="min-w-0 flex-1 truncate">{item.english}</span>
            {i === index && <span aria-hidden="true">✓</span>}
          </button>
        ))}
      </div>
      <div hidden={choosing} className="my-3 min-h-16 overflow-y-auto border-l-4 border-amber-300 pl-3">
        <p lang="en" className="text-xl leading-snug font-bold text-slate-900">{clip.english}</p>
        {translate && <p className="mt-2 text-slate-600">{clip.chinese}</p>}
        <button className="mt-1 min-h-8 text-xs font-semibold text-orange-800 underline underline-offset-4" onClick={() => setTranslate(!translate)}>{translate ? '隐藏翻译' : '显示翻译'}</button>
        {state === 'error' && <p role="alert">这段音频暂时无法播放，请重试。</p>}
      </div>
      {[index, index + 1].filter(i => i < clips.length).map(i => {
        const active = i === index
        const number = String(i + 1).padStart(2, '0')
        return (
          <audio key={passageKey + '-' + i} ref={active ? audio : undefined}
            src={'/api/baidu/audio/' + passageKey + '?clip=' + number}
            preload={active || startedClip === currentKey ? 'auto' : 'none'}
            loop={active && loop && !single}
            onLoadedMetadata={active && single ? e => { e.currentTarget.currentTime = clips[i].singleRead[0] } : undefined}
            onPlay={active && single ? e => {
              const el = e.currentTarget
              const [start, end] = clip.singleRead
              if (el.currentTime < start || el.currentTime >= end + SINGLE_READ_WAIT_SECONDS) el.currentTime = start
            } : undefined}
            onTimeUpdate={active && single ? e => {
              const el = e.currentTarget
              if (el.paused || el.currentTime < clip.singleRead[1] + SINGLE_READ_WAIT_SECONDS) return
              if (!loop) el.pause()
              el.currentTime = clip.singleRead[0]
            } : undefined}
            onPlaying={active ? () => {
              setState('playing')
              setStartedClip(currentKey)
            } : undefined}
            onPause={active ? () => setState('paused') : undefined}
            onEnded={active ? () => setState('paused') : undefined}
            onWaiting={active ? () => setState('loading') : undefined}
            onError={active ? () => setState('error') : undefined}
          />
        )
      })}
      <div className="grid shrink-0 grid-cols-[1fr_1.3fr_1fr] gap-2 text-sm">
        <button className={button} disabled={!index} onClick={() => select(index - 1)}>上一段</button>
        <button className="min-h-11 rounded-xl bg-orange-700 px-4 font-bold text-white hover:bg-orange-800" onClick={() => {
          if (state === 'playing') audio.current?.pause()
          else if (state === 'paused') void audio.current?.play().catch(() => setState('error'))
          else if (state === 'error') setAttempt(n => n + 1)
        }} disabled={state === 'loading'}>{state === 'loading' ? <span aria-label="正在加载" className="inline-block size-4 animate-spin rounded-full border-2 border-orange-200 border-t-orange-700" /> : state === 'playing' ? '暂停' : state === 'error' ? '重试' : '播放'}</button>
        <button className={button} disabled={index === clips.length - 1} onClick={() => select(index + 1)}>下一段</button>
      </div>
      <div className="mt-2 grid shrink-0 grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        <button aria-pressed={single} className={option} onClick={() => {
          const el = audio.current
          if (el) el.currentTime = single ? 0 : clip.singleRead[0]
          setSingle(!single)
        }}>只听一遍{single ? ' · 开' : ' · 关'}</button>
        <button aria-pressed={loop} className={option} onClick={() => setLoop(!loop)}>单段循环{loop ? ' · 开' : ' · 关'}</button>
      </div>
    </section>
  )
}
