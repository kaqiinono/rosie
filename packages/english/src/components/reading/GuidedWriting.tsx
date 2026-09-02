'use client'

import { useMemo, useState } from 'react'
import type { ReadingWritingSection } from '../../utils/reading-data'

export default function GuidedWriting({ section }: { section: ReadingWritingSection }) {
  const [draft, setDraft] = useState('')
  const sentenceCount = useMemo(
    () => draft.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean).length,
    [draft],
  )

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-950 ring-1 ring-orange-200">
        {section.prompt}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {section.questions.map((question, index) => (
          <div key={question} className="rounded-xl bg-white p-3 text-sm text-slate-700 ring-1 ring-slate-200">
            <span className="mr-2 font-black text-orange-500">{index + 1}</span>{question}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {section.suggestedWords.map((word) => (
          <span key={word} className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800">{word}</span>
        ))}
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600">
          <label htmlFor={`${section.id}-draft`}>写下至少五句话</label>
          <span className={sentenceCount >= 5 ? 'text-emerald-600' : ''}>{sentenceCount} / 5 句</span>
        </div>
        <textarea
          id={`${section.id}-draft`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={7}
          placeholder="The Great Wall is a famous place in China..."
          className="w-full resize-y rounded-2xl border border-slate-200 bg-white p-4 text-base leading-7 text-slate-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
        />
      </div>
      <details className="rounded-xl bg-app-green-light p-4 ring-1 ring-app-green/35">
        <summary className="min-h-11 cursor-pointer py-2 text-base font-black text-app-green-dark">
          查看五句话范文
        </summary>
        <div className="mt-2 space-y-3 rounded-xl bg-surface p-4 text-base leading-7 font-semibold text-text-primary shadow-sm ring-1 ring-border-light">
          {section.modelAnswer.map((sentence, index) => (
            <p key={sentence} className="flex items-start gap-3">
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-app-green-light text-xs font-black text-app-green-dark" aria-hidden="true">
                {index + 1}
              </span>
              <span>{sentence}</span>
            </p>
          ))}
        </div>
      </details>
    </div>
  )
}
