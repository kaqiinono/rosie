'use client'

import { useState, useCallback, useEffect } from 'react'
import type { WordEntry } from '@/utils/type'
import { findPassage, findSentenceForWord } from '@/utils/reading-data'
import PhonicsWord from './PhonicsWord'
import SpellTiles from './SpellTiles'
import SpeakButton from './SpeakButton'

function blankWordInSentence(sentence: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\b(${escaped})s?\\b`, 'i')
  return sentence.replace(re, '_______')
}

interface QuizCardProps {
  question: { word: WordEntry; type: 'A' | 'B' | 'C' | 'D' }
  options: WordEntry[]
  currentIndex: number
  totalCount: number
  score: number
  onAnswer: (correct: boolean) => void
  onNext: () => void
}

export default function QuizCard({
  question,
  options,
  currentIndex,
  totalCount,
  score,
  onAnswer,
  onNext,
}: QuizCardProps) {
  const [answered, setAnswered] = useState(false)
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null)
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [spellCorrect, setSpellCorrect] = useState<boolean | null>(null)
  const [isExiting, setIsExiting] = useState(false)
  const [showPassageHint, setShowPassageHint] = useState(false)
  const [prevIndex, setPrevIndex] = useState(currentIndex)
  if (prevIndex !== currentIndex) {
    setPrevIndex(currentIndex)
    setIsExiting(false)
    setShowPassageHint(false)
  }

  // Passage lookup is shared across two features:
  //   - Type D rendering (挖空原句 question body)
  //   - Pre-answer "查看课文情境" hint modal for types A/B/C
  const passage = findPassage(question.word.stage, question.word.unit, question.word.lesson)
  const passageSentence = passage ? findSentenceForWord(passage, question.word.word) : null
  const hasPassageContext = passage !== undefined && passageSentence !== null
  // Type D specifically needs the sentence to render the blanked-question UI.
  const dPassage = question.type === 'D' ? passage : null
  const dSentence = question.type === 'D' ? passageSentence : null

  const handleNext = useCallback(() => {
    setIsExiting(true)
    setTimeout(onNext, 150)
  }, [onNext])

  useEffect(() => {
    if (answered && wasCorrect === true) {
      const t = setTimeout(handleNext, 600)
      return () => clearTimeout(t)
    }
  }, [answered, wasCorrect, handleNext])

  const handleMC = useCallback(
    (chosen: string) => {
      if (answered) return
      const correct = chosen === question.word.word
      setAnswered(true)
      setWasCorrect(correct)
      setSelectedWord(chosen)
      onAnswer(correct)
    },
    [answered, onAnswer, question.word.word],
  )

  const handleSpell = useCallback(
    (val: string) => {
      if (answered) return
      const correct = val.trim().toLowerCase() === question.word.word.toLowerCase()
      setAnswered(true)
      setWasCorrect(correct)
      setSpellCorrect(correct)
      onAnswer(correct)
    },
    [answered, onAnswer, question.word.word],
  )

  const badgeConfig = {
    A: {
      text: '题型 A：看释义 → 选单词',
      cls: 'bg-[rgba(233,69,96,.2)] text-[var(--wm-accent)] border border-[rgba(233,69,96,.3)]',
    },
    B: {
      text: '题型 B：看单词 → 选释义',
      cls: 'bg-[rgba(96,165,250,.2)] text-[var(--wm-accent4)] border border-[rgba(96,165,250,.3)]',
    },
    C: {
      text: '题型 C：看释义 → 默写单词',
      cls: 'bg-[rgba(245,166,35,.2)] text-[var(--wm-accent2)] border border-[rgba(245,166,35,.3)]',
    },
    D: {
      text: '📖 题型 D：课文语境填空',
      cls: 'bg-[rgba(245,158,11,.18)] text-[#fbbf24] border border-[rgba(245,158,11,.35)]',
    },
  }[question.type]

  const pct = (currentIndex / totalCount) * 100

  // Pre-answer "查看课文情境" hint — available for types A/B/C when the word
  // has passage context. Type D already shows the blanked sentence inline.
  const showHintAvailable = !answered && hasPassageContext && question.type !== 'D'
  const passageHintButton = showHintAvailable ? (
    <button
      onClick={() => setShowPassageHint(true)}
      className="font-nunito mb-3 flex w-fit cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-amber-400 bg-amber-50 px-3 py-1.5 text-[clamp(.78rem,2.4cqi,.9rem)] font-bold text-amber-700 transition-all hover:-translate-y-px hover:bg-amber-100"
    >
      📖 查看课文情境 · 提示
    </button>
  ) : null

  return (
    <div className={`@container w-full transition-opacity duration-150 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
      <div className="mb-4">
        <div className="mb-2 h-2 overflow-hidden rounded-sm bg-[var(--wm-surface)]">
          <div
            className="h-full rounded-sm bg-gradient-to-r from-[var(--wm-accent)] to-[var(--wm-accent2)] transition-[width] duration-400 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-[clamp(.72rem,2cqi,.82rem)] font-bold text-[var(--wm-text-dim)]">
          <span>
            第 {currentIndex + 1} / {totalCount} 题
          </span>
          <span className="rounded-full border border-[rgba(74,222,128,.3)] bg-[rgba(74,222,128,.15)] px-2.5 py-0.5 font-extrabold text-[var(--wm-accent3)]">
            ✓ {score}
          </span>
        </div>
      </div>

      <div key={currentIndex} className="mb-3 rounded-[var(--wm-radius)] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-[clamp(.9rem,3.5cqi,1.5rem)] animate-fade-up">
        <div
          className={`mb-3 inline-block rounded-full px-2.5 py-1 text-[clamp(.65rem,1.8cqi,.75rem)] font-extrabold tracking-wide uppercase ${badgeConfig.cls}`}
        >
          {badgeConfig.text}
        </div>

        {question.type === 'A' && (
          <>
            <div className="mb-1 text-[clamp(1rem,4cqi,1.4rem)] leading-snug font-black">
              {question.word.explanation}
            </div>
            <div className="mb-4 text-[clamp(.8rem,2.5cqi,.95rem)] text-[var(--wm-text-dim)]">
              请选出对应的英文单词或短语：
            </div>
            {passageHintButton}
            <div className="grid grid-cols-1 gap-[clamp(.4rem,1.5cqi,.6rem)] @lg:grid-cols-2">
              {options.map((o) => {
                const isCorrect = o.word === question.word.word
                const isSelected = selectedWord === o.word
                let btnCls =
                  'bg-[var(--wm-surface2)] border-[var(--wm-border)] text-[var(--wm-text)]'
                if (answered) {
                  if (isCorrect)
                    btnCls =
                      'border-[var(--wm-accent3)] bg-[rgba(74,222,128,.15)] text-[var(--wm-accent3)]'
                  else if (isSelected)
                    btnCls =
                      'border-[var(--wm-accent)] bg-[rgba(233,69,96,.15)] text-[var(--wm-accent)]'
                }
                return (
                  <button
                    key={o.word}
                    disabled={answered}
                    onClick={() => handleMC(o.word)}
                    className={`font-nunito cursor-pointer rounded-[10px] border-2 px-[clamp(.6rem,2cqi,.9rem)] py-[clamp(.7rem,2.5cqi,1rem)] text-left text-[clamp(.88rem,3cqi,1rem)] leading-snug font-bold break-words transition-all disabled:cursor-default ${btnCls} ${
                      !answered
                        ? 'hover:border-[var(--wm-accent4)] hover:bg-[rgba(96,165,250,.1)]'
                        : ''
                    }`}
                  >
                    {o.word}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {question.type === 'B' && (
          <>
            <div className="mb-1 text-[clamp(2rem,4cqi,1.4rem)] leading-snug font-black">
              <div className="flex items-center gap-2">
                <PhonicsWord text={question.word.word} syllables={question.word.syllables} />
                <SpeakButton word={question.word.word} className="opacity-50 hover:opacity-100 shrink-0" />
              </div>
              {question.word.ipa && (
                <div className="mt-1 text-[clamp(.8rem,2.5cqi,.95rem)] font-semibold text-[var(--wm-accent2)] italic">
                  {question.word.ipa}
                </div>
              )}
            </div>
            <div className="mb-4 text-[clamp(.8rem,2.5cqi,.95rem)] text-[var(--wm-text-dim)]">
              请选出正确的释义：
            </div>
            {passageHintButton}
            <div className="grid grid-cols-1 gap-[clamp(.4rem,1.5cqi,.6rem)] @lg:grid-cols-2">
              {options.map((o) => {
                const isCorrect = o.word === question.word.word
                const isSelected = selectedWord === o.word
                let btnCls =
                  'bg-[var(--wm-surface2)] border-[var(--wm-border)] text-[var(--wm-text)]'
                if (answered) {
                  if (isCorrect)
                    btnCls =
                      'border-[var(--wm-accent3)] bg-[rgba(74,222,128,.15)] text-[var(--wm-accent3)]'
                  else if (isSelected)
                    btnCls =
                      'border-[var(--wm-accent)] bg-[rgba(233,69,96,.15)] text-[var(--wm-accent)]'
                }
                return (
                  <button
                    key={o.word}
                    disabled={answered}
                    onClick={() => handleMC(o.word)}
                    className={`font-nunito cursor-pointer rounded-[10px] border-2 px-[clamp(.6rem,2cqi,.9rem)] py-[clamp(.7rem,2.5cqi,1rem)] text-left text-[clamp(1.1rem,4cqi,2rem)] leading-snug font-bold break-words transition-all disabled:cursor-default ${btnCls} ${
                      !answered
                        ? 'hover:border-[var(--wm-accent4)] hover:bg-[rgba(96,165,250,.1)]'
                        : ''
                    }`}
                  >
                    {o.explanation}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {question.type === 'C' && (
          <>
            <div className="mb-1 text-[clamp(1.2rem,4cqi,1.4rem)] leading-snug font-black">
              {question.word.explanation}
            </div>
            <div className="mb-4 text-[clamp(.8rem,2.5cqi,.95rem)] text-[var(--wm-text-dim)]">
              请拼写出对应的英文单词或短语：
            </div>
            {passageHintButton}
            <SpellTiles
              key={currentIndex}
              word={question.word.word}
              onSubmit={handleSpell}
              answered={answered}
              isCorrect={spellCorrect}
            />
          </>
        )}

        {question.type === 'D' && dSentence && (
          <>
            <div className="mb-3 rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 px-4 py-3">
              <div className="mb-1.5 text-[clamp(.6rem,1.7cqi,.7rem)] font-extrabold tracking-[.14em] text-amber-700 uppercase">
                📖 来自 {question.word.unit} · {question.word.lesson} 课文
              </div>
              <div className="text-[clamp(1.05rem,3.2cqi,1.4rem)] leading-relaxed font-bold text-amber-950">
                “{blankWordInSentence(dSentence.sentence, question.word.word)}”
              </div>
            </div>
            <div className="mb-3 text-[clamp(.8rem,2.5cqi,.95rem)] text-[var(--wm-text-dim)]">
              请选出填入空格的单词或短语：
            </div>
            <div className="grid grid-cols-1 gap-[clamp(.4rem,1.5cqi,.6rem)] @lg:grid-cols-2">
              {options.map((o) => {
                const isCorrect = o.word === question.word.word
                const isSelected = selectedWord === o.word
                let btnCls =
                  'bg-[var(--wm-surface2)] border-[var(--wm-border)] text-[var(--wm-text)]'
                if (answered) {
                  if (isCorrect)
                    btnCls =
                      'border-[var(--wm-accent3)] bg-[rgba(74,222,128,.15)] text-[var(--wm-accent3)]'
                  else if (isSelected)
                    btnCls =
                      'border-[var(--wm-accent)] bg-[rgba(233,69,96,.15)] text-[var(--wm-accent)]'
                }
                return (
                  <button
                    key={o.word}
                    disabled={answered}
                    onClick={() => handleMC(o.word)}
                    className={`font-nunito cursor-pointer rounded-[10px] border-2 px-[clamp(.6rem,2cqi,.9rem)] py-[clamp(.7rem,2.5cqi,1rem)] text-left text-[clamp(.88rem,3cqi,1rem)] leading-snug font-bold break-words transition-all disabled:cursor-default ${btnCls} ${
                      !answered ? 'hover:border-[var(--wm-accent4)] hover:bg-[rgba(96,165,250,.1)]' : ''
                    }`}
                  >
                    {o.word}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {answered && wasCorrect === false && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-[10px] border border-[var(--wm-accent3)] bg-[rgba(74,222,128,.08)] px-4 py-2.5 text-[clamp(.88rem,3cqi,1rem)] font-bold text-[var(--wm-accent3)]">
            <span className="text-[.75rem] font-extrabold uppercase tracking-wide opacity-60">正确答案</span>
            <span className="ml-1">{question.word.word}</span>
            <SpeakButton word={question.word.word} size="text-[1rem]" className="opacity-60 hover:opacity-100" />
          </div>
          <button
            onClick={handleNext}
            className="font-nunito flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border-2 border-[var(--wm-border)] bg-[var(--wm-surface2)] py-[clamp(.75rem,2.5cqi,1rem)] text-[clamp(.88rem,3cqi,1rem)] font-bold text-[var(--wm-text)] transition-all hover:border-[var(--wm-accent4)] hover:bg-[rgba(96,165,250,.1)]"
          >
            下一题 →
          </button>
        </div>
      )}

      {/* Pre-answer passage hint modal */}
      {showPassageHint && passageSentence && passage && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 px-3 backdrop-blur-sm sm:items-center"
          onClick={() => setShowPassageHint(false)}
        >
          <div
            className="font-nunito relative w-full max-w-md animate-pop-in overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPassageHint(false)}
              className="absolute top-3 right-3 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
              aria-label="关闭"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <div className="px-5 pt-5 pb-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-base">📖</span>
                <span className="text-[12px] font-extrabold tracking-[.14em] text-amber-700 uppercase">
                  来自 {question.word.unit} · {question.word.lesson} 课文
                </span>
              </div>
              <div className="rounded-xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 px-4 py-4 text-[1.1rem] leading-relaxed font-bold text-amber-950">
                &ldquo;{blankWordInSentence(passageSentence.sentence, question.word.word)}&rdquo;
              </div>
              <div className="mt-3 text-center text-[11px] text-gray-500">
                根据课文情境，选出最合适的答案 ✨
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
