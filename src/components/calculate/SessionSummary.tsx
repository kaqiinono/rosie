'use client'

import clsx from 'clsx'

type SessionSummaryProps = {
  correctCount: number
  totalCount: number
  starsEarned: number
  timeSpentSec: number
  maxStreak: number
  errorSummary: Record<string, number>
  onRetry: () => void
  onExit: () => void
}

const ERROR_TAG_LABELS: Record<string, string> = {
  carry_miss: '进位遗漏',
  order_confusion: '运算顺序混淆',
  place_value: '数位理解偏差',
  fraction_concept: '分子分母混淆',
  comprehension: '题意理解偏差',
  careless: '粗心计算失误',
  formula_misuse: '公式套用错误',
  estimation_off: '估算范围偏差',
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`
}

function SessionSummary({
  correctCount,
  totalCount,
  starsEarned,
  timeSpentSec,
  maxStreak,
  errorSummary,
  onRetry,
  onExit,
}: SessionSummaryProps) {
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0
  const errorEntries = Object.entries(errorSummary).filter(([, count]) => count > 0)
  const maxErrorCount = errorEntries.length > 0
    ? Math.max(...errorEntries.map(([, count]) => count))
    : 0

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto px-4 py-6 space-y-6">
      {/* Stars earned */}
      <div className="text-center space-y-1">
        <div className="text-5xl font-bold text-amber-500">
          {starsEarned}
        </div>
        <div className="flex items-center justify-center gap-0.5">
          {Array.from({ length: Math.min(starsEarned, 5) }, (_, i) => (
            <span key={i} className="text-2xl text-amber-400">{'⭐'}</span>
          ))}
        </div>
        <p className="text-sm text-gray-400">获得星星</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 w-full">
        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{accuracy}%</p>
          <p className="text-xs text-gray-400 mt-1">正确率</p>
        </div>
        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{formatTime(timeSpentSec)}</p>
          <p className="text-xs text-gray-400 mt-1">用时</p>
        </div>
        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{maxStreak}</p>
          <p className="text-xs text-gray-400 mt-1">最长连击</p>
        </div>
      </div>

      {/* Error summary bars */}
      {errorEntries.length > 0 && (
        <div className="w-full space-y-2">
          <h3 className="text-sm font-semibold text-gray-600">错误分析</h3>
          {errorEntries.map(([tag, count]) => {
            const barWidth = maxErrorCount > 0
              ? Math.round((count / maxErrorCount) * 100)
              : 0
            return (
              <div key={tag} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">{ERROR_TAG_LABELS[tag] ?? tag}</span>
                  <span className="text-gray-400">{count}次</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" aria-hidden>
                    {count >= 3 ? '⚠️' : '○'}
                  </span>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex-1">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all',
                        count >= 3 ? 'bg-red-400' : 'bg-amber-400'
                      )}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 w-full pt-2">
        <button
          type="button"
          onClick={onExit}
          className={clsx(
            'flex-1 py-3 rounded-xl text-base font-bold',
            'bg-white border-2 border-gray-200 text-gray-700',
            'hover:bg-gray-50 active:bg-gray-100 transition-colors'
          )}
        >
          专项练习
        </button>
        <button
          type="button"
          onClick={onRetry}
          className={clsx(
            'flex-1 py-3 rounded-xl text-base font-bold',
            'bg-blue-500 text-white',
            'hover:bg-blue-600 active:bg-blue-700 transition-colors'
          )}
        >
          再来一局
        </button>
      </div>
    </div>
  )
}

export default SessionSummary
