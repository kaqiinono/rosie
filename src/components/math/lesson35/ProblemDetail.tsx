'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Problem } from '@/utils/type'
import { TAG_STYLE } from '@/utils/lesson35-data'
import { useLesson35 } from './Lesson35Provider'
import RatioDiagram from './RatioDiagram'
import BlockDiagram from './BlockDiagram'
import DualBlockDiagram from './DualBlockDiagram'

interface ProblemDetailProps {
  problem: Problem
}

export default function ProblemDetail({ problem }: ProblemDetailProps) {
  const router = useRouter()
  const { solved, handleSolve, setToast } = useLesson35()
  const isSolved = !!solved[problem.id]

  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    setAnswer('')
    setFeedback(null)
  }, [problem.id])

  function checkAnswer() {
    if (!answer) return
    const v = Number(answer)
    if (v === problem.finalAns) {
      setFeedback({ text: '🎉 完全正确！你真棒！', ok: true })
      if (!isSolved) {
        handleSolve(problem.id)
      } else {
        setToast('已经答对过了！继续保持 💪')
      }
    } else {
      setFeedback({ text: `❌ 不对哦，再想想？提示：答案是${problem.finalAns}以内的数。`, ok: false })
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center gap-2.5 border-b border-border-light pb-3.5">
        <button
          onClick={() => router.back()}
          className="flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-gray-100 text-lg transition-colors hover:bg-gray-200"
        >
          ‹
        </button>
        <div className="flex-1 text-[17px] font-bold">{problem.title}</div>
        <div className="text-[22px]">{isSolved ? '✅' : ''}</div>
      </div>

      {/* Two-column layout on desktop */}
      <div className="flex flex-col gap-4 min-[900px]:flex-row min-[900px]:items-start">
        {/* Left column: text + analysis + blocks */}
        <div className="min-w-0 flex-1">
          <span className={`mb-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TAG_STYLE[problem.tag] || 'bg-gray-100 text-gray-600'}`}>
            {problem.tagLabel}
          </span>

          {/* Problem text */}
          <div
            className="mb-3.5 rounded-lg border-l-3 border-app-blue bg-[#f8faff] px-3.5 py-3 text-sm leading-relaxed text-text-secondary [&>strong]:font-bold [&>strong]:text-text-primary"
            dangerouslySetInnerHTML={{ __html: problem.text }}
          />

          {/* Analysis box */}
          <div className="mb-3.5 rounded-lg border border-[#fde68a] bg-gradient-to-br from-[#fffbeb] to-yellow-light p-3.5">
            <div className="mb-1.5 flex items-center gap-1 text-xs font-bold text-yellow-dark">
              🔍 题型分析
            </div>
            <ul className="flex flex-col gap-1.5">
              {problem.analysis.map((a, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed text-[#92400e]">
                  <span className="shrink-0">💡</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>

          {/* Block diagram section */}
          <div className="mb-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-border-light" />
            <div className="whitespace-nowrap text-xs font-semibold text-text-muted">🧱 拆解图（直观理解）</div>
            <div className="h-px flex-1 bg-border-light" />
          </div>

          {problem.type === 'ratio3b' ? (
            problem.dualSc ? (
              <DualBlockDiagram config={problem.dualSc} probId={problem.id} />
            ) : (
              <div className="mb-3 rounded-lg border border-[#e0e4ff] bg-[#f8f9ff] p-3.5 text-xs text-text-muted">
                拆解图暂不支持此题型
              </div>
            )
          ) : problem.blockScene ? (
            <BlockDiagram scene={problem.blockScene} probId={problem.id} />
          ) : (
            <div className="mb-3 rounded-lg border border-[#e0e4ff] bg-[#f8f9ff] p-3.5 text-xs text-text-muted">
              拆解图暂不支持此题型
            </div>
          )}
        </div>

        {/* Right column: ratio diagram + answer */}
        <div className="min-w-0 flex-1">
          {/* Ratio diagram */}
          <div className="mb-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-border-light" />
            <div className="whitespace-nowrap text-xs font-semibold text-text-muted">📊 倍比图</div>
            <div className="h-px flex-1 bg-border-light" />
          </div>

          <RatioDiagram problem={problem} />

          {/* Answer section */}
          <div className="mb-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-border-light" />
            <div className="whitespace-nowrap text-xs font-semibold text-text-muted">✏️ 写出答案</div>
            <div className="h-px flex-1 bg-border-light" />
          </div>

          <div className="mb-3 rounded-lg border border-dashed border-border-light bg-[#f9fafb] p-3.5">
            <div className="text-[13px] text-text-secondary">{problem.finalQ}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <input
                type="number"
                className="w-[72px] rounded-lg border border-border-light px-2 py-1.5 text-center text-sm"
                placeholder="？"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && checkAnswer()}
              />
              <span>{problem.finalUnit}</span>
              <button
                onClick={checkAnswer}
                className="cursor-pointer rounded-full bg-app-blue px-4 py-2 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(59,130,246,0.3)] transition-all active:translate-y-px"
              >
                检查答案
              </button>
            </div>
            {feedback && (
              <div className={`mt-2 text-[13px] ${feedback.ok ? 'text-app-green-dark' : 'text-app-red'}`}>
                {feedback.text}
              </div>
            )}
          </div>

          {/* Tip */}
          <div className="rounded-lg bg-app-green-light px-3 py-2.5 text-xs leading-relaxed text-app-green-dark">
            💡 <strong>口诀：</strong>先归一（÷份数）→ 找每份量 → 再求多（×份数）。倍比图左右对应，上下同步！
          </div>
        </div>
      </div>
    </div>
  )
}
