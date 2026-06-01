'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { WordEntry, WordMasteryMap } from '@/utils/type'
import type { ReadingPassage } from '@/utils/reading-data'
import { buildWordMatchRegex, resolveMatchedWord } from '@/utils/reading-data'
import { wordKey } from '@/utils/english-helpers'
import { getWordMasteryLevel, type MasteryLevel } from '@/utils/masteryUtils'
import WordPopup from './WordPopup'

interface PassageViewProps {
  passage: ReadingPassage
  lessonWords: WordEntry[]
  masteryMap: WordMasteryMap
  focusWord?: string | null
  /** Optional render slot injected at the end of each paragraph (e.g. recall quiz). */
  renderParagraphFooter?: (paragraphIndex: number) => ReactNode
}

const LEVEL_CLASS: Record<MasteryLevel, string> = {
  0: 'bg-amber-200 text-amber-900 border-b-2 border-amber-500 hover:bg-amber-300',
  1: 'bg-sky-100 text-sky-900 border-b-2 border-sky-400 hover:bg-sky-200',
  2: 'bg-violet-100 text-violet-900 border-b border-violet-400 hover:bg-violet-200',
  3: 'bg-emerald-50 text-emerald-800 border-b border-emerald-300 hover:bg-emerald-100',
}

function slugForWord(word: string, paragraphIndex: number, occurrence: number): string {
  const slug = word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `pw-${paragraphIndex}-${slug}-${occurrence}`
}

export default function PassageView({
  passage,
  lessonWords,
  masteryMap,
  focusWord,
  renderParagraphFooter,
}: PassageViewProps) {
  const [selected, setSelected] = useState<WordEntry | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const regex = useMemo(
    () => buildWordMatchRegex(lessonWords.map((w) => w.word)),
    [lessonWords],
  )

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

  const renderParagraph = (text: string, paragraphIndex: number): ReactNode => {
    if (!regex) return text
    // Reset regex state (it has /g flag in some constructions)
    const re = new RegExp(regex.source, regex.flags)
    const parts: ReactNode[] = []
    const occurrenceMap = new Map<string, number>() // lowercased word → next occurrence index
    let lastIndex = 0
    let m: RegExpExecArray | null

    while ((m = re.exec(text)) !== null) {
      if (m.index > lastIndex) {
        parts.push(text.slice(lastIndex, m.index))
      }
      const matched = m[0]
      const entry = resolveMatchedWord(matched, lessonWords)
      if (!entry) {
        parts.push(matched)
      } else {
        const level = getWordMasteryLevel(masteryMap[wordKey(entry)]?.correct ?? 0)
        const occKey = entry.word.toLowerCase()
        const occ = occurrenceMap.get(occKey) ?? 0
        occurrenceMap.set(occKey, occ + 1)
        const id = slugForWord(entry.word, paragraphIndex, occ)
        parts.push(
          <button
            key={`${id}-${m.index}`}
            id={id}
            onClick={() => setSelected(entry)}
            className={`relative inline cursor-pointer rounded-md px-1 py-0.5 font-bold transition-colors ${LEVEL_CLASS[level]}`}
          >
            {matched}
          </button>,
        )
      }
      lastIndex = m.index + matched.length
      if (m.index === re.lastIndex) re.lastIndex++ // safeguard against empty matches
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex))
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
    </div>
  )
}
