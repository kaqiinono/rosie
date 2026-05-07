'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import type { WordEntry } from '@/utils/type'
import {
  buildQuizOptions,
  hilite,
  highlightExample,
  wordKey,
} from '@/utils/english-helpers'
import { getWordMasteryLevel } from '@/utils/masteryUtils'
import PhonicsWord from './PhonicsWord'
import QuizCard from './QuizCard'
import MasteryStatusPanel from './MasteryStatusPanel'
import { useWordsContext } from '@/contexts/WordsContext'
import { useImmersive } from '@/contexts/ImmersiveContext'

interface OldReviewSessionProps {
  words: WordEntry[]          // pre-computed due words, ordered by urgency
  vocab: WordEntry[]          // full vocab for quiz distractors
  onBack: () => void
}

type Phase = 'study' | 'quiz' | 'done'

interface DpQuizQ {
  word: WordEntry
  type: 'A' | 'B' | 'C'
}

export default function OldReviewSession({ words, vocab, onBack }: OldReviewSessionProps) {
  const { masteryMap, recordBatch } = useWordsContext()
  const { isImmersive, setIsImmersive } = useImmersive()

  const [phase, setPhase] = useState<Phase>('study')
  const [studyIdx, setStudyIdx] = useState(0)
  const [studyDefOnly, setStudyDefOnly] = useState(false)
  const [studyWordVisible, setStudyWordVisible] = useState(false)

  const [enabledTypes] = useState<Set<string>>(new Set(['A', 'B', 'C']))

  const [quizQs, setQuizQs] = useState<DpQuizQ[]>([])
  const [curQ, setCurQ] = useState(0)
  const [score, setScore] = useState(0)
  const quizResultBuffer = useRef<{ entry: WordEntry; correct: boolean }[]>([])

  // Flush any accumulated quiz results and exit — called on every exit path
  const flushAndBack = useCallback(() => {
    if (quizResultBuffer.current.length > 0) {
      recordBatch(quizResultBuffer.current)
      quizResultBuffer.current = []
    }
    setIsImmersive(false)
    onBack()
  }, [recordBatch, setIsImmersive, onBack])

  const startQuiz = useCallback(() => {
    const types = [...enabledTypes] as ('A' | 'B' | 'C')[]
    const queues = words.map(w => types.map(t => ({ word: w, type: t })))
    const qs: DpQuizQ[] = []
    while (queues.some(q => q.length > 0)) {
      const nonEmpty = queues.filter(q => q.length > 0)
      qs.push(nonEmpty[Math.floor(Math.random() * nonEmpty.length)].shift()!)
    }
    quizResultBuffer.current = []
    setQuizQs(qs)
    setCurQ(0)
    setScore(0)
    setPhase('quiz')
  }, [words, enabledTypes])

  const handleAnswer = useCallback(
    (correct: boolean) => {
      if (correct) setScore(s => s + 1)
      if (quizQs[curQ]) quizResultBuffer.current.push({ entry: quizQs[curQ].word, correct })
    },
    [quizQs, curQ],
  )

  const nextQ = useCallback(() => {
    const next = curQ + 1
    if (next >= quizQs.length) {
      recordBatch(quizResultBuffer.current)
      quizResultBuffer.current = []
      setPhase('done')
    } else {
      setCurQ(next)
    }
  }, [curQ, quizQs, recordBatch])

  const quizOptions = useMemo(() => {
    const q = quizQs[curQ]
    if (!q) return []
    const seed = curQ * 997 + quizQs.length
    return buildQuizOptions(q.word, vocab, seed)
  }, [quizQs, curQ, vocab])

  const total = words.length

  // ── STUDY ────────────────────────────────────────────────────────────────
  if (phase === 'study') {
    const w = words[studyIdx]
    if (!w) return null
    return (
      <div
        className="mx-auto flex max-w-[1280px] flex-col overflow-hidden px-4 max-sm:px-3"
        style={{ height: isImmersive ? '100dvh' : 'calc(100dvh - 56px)' }}
      >
        <div className="mb-0 flex shrink-0 flex-wrap items-center gap-2 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              onClick={flushAndBack}
              className="font-nunito shrink-0 cursor-pointer rounded-full border-[1.5px] border-[var(--wm-border)] bg-transparent px-3 py-1.5 text-[.75rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent4)] hover:text-[var(--wm-accent4)]"
            >
              ← 返回
            </button>
            <div className="font-fredoka truncate text-[1rem] text-[var(--wm-text)]">
              📖 旧词复习
            </div>
          </div>
          <div className="shrink-0 rounded-full border border-[var(--wm-border)] bg-[var(--wm-surface)] px-2.5 py-1 text-[.72rem] font-bold whitespace-nowrap text-[var(--wm-text-dim)]">
            {studyIdx + 1} / {total}
          </div>
          <button
            onClick={() => {
              setStudyDefOnly(!studyDefOnly)
              setStudyWordVisible(false)
            }}
            className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-[.72rem] font-extrabold whitespace-nowrap transition-all select-none ${
              studyDefOnly
                ? 'border-[#f59e0b] bg-[rgba(245,158,11,.15)] text-[#fbbf24]'
                : 'border-white/10 bg-white/5 text-white/50'
            }`}
          >
            <span>✨</span> 仅看释义
            <div
              className={`relative h-3.5 w-7 rounded-[7px] transition-colors ${studyDefOnly ? 'bg-[rgba(245,158,11,.5)]' : 'bg-white/10'}`}
            >
              <div
                className={`absolute top-0.5 left-0.5 h-2.5 w-2.5 rounded-full transition-all ${studyDefOnly ? 'translate-x-3.5 bg-[#f59e0b]' : 'bg-white/40'}`}
              />
            </div>
          </button>
          {isImmersive && (
            <button
              onClick={() => setIsImmersive(false)}
              className="shrink-0 cursor-pointer rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[.72rem] font-bold text-white/55 transition-all hover:bg-white/20 hover:text-white/80"
            >
              ✕ 退出沉浸
            </button>
          )}
        </div>
        <div className="mb-2 h-[3px] shrink-0 rounded-sm bg-white/[.04]">
          <div
            className="h-full rounded-sm bg-gradient-to-r from-[#c084fc] via-[#a855f7] to-[#7c3aed] transition-[width] duration-400"
            style={{ width: `${((studyIdx + 1) / total) * 100}%` }}
          />
        </div>

        <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-[16px] border border-[var(--wm-border)] max-sm:flex-col">
          {/* Left — word */}
          <div
            className={`relative flex flex-col items-center justify-center gap-3 overflow-hidden px-7 py-6 transition-all duration-400 max-sm:px-5 ${
              studyDefOnly && !studyWordVisible
                ? 'w-0 overflow-hidden p-0 opacity-0 max-sm:h-0 max-sm:w-full'
                : 'w-1/2 opacity-100 max-sm:h-[45%] max-sm:w-full'
            }`}
            style={{ background: 'linear-gradient(135deg, #1a1a30 0%, #12122a 100%)' }}
          >
            <div className="font-fredoka pointer-events-none absolute top-1/2 right-[-10px] -translate-y-1/2 text-[min(35vw,240px)] leading-none text-white/[.022] select-none">
              {w.word.charAt(0).toUpperCase()}
            </div>
            <div className="relative z-[1] flex flex-wrap justify-center gap-1.5">
              <span className="rounded-full border border-[rgba(167,139,250,.3)] bg-[rgba(167,139,250,.2)] px-2 py-0.5 text-[.6rem] font-extrabold tracking-wider uppercase text-[#c4b5fd]">
                旧词复习
              </span>
              <span className="rounded-full border border-[rgba(233,69,96,.3)] bg-[rgba(233,69,96,.2)] px-2 py-0.5 text-[.6rem] font-extrabold tracking-wider text-[var(--wm-accent)] uppercase">
                {w.unit}
              </span>
            </div>
            <div className="font-nunito relative z-[1] text-center text-[clamp(2rem,5vw,3.5rem)] leading-tight font-black break-words">
              <PhonicsWord text={w.word} syllables={w.syllables} />
            </div>
            {w.ipa && (
              <div className="relative z-[1] text-[clamp(.85rem,1.8vw,1rem)] font-semibold text-[var(--wm-accent2)] italic opacity-85">
                {w.ipa}
              </div>
            )}
            {w.example && (
              <div className="relative z-[1] w-full border-t border-white/[.07] pt-3 text-center">
                <div className="mb-1.5 text-[.55rem] font-extrabold tracking-widest text-white/30 uppercase">
                  例句
                </div>
                <div
                  className="text-[1rem] leading-loose text-[rgba(200,200,255,.5)] italic [&_strong]:font-extrabold [&_strong]:text-[#4ade80] [&_strong]:not-italic"
                  dangerouslySetInnerHTML={{ __html: highlightExample(w.example, w.word) }}
                />
              </div>
            )}
          </div>

          {/* Right — definition */}
          <div
            onClick={() => { if (studyDefOnly) setStudyWordVisible(!studyWordVisible) }}
            className={`relative flex flex-col items-center justify-center px-7 py-6 transition-all duration-400 max-sm:w-full max-sm:px-5 ${
              studyDefOnly && !studyWordVisible
                ? 'w-full cursor-pointer max-sm:flex-1'
                : studyDefOnly
                  ? 'w-1/2 cursor-pointer max-sm:flex-1'
                  : 'w-1/2 cursor-default max-sm:flex-1'
            }`}
            style={{ background: 'linear-gradient(135deg, #0e2a50 0%, #1a1a2e 100%)' }}
          >
            <div className="flex w-full max-w-[420px] flex-col items-start gap-2">
              <div className="text-[.6rem] font-extrabold tracking-widest text-[rgba(96,165,250,.6)] uppercase">
                释义
              </div>
              <div
                className="text-[clamp(1rem,2.5vw,1.45rem)] leading-loose font-bold text-[#f0f0ff]"
                dangerouslySetInnerHTML={{ __html: hilite(w.explanation, w.word, w.keywords) }}
              />
            </div>
            {studyDefOnly && (
              <div className="absolute right-5 bottom-4 flex items-center gap-1 text-[.65rem] font-bold text-white/25">
                {studyWordVisible ? '点击隐藏单词' : '点击查看单词'}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-center gap-3.5 py-2">
          <button
            onClick={() => {
              if (studyIdx > 0) { setStudyIdx(studyIdx - 1); setStudyWordVisible(false) }
            }}
            disabled={studyIdx === 0}
            className="font-nunito cursor-pointer rounded-full border-[1.5px] border-white/10 bg-transparent px-6 py-2.5 text-[1rem] font-bold text-white/40 transition-all hover:border-[#60a5fa] hover:text-[#93c5fd] disabled:cursor-default disabled:opacity-20"
          >
            ← 上一个
          </button>
          <div className="min-w-[60px] text-center text-[0.875rem] font-bold text-white/30">
            {studyIdx + 1} / {total}
          </div>
          <button
            onClick={() => {
              if (studyIdx < total - 1) {
                setStudyIdx(studyIdx + 1)
                setStudyWordVisible(false)
              } else {
                setIsImmersive(true)
                startQuiz()
              }
            }}
            className="font-nunito cursor-pointer rounded-full border-0 bg-gradient-to-br from-[#7c3aed] to-[#a855f7] px-7 py-2.5 text-[1rem] font-extrabold text-white shadow-[0_3px_12px_rgba(124,58,237,.4)] hover:-translate-y-px"
          >
            {studyIdx === total - 1 ? '✅ 开始测试 →' : '下一个 →'}
          </button>
        </div>
      </div>
    )
  }

  // ── QUIZ ─────────────────────────────────────────────────────────────────
  if (phase === 'quiz' && quizQs[curQ]) {
    const q = quizQs[curQ]
    return (
      <div className="mx-auto max-w-[1280px] px-4 py-5">
        <div className="mb-2 flex items-center gap-3 py-3">
          <button
            onClick={() => {
              // Flush results so far before returning to study phase
              if (quizResultBuffer.current.length > 0) {
                recordBatch(quizResultBuffer.current)
                quizResultBuffer.current = []
              }
              setStudyIdx(0)
              setStudyWordVisible(false)
              setPhase('study')
            }}
            className="font-nunito shrink-0 cursor-pointer rounded-full border-[1.5px] border-[var(--wm-border)] bg-transparent px-3.5 py-1.5 text-[0.875rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent4)] hover:text-[var(--wm-accent4)]"
          >
            ← 回到记忆
          </button>
          <div className="font-fredoka text-[1.1rem] text-[var(--wm-text)]">✏️ 旧词测试</div>
        </div>
        <QuizCard
          question={{ word: q.word, type: q.type }}
          options={quizOptions}
          currentIndex={curQ}
          totalCount={quizQs.length}
          score={score}
          onAnswer={handleAnswer}
          onNext={nextQ}
        />
      </div>
    )
  }

  // ── DONE ─────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const totalQs = quizQs.length
    const pct = totalQs ? Math.round((score / totalQs) * 100) : 0
    const emoji = pct >= 90 ? '🏆' : pct >= 70 ? '🎉' : pct >= 50 ? '👍' : '💪'
    const msg = pct >= 90 ? '完美！' : pct >= 70 ? '太棒了！' : pct >= 50 ? '不错哦！' : '继续加油！'
    const masteredCount = words.filter(
      w => getWordMasteryLevel(masteryMap[wordKey(w)]?.correct ?? 0) === 3,
    ).length

    return (
      <>
        <div className="mx-auto max-w-[500px] px-5 py-10 text-center">
          <div className="mb-3.5 text-[3.5rem]">{emoji}</div>
          <div className="font-fredoka mb-1.5 bg-gradient-to-br from-[#7c3aed] to-[#a855f7] bg-clip-text text-[3rem] text-transparent">
            {score} / {totalQs}
          </div>
          <div className="mb-2.5 text-[.9rem] font-bold text-[var(--wm-text-dim)]">{msg}</div>
          <div className="mb-2 text-[0.875rem] leading-loose text-[var(--wm-text-dim)]">
            正确率 {pct}% · 旧词复习 {words.length} 个单词
          </div>
          <div className="mb-5 text-[1rem] font-bold text-[#4ade80]">
            本次练习：{masteredCount}/{words.length} 个单词已掌握 🦋
          </div>
          <div className="flex flex-wrap justify-center gap-2.5">
            <button
              onClick={() => startQuiz()}
              className="font-nunito cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#7c3aed] to-[#a855f7] px-6 py-2.5 text-[.88rem] font-extrabold text-white shadow-[0_3px_12px_rgba(124,58,237,.35)]"
            >
              🔄 重新测试
            </button>
            <button
              onClick={() => { setIsImmersive(false); onBack() }}
              className="font-nunito cursor-pointer rounded-[10px] border-[1.5px] border-[var(--wm-border)] bg-transparent px-5 py-2.5 text-[1rem] font-bold text-[var(--wm-text-dim)]"
            >
              ← 返回
            </button>
          </div>
        </div>
        <MasteryStatusPanel vocab={vocab} masteryMap={masteryMap} />
      </>
    )
  }

  return null
}
