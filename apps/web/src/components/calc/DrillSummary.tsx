'use client'

import type { CalcProblemState } from '@rosie/core'

interface DrillSummaryWeakProps {
  type: 'weak-formulas'
  problemStates: Map<string, CalcProblemState>
  /** Signatures that were targeted this drill round */
  targetSignatures: string[]
  round: number
  onContinue: () => void
  onExit: () => void
}

interface DrillSummaryBreakthroughProps {
  type: 'breakthrough'
  blockLabel: string
  avgSec: number
  targetSec: number     // nextTier upper bound in seconds
  tierLabel: string     // next tier name in Chinese (e.g. "进阶")
  onRetry: () => void
  onExit: () => void
}

type DrillSummaryProps = DrillSummaryWeakProps | DrillSummaryBreakthroughProps

export default function DrillSummary(props: DrillSummaryProps) {
  if (props.type === 'weak-formulas') {
    const { targetSignatures, problemStates, round, onContinue, onExit } = props

    const mastered = targetSignatures.filter((sig) => {
      const s = problemStates.get(sig)
      return s ? s.proficiency >= 3 : false
    })
    const remaining = targetSignatures.filter((sig) => {
      const s = problemStates.get(sig)
      return !s || s.proficiency < 3
    })
    const allDone = remaining.length === 0

    return (
      <div className="flex flex-col items-center gap-6 p-6 min-h-[60vh] justify-center">
        {allDone ? (
          <>
            <div className="text-5xl">🎉</div>
            <h2 className="text-2xl font-bold text-green-600">全部攻克！</h2>
            <p className="text-gray-600 text-center">这些算式你全都掌握了</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {mastered.map((sig) => (
                <span key={sig} className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-mono">
                  ✓ {sig}
                </span>
              ))}
            </div>
            <button
              onClick={onExit}
              className="px-8 py-3 rounded-xl bg-green-500 text-white font-bold text-lg"
            >
              返回报告
            </button>
          </>
        ) : (
          <>
            <div className="text-4xl">💪</div>
            <h2 className="text-xl font-bold text-gray-800">第 {round} 轮完成</h2>

            <div className="w-full max-w-xs">
              <div className="flex justify-between text-sm text-gray-500 mb-1">
                <span>已掌握</span>
                <span>{mastered.length} / {targetSignatures.length}</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${targetSignatures.length > 0 ? Math.round((mastered.length / targetSignatures.length) * 100) : 0}%` }}
                />
              </div>
            </div>

            {mastered.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                {mastered.map((sig) => (
                  <span key={sig} className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-mono">
                    ✓ {sig}
                  </span>
                ))}
              </div>
            )}

            {remaining.length > 0 && (
              <div>
                <p className="text-sm text-gray-500 text-center mb-2">还需要继续练</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                  {remaining.map((sig) => (
                    <span key={sig} className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-mono">
                      {sig}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onContinue}
                className="px-6 py-3 rounded-xl bg-blue-500 text-white font-bold"
              >
                继续攻克
              </button>
              <button
                onClick={onExit}
                className="px-6 py-3 rounded-xl bg-gray-200 text-gray-700 font-bold"
              >
                暂时退出
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // Drill C — breakthrough
  const { blockLabel, avgSec, targetSec, tierLabel, onRetry, onExit } = props
  const achieved = avgSec <= targetSec
  const gap = +(avgSec - targetSec).toFixed(1)

  return (
    <div className="flex flex-col items-center gap-6 p-6 min-h-[60vh] justify-center">
      {achieved ? (
        <>
          <div className="text-5xl">🚀</div>
          <h2 className="text-2xl font-bold text-blue-600">进阶了！</h2>
          <p className="text-gray-600 text-center">
            {blockLabel} 已达{tierLabel}档<br/>
            平均 {avgSec}s/题 ≤ 目标 {targetSec}s
          </p>
        </>
      ) : (
        <>
          <div className="text-4xl">🎯</div>
          <h2 className="text-xl font-bold text-gray-800">差一点就突破了！</h2>
          <p className="text-gray-600 text-center">
            平均 {avgSec}s/题，还差 {gap}s 达到{tierLabel}档
          </p>
        </>
      )}
      <div className="flex gap-3">
        {!achieved && (
          <button
            onClick={onRetry}
            className="px-6 py-3 rounded-xl bg-blue-500 text-white font-bold"
          >
            再练一轮
          </button>
        )}
        <button
          onClick={onExit}
          className="px-6 py-3 rounded-xl bg-gray-200 text-gray-700 font-bold"
        >
          返回报告
        </button>
      </div>
    </div>
  )
}
