'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { WordEntry } from '@/utils/type'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Check, ArrowRight } from 'lucide-react'
import PhonicsWord from './PhonicsWord'

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
  const [spellValue, setSpellValue] = useState('')
  const [spellCorrect, setSpellCorrect] = useState<boolean | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setAnswered(false)
    setSelectedWord(null)
    setSpellValue('')
    setSpellCorrect(null)
    if (question.type === 'C') {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [currentIndex, question.type])

  const handleMC = useCallback((chosen: string) => {
    if (answered) return
    setAnswered(true)
    setSelectedWord(chosen)
    onAnswer(chosen === question.word.word)
  }, [answered, onAnswer, question.word.word])

  const handleSpell = useCallback(() => {
    if (answered) return
    setAnswered(true)
    const correct = spellValue.trim().toLowerCase() === question.word.word.toLowerCase()
    setSpellCorrect(correct)
    onAnswer(correct)
  }, [answered, onAnswer, question.word.word, spellValue])

  const badgeConfig = {
    A: { text: '题型 A：看释义 → 选单词', cls: 'bg-[rgba(233,69,96,.2)] text-[var(--wm-accent)] border-[rgba(233,69,96,.3)]' },
    B: { text: '题型 B：看单词 → 选释义', cls: 'bg-[rgba(96,165,250,.2)] text-[var(--wm-accent4)] border-[rgba(96,165,250,.3)]' },
    C: { text: '题型 C：看释义 → 默写单词', cls: 'bg-[rgba(245,166,35,.2)] text-[var(--wm-accent2)] border-[rgba(245,166,35,.3)]' },
  }[question.type]

  const pct = (currentIndex / totalCount * 100)

  return (
    <div className="max-w-[680px] mx-auto">
      <div className="mb-5">
        <Progress
          value={pct}
          max={100}
          className="h-1.5 bg-[var(--wm-surface)] mb-2"
          indicatorClassName="bg-gradient-to-r from-[var(--wm-accent)] to-[var(--wm-accent2)]"
        />
        <div className="flex justify-between text-[.78rem] font-bold text-[var(--wm-text-dim)]">
          <span>第 {currentIndex + 1} / {totalCount} 题</span>
          <Badge className="bg-[rgba(74,222,128,.15)] text-[var(--wm-accent3)] border border-[rgba(74,222,128,.3)] px-2.5 py-0.5 text-[.78rem] font-extrabold">
            <Check className="h-3 w-3" /> {score}
          </Badge>
        </div>
      </div>

      <Card className="bg-[var(--wm-surface)] border-[var(--wm-border)] mb-3">
        <CardContent className="p-6">
          <Badge className={cn('inline-block px-2.5 py-1 text-[.67rem] font-extrabold uppercase tracking-wide mb-3 border', badgeConfig.cls)}>
            {badgeConfig.text}
          </Badge>

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
                    <Button
                      key={o.word}
                      variant="outline"
                      disabled={answered}
                      onClick={() => handleMC(o.word)}
                      className={cn(
                        'h-auto px-3 py-3 border-2 rounded-[10px] font-nunito font-bold text-[.83rem] text-left leading-snug break-words justify-start whitespace-normal',
                        btnCls,
                        !answered && 'hover:border-[var(--wm-accent4)] hover:bg-[rgba(96,165,250,.1)]'
                      )}
                    >
                      {o.word}
                    </Button>
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
                    <Button
                      key={o.word}
                      variant="outline"
                      disabled={answered}
                      onClick={() => handleMC(o.word)}
                      className={cn(
                        'h-auto px-3 py-3 border-2 rounded-[10px] font-nunito font-bold text-[.83rem] text-left leading-snug break-words justify-start whitespace-normal',
                        btnCls,
                        !answered && 'hover:border-[var(--wm-accent4)] hover:bg-[rgba(96,165,250,.1)]'
                      )}
                    >
                      {o.explanation}
                    </Button>
                  )
                })}
              </div>
            </>
          )}

          {question.type === 'C' && (
            <>
              <div className="text-[1.2rem] font-black leading-snug mb-1">{question.word.explanation}</div>
              <div className="text-[.8rem] text-[var(--wm-text-dim)] mb-3.5">请拼写出对应的英文单词或短语：</div>
              <div className="flex flex-col gap-2.5">
                <Input
                  ref={inputRef}
                  type="text"
                  value={spellValue}
                  onChange={e => setSpellValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !answered) handleSpell() }}
                  placeholder="请输入单词或短语…"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className={cn(
                    'h-auto p-3.5 bg-[var(--wm-surface2)] border-2 rounded-[10px] text-[var(--wm-text)] font-nunito text-[1.25rem] font-bold text-center tracking-wider',
                    spellCorrect === true && 'border-[var(--wm-accent3)] bg-[rgba(74,222,128,.1)]',
                    spellCorrect === false && 'border-[var(--wm-accent)] bg-[rgba(233,69,96,.1)]',
                    spellCorrect === null && 'border-[var(--wm-border)]'
                  )}
                />
                {!answered && (
                  <Button
                    onClick={handleSpell}
                    variant="gradient"
                    className="bg-gradient-to-br from-[var(--wm-accent2)] to-[#e67e22] font-nunito font-extrabold text-[.88rem]"
                  >
                    <Check className="h-4 w-4" /> 确认
                  </Button>
                )}
                {answered && spellCorrect !== null && (
                  <div className={cn(
                    'text-center text-[.85rem] font-bold p-2 rounded-lg',
                    spellCorrect ? 'bg-[rgba(74,222,128,.15)] text-[var(--wm-accent3)]' : 'bg-[rgba(233,69,96,.15)] text-[var(--wm-accent)]'
                  )}>
                    {spellCorrect ? '✓ 正确！🎉' : (
                      <span>✗ 错误，正确答案：<strong>{question.word.word}</strong></span>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {answered && (
        <Button
          onClick={onNext}
          variant="outline"
          className="w-full p-3 bg-[var(--wm-surface2)] border-2 border-[var(--wm-border)] rounded-[10px] text-[var(--wm-text)] font-nunito font-bold text-[.85rem] h-auto hover:border-[var(--wm-accent4)] hover:bg-[rgba(96,165,250,.1)]"
        >
          下一题 <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
