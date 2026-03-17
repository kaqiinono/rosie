'use client'

import AppleBag from './AppleBag'

interface StageAreaProps {
  stageLabel: string
  emoji: string
  price: number
  A: number
  B: number
  mode: 'merge' | 'split'
  step: number
  totalSteps: number
}

export default function StageArea({ stageLabel, emoji, price, A, B, mode, step }: StageAreaProps) {
  const isMerge = mode === 'merge'

  const showGroupLeft = isMerge ? step >= 1 : step >= 4
  const showGroupRight = isMerge ? step >= 2 : step >= 4
  const showArrow = isMerge ? step >= 5 : step >= 4
  const showMergeZone = isMerge ? step >= 5 : step >= 1
  const splitHighlighted = isMerge
    ? step < 5 || step === 3
    : step >= 4
  const splitDimmed = isMerge ? step >= 5 : false
  const mergeHighlighted = isMerge ? step >= 5 : step < 4
  const mergeDimmed = isMerge ? false : step >= 4
  const showSplitZone = isMerge ? true : step >= 4

  const arrowIcon = isMerge ? '⬇️' : '⬆️'
  const arrowText = isMerge ? '合在一起' : '拆成两份'

  const leftTitle = isMerge
    ? `妈妈买的：<span class="text-red-600">${A}</span> 袋`
    : `妈妈的：<span class="text-red-600">${A}</span> 袋`
  const rightTitle = isMerge
    ? `爸爸买的：<span class="text-red-600">${B}</span> 袋`
    : `爸爸的：<span class="text-red-600">${B}</span> 袋`

  return (
    <div className="relative rounded-[20px] border-2 border-white/50 bg-white/88 p-4 shadow-[0_6px_28px_rgba(0,0,0,.07)]">
      <div className="mb-1.5 text-center text-xs font-semibold tracking-wider text-slate-400">
        {stageLabel}
      </div>
      <div className="flex flex-col gap-3">
        {/* Split Zone */}
        {showSplitZone && (
          <div
            className={`relative flex flex-wrap justify-center gap-6 rounded-2xl border-2 px-2 py-2.5 transition-all duration-600 ${
              splitHighlighted
                ? 'border-blue-500 bg-blue-100/50 opacity-100 scale-100'
                : splitDimmed
                  ? 'border-blue-300/40 bg-blue-100/30 opacity-55 scale-[.92]'
                  : 'border-blue-300/40 bg-blue-100/30'
            }`}
          >
            <span className="absolute -top-2.5 left-4 rounded-lg border border-blue-300 bg-blue-100 px-2.5 py-px text-[11px] font-bold text-blue-500">
              {isMerge ? '分开看' : '拆成两份'}
            </span>

            {/* Left shelf group */}
            <div
              className={`flex flex-col items-center gap-1.5 transition-all duration-600 ${
                showGroupLeft ? 'max-h-[300px] scale-100 opacity-100' : 'pointer-events-none max-h-0 scale-50 overflow-hidden opacity-0'
              }`}
            >
              <div
                className="rounded-[10px] bg-slate-100 px-2.5 py-0.5 text-sm font-bold text-slate-600"
                dangerouslySetInnerHTML={{ __html: leftTitle }}
              />
              <div className="flex max-w-[280px] flex-wrap justify-center gap-1.5">
                {showGroupLeft &&
                  Array.from({ length: A }).map((_, i) => (
                    <AppleBag
                      key={`left-${i}`}
                      price={price}
                      colorClass="blue"
                      emoji={emoji}
                      delay={i * 130}
                    />
                  ))}
              </div>
            </div>

            {/* Right shelf group */}
            <div
              className={`flex flex-col items-center gap-1.5 transition-all duration-600 ${
                showGroupRight ? 'max-h-[300px] scale-100 opacity-100' : 'pointer-events-none max-h-0 scale-50 overflow-hidden opacity-0'
              }`}
            >
              <div
                className="rounded-[10px] bg-slate-100 px-2.5 py-0.5 text-sm font-bold text-slate-600"
                dangerouslySetInnerHTML={{ __html: rightTitle }}
              />
              <div className="flex max-w-[280px] flex-wrap justify-center gap-1.5">
                {showGroupRight &&
                  Array.from({ length: B }).map((_, i) => (
                    <AppleBag
                      key={`right-${i}`}
                      price={price}
                      colorClass="pink"
                      emoji={emoji}
                      delay={i * 100}
                    />
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Arrow row */}
        <div
          className={`flex items-center justify-center gap-2 text-xl font-bold text-slate-400 transition-all duration-400 ${
            showArrow ? 'h-auto opacity-100' : 'h-0 overflow-hidden opacity-0'
          }`}
        >
          <span>{arrowIcon}</span>
          <span className="text-xs font-semibold text-slate-500">{arrowText}</span>
          <span>{arrowIcon}</span>
        </div>

        {/* Merge Zone */}
        <div
          className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 px-2 py-2.5 transition-all duration-600 ${
            showMergeZone
              ? mergeHighlighted
                ? 'border-amber-500 bg-amber-100/50 opacity-100 scale-100'
                : mergeDimmed
                  ? 'border-amber-400/40 bg-amber-100/30 opacity-55 scale-[.92]'
                  : 'border-amber-400/40 bg-amber-100/30'
              : 'max-h-0 overflow-hidden border-none p-0 opacity-0'
          }`}
        >
          {showMergeZone && (
            <>
              <span className="absolute -top-2.5 left-4 rounded-lg border border-amber-400 bg-amber-50 px-2.5 py-px text-[11px] font-bold text-amber-800">
                {isMerge ? '合在一起看' : '合在一起'}
              </span>
              <div className="rounded-xl border-2 border-amber-400 bg-amber-50 px-3.5 py-[3px] text-[15px] font-bold text-amber-800">
                {isMerge ? '全部放一起' : '一共有'}：
                <span className="text-lg text-red-600">{A + B}</span> 袋
              </div>
              <div className="flex max-w-[540px] flex-wrap justify-center gap-[5px]">
                {Array.from({ length: A + B }).map((_, i) => (
                  <AppleBag
                    key={`merged-${i}`}
                    price={price}
                    colorClass={
                      (isMerge && step >= 5) || (!isMerge && step >= 4)
                        ? i < A ? 'blue' : 'pink'
                        : undefined
                    }
                    emoji={emoji}
                    delay={i * 70}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
