'use client'

import { useState, useCallback, useEffect } from 'react'
import type { WordEntry } from '@/utils/type'
import PhonicsWord from './PhonicsWord'
import SpellTiles from './SpellTiles'

interface QuizCardProps {
  question: { word: WordEntry; type: 'A' | 'B' | 'C' }
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
  const [prevIndex, setPrevIndex] = useState(currentIndex)
  if (prevIndex !== currentIndex) {
    setPrevIndex(currentIndex)
    setAnswered(false)
    setWasCorrect(null)
    setSelectedWord(null)
    setSpellCorrect(null)
  }

  useEffect(() => {
    if (answered && wasCorrect === true) {
      const t = setTimeout(onNext, 600)
      return () => clearTimeout(t)
    }
  }, [answered, wasCorrect, onNext])

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
  }[question.type]

  const pct = (currentIndex / totalCount) * 100

  return (
    <div className="@container w-full">
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

      <div className="mb-3 rounded-[var(--wm-radius)] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-[clamp(.9rem,3.5cqi,1.5rem)]">
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
              <PhonicsWord text={question.word.word} />
              {question.word.ipa && (
                <div className="mt-1 text-[clamp(.8rem,2.5cqi,.95rem)] font-semibold text-[var(--wm-accent2)] italic">
                  {question.word.ipa}
                </div>
              )}
            </div>
            <div className="mb-4 text-[clamp(.8rem,2.5cqi,.95rem)] text-[var(--wm-text-dim)]">
              请选出正确的释义：
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
            <SpellTiles
              key={currentIndex}
              word={question.word.word}
              onSubmit={handleSpell}
              answered={answered}
              isCorrect={spellCorrect}
            />
          </>
        )}
      </div>

      {answered && wasCorrect === false && (
        <button
          onClick={onNext}
          className="font-nunito flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border-2 border-[var(--wm-border)] bg-[var(--wm-surface2)] py-[clamp(.75rem,2.5cqi,1rem)] text-[clamp(.88rem,3cqi,1rem)] font-bold text-[var(--wm-text)] transition-all hover:border-[var(--wm-accent4)] hover:bg-[rgba(96,165,250,.1)]"
        >
          下一题 →
        </button>
      )}
    </div>
  )
}
