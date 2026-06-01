'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { WordEntry, WordMasteryMap } from '@/utils/type'
import { buildQuizOptions, wordKey } from '@/utils/english-helpers'
import { getWordMasteryLevel } from '@/utils/masteryUtils'
import SpeakButton from '@/components/english/words/SpeakButton'

interface ParagraphRecallQuizProps {
  paragraphText: string
  /** Lesson words eligible for this passage (already filtered by unit + lesson). */
  lessonWords: WordEntry[]
  masteryMap: WordMasteryMap
  /** Unique key for this paragraph; once answered we lock the quiz for this paragraph. */
  paragraphKey: string
  onAnswer: (entry: WordEntry, correct: boolean) => void
  /** Recall counts per word key. Picker prefers lowest count → keeps rotating
   *  through rounds rather than excluding. */
  recallCounts?: Record<string, number>
}

const SENTENCE_RE = /(?<=[.!?])\s+/

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function pickQuizTarget(
  paragraph: string,
  lessonWords: WordEntry[],
  masteryMap: WordMasteryMap,
  recallCounts?: Record<string, number>,
): { entry: WordEntry; sentence: string } | null {
  const candidates: {
    entry: WordEntry
    sentence: string
    level: number
    correct: number
    recalls: number
  }[] = []
  const sentences = paragraph.split(SENTENCE_RE)
  for (const entry of lessonWords) {
    const m = masteryMap[wordKey(entry)]
    const level = getWordMasteryLevel(m?.correct ?? 0)
    const recalls = recallCounts?.[wordKey(entry)] ?? 0
    const re = new RegExp(`\\b${escapeRe(entry.word)}s?\\b`, 'i')
    const hit = sentences.find((s) => re.test(s))
    if (hit) candidates.push({ entry, sentence: hit, level, correct: m?.correct ?? 0, recalls })
  }
  if (!candidates.length) return null
  // Round-rotating priority: fewest recalls first, then lowest mastery,
  // then least-correct. Never excludes — always rotates onto next round.
  candidates.sort(
    (a, b) => a.recalls - b.recalls || a.level - b.level || a.correct - b.correct,
  )
  const chosen = candidates[0]
  return { entry: chosen.entry, sentence: chosen.sentence }
}

function blankSentence(sentence: string, word: string): string {
  const re = new RegExp(`\\b${escapeRe(word)}s?\\b`, 'i')
  return sentence.replace(re, '_______')
}

function highlightedSentence(sentence: string, word: string, tone: 'emerald' | 'rose'): ReactNode {
  const re = new RegExp(`\\b${escapeRe(word)}s?\\b`, 'i')
  const m = sentence.match(re)
  if (!m || m.index === undefined) return sentence
  const cls =
    tone === 'emerald'
      ? 'rounded-md bg-emerald-200 px-1.5 py-0.5 font-extrabold text-emerald-900 shadow-sm ring-1 ring-emerald-300'
      : 'rounded-md bg-rose-100 px-1.5 py-0.5 font-extrabold text-rose-700 ring-2 ring-rose-300'
  return (
    <>
      {sentence.slice(0, m.index)}
      <span className={cls}>{sentence.slice(m.index, m.index + m[0].length)}</span>
      {sentence.slice(m.index + m[0].length)}
    </>
  )
}

const CONFETTI_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#22d3ee']

export default function ParagraphRecallQuiz({
  paragraphText,
  lessonWords,
  masteryMap,
  paragraphKey,
  onAnswer,
  recallCounts,
}: ParagraphRecallQuizProps) {
  const target = useMemo(
    () => pickQuizTarget(paragraphText, lessonWords, masteryMap, recallCounts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paragraphText, lessonWords, paragraphKey],
  )

  const options = useMemo(() => {
    if (!target) return []
    const seed = paragraphKey.split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 7) >>> 0
    return buildQuizOptions(target.entry, lessonWords, seed)
  }, [target, lessonWords, paragraphKey])

  const [opened, setOpened] = useState(false)
  const [answered, setAnswered] = useState(false)
  const [selected, setSelected] = useState<WordEntry | null>(null)
  const [correct, setCorrect] = useState<boolean | null>(null)

  // Esc to close modal
  useEffect(() => {
    if (!opened) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpened(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [opened])

  if (!target) return null

  const handlePick = (option: WordEntry) => {
    if (answered) return
    const isCorrect = option.word === target.entry.word
    setAnswered(true)
    setSelected(option)
    setCorrect(isCorrect)
    onAnswer(target.entry, isCorrect)
  }

  const ipaStr = target.entry.ipa ? target.entry.ipa.replace(/^\/|\/$/g, '') : null

  const retry = () => {
    setAnswered(false)
    setSelected(null)
    setCorrect(null)
    setOpened(true)
  }

  // ── Inline pill ───────────────────────────────────────────────────────────
  // - pending: dashed CTA "段落回想 · 测一下"
  // - correct: hidden — the cottage-floral mark on the word in the passage
  //   is the only feedback the learner needs in review mode.
  // - wrong:   two-row card. Top = word + IPA + 🔊, bottom = English meaning
  //   over Chinese. Click anywhere to retry.
  const Pill = (() => {
    if (!answered) {
      return (
        <button
          onClick={() => setOpened(true)}
          className="group flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-left transition hover:border-amber-400 hover:bg-amber-50 active:scale-[0.99]"
        >
          <span className="flex items-center gap-2 text-[13px] font-bold text-amber-800">
            <span className="text-base">💭</span>
            段落回想 · 测一下你刚读的内容
          </span>
          <span className="text-amber-600 transition group-hover:translate-x-1">→</span>
        </button>
      )
    }
    if (correct) {
      // Hidden on page — visual feedback lives on the word itself (🌸 mark).
      return null
    }
    return (
      <button
        onClick={retry}
        className="group flex w-full items-stretch gap-2.5 rounded-xl border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-amber-50 px-3 py-2.5 text-left transition hover:-translate-y-px hover:border-rose-300 hover:shadow-sm active:scale-[0.99] sm:gap-3"
      >
        <div className="flex shrink-0 flex-col items-center justify-start pt-0.5">
          <span className="text-[20px] leading-none sm:text-[22px]">💩</span>
        </div>
        <div className="flex-1 min-w-0">
          {/* Row 1: word + speaker (always 一行,长词允许换行) */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-fredoka text-[16px] font-extrabold text-rose-700 sm:text-[17px]">
              {target.entry.word}
            </span>
            <SpeakButton
              word={target.entry.word}
              size="text-[14px]"
              className="h-7 w-7 bg-rose-100 text-rose-700 hover:bg-rose-200"
            />
          </div>
          {/* Row 2: IPA on its own line — never crowds the word */}
          {ipaStr && (
            <div className="font-mono text-[11px] leading-snug text-gray-500 sm:text-[12px]">
              /{ipaStr}/
            </div>
          )}
          {/* Row 3: English meaning */}
          <div className="mt-1 text-[12px] leading-snug text-gray-700">
            {target.entry.explanation}
          </div>
          {/* Row 4: Chinese meaning */}
          {target.entry.chineseDef && (
            <div className="text-[12px] leading-snug text-rose-700/80">
              {target.entry.chineseDef}
            </div>
          )}
          {/* Retry hint — always visible on touch, subtle on desktop */}
          <div className="mt-1.5 flex justify-end text-[10px] font-bold uppercase tracking-wider text-rose-500/70 transition group-hover:text-rose-500">
            再试一次 →
          </div>
        </div>
      </button>
    )
  })()

  return (
    <>
      {Pill}

      {opened && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 px-3 backdrop-blur-sm sm:items-center"
          onClick={() => setOpened(false)}
        >
          <div
            className="font-nunito relative w-full max-w-md animate-pop-in overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpened(false)}
              className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
              aria-label="关闭"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {/* QUIZ */}
            {!answered && (
              <div className="px-5 pt-5 pb-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-base">💭</span>
                  <span className="text-[12px] font-extrabold tracking-wide text-amber-700 uppercase">
                    段落回想 · 还记得这个词吗?
                  </span>
                </div>
                <div className="mb-4 rounded-xl bg-amber-50/70 px-3 py-3 text-[15px] leading-relaxed text-gray-800 ring-1 ring-amber-200">
                  &ldquo;{blankSentence(target.sentence, target.entry.word)}&rdquo;
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {options.map((o) => (
                    <button
                      key={o.word}
                      onClick={() => handlePick(o)}
                      className="cursor-pointer rounded-xl border-2 border-gray-200 bg-white px-3 py-3 text-left text-[14px] font-bold text-gray-800 transition-all hover:-translate-y-px hover:border-amber-400 hover:bg-amber-50 hover:shadow-sm"
                    >
                      {o.word}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CORRECT */}
            {answered && correct && (
              <div className="relative overflow-hidden px-5 pt-6 pb-5">
                <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center" aria-hidden>
                  {CONFETTI_COLORS.flatMap((c, i) =>
                    [0, 1].map((j) => (
                      <span
                        key={`${i}-${j}`}
                        className="absolute h-2 w-2 rounded-full"
                        style={{
                          background: c,
                          left: `${10 + i * 14 + j * 6}%`,
                          top: '0',
                          animation: `confetti-fall 1.8s ease-out ${i * 0.08 + j * 0.04}s forwards`,
                        }}
                      />
                    )),
                  )}
                </div>
                <div className="relative flex flex-col items-center text-center">
                  <div className="mb-2 flex h-14 w-14 animate-star-pop items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-lg ring-4 ring-emerald-200">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden>
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="font-fredoka text-[22px] font-extrabold text-emerald-700">太棒了!</div>
                  <div className="mt-0.5 text-[12px] font-bold text-emerald-600">回想成功 · 掌握度 +1 ⭐</div>

                  <div className="mt-3 flex items-center gap-2 rounded-full bg-emerald-100/80 px-3 py-1">
                    <span className="font-extrabold text-emerald-800">{target.entry.word}</span>
                    {ipaStr && <span className="font-mono text-[12px] text-emerald-700">/{ipaStr}/</span>}
                    <SpeakButton word={target.entry.word} size="text-[16px]" className="h-6 w-6 bg-white text-emerald-700 hover:bg-emerald-50" />
                  </div>
                  <div className="mt-1 text-[13px] text-emerald-700/80">{target.entry.explanation}</div>

                  <div className="mt-3 w-full rounded-xl bg-white px-4 py-3 text-[14px] leading-relaxed text-gray-800 ring-1 ring-emerald-200">
                    {highlightedSentence(target.sentence, target.entry.word, 'emerald')}
                  </div>
                </div>
              </div>
            )}

            {/* WRONG */}
            {answered && !correct && (
              <div className="px-5 pt-6 pb-5">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-500 ring-2 ring-rose-200">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                      <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-fredoka text-[16px] font-extrabold text-rose-700">差一点 — 多看看这个词</div>
                    {selected && (
                      <div className="mt-0.5 text-[11px] text-rose-500">
                        你选了 <span className="font-bold text-rose-600">{selected.word}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Correct answer card */}
                <div className="mb-3 rounded-xl bg-white p-4 ring-2 ring-emerald-300 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-fredoka text-[26px] font-extrabold text-emerald-700">{target.entry.word}</span>
                      <SpeakButton word={target.entry.word} size="text-[18px]" className="h-9 w-9 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" />
                    </div>
                    {ipaStr && <span className="font-mono text-[13px] text-gray-500">/{ipaStr}/</span>}
                  </div>
                  <div className="mt-1 text-[14px] font-bold text-gray-700">{target.entry.explanation}</div>
                </div>

                {/* In-passage usage */}
                <div className="mb-3">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-amber-700 uppercase">
                    <span>📖</span><span>课文里这样用</span>
                  </div>
                  <div className="rounded-xl bg-amber-50/70 px-3 py-2 text-[14px] leading-relaxed text-gray-800 ring-1 ring-amber-200">
                    {highlightedSentence(target.sentence, target.entry.word, 'rose')}
                  </div>
                </div>

                {/* Bonus example */}
                {target.entry.example && (
                  <div>
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-sky-700 uppercase">
                      <span>💡</span><span>另一个例句</span>
                    </div>
                    <div className="rounded-xl bg-sky-50/70 px-3 py-2 text-[13px] leading-relaxed text-sky-900 ring-1 ring-sky-200">
                      {highlightedSentence(target.entry.example, target.entry.word, 'emerald')}
                    </div>
                  </div>
                )}

                <div className="mt-4 text-center text-[11px] text-gray-500">下次见到它就认识啦 ✨</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
