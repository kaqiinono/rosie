'use client'

import { useRef, useState } from 'react'
import { StickerCard } from '@rosie/ui'
import { Button } from '@rosie/ui/themes'
import ListeningClipPicker from './ListeningClipPicker'
import ListeningClipText from './ListeningClipText'

type Props = {
  clips: readonly { id: string; text: string }[]
  index: number
  playbackId: string | null
  playing: boolean
  loading: boolean
  error: string
  largeText: boolean
  onSelect: (index: number) => void
  onPlay: (ids: string[]) => void
  onStop: () => void
  onClose: () => void
}

export default function StoryListeningPanel({ clips, index, playbackId, playing, loading, error, largeText, onSelect, onPlay, onStop, onClose }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const pickerButton = useRef<HTMLButtonElement>(null)
  const playbackIndex = clips.findIndex(({ id }) => id === playbackId)
  const currentIndex = playbackIndex >= 0 ? playbackIndex : index
  const current = clips[currentIndex]
  const first = selected[0] ?? 0
  const last = selected.at(-1) ?? clips.length - 1

  function changeRange(next: number[]) {
    onStop()
    setSelected(next)
    onSelect(next[0] ?? currentIndex)
  }

  function move(offset: -1 | 1) {
    onStop()
    onSelect(currentIndex + offset)
  }

  return (
    <StickerCard as="section" id="reading-listening-drawer" aria-label="故事逐句模式" tone="paper" size="sm"
      data-story-reading-controls
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)_+_0.75rem)] z-50 mx-auto flex max-h-[52dvh] max-w-2xl flex-col gap-2 overflow-y-auto">
      <header className="flex shrink-0 flex-wrap items-center gap-2">
        <h2 className={`font-bold text-text-primary ${largeText ? 'text-lg' : ''}`}>逐句模式</h2>
        {current && <Button ref={pickerButton} type="button" variant="ghost" color="gray" size="2"
          aria-label={`选择逐句音频，当前第 ${currentIndex + 1} 句`}
          aria-expanded={choosing && !collapsed} aria-controls={choosing ? 'story-listening-options' : undefined}
          className={`tabular-nums ${largeText ? 'text-lg' : ''}`} onClick={() => {
            setCollapsed(false)
            setChoosing((open) => !open)
          }}>
          第 {currentIndex + 1} / {clips.length} 句{selected.length > 0 && ` · 已选 ${selected.length}`}
        </Button>}
        {current && <Button type="button" variant="ghost" color="gray" size="2" className={`ml-auto ${largeText ? 'text-lg' : ''}`}
          aria-expanded={!collapsed} onClick={() => {
            setChoosing(false)
            setCollapsed((closed) => !closed)
          }}>{collapsed ? '展开' : '收起'}</Button>}
        <Button type="button" variant="ghost" color="gray" size="2" aria-label="关闭逐句模式"
          className={`${current ? '' : 'ml-auto'} ${largeText ? 'text-lg' : ''}`} onClick={onClose}>关闭</Button>
      </header>
      {current && choosing && !collapsed && (
        <ListeningClipPicker id="story-listening-options" texts={clips.map(({ text }) => text)} unit="句"
          currentIndex={currentIndex} selected={selected} onChange={changeRange} largeText={largeText}
          onDismiss={() => {
            setChoosing(false)
            pickerButton.current?.focus()
          }} />
      )}
      {current && !collapsed && !choosing && <div className="min-h-10 overflow-y-auto">
        <ListeningClipText english={current.text} largeText={largeText} />
      </div>}
      {error && <p role="alert" className="text-sm font-bold text-rose-700">{error}</p>}
      {!current && !error && (
        <p role="status" className="text-sm text-text-secondary">
          {loading ? '正在读取逐句时间轴…' : '当前录音暂无可逐句播放的内容。'}
        </p>
      )}
      {current && <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button type="button" size="2" variant="soft" color="gray" className={largeText ? 'text-lg' : undefined} disabled={currentIndex <= first}
          onClick={() => move(-1)}>上一句</Button>
        <Button type="button" size="2" variant="solid" color="orange" className={largeText ? 'text-lg' : undefined} onClick={() => {
          if (playing) {
            onStop()
            onSelect(currentIndex)
          }
          else onPlay(selected.length ? clips.slice(first, last + 1).map(({ id }) => id) : [current.id])
        }}>{playing ? '停止' : selected.length ? '播放已选' : '播放'}</Button>
        <Button type="button" size="2" variant="soft" color="gray" className={largeText ? 'text-lg' : undefined} disabled={currentIndex >= last}
          onClick={() => move(1)}>下一句</Button>
      </div>}
    </StickerCard>
  )
}
