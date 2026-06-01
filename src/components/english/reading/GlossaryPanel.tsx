'use client'

import { useMemo, useState } from 'react'
import type { GlossaryWord } from '@/utils/reading-data'
import SpeakButton from '@/components/english/words/SpeakButton'
import GlossaryPopup from './GlossaryPopup'

interface Props {
  open: boolean
  onClose: () => void
  glossary: GlossaryWord[]
}

const CATEGORY_EMOJI: Record<string, string> = {
  '动植物与自然': '🦒',
  '户外活动与地理计量': '🏃',
  '学校与日常核心词': '🏫',
  '超纲词汇': '📚',
  '专有名词': '📍',
}

export default function GlossaryPanel({ open, onClose, glossary }: Props) {
  const [selected, setSelected] = useState<GlossaryWord | null>(null)

  const groups = useMemo(() => {
    const map = new Map<string, GlossaryWord[]>()
    for (const g of glossary) {
      const cat = g.category ?? '其他'
      const list = map.get(cat) ?? []
      list.push(g)
      map.set(cat, list)
    }
    return Array.from(map.entries())
  }, [glossary])

  if (!open || glossary.length === 0) return null

  return (
    <>
      <div className="mb-5 rounded-2xl bg-gradient-to-br from-slate-50 to-stone-50 p-4 ring-1 ring-slate-200">
        <div className="mb-2.5 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base">📒</span>
            <h3 className="text-sm font-extrabold text-slate-800">
              难点词汇 · {glossary.length} 个
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/70 text-slate-500 ring-1 ring-slate-200 transition hover:bg-white hover:text-slate-700"
            aria-label="关闭难点词"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mb-3 text-[12px] leading-relaxed text-slate-600">
          课文里有虚线下划线的就是这些词,点一下可以听发音和查意思
        </p>

        <div className="space-y-3">
          {groups.map(([cat, words]) => (
            <div key={cat}>
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                <span>{CATEGORY_EMOJI[cat] ?? '📁'}</span>
                <span>{cat}</span>
                {cat === '专有名词' && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
                    了解即可
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {words.map((g) => (
                  <button
                    key={g.word}
                    onClick={() => setSelected(g)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2 text-left ring-1 ring-slate-200 transition hover:-translate-y-px hover:ring-slate-300 hover:shadow-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className={`font-fredoka text-[15px] font-extrabold text-slate-800 ${g.isProperNoun ? 'italic' : ''}`}>
                          {g.word}
                        </span>
                        {g.ipa && (
                          <span className="font-mono text-[11px] text-slate-500">
                            /{g.ipa.replace(/^\/|\/$/g, '')}/
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-slate-600">
                        {g.meaningCn}
                      </div>
                    </div>
                    <SpeakButton
                      word={g.word}
                      size="text-[14px]"
                      className="h-8 w-8 shrink-0 bg-slate-100 text-slate-700 hover:bg-slate-200"
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <GlossaryPopup entry={selected} onClose={() => setSelected(null)} />
    </>
  )
}
