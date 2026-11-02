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
  const button = 'min-h-11 rounded-xl px-3 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40'
  const [settingsOpen, setSettingsOpen] = useState(false)
  const switchLabel = 'inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-slate-700'
  const switchInput = 'h-4 w-7 shrink-0 cursor-pointer appearance-none rounded-full bg-slate-300 p-0.5 before:block before:size-3 before:rounded-full before:bg-white before:shadow-sm checked:bg-orange-700 checked:before:translate-x-3 focus-visible:outline-2 focus-visible:outline-offset-2'

  return (
    <section id="reading-listening-drawer" aria-label="听记练习" className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[52dvh] max-w-2xl flex-col overflow-y-auto rounded-t-3xl border border-orange-200 bg-white px-4 pt-3 text-slate-900 sm:px-6 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-orange-100 pb-2">
        <div className="flex items-center gap-3 font-bold text-slate-900">
          <span>🎧 听记</span>
          <button ref={pickerButton} aria-label={`选择听记片段，当前第 ${index + 1} 段`}
            aria-expanded={choosing} aria-controls="listening-clip-options"
            className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-medium tabular-nums text-slate-600 hover:bg-slate-50"
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
      <div hidden={choosing} className="my-2 min-h-16 overflow-y-auto py-4 sm:py-6">
        <p lang="en" className="text-2xl leading-snug font-semibold text-slate-900 sm:text-3xl">{clip.english}</p>
        {translate && <p className="mt-2 text-slate-600">{clip.chinese}</p>}
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
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-t border-slate-100 pt-1 text-sm">
        <button className={button} disabled={!index} onClick={() => select(index - 1)}>上一段</button>
        <button className="min-h-11 min-w-16 rounded-full px-3 font-bold text-orange-800 hover:bg-orange-50" onClick={() => {
          if (state === 'playing') audio.current?.pause()
          else if (state === 'paused') void audio.current?.play().catch(() => setState('error'))
          else if (state === 'error') setAttempt(n => n + 1)
        }} disabled={state === 'loading'}>{state === 'loading' ? <span aria-label="正在加载" className="inline-block size-4 animate-spin rounded-full border-2 border-orange-200 border-t-orange-700" /> : state === 'playing' ? '暂停' : state === 'error' ? '重试' : '播放'}</button>
        <button className={button} disabled={index === clips.length - 1} onClick={() => select(index + 1)}>下一段</button>
        <button aria-expanded={settingsOpen} aria-controls="listening-settings" onClick={() => setSettingsOpen(!settingsOpen)}
          className="ml-auto min-h-11 px-2 text-sm text-slate-600 hover:text-orange-800">设置 {settingsOpen ? '▴' : '▾'}</button>
      </div>
      {settingsOpen && (
        <div id="listening-settings" className="flex shrink-0 flex-wrap items-center gap-x-5 border-t border-slate-100">
          <label className={switchLabel}><input type="checkbox" role="switch" className={switchInput} checked={translate} onChange={e => setTranslate(e.target.checked)} />显示翻译</label>
          <label className={switchLabel}><input type="checkbox" role="switch" className={switchInput} checked={single} onChange={e => {
            const enabled = e.target.checked
            if (audio.current) audio.current.currentTime = enabled ? clip.singleRead[0] : 0
            setSingle(enabled)
          }} />只听一遍</label>
          <label className={switchLabel}><input type="checkbox" role="switch" className={switchInput} checked={loop} onChange={e => setLoop(e.target.checked)} />单段循环</label>
        </div>
      )}
    </section>
  )
}
