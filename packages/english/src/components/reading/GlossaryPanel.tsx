'use client'

import { useEffect, useState } from 'react'
import type { GlossaryWord } from '../../utils/reading-data'
import SpeakButton from '../words/SpeakButton'
import { Button, IconButton, SegmentedControl } from '@rosie/ui/themes'
import { AppDialog, LearningIcon } from '@rosie/ui'

interface Props {
  open: boolean
  onClose: () => void
  glossary: GlossaryWord[]
  originalAudio: {
    sentenceIds: ReadonlyMap<string, string>
    activeId: string | null
    error: string
    onToggle: (sentenceId: string) => void
    onStop: () => void
  }
}

function GlossaryIpa({ ipa }: { ipa?: string }) {
  const text = ipa?.replace(/^\/|\/$/g, '')
  return text ? <span className="font-mono text-sm text-text-secondary">/{text}/</span> : null
}

export default function GlossaryPanel({ open, onClose, glossary, originalAudio }: Props) {
  const [index, setIndex] = useState(0)
  const [view, setView] = useState<'list' | 'card'>('card')

  useEffect(() => {
    if (!open || !glossary.length || view !== 'card') return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || (event.target instanceof Element && event.target.closest('[data-glossary-view-switch]'))) return
      if (event.key === 'ArrowLeft') setIndex((value) => Math.max(0, value - 1))
      if (event.key === 'ArrowRight') {
        setIndex((value) => Math.min(glossary.length - 1, value + 1))
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [glossary.length, open, view])

  const safeIndex = Math.min(index, Math.max(0, glossary.length - 1))
  const entry = glossary[safeIndex]
  if (!open || !entry) return null

  function renderAudioControls(word: string, size: '2' | '3') {
    const sentenceId = originalAudio.sentenceIds.get(word)
    const playing = sentenceId === originalAudio.activeId
    const label = playing ? '停止原句' : '听原句'
    return (
      <div className="flex shrink-0 items-center gap-1">
        <SpeakButton word={word} size={size} beforeSpeak={originalAudio.onStop} />
        {sentenceId && (
          <IconButton type="button" size={size} radius="full" color="orange"
            variant={playing ? 'solid' : 'ghost'} title={label} aria-label={`${label}：${word}`}
            onClick={() => originalAudio.onToggle(sentenceId)}>
            <LearningIcon name={playing ? 'pause' : 'listen'} size={size === '3' ? 20 : 16} />
          </IconButton>
        )}
      </div>
    )
  }

  return (
    <AppDialog
      open
      chrome="none"
      title="本章难点词"
      footer={originalAudio.error ? (
        <p role="alert" className="px-5 pb-3 text-sm font-bold text-rose-700">{originalAudio.error}</p>
      ) : undefined}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <div className="font-nunito relative">
        <div className="sticky top-0 z-10 border-b border-kid-line bg-amber-50 px-5 pt-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-text-primary">
              本章难点词 · {glossary.length} 项
            </span>
            <IconButton
              type="button"
              onClick={onClose}
              aria-label="关闭难点词"
              variant="outline"
              color="gray"
              size="2"
              className="w-10"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </IconButton>
          </div>
          <SegmentedControl.Root
            data-glossary-view-switch
            aria-label="难点词显示方式"
            className="mt-3"
            value={view}
            onValueChange={(value) => {
              if (value === 'list' || value === 'card') setView(value)
            }}
          >
            <SegmentedControl.Item value="list">列表</SegmentedControl.Item>
            <SegmentedControl.Item value="card">卡片</SegmentedControl.Item>
          </SegmentedControl.Root>
        </div>
        {view === 'list' ? (
          <ul aria-label="本章难点词列表" className="divide-y divide-kid-line px-5">
            {glossary.map((item, itemIndex) => (
              <li key={`${item.word}-${itemIndex}`} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span lang="en" className="font-bold text-text-primary">{item.word}</span>
                    <GlossaryIpa ipa={item.ipa} />
                    <span className="text-sm text-text-primary">{item.meaningCn}</span>
                  </div>
                  {item.meaningEn && <p lang="en" className="mt-1 text-sm text-text-secondary">{item.meaningEn}</p>}
                </div>
                {renderAudioControls(item.word, '2')}
              </li>
            ))}
          </ul>
        ) : <>
        <div className="bg-amber-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <h2 className="font-fredoka min-w-0 text-3xl font-black text-slate-900">
              {entry.word}
            </h2>
            {renderAudioControls(entry.word, '3')}
          </div>
          {entry.ipa && <p className="mt-1"><GlossaryIpa ipa={entry.ipa} /></p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {entry.category && (
              <span className="ring-kid-line rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 ring-1">
                {entry.category}
              </span>
            )}
            {entry.isProperNoun && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                专有名词 · 了解即可
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          {entry.meaningEn && (
            <div>
              <p className="text-[11px] font-extrabold tracking-wider text-sky-600 uppercase">
                English
              </p>
              <p className="mt-1 text-base leading-relaxed text-slate-700">{entry.meaningEn}</p>
            </div>
          )}
          <div>
            <p className="text-[11px] font-extrabold tracking-wider text-rose-600 uppercase">
              中文
            </p>
            <p className="mt-1 text-base leading-relaxed font-bold text-slate-800">
              {entry.meaningCn}
            </p>
          </div>
        </div>

        <nav className="border-kid-line grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t px-5 py-4">
          <Button
            type="button"
            disabled={safeIndex === 0}
            onClick={() => setIndex((value) => value - 1)}
            variant="ghost"
            color="sky"
            size="3"
            className="justify-self-start"
          >
            ← 上一张
          </Button>
          <span className="text-xs font-bold text-slate-500 tabular-nums" aria-live="polite">
            {safeIndex + 1} / {glossary.length}
          </span>
          <Button
            type="button"
            disabled={safeIndex === glossary.length - 1}
            onClick={() => setIndex((value) => value + 1)}
            variant="ghost"
            color="sky"
            size="3"
            className="justify-self-end"
          >
            下一张 →
          </Button>
        </nav>
        </>}
      </div>
    </AppDialog>
  )
}
