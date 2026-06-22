'use client'

import { useEffect } from 'react'
import type { GlossaryWord } from '@/utils/reading-data'
import SpeakButton from '@/components/english/words/SpeakButton'

interface Props {
  entry: GlossaryWord | null
  onClose: () => void
}

export default function GlossaryPopup({ entry, onClose }: Props) {
  useEffect(() => {
    if (!entry) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [entry, onClose])

  if (!entry) return null

  const ipaStr = entry.ipa ? entry.ipa.replace(/^\/|\/$/g, '') : null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 px-3 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="font-nunito relative w-full max-w-md animate-pop-in overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
          aria-label="关闭"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="px-5 pt-5 pb-5">
          <div className="mb-1.5 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
            <span>📒</span>
            <span>难点词查询</span>
            {entry.isProperNoun && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
                了解即可
              </span>
            )}
          </div>

          {/* Word + speaker + IPA */}
          <div className="flex items-center gap-2.5">
            <span className="font-fredoka text-[26px] font-extrabold text-slate-800 sm:text-[28px]">
              {entry.word}
            </span>
            <SpeakButton
              word={entry.word}
              size="text-[18px]"
              className="h-10 w-10 bg-slate-100 text-slate-700 hover:bg-slate-200"
            />
          </div>
          {ipaStr && (
            <div className="mt-0.5 font-mono text-[13px] text-slate-500">
              /{ipaStr}/
            </div>
          )}

          <div className="my-4 h-px bg-slate-100" />

          {/* Definitions */}
          {entry.meaningEn && (
            <div className="mb-2.5 flex items-baseline gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-sky-600">EN</span>
              <p className="flex-1 text-[14px] leading-relaxed text-slate-700">
                {entry.meaningEn}
              </p>
            </div>
          )}
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-rose-600">中</span>
            <p className="flex-1 text-[14px] font-bold leading-relaxed text-slate-800">
              {entry.meaningCn}
            </p>
          </div>

          {entry.category && (
            <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
              <span>📁</span>
              <span>{entry.category}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
