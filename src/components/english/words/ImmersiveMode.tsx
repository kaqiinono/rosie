'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { WordEntry } from '@/utils/type'
import { hilite, highlightExample, shuffle, buildQuizOptions } from '@/utils/english-helpers'
import { getWordSizeClass } from '@/utils/phonics'
import PhonicsWord from './PhonicsWord'
import SpellTiles from './SpellTiles'

type ImmMode = 'vocab' | 'practice'

interface ImmersiveModeProps {
  open: boolean
  words: WordEntry[]
  allWords: WordEntry[]
  mode: ImmMode
  practiceTypes: ('A' | 'B' | 'C')[]
  onClose: () => void
  onQuizComplete?: (results: { entry: WordEntry; correct: boolean }[]) => void
}

interface ImmQuizQ {
  word: WordEntry
  type: 'A' | 'B' | 'C'
}

export default function ImmersiveMode({ open, words, allWords, mode, practiceTypes, onClose, onQuizComplete }: ImmersiveModeProps) {
  const [idx, setIdx] = useState(0)
  const [defOnly, setDefOnly] = useState(false)
  const [wordShown, setWordShown] = useState(true)
  const [bodyMode, setBodyMode] = useState<'normal' | 'word-visible' | 'def-only'>('normal')
  const [isWide, setIsWide] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    setIsWide(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const [quizQs, setQuizQs] = useState<ImmQuizQ[]>([])
  const [curQ, setCurQ] = useState(0)
  const [qScore, setQScore] = useState(0)
  const [qAnswered, setQAnswered] = useState(false)
  const [qSelected, setQSelected] = useState<string | null>(null)
  const [spellOk, setSpellOk] = useState<boolean | null>(null)
  const [showResults, setShowResults] = useState(false)
  const quizResultBuffer = useRef<{ entry: WordEntry; correct: boolean }[]>([])

  useEffect(() => {
    if (!open) return
    setIdx(0)
    setDefOnly(false)
    setWordShown(true)
    setBodyMode('normal')
    setShowResults(false)
    if (mode === 'practice') startQuiz()
  }, [open])

  const startQuiz = useCallback(() => {
    const types = practiceTypes.length ? practiceTypes : ['A', 'B'] as ('A' | 'B' | 'C')[]
    const seed = Date.now()
    const shuffled = shuffle(words, seed)
    let qs = shuffled.map((w, i) => ({ word: w, type: types[i % types.length] }))
    qs = shuffle(qs, seed + 1)
    setQuizQs(qs)
    setCurQ(0)
    setQScore(0)
    setQAnswered(false)
    setQSelected(null)
    setSpellOk(null)
    setShowResults(false)
    quizResultBuffer.current = []
  }, [words, practiceTypes])

  const toggleDefOnly = useCallback(() => {
    const newVal = !defOnly
    setDefOnly(newVal)
    if (newVal) {
      setWordShown(false)
      setBodyMode('def-only')
    } else {
      setWordShown(true)
      setBodyMode('normal')
    }
  }, [defOnly])

  const handleRightClick = useCallback(() => {
    if (!defOnly) return
    const newShown = !wordShown
    setWordShown(newShown)
    setBodyMode(newShown ? 'word-visible' : 'def-only')
  }, [defOnly, wordShown])

  const goNext = useCallback(() => {
    if (idx < words.length - 1) {
      setIdx(idx + 1)
      if (defOnly) { setWordShown(false); setBodyMode('def-only') }
    } else {
      onClose()
    }
  }, [idx, words.length, defOnly, onClose])

  const goPrev = useCallback(() => {
    if (idx > 0) {
      setIdx(idx - 1)
      if (defOnly) { setWordShown(false); setBodyMode('def-only') }
    }
  }, [idx, defOnly])

  const handleMCAnswer = useCallback((chosen: string, correct: string) => {
    if (qAnswered) return
    setQAnswered(true)
    setQSelected(chosen)
    const isCorrect = chosen === correct
    if (isCorrect) setQScore(s => s + 1)
    if (quizQs[curQ]) quizResultBuffer.current.push({ entry: quizQs[curQ].word, correct: isCorrect })
  }, [qAnswered, quizQs, curQ])

  const handleSpellSubmit = useCallback((val: string) => {
    if (qAnswered) return
    setQAnswered(true)
    const ok = val.trim().toLowerCase() === quizQs[curQ]?.word.word.toLowerCase()
    setSpellOk(ok)
    if (ok) setQScore(s => s + 1)
    if (quizQs[curQ]) quizResultBuffer.current.push({ entry: quizQs[curQ].word, correct: ok })
  }, [qAnswered, quizQs, curQ])

  const nextQuizQ = useCallback(() => {
    const next = curQ + 1
    if (next >= quizQs.length) {
      onQuizComplete?.(quizResultBuffer.current)
      quizResultBuffer.current = []
      setShowResults(true)
    } else {
      setCurQ(next)
      setQAnswered(false)
      setQSelected(null)
      setSpellOk(null)
    }
  }, [curQ, quizQs, onQuizComplete])

  if (!open || !words.length) return null

  const v = words[idx]
  const total = words.length
  const sz = v ? getWordSizeClass(v.word) : 'lg'
  const wordSizeClass = {
    xl: 'text-[clamp(3rem,6vw,5.5rem)]',
    lg: 'text-[clamp(2.5rem,5vw,4.5rem)]',
    md: 'text-[clamp(2rem,4vw,3.5rem)]',
    sm: 'text-[clamp(1.6rem,3.2vw,2.8rem)]',
    xs: 'text-[clamp(1.3rem,2.6vw,2.2rem)]',
  }[sz]

  const topVisible = bodyMode !== 'def-only'

  const qTotal = quizQs.length
  const q = quizQs[curQ]
  const qPct = qTotal ? Math.round(qScore / qTotal * 100) : 0
  const qEmoji = qPct >= 90 ? '🏆' : qPct >= 70 ? '🎉' : qPct >= 50 ? '💪' : '😅'

  const qOptions = useMemo(() => {
    if (!q) return []
    const seed = curQ * 997 + quizQs.length
    return buildQuizOptions(q.word, allWords, seed)
  }, [q, curQ, quizQs.length, allWords])

  return (
    <div className="fixed inset-0 z-[200] bg-[#090914] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-2.5 bg-[rgba(9,9,20,.98)] border-b border-white/[.07] shrink-0 flex-wrap z-10">
        <div className="font-fredoka text-[1.05rem] bg-gradient-to-br from-[#a78bfa] to-[#7c3aed] bg-clip-text text-transparent mr-auto">
          ⚡ 沉浸模式 · {mode === 'vocab' ? '背单词' : '单词练习'}
        </div>
        <div className="text-[.7rem] font-bold text-white/[.38] bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
          {mode === 'vocab' ? `${idx + 1} / ${total}` : (showResults ? '完成' : `${curQ + 1} / ${qTotal}`)}
        </div>
        {mode === 'vocab' && (
          <button
            onClick={toggleDefOnly}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-[1.5px] cursor-pointer transition-all select-none ${
              defOnly ? 'bg-[rgba(124,58,237,.2)] border-[#7c3aed]' : 'bg-white/5 border-white/10'
            }`}
          >
            <span className="text-[.88rem]">👁</span>
            <span className={`text-[.72rem] font-bold whitespace-nowrap ${defOnly ? 'text-[#c4b5fd]' : 'text-white/45'}`}>
              仅看释义
            </span>
            <div className={`w-7 h-4 rounded-lg relative transition-colors ${defOnly ? 'bg-[#7c3aed]' : 'bg-white/[.14]'}`}>
              <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform shadow-[0_1px_4px_rgba(0,0,0,.4)] ${defOnly ? 'translate-x-3' : ''}`} />
            </div>
          </button>
        )}
        <button
          onClick={onClose}
          className="px-3.5 py-1.5 bg-transparent border-[1.5px] border-white/10 rounded-full text-white/[.38] font-nunito text-[.72rem] font-bold cursor-pointer transition-all hover:border-[#f87171] hover:text-[#f87171]"
        >
          ✕ 退出
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-white/[.04] shrink-0">
        <div
          className="h-full bg-gradient-to-r from-[#6d28d9] via-[#a855f7] to-[#60a5fa] transition-[width] duration-[450ms] ease-[cubic-bezier(.4,0,.2,1)]"
          style={{ width: mode === 'vocab' ? `${(idx + 1) / total * 100}%` : `${(curQ + 1) / qTotal * 100}%` }}
        />
      </div>

      {/* Vocab body */}
      {mode === 'vocab' && v && (
        <>
          <div className="flex-1 overflow-hidden min-h-0 relative" style={{ display: 'flex', flexDirection: isWide ? 'row' : 'column' }}>

            {/* Word panel — left on wide, top on narrow */}
            <div
              className="flex flex-col items-center justify-center gap-3.5 relative overflow-hidden"
              style={{
                background: 'radial-gradient(ellipse at 40% 45%, rgba(109,40,217,.13) 0, transparent 62%), #0e0e22',
                ...(isWide ? {
                  // Wide: absolute left panel, slides out left when def-only
                  position: 'absolute',
                  top: 0, bottom: 0,
                  left: topVisible ? 0 : '-50%',
                  width: '50%',
                  opacity: topVisible ? 1 : 0,
                  padding: '2.5rem 2.5rem',
                  overflowY: 'auto' as const,
                  transition: 'left 450ms cubic-bezier(.4,0,.2,1), opacity 320ms ease',
                } : {
                  // Narrow: collapses vertically
                  flexShrink: 0,
                  maxHeight: topVisible ? '60vh' : '0px',
                  opacity: topVisible ? 1 : 0,
                  padding: topVisible ? '2rem 2rem' : '0 2rem',
                  overflow: 'hidden',
                  transition: 'max-height 450ms cubic-bezier(.4,0,.2,1), opacity 320ms ease, padding 380ms ease',
                }),
              }}
            >
              <div
                className="absolute font-fredoka font-black leading-none pointer-events-none select-none"
                style={{
                  fontSize: 'clamp(90px,16vw,190px)',
                  color: 'rgba(124,58,237,.05)',
                  bottom: '-6%', right: '-2%',
                  zIndex: 0,
                }}
              >
                {v.word.charAt(0).toUpperCase()}
              </div>
              <div className="relative z-[1] flex flex-col items-center gap-3 w-full max-w-[600px]">
                <div className="flex gap-1.5 justify-center flex-wrap">
                  <span className="px-2.5 py-1 rounded-full text-[.6rem] font-extrabold uppercase tracking-wider bg-[rgba(233,69,96,.12)] text-[#f87171] border border-[rgba(233,69,96,.2)]">
                    {v.unit}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[.6rem] font-extrabold uppercase tracking-wider bg-[rgba(96,165,250,.12)] text-[#60a5fa] border border-[rgba(96,165,250,.2)]">
                    {v.lesson}
                  </span>
                </div>
                <div className={`font-nunito ${wordSizeClass} font-black leading-tight text-center break-words`}>
                  <PhonicsWord text={v.word} />
                </div>
                {v.ipa && (
                  <div className="text-[clamp(1rem,2vw,1.4rem)] text-[#f0abfc] italic font-semibold text-center opacity-80">
                    {v.ipa}
                  </div>
                )}
                {v.example && (
                  <>
                    <div className="w-10 h-px bg-gradient-to-r from-transparent via-[rgba(124,58,237,.5)] to-transparent shrink-0" />
                    <div className="text-center max-w-[520px] w-full">
                      <div className="text-[.68rem] font-extrabold uppercase tracking-[.12em] text-[rgba(74,222,128,.55)] mb-2">例句</div>
                      <div
                        className="text-[clamp(.85rem,1.5vw,1.05rem)] font-semibold leading-loose text-[rgba(220,220,255,.4)] italic [&_strong]:text-[#4ade80] [&_strong]:not-italic [&_strong]:font-extrabold [&_strong]:bg-[rgba(74,222,128,.07)] [&_strong]:px-1 [&_strong]:rounded-sm"
                        dangerouslySetInnerHTML={{ __html: highlightExample(v.example, v.word) }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Narrow-only horizontal divider */}
            {!isWide && (
              <div
                className="h-px bg-white/[.07] shrink-0"
                style={{ opacity: topVisible ? 1 : 0, transition: 'opacity 320ms ease' }}
              />
            )}

            {/* Definition panel — right on wide, bottom on narrow */}
            <div
              onClick={handleRightClick}
              className="flex flex-col items-center justify-center px-10 py-8 overflow-y-auto relative"
              style={{
                background: 'radial-gradient(ellipse at 60% 55%, rgba(96,165,250,.07) 0, transparent 60%), #0c0c1a',
                cursor: defOnly ? 'pointer' : 'default',
                ...(isWide ? {
                  // Wide: absolute right panel, expands to full width when def-only
                  position: 'absolute',
                  top: 0, bottom: 0, right: 0,
                  width: topVisible ? '50%' : '100%',
                  borderLeft: topVisible ? '1px solid rgba(255,255,255,.06)' : 'none',
                  transition: 'width 450ms cubic-bezier(.4,0,.2,1)',
                } : {
                  // Narrow: takes remaining space
                  flex: 1,
                }),
              }}
            >
              <div className="flex flex-col items-center gap-3.5 max-w-[640px] w-full text-center">
                <div className="text-[.75rem] font-extrabold uppercase tracking-[.14em] text-[rgba(167,139,250,.5)]">
                  释义
                </div>
                <div
                  className={`font-bold leading-loose text-[var(--wm-text)] transition-[font-size] duration-350 ease-out ${
                    topVisible
                      ? 'text-[clamp(1.3rem,2.6vw,1.9rem)]'
                      : 'text-[clamp(1.6rem,3.5vw,2.4rem)]'
                  }`}
                  dangerouslySetInnerHTML={{ __html: hilite(v.explanation, v.word) }}
                />
              </div>
              {defOnly && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[.65rem] font-bold text-white/20 flex items-center gap-1.5 pointer-events-none whitespace-nowrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 opacity-60">
                    {isWide
                      ? <path d={wordShown ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
                      : <path d={wordShown ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
                    }
                  </svg>
                  {wordShown ? '点击隐藏单词' : '点击查看单词'}
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-3 px-5 py-3 bg-[rgba(9,9,20,.98)] border-t border-white/[.07] shrink-0 flex-wrap z-10">
            <button
              onClick={goPrev}
              disabled={idx === 0}
              className="px-6 py-2 rounded-full border-[1.5px] border-white/10 bg-transparent text-white/[.38] font-nunito font-bold text-[.82rem] cursor-pointer transition-all hover:border-[#60a5fa] hover:text-[#93c5fd] disabled:opacity-[.18] disabled:cursor-default"
            >
              ← 上一个
            </button>
            <div className="text-[.78rem] font-bold text-white/[.32] min-w-[70px] text-center">
              {idx + 1} / {total}
            </div>
            <button
              onClick={goNext}
              className="px-7 py-2 rounded-full border-0 bg-gradient-to-br from-[#6d28d9] to-[#a855f7] text-white font-nunito font-extrabold text-[.85rem] cursor-pointer transition-all shadow-[0_3px_12px_rgba(109,40,217,.4)] hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(109,40,217,.55)]"
            >
              {idx === total - 1 ? '完成 ✓' : '下一个 →'}
            </button>
          </div>
        </>
      )}

      {/* Practice body */}
      {mode === 'practice' && (
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-7 overflow-auto"
          style={{ background: 'radial-gradient(ellipse at 20% 30%, rgba(109,40,217,.09) 0, transparent 55%), #0c0c1d' }}
        >
          {!showResults && q && (() => {
            const opts = qOptions
            const isA = q.type === 'A'
            const isC = q.type === 'C'
            const badgeStyle = isA ? 'bg-[rgba(96,165,250,.15)] text-[#60a5fa]'
              : isC ? 'bg-[rgba(74,222,128,.12)] text-[#4ade80]'
              : 'bg-[rgba(167,139,250,.15)] text-[#a78bfa]'

            return (
              <div className="w-full max-w-[680px] bg-white/[.04] border border-white/[.08] rounded-[20px] p-7 flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className={`inline-block px-3 py-1 rounded-full text-[.65rem] font-extrabold uppercase tracking-wider w-fit ${badgeStyle}`}>
                    {isA ? '题型 A · 看释义选单词' : isC ? '题型 C · 看释义默写单词' : '题型 B · 看单词选释义'}
                  </span>
                  <div className="text-[.75rem] font-bold text-white/[.32]">✓ {qScore}</div>
                </div>

                <div className="text-[clamp(1rem,2.8vw,1.5rem)] font-black leading-relaxed text-[#f0f0ff]">
                  {isA || isC ? q.word.explanation : <PhonicsWord text={q.word.word} />}
                </div>
                {!isA && !isC && q.word.ipa && (
                  <div className="text-[.85rem] text-[#f0abfc] italic font-semibold">{q.word.ipa}</div>
                )}
                <div className="text-[.8rem] text-white/[.38] font-semibold">
                  {isA ? '请选出对应的英文单词：' : isC ? '请拼写出对应的英文单词或短语：' : '请选出正确的释义：'}
                </div>

                {!isC && (
                  <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-2">
                    {opts.map(o => {
                      const isCorrect = o.word === q.word.word
                      const isSel = qSelected === o.word
                      let cls = 'bg-white/[.04] border-white/[.09] text-[#f0f0ff]'
                      if (qAnswered) {
                        if (isCorrect) cls = 'border-[#4ade80] bg-[rgba(74,222,128,.12)] text-[#4ade80]'
                        else if (isSel) cls = 'border-[#f87171] bg-[rgba(248,113,113,.12)] text-[#f87171]'
                      }
                      return (
                        <button
                          key={o.word}
                          disabled={qAnswered}
                          onClick={() => handleMCAnswer(o.word, q.word.word)}
                          className={`px-3.5 py-3 border-2 rounded-xl font-nunito font-bold text-[.86rem] cursor-pointer transition-all text-left leading-snug break-words disabled:cursor-default ${cls} ${
                            !qAnswered ? 'hover:border-[#a78bfa] hover:bg-[rgba(167,139,250,.1)]' : ''
                          }`}
                        >
                          {isA ? o.word : o.explanation}
                        </button>
                      )
                    })}
                  </div>
                )}

                {isC && (
                  <SpellTiles
                    key={curQ}
                    word={q.word.word}
                    onSubmit={handleSpellSubmit}
                    answered={qAnswered}
                    isCorrect={spellOk}
                  />
                )}

                {qAnswered && (
                  <button
                    onClick={nextQuizQ}
                    className="px-7 py-3 bg-gradient-to-br from-[#6d28d9] to-[#a855f7] border-0 rounded-xl text-white font-nunito font-extrabold text-[.88rem] cursor-pointer transition-all self-center shadow-[0_3px_12px_rgba(109,40,217,.35)] hover:-translate-y-0.5"
                  >
                    下一题 →
                  </button>
                )}
              </div>
            )
          })()}

          {showResults && (
            <div className="w-full max-w-[460px] text-center bg-white/[.04] border border-white/[.08] rounded-[20px] py-11 px-7">
              <div className="text-[3.5rem] mb-2.5">{qEmoji}</div>
              <div className="font-fredoka text-[3rem] bg-gradient-to-br from-[#7c3aed] to-[#a855f7] bg-clip-text text-transparent mb-1.5">
                {qScore} / {qTotal}
              </div>
              <div className="text-white/45 text-[.9rem] mb-6 leading-loose">
                正确率 <strong>{qPct}%</strong><br />
                {qPct >= 90 ? '太棒了，几乎满分！' : qPct >= 70 ? '不错哦，继续加油！' : qPct >= 50 ? '有进步，再练练吧！' : '继续努力，你可以的！'}
              </div>
              <button
                onClick={startQuiz}
                className="px-6 py-2.5 bg-gradient-to-br from-[#6d28d9] to-[#a855f7] border-0 rounded-full text-white font-nunito font-extrabold text-[.86rem] cursor-pointer mr-2"
              >
                🔄 再练一次
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-transparent border-[1.5px] border-white/10 rounded-full text-white/[.38] font-nunito font-bold text-[.86rem] cursor-pointer"
              >
                退出沉浸模式
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
