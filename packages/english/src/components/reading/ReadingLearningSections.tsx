'use client'

import { useCallback, useState } from 'react'
import type { WordEntry } from '@rosie/core'
import { StickerCard } from '@rosie/ui'
import { ExerciseView } from '../../grammar/components/ExerciseView'
import type { ReadingLearningSection } from '../../utils/reading-data'
import { resolveReadingWordRef } from '../../utils/reading-data'
import GuidedWriting from './GuidedWriting'
import ReadingGrammarSummary from './ReadingGrammarSummary'
import { Button } from '@rosie/ui/themes'

interface Props {
  sections: ReadingLearningSection[]
  vocab: WordEntry[]
  defaultOpen: boolean
  onWordClick: (entry: WordEntry) => void
}

const TONES = [
  'bg-sky-50 ring-sky-200',
  'bg-violet-50 ring-violet-200',
  'bg-amber-50 ring-amber-200',
  'bg-rose-50 ring-rose-200',
] as const

function tabLabel(section: ReadingLearningSection): string {
  if (section.id === 'reading-comprehension') return '总结'
  if (section.type === 'grammar') return '语法'
  if (section.id === 'place-vocabulary') return '词汇'
  if (section.type === 'writing') return '写作'
  return section.eyebrow
}

export default function ReadingLearningSections({
  sections,
  vocab,
  defaultOpen,
  onWordClick,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '')
  const handleResult = useCallback(() => undefined, [])
  const handlePreview = useCallback(() => undefined, [])
  const tabColumns =
    sections.length >= 4
      ? 'grid-cols-4'
      : sections.length === 3
        ? 'grid-cols-3'
        : sections.length === 2
          ? 'grid-cols-2'
          : 'grid-cols-1'

  if (sections.length === 0) return null

  return (
    <StickerCard as="section" tone="white" size="none" elevation="sm" className="mt-8 overflow-hidden">
      <button // native-ok: 整块可点击容器（内含多行内容），Radix Button 是 inline-flex 居中，不适用
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between bg-amber-100 px-5 py-4 text-left text-amber-950"
      >
        <span className="font-fredoka flex items-center gap-2.5 text-xl font-black">
          <span aria-hidden="true" className="h-5 w-1 rounded-full bg-amber-500" />
          本课总结与练习
        </span>
        <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-amber-200 text-amber-900">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className={`motion-safe:transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path d="m3 5.5 5 5 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="p-3 sm:p-4">
          <div
            role="tablist"
            aria-label="本课学习内容"
            className={`bg-surface-dim mb-3 grid gap-1.5 rounded-2xl p-1.5 sm:mb-4 sm:gap-2 sm:p-2 ${tabColumns}`}
          >
            {sections.map((section) => {
              const index = sections.findIndex((candidate) => candidate.id === section.id)
              const active = activeId === section.id
              return (
                <Button
                  key={section.id}
                  id={`reading-tab-${section.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`reading-panel-${section.id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setActiveId(section.id)}
                  onKeyDown={(event) => {
                    let nextIndex: number | null = null
                    if (event.key === 'ArrowRight') nextIndex = (index + 1) % sections.length
                    if (event.key === 'ArrowLeft')
                      nextIndex = (index - 1 + sections.length) % sections.length
                    if (event.key === 'Home') nextIndex = 0
                    if (event.key === 'End') nextIndex = sections.length - 1
                    if (nextIndex === null) return
                    event.preventDefault()
                    const next = sections[nextIndex]
                    setActiveId(next.id)
                    document.getElementById(`reading-tab-${next.id}`)?.focus()
                  }}
                  variant={active ? 'solid' : 'soft'}
                  color={active ? 'orange' : 'gray'}
                  size="3"
                  className="sm:text-base"
                >
                  {tabLabel(section)}
                </Button>
              )
            })}
          </div>

          <div>
            {sections.map((section, index) => (
              <article
                key={section.id}
                id={`reading-panel-${section.id}`}
                role="tabpanel"
                aria-labelledby={`reading-tab-${section.id}`}
                hidden={activeId !== section.id}
                className={`rounded-3xl p-4 ring-1 sm:p-6 ${TONES[index % TONES.length]}`}
              >
                <div className="mb-4">
                  <div className="text-xs font-black tracking-[.16em] text-slate-500 uppercase">
                    {section.eyebrow}
                  </div>
                  <h2 className="font-fredoka mt-1 text-xl font-black text-slate-900 sm:text-2xl">
                    {section.title}
                  </h2>
                  {section.type === 'exercises' && section.description && (
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {section.description}
                    </p>
                  )}
                </div>

                {section.type === 'grammar' && (
                  <ReadingGrammarSummary refs={section.grammarRefs} summary={section.summary} />
                )}

                {(section.type === 'exercises' || section.type === 'grammar') && (
                  <div className={section.type === 'grammar' ? 'mt-5' : ''}>
                    {section.type === 'exercises' && section.wordRefs && (
                      <div className="mb-4 flex flex-wrap gap-2">
                        {section.wordRefs.map((ref) => {
                          const entry = resolveReadingWordRef(ref, vocab)
                          return (
                            <Button
                              key={`${ref.stage}-${ref.unit}-${ref.lesson}-${ref.word}`}
                              type="button"
                              disabled={!entry}
                              onClick={() => entry && onWordClick(entry)}
                              variant="outline"
                              color="gray"
                              size="1"
                            >
                              {ref.word}
                            </Button>
                          )
                        })}
                      </div>
                    )}
                    <ExerciseView
                      groups={section.groups}
                      isAdmin={false}
                      pageImages={[]}
                      onGroupResult={handleResult}
                      onPreviewFigure={handlePreview}
                    />
                  </div>
                )}

                {section.type === 'writing' && <GuidedWriting section={section} />}
              </article>
            ))}
          </div>
        </div>
      )}
    </StickerCard>
  )
}
