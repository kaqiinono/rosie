'use client'

import { useState, useEffect, useCallback } from 'react'
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

export default function QuizCard({ question, options, currentIndex, totalCount, score, onAnswer, onNext }: QuizCardProps) {
  const [answered, setAnswered] = useState(false)
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [spellCorrect, setSpellCorrect] = useState<boolean | null>(null)

  useEffect(() => {
    setAnswered(false)
    setSelectedWord(null)
    setSpellCorrect(null)
  }, [currentIndex])

  const handleMC = useCallback((chosen: string) => {
    if (answered) return
    setAnswered(true)
    setSelectedWord(chosen)
    onAnswer(chosen === question.word.word)
  }, [answered, onAnswer, question.word.word])

  const handleSpell = useCallback((val: string) => {
    if (answered) return
    setAnswered(true)
    const correct = val.trim().toLowerCase() === question.word.word.toLowerCase()
    setSpellCorrect(correct)
    onAnswer(correct)
  }, [answered, onAnswer, question.word.word])

  const badgeConfig = {
    A: { text: '题型 A：看释义 → 选单词', cls: 'bg-[rgba(233,69,96,.2)] text-[var(--wm-accent)] border border-[rgba(233,69,96,.3)]' },
    B: { text: '题型 B：看单词 → 选释义', cls: 'bg-[rgba(96,165,250,.2)] text-[var(--wm-accent4)] border border-[rgba(96,165,250,.3)]' },
    C: { text: '题型 C：看释义 → 默写单词', cls: 'bg-[rgba(245,166,35,.2)] text-[var(--wm-accent2)] border border-[rgba(245,166,35,.3)]' },
  }[question.type]

  const pct = (currentIndex / totalCount * 100)

  return (
    <div className="max-w-[680px] mx-auto">
      <div className="mb-5">
        <div className="h-1.5 bg-[var(--wm-surface)] rounded-sm overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-[var(--wm-accent)] to-[var(--wm-accent2)] rounded-sm transition-[width] duration-400 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-[.78rem] font-bold text-[var(--wm-text-dim)]">
          <span>第 {currentIndex + 1} / {totalCount} 题</span>
          <span className="bg-[rgba(74,222,128,.15)] text-[var(--wm-accent3)] border border-[rgba(74,222,128,.3)] px-2.5 py-0.5 rounded-full text-[.78rem] font-extrabold">
            ✓ {score}
          </span>
        </div>
      </div>

      <div className="bg-[var(--wm-surface)] border border-[var(--wm-border)] rounded-[var(--wm-radius)] p-6 mb-3">
        <div className={`inline-block px-2.5 py-1 rounded-full text-[.67rem] font-extrabold uppercase tracking-wide mb-3 ${badgeConfig.cls}`}>
          {badgeConfig.text}
        </div>

        {question.type === 'A' && (
          <>
            <div className="text-[1.2rem] font-black leading-snug mb-1">{question.word.explanation}</div>
            <div className="text-[.8rem] text-[var(--wm-text-dim)] mb-3.5">请选出对应的英文单词或短语：</div>
            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-2">
              {options.map(o => {
                const isCorrect = o.word === question.word.word
                const isSelected = selectedWord === o.word
                let btnCls = 'bg-[var(--wm-surface2)] border-[var(--wm-border)] text-[var(--wm-text)]'
                if (answered) {
                  if (isCorrect) btnCls = 'border-[var(--wm-accent3)] bg-[rgba(74,222,128,.15)] text-[var(--wm-accent3)]'
                  else if (isSelected) btnCls = 'border-[var(--wm-accent)] bg-[rgba(233,69,96,.15)] text-[var(--wm-accent)]'
                }
                return (
                  <button
                    key={o.word}
                    disabled={answered}
                    onClick={() => handleMC(o.word)}
                    className={`px-3 py-3 border-2 rounded-[10px] font-nunito font-bold text-[.83rem] cursor-pointer transition-all text-left leading-snug break-words disabled:cursor-default ${btnCls} ${
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

        {question.type === 'B' && (
          <>
            <div className="text-[1.2rem] font-black leading-snug mb-1">
              <PhonicsWord text={question.word.word} />
              {question.word.ipa && (
                <div className="text-[.85rem] text-[var(--wm-accent2)] italic font-semibold mt-1">{question.word.ipa}</div>
              )}
            </div>
            <div className="text-[.8rem] text-[var(--wm-text-dim)] mb-3.5">请选出正确的释义：</div>
            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-2">
              {options.map(o => {
                const isCorrect = o.word === question.word.word
                const isSelected = selectedWord === o.word
                let btnCls = 'bg-[var(--wm-surface2)] border-[var(--wm-border)] text-[var(--wm-text)]'
                if (answered) {
                  if (isCorrect) btnCls = 'border-[var(--wm-accent3)] bg-[rgba(74,222,128,.15)] text-[var(--wm-accent3)]'
                  else if (isSelected) btnCls = 'border-[var(--wm-accent)] bg-[rgba(233,69,96,.15)] text-[var(--wm-accent)]'
                }
                return (
                  <button
                    key={o.word}
                    disabled={answered}
                    onClick={() => handleMC(o.word)}
                    className={`px-3 py-3 border-2 rounded-[10px] font-nunito font-bold text-[.83rem] cursor-pointer transition-all text-left leading-snug break-words disabled:cursor-default ${btnCls} ${
                      !answered ? 'hover:border-[var(--wm-accent4)] hover:bg-[rgba(96,165,250,.1)]' : ''
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
            <div className="text-[1.2rem] font-black leading-snug mb-1">{question.word.explanation}</div>
            <div className="text-[.8rem] text-[var(--wm-text-dim)] mb-3.5">请拼写出对应的英文单词或短语：</div>
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

      {answered && (
        <button
          onClick={onNext}
          className="w-full p-3 bg-[var(--wm-surface2)] border-2 border-[var(--wm-border)] rounded-[10px] text-[var(--wm-text)] font-nunito font-bold text-[.85rem] cursor-pointer transition-all flex items-center justify-center gap-1.5 hover:border-[var(--wm-accent4)] hover:bg-[rgba(96,165,250,.1)]"
        >
          下一题 →
        </button>
      )}
    </div>
  )
}
