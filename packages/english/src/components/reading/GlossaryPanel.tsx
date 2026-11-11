'use client'

import { useEffect, useState } from 'react'
import type { GlossaryWord } from '../../utils/reading-data'
import SpeakButton from '../words/SpeakButton'
import { Button, IconButton } from '@rosie/ui/themes'
import { AppDialog } from '@rosie/ui'

interface Props {
  open: boolean
  onClose: () => void
  glossary: GlossaryWord[]
}

export default function GlossaryPanel({ open, onClose, glossary }: Props) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') setIndex((value) => Math.max(0, value - 1))
      if (event.key === 'ArrowRight') {
        setIndex((value) => Math.min(glossary.length - 1, value + 1))
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [glossary.length, onClose, open])

  const safeIndex = Math.min(index, Math.max(0, glossary.length - 1))
  const entry = glossary[safeIndex]
  if (!open || !entry) return null
  const ipa = entry.ipa?.replace(/^\/|\/$/g, '')

  return (
    <AppDialog
      open
      chrome="none"
      title="本章难点词卡片"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <div className="font-nunito relative">
        <div className="bg-amber-50 px-5 pt-5 pb-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-extrabold tracking-wider text-slate-500 uppercase">
              本章难点词 · {safeIndex + 1}/{glossary.length}
            </span>
            <IconButton
              type="button"
              onClick={onClose}
              aria-label="关闭难点词卡片"
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
          <div className="mt-4 flex items-center gap-3">
            <h2 className="font-fredoka min-w-0 text-3xl font-black text-slate-900">
              {entry.word}
            </h2>
            <SpeakButton word={entry.word} size="3" className="shrink-0" />
          </div>
          {ipa && <p className="mt-1 font-mono text-sm text-slate-500">/{ipa}/</p>}
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
      </div>
    </AppDialog>
  )
}
