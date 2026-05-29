'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { WordEntry } from '@/utils/type'
import {
  buildQuizOptions,
  buildQuizQuestions,
  normalizeQuizTypes,
  wordKey,
} from '@/utils/english-helpers'
import { getWordMasteryLevel } from '@/utils/masteryUtils'
import QuizCard from './QuizCard'
import MasteryStatusPanel from './MasteryStatusPanel'
import StudyPhase from './StudyPhase'
import DoneSummary from './DoneSummary'
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

interface OldReviewSnapshot {
  version: 1
  phase: 'study' | 'quiz'
  studyIdx: number
  wordKeys: string[]
  quizQs: { key: string; type: 'A' | 'B' | 'C' }[]
  curQ: number
  quizResults: { key: string; correct: boolean }[]
}

const OLD_REVIEW_STORAGE_KEY = 'old_review_session'

function loadOldReviewSnapshot(): OldReviewSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(OLD_REVIEW_STORAGE_KEY)
    if (!raw) return null
    const snap = JSON.parse(raw) as Partial<OldReviewSnapshot>
    if (snap.version !== 1) return null
    if (snap.phase !== 'study' && snap.phase !== 'quiz') return null
    return snap as OldReviewSnapshot
  } catch { return null }
}

export default function OldReviewSession({ words, vocab, onBack }: OldReviewSessionProps) {
  const { masteryMap, recordBatch } = useWordsContext()
  const { isImmersive, setIsImmersive } = useImmersive()

  // Read sessionStorage exactly once via a lazy-init state (immutable after mount)
  const [snap0] = useState(() => loadOldReviewSnapshot())
  const hydrationDone = useRef(false)

  const [phase, setPhase] = useState<Phase>(() => snap0?.phase ?? 'study')
  const [studyIdx, setStudyIdx] = useState(() => snap0?.studyIdx ?? 0)
  const [studyDefOnly, setStudyDefOnly] = useState(false)

  const [enabledTypes] = useState<Set<string>>(new Set(['A', 'B', 'C']))

  // Session words are stored as keys so they're vocab-independent (persistence
  // never corrupts mid-load). Snapshot takes precedence over `words` prop so an
  // interrupted session resumes with the exact same word list.
  const [sessionWordKeys] = useState<string[]>(
    () => snap0?.wordKeys ?? words.map(wordKey),
  )
  const sessionWords = useMemo<WordEntry[]>(
    () =>
      sessionWordKeys
        .map((k) => vocab.find((w) => wordKey(w) === k))
        .filter((w): w is WordEntry => w !== undefined),
    [sessionWordKeys, vocab],
  )

  const [quizQKeys, setQuizQKeys] = useState<{ key: string; type: 'A' | 'B' | 'C' }[]>(
    () => snap0?.quizQs ?? [],
  )
  const quizQs = useMemo<DpQuizQ[]>(
    () =>
      quizQKeys
        .map(({ key, type }) => {
          const entry = vocab.find((w) => wordKey(w) === key)
          return entry ? { word: entry, type } : null
        })
        .filter((q): q is DpQuizQ => q !== null),
    [quizQKeys, vocab],
  )

  const [curQ, setCurQ] = useState(() => snap0?.curQ ?? 0)
  const [score, setScore] = useState(() => snap0?.quizResults.filter((r) => r.correct).length ?? 0)
  const quizResultBuffer = useRef<{ entry: WordEntry; correct: boolean }[]>([])

  // One-time: hydrate quizResultBuffer + activate immersive mode after vocab is loaded
  useEffect(() => {
    if (hydrationDone.current || !snap0 || !vocab.length) return
    hydrationDone.current = true
    quizResultBuffer.current = snap0.quizResults
      .map(({ key, correct }) => {
        const entry = vocab.find((w) => wordKey(w) === key)
        return entry ? { entry, correct } : null
      })
      .filter((r): r is { entry: WordEntry; correct: boolean } => r !== null)
    setIsImmersive(true)
  }, [snap0, vocab, setIsImmersive])

  // Persist active session to sessionStorage on every relevant state change.
  // Cleared on 'done' or voluntary exit (flushAndBack); accidental exit keeps it.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (phase === 'done') {
      try { sessionStorage.removeItem(OLD_REVIEW_STORAGE_KEY) } catch { /* noop */ }
      return
    }
    try {
      sessionStorage.setItem(
        OLD_REVIEW_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          phase,
          studyIdx,
          wordKeys: sessionWordKeys,
          quizQs: quizQKeys,
          curQ,
          quizResults: quizResultBuffer.current
            .slice(0, curQ)
            .map(({ entry, correct }) => ({ key: wordKey(entry), correct })),
        } satisfies OldReviewSnapshot),
      )
    } catch { /* noop */ }
  }, [phase, studyIdx, sessionWordKeys, quizQKeys, curQ])

  // Flush any accumulated quiz results and exit — called on every exit path
  const flushAndBack = useCallback(() => {
    if (quizResultBuffer.current.length > 0) {
      recordBatch(quizResultBuffer.current)
      quizResultBuffer.current = []
    }
    try { sessionStorage.removeItem(OLD_REVIEW_STORAGE_KEY) } catch { /* noop */ }
    setIsImmersive(false)
    onBack()
  }, [recordBatch, setIsImmersive, onBack])

  const startQuiz = useCallback(() => {
    const types = normalizeQuizTypes([...enabledTypes] as ('A' | 'B' | 'C')[])
    const qs = buildQuizQuestions(sessionWords, types, Date.now())
    quizResultBuffer.current = []
    setQuizQKeys(qs.map((q) => ({ key: wordKey(q.word), type: q.type })))
    setCurQ(0)
    setScore(0)
    setPhase('quiz')
  }, [sessionWords, enabledTypes])

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

  const total = sessionWords.length

  // ── STUDY ────────────────────────────────────────────────────────────────
  if (phase === 'study') {
    const w = sessionWords[studyIdx]
    if (!w) return null
    return (
      <StudyPhase
        entry={w}
        currentIdx={studyIdx}
        totalCount={total}
        title="📖 旧词复习"
        studyDefOnly={studyDefOnly}
        onStudyDefOnlyChange={setStudyDefOnly}
        isImmersive={isImmersive}
        onExitImmersive={() => setIsImmersive(false)}
        progressGradientClasses="from-[#c084fc] via-[#a855f7] to-[#7c3aed]"
        nextButtonGradientClasses="from-[#7c3aed] to-[#a855f7]"
        nextButtonShadowClass="shadow-[0_3px_12px_rgba(124,58,237,.4)]"
        wordBadge={
          <span className="rounded-full border border-[rgba(167,139,250,.3)] bg-[rgba(167,139,250,.2)] px-2 py-0.5 text-[.6rem] font-extrabold tracking-wider uppercase text-[#c4b5fd]">
            旧词复习
          </span>
        }
        onBack={flushAndBack}
        onPrev={() => setStudyIdx(studyIdx - 1)}
        onNext={() => setStudyIdx(studyIdx + 1)}
        onComplete={() => { setIsImmersive(true); startQuiz() }}
        completeButtonText="✅ 开始测试 →"
      />
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
              setQuizQKeys([])
              setCurQ(0)
              setScore(0)
              quizResultBuffer.current = []
              setStudyIdx(0)
              setPhase('study')
            }}
            className="font-nunito shrink-0 cursor-pointer rounded-full border-[1.5px] border-[var(--wm-border)] bg-transparent px-3.5 py-1.5 text-[0.875rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent4)] hover:text-[var(--wm-accent4)]"
          >
            ← 回到记忆
          </button>
          <div className="font-fredoka text-[1.1rem] text-[var(--wm-text)]">✏️ 旧词测试</div>
          <button
            onClick={flushAndBack}
            className="font-nunito ml-auto shrink-0 cursor-pointer rounded-full border-[1.5px] border-[var(--wm-border)] bg-transparent px-3.5 py-1.5 text-[0.875rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent4)] hover:text-[var(--wm-accent4)]"
          >
            退出复习
          </button>
        </div>
        <QuizCard
          key={curQ}
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
    const masteredCount = sessionWords.filter(
      w => getWordMasteryLevel(masteryMap[wordKey(w)]?.correct ?? 0) === 3,
    ).length

    return (
      <>
        <DoneSummary
          score={score}
          total={totalQs}
          scoreGradientClasses="from-[#7c3aed] to-[#a855f7]"
          detailLine={`正确率 ${pct}% · 旧词复习 ${sessionWords.length} 个单词`}
          masteredCount={masteredCount}
          wordsCount={sessionWords.length}
          actions={
            <>
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
            </>
          }
        />
        <MasteryStatusPanel vocab={vocab} masteryMap={masteryMap} />
      </>
    )
  }

  return null
}
