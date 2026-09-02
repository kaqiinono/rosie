'use client'

import { useCallback, useState } from 'react'
import type { WordEntry } from '@rosie/core'
import { ExerciseView } from '../../grammar/components/ExerciseView'
import type { ReadingLearningSection } from '../../utils/reading-data'
import { resolveReadingWordRef } from '../../utils/reading-data'
import GuidedWriting from './GuidedWriting'
import ReadingGrammarSummary from './ReadingGrammarSummary'

interface Props {
  sections: ReadingLearningSection[]
  vocab: WordEntry[]
  defaultOpen: boolean
  onWordClick: (entry: WordEntry) => void
}

const TONES = [
  'from-sky-50 to-cyan-50 ring-sky-200',
  'from-violet-50 to-fuchsia-50 ring-violet-200',
  'from-amber-50 to-orange-50 ring-amber-200',
  'from-rose-50 to-pink-50 ring-rose-200',
] as const

function tabLabel(section: ReadingLearningSection): string {
  if (section.id === 'reading-comprehension') return '总结'
  if (section.type === 'grammar') return '语法'
  if (section.id === 'place-vocabulary') return '词汇'
  if (section.type === 'writing') return '写作'
  return section.eyebrow
}

export default function ReadingLearningSections({ sections, vocab, defaultOpen, onWordClick }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '')
  const handleResult = useCallback(() => undefined, [])
  const handlePreview = useCallback(() => undefined, [])
  const tabColumns = sections.length >= 4
    ? 'grid-cols-4'
    : sections.length === 3
      ? 'grid-cols-3'
      : sections.length === 2
        ? 'grid-cols-2'
        : 'grid-cols-1'

  if (sections.length === 0) return null

  return (
    <section className="mt-8 overflow-hidden rounded-3xl bg-surface shadow-sm ring-1 ring-border-light">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between bg-gradient-to-r from-orange-400 to-amber-400 px-5 py-4 text-left text-white"
      >
        <span>
          <span className="block text-xs font-black tracking-widest uppercase opacity-80">Lesson workshop</span>
          <span className="font-fredoka text-xl font-black">本课总结与练习</span>
        </span>
        <span className={`text-2xl transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>

      {open && (
        <div className="p-3 sm:p-4">
          <div
            role="tablist"
            aria-label="本课学习内容"
            className={`mb-3 grid gap-1.5 rounded-2xl bg-surface-dim p-1.5 sm:mb-4 sm:gap-2 sm:p-2 ${tabColumns}`}
          >
            {sections.map((section) => {
              const index = sections.findIndex((candidate) => candidate.id === section.id)
              const active = activeId === section.id
              return (
                <button
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
                    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + sections.length) % sections.length
                    if (event.key === 'Home') nextIndex = 0
                    if (event.key === 'End') nextIndex = sections.length - 1
                    if (nextIndex === null) return
                    event.preventDefault()
                    const next = sections[nextIndex]
                    setActiveId(next.id)
                    document.getElementById(`reading-tab-${next.id}`)?.focus()
                  }}
                  className={`min-h-11 cursor-pointer rounded-xl px-2 py-2 text-sm font-black transition-[background-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-blue sm:text-base ${
                    active
                      ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white shadow-sm'
                      : 'text-text-secondary hover:bg-surface-dim hover:text-text-primary active:scale-[.98]'
                  }`}
                >
                  {tabLabel(section)}
                </button>
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
              className={`rounded-3xl bg-gradient-to-br p-4 ring-1 sm:p-6 ${TONES[index % TONES.length]}`}
            >
              <div className="mb-4">
                <div className="text-xs font-black tracking-[.16em] text-slate-500 uppercase">{section.eyebrow}</div>
                <h2 className="mt-1 font-fredoka text-xl font-black text-slate-900 sm:text-2xl">{section.title}</h2>
                {section.type === 'exercises' && section.description && (
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{section.description}</p>
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
                          <button
                            key={`${ref.stage}-${ref.unit}-${ref.lesson}-${ref.word}`}
                            type="button"
                            disabled={!entry}
                            onClick={() => entry && onWordClick(entry)}
                            className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {ref.word}
                          </button>
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
    </section>
  )
}
