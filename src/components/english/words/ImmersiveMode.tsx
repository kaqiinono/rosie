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

export default function ImmersiveMode({
  open,
  words,
  allWords,
  mode,
  practiceTypes,
  onClose,
  onQuizComplete,
}: ImmersiveModeProps) {
  const [idx, setIdx] = useState(0)
  const [defOnly, setDefOnly] = useState(false)
  const [wordShown, setWordShown] = useState(true)
  const [bodyMode, setBodyMode] = useState<'normal' | 'word-visible' | 'def-only'>('normal')
  const [isWide, setIsWide] = useState(() => window.matchMedia('(min-width: 768px)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const [quizQs, setQuizQs] = useState<ImmQuizQ[]>([])
  const [curQ, setCurQ] = useState(0)
  const [qScore, setQScore] = useState(0)
  const [qAnswered, setQAnswered] = useState(false)
  const [qCorrect, setQCorrect] = useState<boolean | null>(null)
  const [qSelected, setQSelected] = useState<string | null>(null)
  const [spellOk, setSpellOk] = useState<boolean | null>(null)
  const [showResults, setShowResults] = useState(false)
  const quizResultBuffer = useRef<{ entry: WordEntry; correct: boolean }[]>([])

  const startQuiz = useCallback(() => {
    const types = practiceTypes.length ? practiceTypes : (['A', 'B'] as ('A' | 'B' | 'C')[])
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
  }, [words, practiceTypes])

  // Clear quiz result buffer when practice opens (ref access must stay in an effect)
  useEffect(() => {
    if (open && mode === 'practice') quizResultBuffer.current = []
  }, [open, mode])

  // Clear result buffer when switching into practice via preview flow
  useEffect(() => {
    if (open && mode === 'practice') quizResultBuffer.current = []
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const [prevOpen, setPrevOpen] = useState(open)
  if (prevOpen !== open) {
    setPrevOpen(open)
    if (open) {
      setIdx(0)
      setDefOnly(false)
      setWordShown(true)
      setBodyMode('normal')
      setShowResults(false)
      if (mode === 'practice') startQuiz()
    }
  }

  // When mode switches from 'vocab' → 'practice' while already open (preview → quiz flow)
  const [prevMode, setPrevMode] = useState(mode)
  if (prevMode !== mode) {
    setPrevMode(mode)
    if (open && mode === 'practice') startQuiz()
  }

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
      if (defOnly) {
        setWordShown(false)
        setBodyMode('def-only')
      }
    } else {
      onClose()
    }
  }, [idx, words.length, defOnly, onClose])

  const goPrev = useCallback(() => {
    if (idx > 0) {
      setIdx(idx - 1)
      if (defOnly) {
        setWordShown(false)
        setBodyMode('def-only')
      }
    }
  }, [idx, defOnly])

  const nextQuizQ = useCallback(() => {
    const next = curQ + 1
    if (next >= quizQs.length) {
      onQuizComplete?.(quizResultBuffer.current)
      quizResultBuffer.current = []
      setShowResults(true)
    } else {
      setCurQ(next)
      setQAnswered(false)
      setQCorrect(null)
      setQSelected(null)
      setSpellOk(null)
    }
  }, [curQ, quizQs, onQuizComplete])

  const handleMCAnswer = useCallback(
    (chosen: string, correct: string) => {
      if (qAnswered) return
      const isCorrect = chosen === correct
      setQAnswered(true)
      setQCorrect(isCorrect)
      setQSelected(chosen)
      if (isCorrect) setQScore((s) => s + 1)
      if (quizQs[curQ])
        quizResultBuffer.current.push({ entry: quizQs[curQ].word, correct: isCorrect })
    },
    [qAnswered, quizQs, curQ],
  )

  const handleSpellSubmit = useCallback(
    (val: string) => {
      if (qAnswered) return
      const ok = val.trim().toLowerCase() === quizQs[curQ]?.word.word.toLowerCase()
      setQAnswered(true)
      setQCorrect(ok)
      setSpellOk(ok)
      if (ok) setQScore((s) => s + 1)
      if (quizQs[curQ]) quizResultBuffer.current.push({ entry: quizQs[curQ].word, correct: ok })
    },
    [qAnswered, quizQs, curQ],
  )

  useEffect(() => {
    if (qAnswered && qCorrect === true) {
      const t = setTimeout(nextQuizQ, 600)
      return () => clearTimeout(t)
    }
  }, [qAnswered, qCorrect, nextQuizQ])

  const qTotal = quizQs.length
  const q = quizQs[curQ]
  const qPct = qTotal ? Math.round((qScore / qTotal) * 100) : 0
  const qEmoji = qPct >= 90 ? '🏆' : qPct >= 70 ? '🎉' : qPct >= 50 ? '💪' : '😅'

  const qOptions = useMemo(() => {
    if (!q) return []
    const seed = curQ * 997 + quizQs.length
    return buildQuizOptions(q.word, allWords, seed)
  }, [q, curQ, quizQs.length, allWords])

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

  return (
    <div className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-[#090914]">
      {/* Header */}
      <div className="z-10 flex shrink-0 flex-wrap items-center gap-2.5 border-b border-white/[.07] bg-[rgba(9,9,20,.98)] px-5 py-2.5">
        <div className="font-fredoka mr-auto bg-gradient-to-br from-[#a78bfa] to-[#7c3aed] bg-clip-text text-[1.05rem] text-transparent">
          ⚡ 沉浸模式 · {mode === 'vocab' ? '背单词' : '单词练习'}
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[.7rem] font-bold text-white/[.38]">
          {mode === 'vocab'
            ? `${idx + 1} / ${total}`
            : showResults
              ? '完成'
              : `${curQ + 1} / ${qTotal}`}
        </div>
        {mode === 'vocab' && (
          <button
            onClick={toggleDefOnly}
            className={`flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-3 py-1.5 transition-all select-none ${
              defOnly ? 'border-[#7c3aed] bg-[rgba(124,58,237,.2)]' : 'border-white/10 bg-white/5'
            }`}
          >
            <span className="text-[.88rem]">👁</span>
            <span
              className={`text-[.72rem] font-bold whitespace-nowrap ${defOnly ? 'text-[#c4b5fd]' : 'text-white/45'}`}
            >
              仅看释义
            </span>
            <div
              className={`relative h-4 w-7 rounded-lg transition-colors ${defOnly ? 'bg-[#7c3aed]' : 'bg-white/[.14]'}`}
            >
              <div
                className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,.4)] transition-transform ${defOnly ? 'translate-x-3' : ''}`}
              />
            </div>
          </button>
        )}
        <button
          onClick={onClose}
          className="font-nunito cursor-pointer rounded-full border-[1.5px] border-white/10 bg-transparent px-3.5 py-1.5 text-[.72rem] font-bold text-white/[.38] transition-all hover:border-[#f87171] hover:text-[#f87171]"
        >
          ✕ 退出
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 shrink-0 bg-white/[.04]">
        <div
          className="h-full bg-gradient-to-r from-[#6d28d9] via-[#a855f7] to-[#60a5fa] transition-[width] duration-[450ms] ease-[cubic-bezier(.4,0,.2,1)]"
          style={{
            width:
              mode === 'vocab'
                ? `${((idx + 1) / total) * 100}%`
                : `${((curQ + 1) / qTotal) * 100}%`,
          }}
        />
      </div>

      {/* Vocab body */}
      {mode === 'vocab' && v && (
        <>
          <div
            className="relative min-h-0 flex-1 overflow-hidden"
            style={{ display: 'flex', flexDirection: isWide ? 'row' : 'column' }}
          >
            {/* Word panel — left on wide, top on narrow */}
            <div
              className="relative flex flex-col items-center justify-center gap-3.5 overflow-hidden"
              style={{
                background:
                  'radial-gradient(ellipse at 40% 45%, rgba(109,40,217,.13) 0, transparent 62%), #0e0e22',
                ...(isWide
                  ? {
                      // Wide: absolute left panel, slides out left when def-only
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: topVisible ? 0 : '-50%',
                      width: '50%',
                      opacity: topVisible ? 1 : 0,
                      padding: '2.5rem 2.5rem',
                      overflowY: 'auto' as const,
                      transition: 'left 450ms cubic-bezier(.4,0,.2,1), opacity 320ms ease',
                    }
                  : {
                      // Narrow: collapses vertically
                      flexShrink: 0,
                      maxHeight: topVisible ? '60vh' : '0px',
                      opacity: topVisible ? 1 : 0,
                      padding: topVisible ? '2rem 2rem' : '0 2rem',
                      overflow: 'hidden',
                      transition:
                        'max-height 450ms cubic-bezier(.4,0,.2,1), opacity 320ms ease, padding 380ms ease',
                    }),
              }}
            >
              <div
                className="font-fredoka pointer-events-none absolute leading-none font-black select-none"
                style={{
                  fontSize: 'clamp(90px,16vw,190px)',
                  color: 'rgba(124,58,237,.05)',
                  bottom: '-6%',
                  right: '-2%',
                  zIndex: 0,
                }}
              >
                {v.word.charAt(0).toUpperCase()}
              </div>
              <div className="relative z-[1] flex w-full max-w-[600px] flex-col items-center gap-3">
                <div className="flex flex-wrap justify-center gap-1.5">
                  <span className="rounded-full border border-[rgba(233,69,96,.2)] bg-[rgba(233,69,96,.12)] px-2.5 py-1 text-[.6rem] font-extrabold tracking-wider text-[#f87171] uppercase">
                    {v.unit}
                  </span>
                  <span className="rounded-full border border-[rgba(96,165,250,.2)] bg-[rgba(96,165,250,.12)] px-2.5 py-1 text-[.6rem] font-extrabold tracking-wider text-[#60a5fa] uppercase">
                    {v.lesson}
                  </span>
                </div>
                <div
                  className={`font-nunito ${wordSizeClass} text-center leading-tight font-black break-words`}
                >
                  <PhonicsWord text={v.word} syllables={v.syllables} />
                </div>
                {v.ipa && (
                  <div className="text-center text-[clamp(1rem,2vw,1.4rem)] font-semibold text-[#f0abfc] italic opacity-80">
                    {v.ipa}
                  </div>
                )}
                {v.example && (
                  <>
                    <div className="h-px w-10 shrink-0 bg-gradient-to-r from-transparent via-[rgba(124,58,237,.5)] to-transparent" />
                    <div className="w-full max-w-[520px] text-center">
                      <div className="mb-2 text-[.68rem] font-extrabold tracking-[.12em] text-[rgba(74,222,128,.55)] uppercase">
                        例句
                      </div>
                      <div
                        className="text-[clamp(1.125rem,1.5vw,1.05rem)] leading-loose font-semibold text-[rgba(220,220,255,.4)] italic [&_strong]:rounded-sm [&_strong]:bg-[rgba(74,222,128,.07)] [&_strong]:px-1 [&_strong]:font-extrabold [&_strong]:text-[#4ade80] [&_strong]:not-italic"
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
                className="h-px shrink-0 bg-white/[.07]"
                style={{ opacity: topVisible ? 1 : 0, transition: 'opacity 320ms ease' }}
              />
            )}

            {/* Definition panel — right on wide, bottom on narrow */}
            <div
              onClick={handleRightClick}
              className="relative flex flex-col items-center justify-center overflow-y-auto px-10 py-8"
              style={{
                background:
                  'radial-gradient(ellipse at 60% 55%, rgba(96,165,250,.07) 0, transparent 60%), #0c0c1a',
                cursor: defOnly ? 'pointer' : 'default',
                ...(isWide
                  ? {
                      // Wide: absolute right panel, expands to full width when def-only
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      right: 0,
                      width: topVisible ? '50%' : '100%',
                      borderLeft: topVisible ? '1px solid rgba(255,255,255,.06)' : 'none',
                      transition: 'width 450ms cubic-bezier(.4,0,.2,1)',
                    }
                  : {
                      // Narrow: takes remaining space
                      flex: 1,
                    }),
              }}
            >
              <div className="flex w-full max-w-[640px] flex-col items-center gap-3.5 text-center">
                <div className="text-[.75rem] font-extrabold tracking-[.14em] text-[rgba(167,139,250,.5)] uppercase">
                  释义
                </div>
                <div
                  className={`leading-loose font-bold text-[var(--wm-text)] transition-[font-size] duration-350 ease-out ${
                    topVisible
                      ? 'text-[clamp(1.3rem,2.6vw,1.9rem)]'
                      : 'text-[clamp(1.6rem,3.5vw,2.4rem)]'
                  }`}
                  dangerouslySetInnerHTML={{ __html: hilite(v.explanation, v.word, v.keywords) }}
                />
              </div>
              {defOnly && (
                <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 text-[.65rem] font-bold whitespace-nowrap text-white/20">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="h-3.5 w-3.5 opacity-60"
                  >
                    {isWide ? (
                      <path d={wordShown ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
                    ) : (
                      <path d={wordShown ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
                    )}
                  </svg>
                  {wordShown ? '点击隐藏单词' : '点击查看单词'}
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="z-10 flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-white/[.07] bg-[rgba(9,9,20,.98)] px-5 py-3">
            <button
              onClick={goPrev}
              disabled={idx === 0}
              className="font-nunito cursor-pointer rounded-full border-[1.5px] border-white/10 bg-transparent px-6 py-2 text-[1rem] font-bold text-white/[.38] transition-all hover:border-[#60a5fa] hover:text-[#93c5fd] disabled:cursor-default disabled:opacity-[.18]"
            >
              ← 上一个
            </button>
            <div className="min-w-[70px] text-center text-[0.875rem] font-bold text-white/[.32]">
              {idx + 1} / {total}
            </div>
            <button
              onClick={goNext}
              className="font-nunito cursor-pointer rounded-full border-0 bg-gradient-to-br from-[#6d28d9] to-[#a855f7] px-7 py-2 text-[.85rem] font-extrabold text-white shadow-[0_3px_12px_rgba(109,40,217,.4)] transition-all hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(109,40,217,.55)]"
            >
              {idx === total - 1 ? '完成 ✓' : '下一个 →'}
            </button>
          </div>
        </>
      )}

      {/* Practice body */}
      {mode === 'practice' && (
        <div
          className="flex flex-1 flex-col items-center justify-center overflow-auto px-5 py-7"
          style={{
            background:
              'radial-gradient(ellipse at 20% 30%, rgba(109,40,217,.09) 0, transparent 55%), #0c0c1d',
          }}
        >
          {!showResults &&
            q &&
            (() => {
              const opts = qOptions
              const isA = q.type === 'A'
              const isC = q.type === 'C'
              const badgeStyle = isA
                ? 'bg-[rgba(96,165,250,.15)] text-[#60a5fa]'
                : isC
                  ? 'bg-[rgba(74,222,128,.12)] text-[#4ade80]'
                  : 'bg-[rgba(167,139,250,.15)] text-[#a78bfa]'

              return (
                <div className="@container flex w-full max-w-[1000px] flex-col gap-4 rounded-[20px] border border-white/[.08] bg-white/[.04] p-[clamp(1rem,3.5cqi,1.75rem)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-block w-fit rounded-full px-3 py-1 text-[clamp(.62rem,1.8cqi,.72rem)] font-extrabold tracking-wider uppercase ${badgeStyle}`}
                    >
                      {isA
                        ? '题型 A · 看释义选单词'
                        : isC
                          ? '题型 C · 看释义默写单词'
                          : '题型 B · 看单词选释义'}
                    </span>
                    <div className="text-[clamp(.72rem,2cqi,.82rem)] font-bold text-white/[.32]">
                      ✓ {qScore}
                    </div>
                  </div>

                  <div className="text-[clamp(1.3rem,4cqi,2.5rem)] leading-relaxed font-black text-[#f0f0ff]">
                    {isA || isC ? (
                      q.word.explanation
                    ) : (
                      <PhonicsWord text={q.word.word} syllables={q.word.syllables} />
                    )}
                  </div>
                  {!isA && !isC && q.word.ipa && (
                    <div className="text-[clamp(.8rem,2.5cqi,.95rem)] font-semibold text-[#f0abfc] italic">
                      {q.word.ipa}
                    </div>
                  )}
                  <div className="text-[clamp(.78rem,2.2cqi,.9rem)] font-semibold text-white/[.38]">
                    {isA
                      ? '请选出对应的英文单词：'
                      : isC
                        ? '请拼写出对应的英文单词或短语：'
                        : '请选出正确的释义：'}
                  </div>

                  {!isC && (
                    <div
                      className={`grid gap-[clamp(.4rem,1.5cqi,.6rem)] ${isA ? 'grid-cols-1 @lg:grid-cols-2' : 'grid-cols-1'}`}
                    >
                      {opts.map((o, optIdx) => {
                        const isCorrect = o.word === q.word.word
                        const isSel = qSelected === o.word
                        let cls = 'bg-white/[.04] border-white/[.09] text-[#f0f0ff]'
                        let labelCls = 'text-[#a78bfa]/60'
                        if (qAnswered) {
                          if (isCorrect) {
                            cls = 'border-[#4ade80] bg-[rgba(74,222,128,.12)] text-[#4ade80]'
                            labelCls = 'text-[#4ade80]/70'
                          } else if (isSel) {
                            cls = 'border-[#f87171] bg-[rgba(248,113,113,.12)] text-[#f87171]'
                            labelCls = 'text-[#f87171]/70'
                          }
                        }
                        const label = ['A', 'B', 'C', 'D'][optIdx] ?? String(optIdx + 1)
                        return (
                          <button
                            key={o.word}
                            disabled={qAnswered}
                            onClick={() => handleMCAnswer(o.word, q.word.word)}
                            className={`font-nunito flex cursor-pointer items-start gap-[clamp(.4rem,1.2cqi,.6rem)] rounded-xl border-2 px-[clamp(.6rem,2cqi,.9rem)] py-[clamp(.7rem,2.5cqi,1rem)] text-left text-[clamp(1.2rem,2.2cqi,1rem)] leading-snug font-bold break-words transition-all disabled:cursor-default ${cls} ${
                              !qAnswered
                                ? 'hover:border-[#a78bfa] hover:bg-[rgba(167,139,250,.1)]'
                                : ''
                            }`}
                          >
                            <span className={`shrink-0 font-extrabold tabular-nums ${labelCls}`}>
                              {label}.
                            </span>
                            <span>{isA ? o.word : o.explanation}</span>
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

                  {qAnswered && qCorrect === false && (
                    <button
                      onClick={nextQuizQ}
                      className="font-nunito cursor-pointer self-center rounded-xl border-0 bg-gradient-to-br from-[#6d28d9] to-[#a855f7] px-7 py-[clamp(.6rem,2cqi,.8rem)] text-[clamp(.88rem,2.8cqi,1rem)] font-extrabold text-white shadow-[0_3px_12px_rgba(109,40,217,.35)] transition-all hover:-translate-y-0.5"
                    >
                      下一题 →
                    </button>
                  )}
                </div>
              )
            })()}

          {showResults && (
            <div className="w-full max-w-[460px] rounded-[20px] border border-white/[.08] bg-white/[.04] px-7 py-11 text-center">
              <div className="mb-2.5 text-[3.5rem]">{qEmoji}</div>
              <div className="font-fredoka mb-1.5 bg-gradient-to-br from-[#7c3aed] to-[#a855f7] bg-clip-text text-[3rem] text-transparent">
                {qScore} / {qTotal}
              </div>
              <div className="mb-6 text-[.9rem] leading-loose text-white/45">
                正确率 <strong>{qPct}%</strong>
                <br />
                {qPct >= 90
                  ? '太棒了，几乎满分！'
                  : qPct >= 70
                    ? '不错哦，继续加油！'
                    : qPct >= 50
                      ? '有进步，再练练吧！'
                      : '继续努力，你可以的！'}
              </div>
              <button
                onClick={startQuiz}
                className="font-nunito mr-2 cursor-pointer rounded-full border-0 bg-gradient-to-br from-[#6d28d9] to-[#a855f7] px-6 py-2.5 text-[.86rem] font-extrabold text-white"
              >
                🔄 再练一次
              </button>
              <button
                onClick={onClose}
                className="font-nunito cursor-pointer rounded-full border-[1.5px] border-white/10 bg-transparent px-6 py-2.5 text-[.86rem] font-bold text-white/[.38]"
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
