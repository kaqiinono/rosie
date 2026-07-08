'use client'

import { use, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { useMathSolved } from '@rosie/math/hooks/useMathSolved'
import { useMathQuiz, computeQuizPoints } from '@rosie/math/hooks/useMathQuiz'
import { supabase } from '@rosie/core'
import { useStarHud } from '@rosie/rewards'
import { StarProgressBar } from '@rosie/rewards'
import { PROBLEMS as G1Lesson12PROBLEMS } from '@rosie/math/utils/g1/lesson12-data'
import { PROBLEMS as G1Lesson13PROBLEMS } from '@rosie/math/utils/g1/lesson13-data'
import { PROBLEMS as G1Lesson15PROBLEMS } from '@rosie/math/utils/g1/lesson15-data'
import { PROBLEMS as G1Lesson18PROBLEMS } from '@rosie/math/utils/g1/lesson18-data'
import { PROBLEMS as G1Lesson23PROBLEMS } from '@rosie/math/utils/g1/lesson23-data'
import { PROBLEMS as G1Lesson29PROBLEMS } from '@rosie/math/utils/g1/lesson29-data'
import { PROBLEMS as G1Lesson30PROBLEMS } from '@rosie/math/utils/g1/lesson30-data'
import { PROBLEMS as G1Lesson34PROBLEMS } from '@rosie/math/utils/g1/lesson34-data'
import { PROBLEMS as G1Lesson35PROBLEMS } from '@rosie/math/utils/g1/lesson35-data'
import { PROBLEMS as G1Lesson36PROBLEMS } from '@rosie/math/utils/g1/lesson36-data'
import { PROBLEMS as G1Lesson37PROBLEMS } from '@rosie/math/utils/g1/lesson37-data'
import { PROBLEMS as G1Lesson38PROBLEMS } from '@rosie/math/utils/g1/lesson38-data'
import { PROBLEMS as G1Lesson39PROBLEMS } from '@rosie/math/utils/g1/lesson39-data'
import { PROBLEMS as G1Lesson40PROBLEMS } from '@rosie/math/utils/g1/lesson40-data'
import { PROBLEMS as G1Lesson41PROBLEMS } from '@rosie/math/utils/g1/lesson41-data'
import { PROBLEMS as G1Lesson42PROBLEMS } from '@rosie/math/utils/g1/lesson42-data'
import { PROBLEMS as G1Lesson43PROBLEMS } from '@rosie/math/utils/g1/lesson43-data'
import { PROBLEMS as G1Lesson44PROBLEMS } from '@rosie/math/utils/g1/lesson44-data'
import { PROBLEMS as G1Lesson46PROBLEMS } from '@rosie/math/utils/g1/lesson46-data'
import { PROBLEMS as G1Lesson47PROBLEMS } from '@rosie/math/utils/g1/lesson47-data'
import { PROBLEMS as G2Lesson1PROBLEMS } from '@rosie/math/utils/g2/lesson1-data'
import { PROBLEMS as G2Lesson2PROBLEMS } from '@rosie/math/utils/g2/lesson2-data'
import { PROBLEMS as G2Lesson6PROBLEMS } from '@rosie/math/utils/g2/lesson6-data'
import { PROBLEMS as G2Lesson7PROBLEMS } from '@rosie/math/utils/g2/lesson7-data'
import { PROBLEMS as G2Lesson5PROBLEMS } from '@rosie/math/utils/g2/lesson5-data'
import { PROBLEMS as G2Lesson4PROBLEMS } from '@rosie/math/utils/g2/lesson4-data'
import { PROBLEMS as G2Lesson3PROBLEMS } from '@rosie/math/utils/g2/lesson3-data'
import type { Problem, ProblemSet } from '@rosie/core'
import type { QuizPaper, QuizAnswerRecord } from '@rosie/math/hooks/useMathQuiz'
import { checkProblemAnswer, isInteractiveProblem } from '@rosie/math/utils/check-problem-answer'
import { injectFigureGridCallbacks } from '@rosie/math/components/shared/injectFigureSubmit'
import ScratchPadTrigger from '@rosie/math/components/shared/ScratchPad/ScratchPadTrigger'
import QuizProblemSolution from '@rosie/math/components/shared/QuizProblemSolution'
import { submitPracticeAttempt } from '@rosie/math/utils/submitPracticeAttempt'
import {
  clearAllScratchWorkingForPaper,
  fetchAllScratchWorkingForPaper,
} from '@rosie/math/utils/math-scratch-db'
import { mathWrongStore } from '@rosie/math/hooks/useMathWrong'

// ── Problem lookup ─────────────────────────────────────────────────────────────

const LESSON_DATA: Record<string, ProblemSet> = {
  '1-12': G1Lesson12PROBLEMS,
  '1-13': G1Lesson13PROBLEMS,
  '1-15': G1Lesson15PROBLEMS,
  '1-18': G1Lesson18PROBLEMS,
  '1-23': G1Lesson23PROBLEMS,
  '1-29': G1Lesson29PROBLEMS,
  '1-30': G1Lesson30PROBLEMS,
  '1-34': G1Lesson34PROBLEMS,
  '1-35': G1Lesson35PROBLEMS,
  '1-36': G1Lesson36PROBLEMS,
  '1-37': G1Lesson37PROBLEMS,
  '1-38': G1Lesson38PROBLEMS,
  '1-39': G1Lesson39PROBLEMS,
  '1-40': G1Lesson40PROBLEMS,
  '1-41': G1Lesson41PROBLEMS,
  '1-42': G1Lesson42PROBLEMS,
  '1-43': G1Lesson43PROBLEMS,
  '1-44': G1Lesson44PROBLEMS,
  '1-46': G1Lesson46PROBLEMS,
  '1-47': G1Lesson47PROBLEMS,
  '2-1': G2Lesson1PROBLEMS,
  '2-2': G2Lesson2PROBLEMS,
  '2-6': G2Lesson6PROBLEMS,
  '2-7': G2Lesson7PROBLEMS,
  '2-5': G2Lesson5PROBLEMS,
  '2-4': G2Lesson4PROBLEMS,
  '2-3': G2Lesson3PROBLEMS,
}

const LESSON_NAMES: Record<string, string> = {
  '1-12': '巧算加减法进阶',
  '1-13': '植树问题',
  '1-15': '和差问题',
  '1-18': '和差倍初步',
  '1-23': '逻辑推理',
  '1-29': '算符大作战',
  '1-30': '和差倍进阶',
  '1-34': '乘法分配律',
  '1-35': '归一问题',
  '1-36': '星期几问题',
  '1-37': '鸡兔同笼',
  '1-38': '一笔画',
  '1-39': '盈亏问题',
  '1-40': '周长问题',
  '1-41': '间隔趣题',
  '1-42': '生活智力题',
  '1-43': '等差数列初识',
  '1-44': '统筹优化',
  '1-46': '抽屉原理与最不利',
  '1-47': '方格中的秘密',
  '2-1': '加减法速算与巧算',
  '2-2': '等量代换与归一问题',
  '2-6': '简单枚举',
  '2-7': '数字谜',
  '2-5': '找规律',
  '2-4': '差倍问题',
  '2-3': '等量代换与归一问题',
}

type SectionKey = 'pretest' | 'lesson' | 'homework' | 'workbook' | 'supplement'
const ALL_SECTIONS: SectionKey[] = ['lesson', 'homework', 'workbook', 'supplement', 'pretest']

const PROBLEM_MAP = (() => {
  const map = new Map<string, { problem: Problem; lessonId: string; section: SectionKey }>()
  for (const [lessonId, data] of Object.entries(LESSON_DATA)) {
    for (const section of ALL_SECTIONS) {
      const problems = data[section]
      if (!problems) continue
      for (const p of problems) map.set(p.id, { problem: p, lessonId, section })
    }
  }
  return map
})()

const SECTION_LABELS: Record<SectionKey, string> = {
  lesson: '课堂讲解',
  homework: '课后巩固',
  workbook: '拓展练习',
  supplement: '附加题',
  pretest: '课前测',
}

function paperProblemsList(paper: QuizPaper): Problem[] {
  return paper.problems
    .map((item) => PROBLEM_MAP.get(item.problemId)?.problem)
    .filter((p): p is Problem => Boolean(p))
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QuizDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuth()
  const { handleSolve } = useMathSolved(user)
  const { completePaper, saveDraftPaper, savePaperProgress } = useMathQuiz(user)
  const { awardStars } = useStarHud()
  const [starBreakdown, setStarBreakdown] = useState<{ base: number; bonus: number } | null>(null)

  const [paper, setPaper] = useState<QuizPaper | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [interactiveStates, setInteractiveStates] = useState<Record<string, unknown>>({})
  const [interactiveTouched, setInteractiveTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [results, setResults] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('math_quiz_papers')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const p: QuizPaper = {
            id: data.id as string,
            title: data.title as string,
            problems: data.problems as QuizPaper['problems'],
            score: data.score as number | null,
            totalScore: data.total_score as number,
            answers: data.answers as QuizPaper['answers'],
            completedAt: data.completed_at as string | null,
            createdAt: data.created_at as string,
          }
          setPaper(p)
          if (p.completedAt && p.answers) {
            setSubmitted(true)
            const res: Record<string, boolean> = {}
            for (const [k, v] of Object.entries(p.answers)) {
              res[k] = v.correct ?? false
            }
            setResults(res)
            const savedAnswers: Record<string, string> = {}
            for (const [k, v] of Object.entries(p.answers)) {
              savedAnswers[k] = v.userAnswer != null ? String(v.userAnswer) : ''
            }
            setAnswers(savedAnswers)
          } else if (p.answers) {
            const savedAnswers: Record<string, string> = {}
            const savedInteractive: Record<string, unknown> = {}
            const savedTouched: Record<string, boolean> = {}
            for (const [k, v] of Object.entries(p.answers)) {
              if (v.interactiveState != null) {
                savedInteractive[k] = v.interactiveState
                savedTouched[k] = true
              } else if (v.userAnswer != null) {
                savedAnswers[k] = String(v.userAnswer)
              }
            }
            setAnswers(savedAnswers)
            setInteractiveStates(savedInteractive)
            setInteractiveTouched(savedTouched)
          }
        }
        setLoading(false)
      })
  }, [user, id])

  const pointsArr = paper ? computeQuizPoints(paper.problems.length) : []
  const totalScore = paper ? pointsArr.reduce((s, p) => s + p, 0) : 100

  function isProblemAnswered(problemId: string, problem: Problem): boolean {
    if (isInteractiveProblem(problem)) {
      return interactiveTouched[problemId] === true
    }
    return (answers[problemId] ?? '').trim() !== ''
  }

  function recordInteractiveState(problemId: string, state: unknown) {
    setInteractiveStates((prev) => ({ ...prev, [problemId]: state }))
    setInteractiveTouched((prev) => ({ ...prev, [problemId]: true }))
  }

  const buildDraftAnswers = useCallback((): Record<string, QuizAnswerRecord> => {
    if (!paper) return {}
    const records: Record<string, QuizAnswerRecord> = {}
    for (const item of paper.problems) {
      const entry = PROBLEM_MAP.get(item.problemId)
      if (!entry) continue
      const { problem } = entry
      const existing = paper.answers?.[item.problemId]

      let record: QuizAnswerRecord | null = null

      if (isInteractiveProblem(problem)) {
        if (interactiveTouched[item.problemId]) {
          record = {
            userAnswer: null,
            correct: existing?.correct ?? null,
            interactiveState: interactiveStates[item.problemId],
          }
        }
      } else {
        const raw = answers[item.problemId] ?? ''
        if (raw.trim() !== '') {
          const parsed = parseFloat(raw)
          record = {
            userAnswer: Number.isFinite(parsed) ? parsed : null,
            correct: existing?.correct ?? null,
          }
        }
      }

      if (!record) continue
      const hasData =
        record.userAnswer != null || record.interactiveState != null || record.correct != null
      if (hasData) records[item.problemId] = record
    }
    return records
  }, [paper, answers, interactiveTouched, interactiveStates])

  const persistAnswers = useCallback(
    async (records: Record<string, QuizAnswerRecord>, isSubmitted = submitted) => {
      if (!paper || !user) return false
      const ok = isSubmitted
        ? await savePaperProgress(paper.id, records)
        : await saveDraftPaper(paper.id, records)
      if (ok) {
        setPaper((prev) => (prev ? { ...prev, answers: records } : prev))
      }
      return ok
    },
    [paper, user, submitted, savePaperProgress, saveDraftPaper],
  )

  async function handleSaveDraft() {
    if (!paper || !user || submitted) return
    const draftAnswers = buildDraftAnswers()
    if (Object.keys(draftAnswers).length === 0) return

    setSaving(true)
    setSaveMessage(null)
    const ok = await persistAnswers(draftAnswers, false)
    setSaving(false)
    if (ok) {
      setSaveMessage('已暂存，下次可继续作答')
      window.setTimeout(() => setSaveMessage(null), 3000)
    } else {
      setSaveMessage('暂存失败，请稍后重试')
    }
  }

  async function handleSubmit() {
    if (!paper || !user) return
    setSubmitting(true)

    const workingMap = await fetchAllScratchWorkingForPaper(user.id, paper.id)
    const newResults: Record<string, boolean> = {}
    const answerRecords: Record<string, QuizAnswerRecord> = {}

    for (const item of paper.problems) {
      const entry = PROBLEM_MAP.get(item.problemId)
      if (!entry) continue
      const { problem, section } = entry
      const working = workingMap.get(item.problemId)

      if (isInteractiveProblem(problem)) {
        const state = interactiveStates[item.problemId]
        const result = checkProblemAnswer(problem, state)
        const correct = result.ok
        newResults[item.problemId] = correct
        answerRecords[item.problemId] = {
          userAnswer: null,
          correct,
          interactiveState: state,
        }
        await submitPracticeAttempt({
          userId: user.id,
          problem,
          section: 'quiz',
          correct,
          objects: working?.objects ?? [],
          answerSnapshot: state ?? null,
          paperId: paper.id,
        })
        if (correct) {
          await handleSolve(item.problemId)
        } else {
          mathWrongStore.invalidate(user.id)
        }
        continue
      }

      const raw = answers[item.problemId] ?? ''
      const userAnswer = raw === '' ? null : parseFloat(raw)
      const result = checkProblemAnswer(problem, userAnswer)
      const correct = result.ok
      newResults[item.problemId] = correct
      answerRecords[item.problemId] = {
        userAnswer,
        correct,
      }
      await submitPracticeAttempt({
        userId: user.id,
        problem,
        section: 'quiz',
        correct,
        objects: working?.objects ?? [],
        answerSnapshot: userAnswer,
        paperId: paper.id,
      })
      if (correct) {
        await handleSolve(item.problemId)
      } else {
        mathWrongStore.invalidate(user.id)
      }
    }

    await clearAllScratchWorkingForPaper(user.id, paper.id)

    const score = paper.problems.reduce(
      (sum, item, idx) => sum + (newResults[item.problemId] ? pointsArr[idx] : 0),
      0,
    )

    await completePaper(paper.id, score, answerRecords)

    setResults(newResults)
    setSubmitted(true)
    setSubmitting(false)

    // ── Award blue stars: +1 per correct, +20% bonus if all correct
    const correctN = paper.problems.filter((item) => newResults[item.problemId]).length
    const allCorrect = correctN > 0 && correctN === paper.problems.length
    const bonus = allCorrect ? Math.round(correctN * 0.2) : 0
    setStarBreakdown({ base: correctN, bonus })
    if (correctN > 0) {
      void awardStars('blue', correctN, {
        bonus,
        bonusLabel: bonus > 0 ? `全对加成 +20% (+${bonus}⭐)` : undefined,
      })
    }
  }

  const hasProgress =
    paper?.problems.some((item) => {
      const entry = PROBLEM_MAP.get(item.problemId)
      if (!entry) return false
      return isProblemAnswered(item.problemId, entry.problem)
    }) ?? false

  const allAnswered =
    paper?.problems.every((item) => {
      const entry = PROBLEM_MAP.get(item.problemId)
      if (!entry) return false
      return isProblemAnswered(item.problemId, entry.problem)
    }) ?? false

  const correctCount = submitted ? Object.values(results).filter(Boolean).length : 0
  const finalScore =
    submitted && paper
      ? paper.problems.reduce(
          (sum, item, idx) => sum + (results[item.problemId] ? pointsArr[idx] : 0),
          0,
        )
      : 0

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-200 border-t-indigo-500" />
          <span className="text-sm text-slate-400">加载中…</span>
        </div>
      </div>
    )
  }

  if (!paper) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-slate-500">找不到该试卷</p>
        <Link href="/math/ny/quiz" className="text-sm text-indigo-500 no-underline hover:underline">
          ← 返回组卷
        </Link>
      </div>
    )
  }

  const unansweredCount = paper.problems.filter((item) => {
    const entry = PROBLEM_MAP.get(item.problemId)
    if (!entry) return true
    return !isProblemAnswered(item.problemId, entry.problem)
  }).length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 pr-[168px] pl-4 lg:pr-4">
          <Link
            href="/math/ny/quiz"
            className="flex shrink-0 items-center gap-1.5 text-sm text-slate-400 no-underline transition-colors hover:text-slate-600"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 12L6 8l4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            返回
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
            {paper.title}
          </h1>
          <Link
            href={`/math/ny/quiz/${id}/print${submitted ? '?mode=complete' : ''}`}
            target="_blank"
            className="flex shrink-0 items-center gap-1 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 no-underline transition-colors hover:bg-indigo-100"
            title="打印试卷"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path
                d="M3.5 5V2h7v3M3.5 10.5h-1a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1h-1M3.5 8.5h7V12h-7z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden sm:inline">打印</span>
          </Link>
          {submitted && (
            <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
              {finalScore}/{totalScore}分
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5">
        {/* ── Star progress (live) ─────────────────────────────────────── */}
        {!submitted && paper.problems.length > 0 && (
          <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3">
            <StarProgressBar
              color="blue"
              target={paper.problems.length}
              label="本套试卷可得"
              compact
            />
            <p className="mt-1.5 text-[11px] text-blue-700/70">
              答对 1 题 +1 <span className="font-bold">蓝⭐</span>，全对再加成 +20%！
            </p>
          </div>
        )}

        {/* ── Score summary ────────────────────────────────────────────── */}
        {submitted && (
          <div
            className="mb-5 overflow-hidden rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              border: '1.5px solid #a7f3d0',
            }}
          >
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1">
                <div className="text-3xl leading-none font-black text-emerald-700">
                  {finalScore}
                  <span className="ml-1 text-base font-semibold text-emerald-500">
                    / {totalScore} 分
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-emerald-600">
                  答对 {correctCount} 题 · 答错 {paper.problems.length - correctCount} 题 · 满分{' '}
                  {totalScore} 分
                </p>
              </div>
              <div className="text-4xl">
                {correctCount === paper.problems.length
                  ? '🎉'
                  : correctCount >= paper.problems.length * 0.6
                    ? '👍'
                    : '📚'}
              </div>
            </div>

            {/* Star reward breakdown */}
            {starBreakdown && starBreakdown.base + starBreakdown.bonus > 0 && (
              <div className="border-t border-emerald-200 bg-white/60 px-5 py-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-bold">
                  <span className="text-blue-700">
                    本次获得{' '}
                    <span className="font-fredoka text-[18px] text-blue-600">
                      {starBreakdown.base + starBreakdown.bonus}
                    </span>{' '}
                    蓝⭐
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-600">基础 +{starBreakdown.base}</span>
                  {starBreakdown.bonus > 0 && (
                    <>
                      <span className="text-slate-500">·</span>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                        全对加成 +{starBreakdown.bonus} (+20%)
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {correctCount < paper.problems.length && (
              <div className="border-t border-emerald-200 px-5 py-2.5">
                <Link
                  href="/math/mistakes"
                  className="text-xs font-semibold text-rose-500 no-underline hover:text-rose-700"
                >
                  📕 查看错题本 →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── Problem list ─────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-col gap-3">
          {paper.problems.map((item, i) => {
            const entry = PROBLEM_MAP.get(item.problemId)
            if (!entry) return null
            const { problem, section } = entry
            const ans = answers[item.problemId] ?? ''
            const isCorrect = submitted ? results[item.problemId] : undefined
            const pts = pointsArr[i] ?? 0
            const quizProblemList = paperProblemsList(paper)
            const quizProblemIndex = quizProblemList.findIndex((p) => p.id === item.problemId)

            let cardBorder = '1px solid #e2e8f0'
            let cardBg = '#ffffff'
            if (submitted) {
              cardBorder = isCorrect ? '1.5px solid #6ee7b7' : '1.5px solid #fca5a5'
              cardBg = isCorrect ? '#f0fdf4' : '#fff7f7'
            }

            return (
              <div
                key={item.problemId}
                className="rounded-2xl p-4"
                style={{
                  background: cardBg,
                  border: cardBorder,
                  boxShadow: '0 1px 8px rgba(0,0,0,.04)',
                }}
              >
                {/* ── Header row ── */}
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Problem number */}
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black"
                      style={{ background: '#eef2ff', color: '#4f46e5' }}
                    >
                      {i + 1}
                    </span>
                    {/* Lesson tag */}
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{ background: '#eef2ff', color: '#4338ca' }}
                    >
                      第{item.lessonId}讲 · {LESSON_NAMES[item.lessonId] ?? item.lessonId}
                    </span>
                    {/* Section tag */}
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px]"
                      style={{ background: '#f1f5f9', color: '#64748b' }}
                    >
                      {SECTION_LABELS[section as SectionKey]}
                    </span>
                    {/* Type tag */}
                    {problem.tagLabel && (
                      <span
                        className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px]"
                        style={{ background: '#f1f5f9', color: '#64748b' }}
                      >
                        {problem.tagLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {!submitted && (
                      <ScratchPadTrigger
                        problem={problem}
                        variant="compact"
                        problems={quizProblemList}
                        problemIndex={quizProblemIndex >= 0 ? quizProblemIndex : i}
                        section="quiz"
                        mode="quiz"
                        paperId={paper.id}
                      />
                    )}
                    {submitted ? (
                      <span
                        className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold"
                        style={
                          isCorrect
                            ? { background: '#d1fae5', color: '#065f46' }
                            : { background: '#fee2e2', color: '#b91c1c' }
                        }
                      >
                        {isCorrect ? `+${pts}分` : `0/${pts}分`}
                      </span>
                    ) : (
                      <span
                        className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={{ background: '#eef2ff', color: '#4f46e5' }}
                      >
                        {pts}分
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Problem text ── */}
                <div
                  className="quiz-problem-text mb-4 text-sm text-slate-700"
                  style={{ lineHeight: '1.75' }}
                  dangerouslySetInnerHTML={{ __html: problem.text }}
                />
                {problem.figureNode && !isInteractiveProblem(problem) && (
                  <div className="mb-4 flex justify-center">{problem.figureNode}</div>
                )}

                {/* ── Answer area ── */}
                {isInteractiveProblem(problem) ? (
                  <div
                    className="rounded-xl p-3"
                    style={{
                      background: submitted ? 'transparent' : '#f8fafc',
                      border: submitted
                        ? isCorrect
                          ? '1.5px solid #6ee7b7'
                          : '1.5px solid #fca5a5'
                        : '1px solid #e2e8f0',
                    }}
                  >
                    <p className="mb-3 text-sm text-slate-600">
                      在下方宫格中完成作答即可交卷；点「检查答案」可提前看对错提示。
                    </p>
                    <div className={submitted ? 'pointer-events-none opacity-90' : undefined}>
                      {injectFigureGridCallbacks(problem.figureNode, {
                        initialState: interactiveStates[item.problemId],
                        onStateChange: (state) => recordInteractiveState(item.problemId, state),
                        onSubmit: (state) => recordInteractiveState(item.problemId, state),
                      })}
                    </div>
                    {submitted && (
                      <div className="mt-3 flex items-center gap-2">
                        {isCorrect ? (
                          <span className="text-lg text-emerald-500">✓</span>
                        ) : (
                          <span className="text-lg text-rose-400">✗</span>
                        )}
                        <span
                          className="text-xs font-semibold"
                          style={{ color: isCorrect ? '#065f46' : '#b91c1c' }}
                        >
                          {isCorrect ? '作答正确' : '作答有误，请回顾题解'}
                        </span>
                      </div>
                    )}
                    {!submitted && !interactiveTouched[item.problemId] && (
                      <p className="mt-2 text-xs text-amber-600">尚未开始作答</p>
                    )}
                    {!submitted && interactiveTouched[item.problemId] && (
                      <p className="mt-2 text-xs font-medium text-indigo-600">已记录作答，可交卷</p>
                    )}
                  </div>
                ) : (
                  <div
                    className="rounded-xl p-3"
                    style={{
                      background: submitted ? 'transparent' : '#f8fafc',
                      border: submitted ? 'none' : '1px solid #e2e8f0',
                    }}
                  >
                    {/* Question prompt */}
                    {problem.finalQ && (
                      <p className="mb-2.5 text-sm text-slate-600">{problem.finalQ}</p>
                    )}
                    {/* Input row */}
                    <div className="flex items-center gap-2">
                      <div className="relative max-w-[180px] flex-1">
                        <input
                          type="number"
                          disabled={submitted}
                          value={ans}
                          onChange={(e) =>
                            setAnswers((prev) => ({
                              ...prev,
                              [item.problemId]: e.target.value,
                            }))
                          }
                          placeholder="填写答案"
                          className="w-full rounded-xl px-3 py-2 text-center text-sm font-semibold transition-colors focus:outline-none"
                          style={{
                            border: submitted
                              ? isCorrect
                                ? '1.5px solid #6ee7b7'
                                : '1.5px solid #fca5a5'
                              : '1.5px solid #c7d2fe',
                            background: submitted ? (isCorrect ? '#d1fae5' : '#fee2e2') : '#ffffff',
                            color: submitted ? (isCorrect ? '#065f46' : '#b91c1c') : '#1e293b',
                            // hide number input arrows
                            MozAppearance: 'textfield',
                          }}
                        />
                      </div>
                      {problem.finalUnit && (
                        <span className="shrink-0 text-sm text-slate-500">{problem.finalUnit}</span>
                      )}
                      {submitted && isCorrect && (
                        <span className="shrink-0 text-lg text-emerald-500">✓</span>
                      )}
                      {submitted && !isCorrect && (
                        <span className="shrink-0 text-lg text-rose-400">✗</span>
                      )}
                    </div>

                    {/* Correct answer hint */}
                    {submitted && !isCorrect && (
                      <p className="mt-2 text-xs font-semibold" style={{ color: '#dc2626' }}>
                        正确答案：{problem.finalAns}
                        {problem.finalUnit ? ` ${problem.finalUnit}` : ''}
                      </p>
                    )}
                  </div>
                )}

                {submitted && <QuizProblemSolution problem={problem} className="mt-4" />}
              </div>
            )
          })}
        </div>

        {/* ── Save / Submit buttons ─────────────────────────────────────── */}
        {!submitted && (
          <div className="sticky bottom-4 flex flex-col gap-2">
            {saveMessage && (
              <p className="text-center text-xs font-semibold text-indigo-600">{saveMessage}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => void handleSaveDraft()}
                disabled={!hasProgress || saving || submitting}
                className="flex-1 rounded-2xl py-3.5 text-sm font-bold transition-all"
                style={{
                  background: hasProgress && !saving && !submitting ? '#ffffff' : '#f1f5f9',
                  border:
                    hasProgress && !saving && !submitting
                      ? '1.5px solid #a5b4fc'
                      : '1.5px solid #e2e8f0',
                  color: hasProgress && !saving && !submitting ? '#4f46e5' : '#94a3b8',
                  cursor: hasProgress && !saving && !submitting ? 'pointer' : 'not-allowed',
                }}
              >
                {saving ? '暂存中…' : '暂存'}
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={!allAnswered || submitting || saving}
                className="flex-[1.4] rounded-2xl py-3.5 text-sm font-bold text-white transition-all"
                style={{
                  background:
                    allAnswered && !submitting && !saving
                      ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                      : '#cbd5e1',
                  boxShadow:
                    allAnswered && !submitting && !saving
                      ? '0 4px 16px rgba(99,102,241,.35)'
                      : 'none',
                  cursor: allAnswered && !submitting && !saving ? 'pointer' : 'not-allowed',
                }}
              >
                {submitting ? '提交中…' : allAnswered ? '交卷' : `还有 ${unansweredCount} 题未填写`}
              </button>
            </div>
            <p className="text-center text-[11px] text-slate-400">
              可先暂存进度，全部答完后再交卷判分
            </p>
          </div>
        )}
      </div>

      {/* Hide number input arrows globally for this page */}
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        .quiz-problem-text p { margin: 0 0 .5em; }
        .quiz-problem-text p:last-child { margin-bottom: 0; }
        .quiz-problem-text img {
          display: block;
          max-width: 100%;
          height: auto;
          margin: .5rem auto;
          border-radius: .5rem;
        }
      `}</style>
    </div>
  )
}
