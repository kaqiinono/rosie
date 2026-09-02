'use client'

import Link from 'next/link'
import type {
  ReadingGrammarReference,
  ReadingGrammarSummary as ReadingGrammarSummaryData,
  ReadingGrammarSummaryCard,
} from '../../utils/reading-data'

interface Props {
  refs: ReadingGrammarReference[]
  summary: ReadingGrammarSummaryData
}

const CARD_STYLES = [
  'border-sky-200 bg-sky-50 text-sky-950',
  'border-violet-200 bg-violet-50 text-violet-950',
  'border-emerald-200 bg-emerald-50 text-emerald-950',
] as const

function SummaryCard({ card, index }: { card: ReadingGrammarSummaryCard; index: number }) {
  return (
    <article className={`rounded-2xl border p-4 ${CARD_STYLES[index % CARD_STYLES.length]}`}>
      <h4 className="font-fredoka text-lg font-black">{card.title}</h4>
      {card.formula && <p className="mt-1 text-sm font-bold opacity-75">{card.formula}</p>}
      {card.signals && (
        <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs font-bold">
          判断线索：{card.signals}
        </p>
      )}
      <div className="mt-3 space-y-2">
        {card.points.map((point) => (
          <div key={`${point.label}-${point.text}`}>
            <div className="text-xs font-black">{point.label}</div>
            <div className="text-sm leading-relaxed">{point.text}</div>
          </div>
        ))}
      </div>
    </article>
  )
}

export default function ReadingGrammarSummary({ refs, summary }: Props) {
  const primary = refs.find((ref) => ref.role === 'primary')
  const related = refs.filter((ref) => ref.role !== 'primary')

  return (
    <div className="space-y-4">
      <div className={`grid gap-3 ${summary.cards.length > 1 ? 'md:grid-cols-2' : ''}`}>
        {summary.cards.map((card, index) => (
          <SummaryCard key={card.title} card={card} index={index} />
        ))}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="text-sm font-black text-amber-900">⭐ {summary.contrastTitle}</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {summary.contrasts.map((contrast) => (
            <p key={contrast.example} className="rounded-xl bg-white/75 p-3 text-sm text-amber-950">
              <strong>{contrast.example}</strong><br />{contrast.note}
            </p>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <div className="text-sm font-black text-slate-800">一眼判断</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
          {summary.decisionGuide.map((item) => <li key={item}>{item}</li>)}
        </ul>
        {summary.reminders && summary.reminders.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600">
            {summary.reminders.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
      </div>

      {primary && (
        <Link
          href={`/english/grammar/${primary.book}/${primary.unitNumber}`}
          className="flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 text-center text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5"
        >
          📗 系统学习：剑桥 Essential Unit {primary.unitNumber} · {primary.label}
        </Link>
      )}
      {related.length > 0 && (
        <details className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <summary className="cursor-pointer text-sm font-bold text-slate-700">基础复习与扩展单元</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {related.map((ref) => (
              <Link
                key={`${ref.book}-${ref.unitNumber}`}
                href={`/english/grammar/${ref.book}/${ref.unitNumber}`}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                Unit {ref.unitNumber} · {ref.label}
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
