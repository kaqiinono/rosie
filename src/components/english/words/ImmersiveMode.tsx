'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { WordEntry, QuizQuestion, QuizType } from '@/utils/type'
import {
  hilite,
  highlightExample,
  buildQuizOptions,
  buildQuizQuestions,
  buildReinforcementQuestions,
  normalizeQuizTypes,
  wordKey,
} from '@/utils/english-helpers'
import { getWordSizeClass } from '@/utils/phonics'
import { findPassage, findSentenceForWord } from '@/utils/reading-data'
import PhonicsWord from './PhonicsWord'
import { useStarHud } from '@/components/stars/StarHudProvider'
import ColoredStar from '@/components/stars/ColoredStar'
import { useQuizRunner } from './useQuizRunner'
import type { QuizCommitInfo } from './useQuizRunner'
import QuizQuestionBody from './QuizQuestionBody'
import type { SpellButtonStyle } from './SpellTiles'

type ImmMode = 'vocab' | 'practice'

interface ImmersiveModeProps {
  open: boolean
  words: WordEntry[]
  allWords: WordEntry[]
  mode: ImmMode
  practiceTypes: QuizType[]
  /** Type-C 拼写题字母池样式（默认 'candy'，'jelly' 切换到圆角果冻砖） */
  spellButtonStyle?: SpellButtonStyle
  onClose: () => void
  onQuizComplete?: (results: { entry: WordEntry; correct: boolean }[]) => void
}


export default function ImmersiveMode({
  open,
  words,
  allWords,
  mode,
  practiceTypes,
  spellButtonStyle,
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

  const [quizQs, setQuizQs] = useState<QuizQuestion[]>([])
  const [curQ, setCurQ] = useState(0)
  const [qScore, setQScore] = useState(0)
  const [showResults, setShowResults] = useState(false)
  const quizResultBuffer = useRef<{ entry: WordEntry; correct: boolean }[]>([])
  const [helpClicks, setHelpClicks] = useState<Record<string, number>>({})
  const [reinforcementAppended, setReinforcementAppended] = useState(false)
  const [mainPassTotal, setMainPassTotal] = useState<number | null>(null)

  const isEligibleForTypeD = useCallback((entry: WordEntry) => {
    const p = findPassage(entry.stage, entry.unit, entry.lesson)
    return p !== undefined && findSentenceForWord(p, entry.word) !== null
  }, [])

  const startQuiz = useCallback(() => {
    const raw = practiceTypes.length ? practiceTypes : (['A', 'B'] as QuizType[])
    const types = normalizeQuizTypes(raw)
    const seed = Date.now()
    setQuizQs(buildQuizQuestions(words, types, seed, isEligibleForTypeD))
    setCurQ(0)
    setQScore(0)
    setShowResults(false)
    setHelpClicks({})
    setReinforcementAppended(false)
    setMainPassTotal(null)
  }, [words, practiceTypes, isEligibleForTypeD])

  useEffect(() => {
    if (open && mode === 'practice') quizResultBuffer.current = []
  }, [open, mode])

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

  const { awardStars, session: starSession } = useStarHud()

  const currentQ = quizQs[curQ] ?? null

  const handleCommit = useCallback(
    (info: QuizCommitInfo) => {
      if (!currentQ) return
      if (info.finalCorrect) {
        setQScore((s) => s + 1)
        const amount = currentQ.type === 'C' || currentQ.type === 'D' ? 2 : 1
        void awardStars('red', amount)
      }
      quizResultBuffer.current.push({ entry: currentQ.word, correct: info.finalCorrect })
    },
    [currentQ, awardStars],
  )

  const handleAdvance = useCallback(() => {
    const next = curQ + 1
    if (next < quizQs.length) {
      setCurQ(next)
      return
    }
    // End of main pass: if the user asked for letter-reveal help on any words,
    // append a reinforcement batch of Type-C questions before finishing.
    const hasHelp = !reinforcementAppended && Object.values(helpClicks).some((c) => c > 0)
    if (hasHelp) {
      const extras = buildReinforcementQuestions(helpClicks, allWords, wordKey, Date.now())
      if (extras.length > 0) {
        setMainPassTotal(quizQs.length)
        setQuizQs((prev) => [...prev, ...extras])
        setReinforcementAppended(true)
        setCurQ(next)
        return
      }
    }
    onQuizComplete?.(quizResultBuffer.current)
    quizResultBuffer.current = []
    setShowResults(true)
  }, [curQ, quizQs.length, helpClicks, reinforcementAppended, allWords, onQuizComplete])

  const handleHelpReveal = useCallback(() => {
    if (!currentQ) return
    const k = wordKey(currentQ.word)
    setHelpClicks((prev) => ({ ...prev, [k]: (prev[k] ?? 0) + 1 }))
  }, [currentQ])

  const helpRevealedForCurrent = currentQ ? (helpClicks[wordKey(currentQ.word)] ?? 0) : 0
  const inReinforcement = reinforcementAppended && mainPassTotal !== null && curQ >= mainPassTotal

  const runner = useQuizRunner({
    question: currentQ,
    onCommit: handleCommit,
    onAdvance: handleAdvance,
  })

  const qTotal = quizQs.length
  const qPct = qTotal ? Math.round((qScore / qTotal) * 100) : 0
  const qEmoji = qPct >= 90 ? '🏆' : qPct >= 70 ? '🎉' : qPct >= 50 ? '💪' : '😅'

  const qOptions = useMemo(() => {
    if (!currentQ) return []
    const seed = curQ * 997 + quizQs.length
    return buildQuizOptions(currentQ.word, allWords, seed)
  }, [currentQ, curQ, quizQs.length, allWords])

  // Per-question star value summed for accurate live target (A/B=1, C/D=2)
  const targetStars = useMemo(
    () => quizQs.reduce((s, q) => s + (q.type === 'C' || q.type === 'D' ? 2 : 1), 0),
    [quizQs],
  )

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

  const moonProgress = (() => {
    const earned = starSession.red
    const goal = Math.max(1, targetStars)
    const pct = Math.min(100, (earned / goal) * 100)
    const reached = earned >= goal
    return (
      <div className="rounded-2xl border border-rose-400/20 bg-white/[.04] px-3.5 py-2.5 backdrop-blur">
        <div className="mb-1.5 flex items-center gap-2">
          <ColoredStar color="red" size={16} glow={6} />
          <span className="text-[11px] font-extrabold tracking-[.14em] text-rose-300/80 uppercase">
            本次月亮
          </span>
          <span className="font-fredoka ml-auto text-[14px] font-black tabular-nums text-rose-100">
            {earned}
            <span className="ml-0.5 text-[11px] text-rose-100/40">/{goal}</span>
          </span>
          <span
            className="inline-flex h-4 w-4 items-center justify-center"
            style={{
              filter: reached
                ? 'drop-shadow(0 0 6px rgba(239,68,68,.9))'
                : 'grayscale(40%)',
              opacity: reached ? 1 : 0.4,
            }}
            aria-hidden
          >
            <ColoredStar color="red" size={14} glow={0} />
          </span>
        </div>
        <div
          className="relative h-2 overflow-hidden rounded-full bg-white/[.06]"
          style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,.4)' }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #fb7185, #e11d48)',
              boxShadow:
                '0 0 10px rgba(244,63,94,.6), inset 0 1px 0 rgba(255,255,255,.35)',
            }}
          />
          {pct > 0 && pct < 100 && (
            <div
              className="pointer-events-none absolute inset-y-0 w-1/3 opacity-50 mix-blend-overlay"
              style={{
                left: `${Math.max(0, pct - 18)}%`,
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,.75), transparent)',
                animation: 'imm-moon-shimmer 1.6s linear infinite',
              }}
            />
          )}
        </div>
        <style jsx>{`
          @keyframes imm-moon-shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(280%); }
          }
        `}</style>
      </div>
    )
  })()

  return (
    <div className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-[#090914]">
      {/* Header */}
      <div className="z-10 flex shrink-0 flex-wrap items-center gap-2.5 border-b border-white/[.07] bg-[rgba(9,9,20,.98)] px-5 py-2.5">
        <div className="font-fredoka mr-auto flex items-center gap-2">
          <span className="bg-gradient-to-br from-[#a78bfa] to-[#7c3aed] bg-clip-text text-[1.05rem] text-transparent">
            ⚡ 沉浸模式 · {mode === 'vocab' ? '背单词' : '单词练习'}
          </span>
          {mode === 'practice' && inReinforcement && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 px-2.5 py-0.5 text-[10px] font-black tracking-wide text-white shadow-[0_2px_0_rgba(0,0,0,.25)]">
              🌱 巩固
            </span>
          )}
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
                : `${qTotal ? ((curQ + 1) / qTotal) * 100 : 0}%`,
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
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      right: 0,
                      width: topVisible ? '50%' : '100%',
                      borderLeft: topVisible ? '1px solid rgba(255,255,255,.06)' : 'none',
                      transition: 'width 450ms cubic-bezier(.4,0,.2,1)',
                    }
                  : {
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
                  dangerouslySetInnerHTML={{ __html: hilite(v.explanation, v.keywords) }}
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
          {!showResults && currentQ && (
            <QuizQuestionBody
              question={currentQ}
              options={qOptions}
              score={qScore}
              total={qTotal}
              runner={runner}
              questionKey={curQ}
              progressSlot={moonProgress}
              helpRevealed={helpRevealedForCurrent}
              onHelpReveal={handleHelpReveal}
              spellButtonStyle={spellButtonStyle}
            />
          )}

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
