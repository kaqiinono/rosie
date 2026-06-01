'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { WordEntry, WordMasteryMap } from '@/utils/type'
import { buildQuizOptions, wordKey } from '@/utils/english-helpers'
import { getWordMasteryLevel } from '@/utils/masteryUtils'

interface ParagraphRecallQuizProps {
  paragraphText: string
  /** Lesson words eligible for this passage (already filtered by unit + lesson). */
  lessonWords: WordEntry[]
  masteryMap: WordMasteryMap
  /** Unique key for this paragraph; once answered we lock the quiz for this paragraph. */
  paragraphKey: string
  onAnswer: (entry: WordEntry, correct: boolean) => void
}

const SENTENCE_RE = /(?<=[.!?])\s+/

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function pickQuizTarget(
  paragraph: string,
  lessonWords: WordEntry[],
  masteryMap: WordMasteryMap,
): { entry: WordEntry; sentence: string } | null {
  const candidates: { entry: WordEntry; sentence: string; level: number; correct: number }[] = []
  const sentences = paragraph.split(SENTENCE_RE)
  for (const entry of lessonWords) {
    const m = masteryMap[wordKey(entry)]
    const level = getWordMasteryLevel(m?.correct ?? 0)
    if (level > 1) continue // only test unknown / learning words
    const re = new RegExp(`\\b${escapeRe(entry.word)}s?\\b`, 'i')
    const hit = sentences.find((s) => re.test(s))
    if (hit) candidates.push({ entry, sentence: hit, level, correct: m?.correct ?? 0 })
  }
  if (!candidates.length) return null
  // Lowest level first, then lowest correct count, then first encountered
  candidates.sort((a, b) => a.level - b.level || a.correct - b.correct)
  const chosen = candidates[0]
  return { entry: chosen.entry, sentence: chosen.sentence }
}

function blankSentence(sentence: string, word: string): string {
  const re = new RegExp(`\\b${escapeRe(word)}s?\\b`, 'i')
  return sentence.replace(re, '_______')
}

function highlightWord(sentence: string, word: string) {
  const re = new RegExp(`\\b${escapeRe(word)}s?\\b`, 'i')
  const m = sentence.match(re)
  if (!m || m.index === undefined) return sentence
  return (
    <>
      {sentence.slice(0, m.index)}
      <span className="rounded bg-emerald-200 px-1 font-extrabold text-emerald-900">
        {sentence.slice(m.index, m.index + m[0].length)}
      </span>
      {sentence.slice(m.index + m[0].length)}
    </>
  )
}

export default function ParagraphRecallQuiz({
  paragraphText,
  lessonWords,
  masteryMap,
  paragraphKey,
  onAnswer,
}: ParagraphRecallQuizProps) {
  const target = useMemo(
    () => pickQuizTarget(paragraphText, lessonWords, masteryMap),
    // Stable per paragraph — masteryMap intentionally NOT in deps so the
    // question doesn't switch underfoot once an answer is recorded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paragraphText, lessonWords, paragraphKey],
  )

  const options = useMemo(() => {
    if (!target) return []
    // deterministic seed per paragraph so options don't reshuffle
    const seed = paragraphKey.split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 7) >>> 0
    return buildQuizOptions(target.entry, lessonWords.length >= 4 ? lessonWords : lessonWords, seed)
  }, [target, lessonWords, paragraphKey])

  const [answered, setAnswered] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [correct, setCorrect] = useState<boolean | null>(null)

  // Reveal the quiz only when the learner has scrolled ~80% past the paragraph.
  // We watch a tiny anchor placed where the quiz would appear; an IntersectionObserver
  // with a generous downward rootMargin fires the reveal slightly before the anchor
  // would otherwise enter the viewport.
  const anchorRef = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    if (revealed) return
    const node = anchorRef.current
    if (!node) return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setRevealed(true)
            obs.disconnect()
            return
          }
        }
      },
      { threshold: 0.01, rootMargin: '0px 0px 25% 0px' },
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [revealed])

  if (!target) return null
  if (!revealed) {
    // Reserve a minimal placeholder so layout doesn't shift when revealed.
    return <div ref={anchorRef} aria-hidden className="h-1" />
  }

  const handlePick = (option: WordEntry) => {
    if (answered) return
    const isCorrect = option.word === target.entry.word
    setAnswered(true)
    setSelected(option.word)
    setCorrect(isCorrect)
    onAnswer(target.entry, isCorrect)
  }

  return (
    <div
      className={`rounded-2xl border-2 p-4 transition-all ${
        answered
          ? correct
            ? 'border-emerald-300 bg-emerald-50/80'
            : 'border-rose-200 bg-rose-50/60'
          : 'border-amber-200 bg-amber-50/70'
      }`}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-base">💭</span>
        <span className="text-[12px] font-extrabold tracking-wide text-amber-700 uppercase">
          段落回想 · 还记得这个词吗？
        </span>
      </div>

      <div className="mb-3 rounded-xl bg-white/70 px-3 py-2 text-[14px] leading-relaxed text-gray-800">
        {answered
          ? highlightWord(target.sentence, target.entry.word)
          : `"${blankSentence(target.sentence, target.entry.word)}"`}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => {
          const isCorrectOpt = o.word === target.entry.word
          const isSel = selected === o.word
          let cls = 'bg-white text-gray-800 border-gray-200 hover:border-amber-400 hover:bg-amber-50'
          if (answered) {
            if (isCorrectOpt) {
              cls = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold'
            } else if (isSel) {
              cls = 'bg-rose-100 text-rose-700 border-rose-300'
            } else {
              cls = 'bg-gray-50 text-gray-400 border-gray-200'
            }
          }
          return (
            <button
              key={o.word}
              disabled={answered}
              onClick={() => handlePick(o)}
              className={`cursor-pointer rounded-xl border-2 px-3 py-2 text-left text-[13px] font-bold transition-all disabled:cursor-default ${cls}`}
            >
              {o.word}
            </button>
          )
        })}
      </div>

      {answered && (
        <div
          className={`mt-2.5 flex items-center gap-1.5 text-[12px] font-bold ${
            correct ? 'text-emerald-700' : 'text-rose-600'
          }`}
        >
          {correct ? (
            <>
              <span>✓</span>
              <span>答对了！该词已强化记忆。</span>
            </>
          ) : (
            <>
              <span>✗</span>
              <span>
                正确答案是 <strong className="text-rose-700">{target.entry.word}</strong>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
