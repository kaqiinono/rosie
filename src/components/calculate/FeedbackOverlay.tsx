'use client'

import clsx from 'clsx'

type FeedbackOverlayProps = {
  correct: boolean
  starsEarned: number
  streakMultiplier: number
  explanation?: string
  userAnswer?: string
  errorTagLabel?: string
  onNext: () => void
}

function FeedbackOverlay({
  correct,
  starsEarned,
  streakMultiplier,
  explanation,
  userAnswer,
  errorTagLabel,
  onNext,
}: FeedbackOverlayProps) {
  return (
    <div
      className={clsx(
        'fixed inset-0 z-50 flex items-end justify-center',
        'bg-black/30'
      )}
    >
      <div
        className={clsx(
          'w-full max-w-md rounded-t-2xl p-6 pb-8',
          'animate-slide-up',
          correct ? 'bg-green-50' : 'bg-red-50'
        )}
      >
        {correct ? (
          <div className="space-y-3">
            <p className="text-2xl font-bold text-green-700 text-center">
              {'✅'} 正确！
            </p>
            <div className="flex items-center justify-center gap-4 text-green-600">
              <span className="text-lg font-semibold">
                +{starsEarned} {'⭐'}
              </span>
              {streakMultiplier > 1 && (
                <span className="text-sm bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-medium">
                  连击 x{streakMultiplier}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-2xl font-bold text-red-700 text-center">
              {'❌'} 再想想
            </p>
            {userAnswer && (
              <p className="text-sm text-red-600 text-center">
                你的答案：{userAnswer}
              </p>
            )}
            {explanation && (
              <div className="bg-white rounded-xl p-3 text-sm text-gray-700">
                {explanation}
              </div>
            )}
            {errorTagLabel && (
              <p className="text-xs text-red-400 text-center">
                错误类型：{errorTagLabel}
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onNext}
          className={clsx(
            'mt-5 w-full py-3 rounded-xl text-lg font-bold text-white',
            'transition-colors select-none',
            correct
              ? 'bg-green-500 hover:bg-green-600 active:bg-green-700'
              : 'bg-red-500 hover:bg-red-600 active:bg-red-700'
          )}
        >
          {'下一题 →'}
        </button>
      </div>
    </div>
  )
}

export default FeedbackOverlay
