'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { WordEntry, WordMasteryMap } from '@/utils/type'
import type { GlossaryWord, ReadingPassage } from '@/utils/reading-data'
import {
  buildGlossaryRegex,
  buildWordMatchRegex,
  resolveGlossaryMatch,
  resolveMatchedWord,
} from '@/utils/reading-data'
import { wordKey } from '@/utils/english-helpers'
import { getWordMasteryLevel, type MasteryLevel } from '@/utils/masteryUtils'
import WordPopup from './WordPopup'
import GlossaryPopup from './GlossaryPopup'

interface PassageViewProps {
  passage: ReadingPassage
  lessonWords: WordEntry[]
  masteryMap: WordMasteryMap
  focusWord?: string | null
  /**
   * Per-word recall outcome (keyed by `wordKey(entry)`).
   * Drives the cute floral / 粑粑 decoration on matched words.
   */
  recallOutcomes?: Record<string, 'correct' | 'wrong'>
  /** Cross-session recall count per word key. Renders ✓ⁿ subtly on word capsules. */
  recallCounts?: Record<string, number>
  /** Reading mode — drives capsule styling intensity.
   *  'learn' = full color capsule. 'focus' = subtle bold + tint, no bg. */
  mode?: 'learn' | 'focus'
  /** Optional render slot injected at the end of each paragraph (e.g. recall quiz). */
  renderParagraphFooter?: (paragraphIndex: number) => ReactNode
}

const LEVEL_CLASS: Record<MasteryLevel, string> = {
  0: 'bg-amber-200 text-amber-900 border-b-2 border-amber-500 hover:bg-amber-300',
  1: 'bg-sky-100 text-sky-900 border-b-2 border-sky-400 hover:bg-sky-200',
  2: 'bg-violet-100 text-violet-900 border-b border-violet-400 hover:bg-violet-200',
  3: 'bg-emerald-50 text-emerald-800 border-b border-emerald-300 hover:bg-emerald-100',
}

// Focus mode — minimal: no bg, bold + a mastery-tinted text color so the kid
// still sees "this is a key word" but the reading flow isn't interrupted.
const LEVEL_CLASS_FOCUS: Record<MasteryLevel, string> = {
  0: 'font-extrabold text-amber-700 hover:bg-amber-50',
  1: 'font-extrabold text-sky-700 hover:bg-sky-50',
  2: 'font-extrabold text-violet-700 hover:bg-violet-50',
  3: 'font-extrabold text-emerald-700 hover:bg-emerald-50',
}

function slugForWord(word: string, paragraphIndex: number, occurrence: number): string {
  const slug = word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `pw-${paragraphIndex}-${slug}-${occurrence}`
}

const SUP_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹'
function toSuperscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUP_DIGITS[Number(d)] ?? d)
    .join('')
}

export default function PassageView({
  passage,
  lessonWords,
  masteryMap,
  focusWord,
  recallOutcomes,
  recallCounts,
  mode = 'learn',
  renderParagraphFooter,
}: PassageViewProps) {
  const levelClass = mode === 'focus' ? LEVEL_CLASS_FOCUS : LEVEL_CLASS
  const [selected, setSelected] = useState<WordEntry | null>(null)
  const [glossarySelected, setGlossarySelected] = useState<GlossaryWord | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const regex = useMemo(
    () => buildWordMatchRegex(lessonWords.map((w) => w.word)),
    [lessonWords],
  )

  const glossary = passage.glossary ?? []
  const glossaryRegex = useMemo(() => buildGlossaryRegex(glossary), [glossary])

  // Handle ?focus=<word> scroll-to-paragraph + flash.
  // Uses DOM class manipulation rather than React state to avoid a cascading
  // re-render for this transient visual effect.
  useEffect(() => {
    if (!focusWord || !containerRef.current) return
    const target = lessonWords.find((w) => w.word.toLowerCase() === focusWord.toLowerCase())
    if (!target) return
    const lower = target.word.toLowerCase()
    let id: string | null = null
    for (let pi = 0; pi < passage.paragraphs.length; pi++) {
      const test = new RegExp(`\\b${lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i')
      if (test.test(passage.paragraphs[pi])) {
        id = slugForWord(target.word, pi, 0)
        break
      }
    }
    if (!id) return
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('reading-flash')
    const t = setTimeout(() => el.classList.remove('reading-flash'), 2200)
    return () => {
      clearTimeout(t)
      el.classList.remove('reading-flash')
    }
  }, [focusWord, lessonWords, passage])

  // Scan plain (non-lessonWord) text for glossary matches and turn them into
  // gray dotted-underline buttons. Used for every text slice that isn't
  // claimed by the lessonWord pipeline, so the two pipelines never collide.
  const renderGlossary = (text: string, keyPrefix: string): ReactNode[] => {
    if (!glossaryRegex) return [text]
    const re = new RegExp(glossaryRegex.source, glossaryRegex.flags)
    const out: ReactNode[] = []
    let lastIdx = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      if (m.index > lastIdx) out.push(text.slice(lastIdx, m.index))
      const matched = m[0]
      const gw = resolveGlossaryMatch(matched, glossary)
      if (!gw) {
        out.push(matched)
      } else {
        // Proper nouns = italic + lighter underline; common difficulty words =
        // bolder dotted underline. Both stay color-neutral so they don't
        // compete visually with lessonWord capsules.
        const isProper = !!gw.isProperNoun
        const cls = isProper
          ? 'italic underline decoration-dotted decoration-slate-300 underline-offset-2 text-slate-700/85 hover:text-slate-900 hover:bg-slate-100/60'
          : 'underline decoration-dotted decoration-slate-400 underline-offset-2 text-slate-700/90 hover:text-slate-900 hover:bg-slate-100/60'
        out.push(
          <button
            key={`${keyPrefix}-g-${m.index}`}
            onClick={() => setGlossarySelected(gw)}
            className={`cursor-pointer rounded-sm px-0.5 transition-colors ${cls}`}
            title={`难点词 · ${gw.meaningCn}`}
          >
            {matched}
          </button>,
        )
      }
      lastIdx = m.index + matched.length
      if (m.index === re.lastIndex) re.lastIndex++
    }
    if (lastIdx < text.length) out.push(text.slice(lastIdx))
    return out
  }

  const renderParagraph = (text: string, paragraphIndex: number): ReactNode => {
    if (!regex) return renderGlossary(text, `p${paragraphIndex}`)
    // Reset regex state (it has /g flag in some constructions)
    const re = new RegExp(regex.source, regex.flags)
    const parts: ReactNode[] = []
    const occurrenceMap = new Map<string, number>() // lowercased word → next occurrence index
    let lastIndex = 0
    let m: RegExpExecArray | null

    while ((m = re.exec(text)) !== null) {
      if (m.index > lastIndex) {
        parts.push(
          ...renderGlossary(
            text.slice(lastIndex, m.index),
            `p${paragraphIndex}-pre${m.index}`,
          ),
        )
      }
      const matched = m[0]
      const entry = resolveMatchedWord(matched, lessonWords)
      if (!entry) {
        parts.push(...renderGlossary(matched, `p${paragraphIndex}-m${m.index}`))
      } else {
        const level = getWordMasteryLevel(masteryMap[wordKey(entry)]?.correct ?? 0)
        const occKey = entry.word.toLowerCase()
        const occ = occurrenceMap.get(occKey) ?? 0
        occurrenceMap.set(occKey, occ + 1)
        const id = slugForWord(entry.word, paragraphIndex, occ)
        // Focus mode skips per-session recall outcome decorations (🌸/💩) —
        // those belong to learn mode; focus is for distraction-free reading.
        const outcome = mode === 'focus' ? undefined : recallOutcomes?.[wordKey(entry)]
        const outcomeClass =
          outcome === 'correct' ? 'recall-mark-correct' : outcome === 'wrong' ? 'recall-mark-wrong' : ''
        const recalls = recallCounts?.[wordKey(entry)] ?? 0
        parts.push(
          <button
            key={`${id}-${m.index}`}
            id={id}
            onClick={() => setSelected(entry)}
            className={`relative inline cursor-pointer rounded-md px-1 py-0.5 font-bold transition-colors ${levelClass[level]} ${outcomeClass}`}
          >
            {matched}
            {recalls > 0 && (
              <span
                aria-hidden
                title={`已回想 ${recalls} 次`}
                className="ml-0.5 align-super text-[9px] font-extrabold leading-none text-emerald-600/70"
              >
                ✓{recalls >= 2 ? toSuperscript(recalls) : ''}
              </span>
            )}
          </button>,
        )
      }
      lastIndex = m.index + matched.length
      if (m.index === re.lastIndex) re.lastIndex++ // safeguard against empty matches
    }
    if (lastIndex < text.length) {
      parts.push(...renderGlossary(text.slice(lastIndex), `p${paragraphIndex}-tail`))
    }
    return parts
  }

  return (
    <div ref={containerRef} className="font-nunito">
      <article className="space-y-6 text-[17px] leading-[1.85] text-gray-800 sm:text-[18px] sm:leading-[2]">
        {passage.paragraphs.map((p, i) => (
          <div key={i}>
            <p className="break-words">{renderParagraph(p, i)}</p>
            {renderParagraphFooter && (
              <div className="mt-4">{renderParagraphFooter(i)}</div>
            )}
          </div>
        ))}
      </article>

      <WordPopup
        entry={selected}
        passage={passage}
        mastery={selected ? masteryMap[wordKey(selected)] : undefined}
        onClose={() => setSelected(null)}
      />

      <GlossaryPopup
        entry={glossarySelected}
        onClose={() => setGlossarySelected(null)}
      />
    </div>
  )
}
