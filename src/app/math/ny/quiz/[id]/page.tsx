'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useMathSolved } from '@/hooks/useMathSolved'
import { useMathQuiz, computeQuizPoints } from '@/hooks/useMathQuiz'
import { supabase } from '@/lib/supabase'
import { PROBLEMS as P34 } from '@/utils/lesson34-data'
import { PROBLEMS as P35 } from '@/utils/lesson35-data'
import { PROBLEMS as P36 } from '@/utils/lesson36-data'
import { PROBLEMS as P37 } from '@/utils/lesson37-data'
import { PROBLEMS as P38 } from '@/utils/lesson38-data'
import { PROBLEMS as P39 } from '@/utils/lesson39-data'
import type { Problem, ProblemSet } from '@/utils/type'
import type { QuizPaper, QuizAnswerRecord } from '@/hooks/useMathQuiz'

// ── Problem lookup ─────────────────────────────────────────────────────────────

const LESSON_DATA: Record<string, ProblemSet> = {
  '34': P34, '35': P35, '36': P36, '37': P37, '38': P38, '39': P39,
}

const LESSON_NAMES: Record<string, string> = {
  '34': '乘法分配律', '35': '归一问题', '36': '星期几问题',
  '37': '鸡兔同笼', '38': '一笔画', '39': '盈亏问题',
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
  lesson: '课堂讲解', homework: '课后巩固', workbook: '拓展练习',
  supplement: '附加题', pretest: '课前测',
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, '')
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QuizDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuth()
  const { handleSolve } = useMathSolved(user)
  const { completePaper } = useMathQuiz(user)

  const [paper, setPaper] = useState<QuizPaper | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [results, setResults] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)

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
          }
        }
        setLoading(false)
      })
  }, [user, id])

  const pointsArr = paper ? computeQuizPoints(paper.problems.length) : []
  const totalScore = paper ? pointsArr.reduce((s, p) => s + p, 0) : 100

  async function handleSubmit() {
    if (!paper || !user) return
    setSubmitting(true)

    const newResults: Record<string, boolean> = {}
    const answerRecords: Record<string, QuizAnswerRecord> = {}

    for (const item of paper.problems) {
      const entry = PROBLEM_MAP.get(item.problemId)
      if (!entry) continue
      const raw = answers[item.problemId] ?? ''
      const userAnswer = raw === '' ? null : parseFloat(raw)
      const correct = userAnswer !== null && userAnswer === entry.problem.finalAns
      newResults[item.problemId] = correct
      answerRecords[item.problemId] = { userAnswer, correct }
    }

    await Promise.all(
      paper.problems.map(async item => {
        const correct = newResults[item.problemId] ?? false
        if (correct) {
          await handleSolve(item.problemId)
        } else {
          if (user) {
            await supabase
              .from('math_wrong')
              .upsert(
                { user_id: user.id, problem_id: item.problemId },
                { onConflict: 'user_id,problem_id' },
              )
          }
        }
      }),
    )

    const score = paper.problems.reduce(
      (sum, item, idx) => sum + (newResults[item.problemId] ? pointsArr[idx] : 0),
      0,
    )

    await completePaper(paper.id, score, answerRecords)

    setResults(newResults)
    setSubmitted(true)
    setSubmitting(false)
  }

  const allAnswered = paper?.problems.every(
    item => (answers[item.problemId] ?? '').trim() !== '',
  ) ?? false

  const correctCount = submitted ? Object.values(results).filter(Boolean).length : 0
  const finalScore = submitted && paper
    ? paper.problems.reduce(
        (sum, item, idx) => sum + (results[item.problemId] ? pointsArr[idx] : 0),
        0,
      )
    : 0

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-3 border-indigo-200 border-t-indigo-500 animate-spin" />
          <span className="text-sm text-slate-400">加载中…</span>
        </div>
      </div>
    )
  }

  if (!paper) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-slate-500">找不到该试卷</p>
        <Link href="/math/ny/quiz" className="text-indigo-500 text-sm no-underline hover:underline">← 返回组卷</Link>
      </div>
    )
  }

  const unansweredCount = paper.problems.filter(item => !(answers[item.problemId] ?? '').trim()).length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-slate-100">
        <div className="mx-auto max-w-2xl pl-4 pr-[168px] lg:pr-4 h-14 flex items-center gap-3">
          <Link
            href="/math/ny/quiz"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors no-underline shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            返回
          </Link>
          <h1 className="text-sm font-bold text-slate-800 flex-1 min-w-0 truncate">{paper.title}</h1>
          <Link
            href={`/math/ny/quiz/${id}/print`}
            target="_blank"
            className="shrink-0 flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors no-underline"
            title="打印试卷"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 5V2h7v3M3.5 10.5h-1a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1h-1M3.5 8.5h7V12h-7z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
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
        {/* ── Score summary ────────────────────────────────────────────── */}
        {submitted && (
          <div className="mb-5 rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', border: '1.5px solid #a7f3d0' }}>
            <div className="px-5 py-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="text-3xl font-black text-emerald-700 leading-none">
                  {finalScore}
                  <span className="text-base font-semibold text-emerald-500 ml-1">/ {totalScore} 分</span>
                </div>
                <p className="mt-1.5 text-sm text-emerald-600">
                  答对 {correctCount} 题 · 答错 {paper.problems.length - correctCount} 题 · 满分 {totalScore} 分
                </p>
              </div>
              <div className="text-4xl">
                {correctCount === paper.problems.length ? '🎉' : correctCount >= paper.problems.length * 0.6 ? '👍' : '📚'}
              </div>
            </div>
            {correctCount < paper.problems.length && (
              <div className="border-t border-emerald-200 px-5 py-2.5">
                <Link
                  href="/math/mistakes"
                  className="text-xs font-semibold text-rose-500 hover:text-rose-700 no-underline"
                >
                  📕 查看错题本 →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── Problem list ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 mb-6">
          {paper.problems.map((item, i) => {
            const entry = PROBLEM_MAP.get(item.problemId)
            if (!entry) return null
            const { problem, section } = entry
            const ans = answers[item.problemId] ?? ''
            const isCorrect = submitted ? results[item.problemId] : undefined
            const pts = pointsArr[i] ?? 0

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
                style={{ background: cardBg, border: cardBorder, boxShadow: '0 1px 8px rgba(0,0,0,.04)' }}
              >
                {/* ── Header row ── */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Problem number */}
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                      style={{ background: '#eef2ff', color: '#4f46e5' }}
                    >
                      {i + 1}
                    </span>
                    {/* Lesson tag */}
                    <span
                      className="text-[11px] font-semibold rounded-full px-2.5 py-0.5 shrink-0"
                      style={{ background: '#eef2ff', color: '#4338ca' }}
                    >
                      第{item.lessonId}讲 · {LESSON_NAMES[item.lessonId] ?? item.lessonId}
                    </span>
                    {/* Section tag */}
                    <span
                      className="text-[11px] rounded-full px-2.5 py-0.5 shrink-0"
                      style={{ background: '#f1f5f9', color: '#64748b' }}
                    >
                      {SECTION_LABELS[section as SectionKey]}
                    </span>
                    {/* Type tag */}
                    {problem.tagLabel && (
                      <span
                        className="text-[11px] rounded-full px-2.5 py-0.5 shrink-0"
                        style={{ background: '#f1f5f9', color: '#64748b' }}
                      >
                        {problem.tagLabel}
                      </span>
                    )}
                  </div>
                  {/* Score chip */}
                  {submitted ? (
                    <span
                      className="shrink-0 text-xs font-bold rounded-full px-2.5 py-0.5"
                      style={isCorrect
                        ? { background: '#d1fae5', color: '#065f46' }
                        : { background: '#fee2e2', color: '#b91c1c' }
                      }
                    >
                      {isCorrect ? `+${pts}分` : `0/${pts}分`}
                    </span>
                  ) : (
                    <span
                      className="shrink-0 text-xs font-semibold rounded-full px-2.5 py-0.5"
                      style={{ background: '#eef2ff', color: '#4f46e5' }}
                    >
                      {pts}分
                    </span>
                  )}
                </div>

                {/* ── Problem text ── */}
                <p className="text-sm text-slate-700 leading-relaxed mb-4" style={{ lineHeight: '1.75' }}>
                  {stripHtml(problem.text)}
                </p>

                {/* ── Answer area ── */}
                <div className="rounded-xl p-3" style={{ background: submitted ? 'transparent' : '#f8fafc', border: submitted ? 'none' : '1px solid #e2e8f0' }}>
                  {/* Question prompt */}
                  {problem.finalQ && (
                    <p className="text-sm text-slate-600 mb-2.5">{problem.finalQ}</p>
                  )}
                  {/* Input row */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-[180px]">
                      <input
                        type="number"
                        disabled={submitted}
                        value={ans}
                        onChange={e => setAnswers(prev => ({ ...prev, [item.problemId]: e.target.value }))}
                        placeholder="填写答案"
                        className="w-full rounded-xl px-3 py-2 text-sm font-semibold text-center transition-colors focus:outline-none"
                        style={{
                          border: submitted
                            ? isCorrect ? '1.5px solid #6ee7b7' : '1.5px solid #fca5a5'
                            : '1.5px solid #c7d2fe',
                          background: submitted
                            ? isCorrect ? '#d1fae5' : '#fee2e2'
                            : '#ffffff',
                          color: submitted
                            ? isCorrect ? '#065f46' : '#b91c1c'
                            : '#1e293b',
                          // hide number input arrows
                          MozAppearance: 'textfield',
                        }}
                      />
                    </div>
                    {problem.finalUnit && (
                      <span className="text-sm text-slate-500 shrink-0">{problem.finalUnit}</span>
                    )}
                    {submitted && isCorrect && (
                      <span className="text-emerald-500 text-lg shrink-0">✓</span>
                    )}
                    {submitted && !isCorrect && (
                      <span className="text-rose-400 text-lg shrink-0">✗</span>
                    )}
                  </div>

                  {/* Correct answer hint */}
                  {submitted && !isCorrect && (
                    <p className="mt-2 text-xs font-semibold" style={{ color: '#dc2626' }}>
                      正确答案：{problem.finalAns}{problem.finalUnit ? ` ${problem.finalUnit}` : ''}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Submit button ─────────────────────────────────────────────── */}
        {!submitted && (
          <div className="sticky bottom-4">
            <button
              onClick={handleSubmit}
              disabled={!allAnswered || submitting}
              className="w-full rounded-2xl py-3.5 text-sm font-bold text-white transition-all"
              style={{
                background: allAnswered && !submitting
                  ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                  : '#cbd5e1',
                boxShadow: allAnswered && !submitting ? '0 4px 16px rgba(99,102,241,.35)' : 'none',
                cursor: allAnswered && !submitting ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting
                ? '提交中…'
                : allAnswered
                  ? '交卷'
                  : `还有 ${unansweredCount} 题未填写`
              }
            </button>
          </div>
        )}
      </div>

      {/* Hide number input arrows globally for this page */}
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </div>
  )
}
