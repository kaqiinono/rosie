'use client'

import { useEffect, useRef, useState } from 'react'
import type { ListeningClip } from '../../utils/listening-clips'

type Props = {
  passageKey: string
  clips: ListeningClip[]
  index: number
  select: (index: number) => void
  close: () => void
}

export default function ListeningDrawer({ passageKey, clips, index, select, close }: Props) {
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
  const button = 'min-h-10 rounded-full bg-orange-50 px-3 font-bold text-orange-900 disabled:opacity-40'
  return (
    <section id="reading-listening-drawer" aria-label="听记练习" className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[45dvh] max-w-2xl flex-col rounded-t-3xl border border-orange-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
      <header className="flex items-center justify-between">
        <label className="font-bold">🎧 听记 <select aria-label="选择听记片段" value={index} onChange={e => select(Number(e.target.value))}>
          {clips.map((_, i) => <option key={i} value={i}>第 {String(i + 1).padStart(2, '0')} / {clips.length} 段</option>)}
        </select></label>
        <button className={button} onClick={close}>收起</button>
      </header>
      <div className="my-3 flex-1 overflow-auto">
        <p lang="en" className="text-xl font-semibold text-slate-900">{clip.english}</p>
        {translate && <p className="mt-2 text-slate-600">{clip.chinese}</p>}
        <button className="mt-2 text-sm text-orange-800 underline" onClick={() => setTranslate(!translate)}>{translate ? '隐藏翻译' : '显示翻译'}</button>
        {state === 'error' && <p role="alert">这段音频暂时无法播放，请重试。</p>}
      </div>
      {[index, index + 1].filter(i => i < clips.length).map(i => {
        const active = i === index
        const number = String(i + 1).padStart(2, '0')
        return (
          <audio key={passageKey + '-' + i} ref={active ? audio : undefined}
            src={'/api/baidu/audio/' + passageKey + '?clip=' + number}
            preload={active || startedClip === currentKey ? 'auto' : 'none'}
            loop={active && loop}
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
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <button className={button} disabled={!index} onClick={() => select(index - 1)}>上一段</button>
        <button className={button} onClick={() => {
          if (state === 'playing') audio.current?.pause()
          else if (state === 'paused') void audio.current?.play().catch(() => setState('error'))
          else if (state === 'error') setAttempt(n => n + 1)
        }} disabled={state === 'loading'}>{state === 'loading' ? <span aria-label="正在加载" className="inline-block size-4 animate-spin rounded-full border-2 border-orange-200 border-t-orange-700" /> : state === 'playing' ? '暂停' : state === 'error' ? '重试' : '播放'}</button>
        <button className={button} disabled={index === clips.length - 1} onClick={() => select(index + 1)}>下一段</button>
        <button aria-pressed={loop} className={button} onClick={() => setLoop(!loop)}>单段循环{loop ? ' · 开' : ' · 关'}</button>
      </div>
    </section>
  )
}
