'use client'

import type { WordMasteryMap } from '@rosie/core'
import type { MasteryLevel } from '@rosie/core'
import type { WordEntry } from '@rosie/core'
import VocabRangeFilter from './vocab-range-filter/VocabRangeFilter'

interface FilterBarProps {
  vocab: WordEntry[]
  selStage: string
  onSetStage: (stage: string) => void
  selUnits: Set<string>
  selLessons: Set<string>
  selWords: Set<string>
  filteredCount: number
  allFlipped?: boolean
  dualMode?: boolean
  onToggleUnit: (unit: string) => void
  onToggleLesson: (lesson: string) => void
  onToggleWord: (word: string) => void
  onClearWords: () => void
  onFlipAll?: () => void
  onToggleDualMode?: () => void
  onShuffleOrder?: () => void
  masteryFilter?: MasteryLevel | null
  onMasteryFilter?: (level: MasteryLevel | null) => void
  masteryMap?: WordMasteryMap
}

export default function FilterBar({
  vocab,
  selStage,
  onSetStage,
  selUnits,
  selLessons,
  selWords,
  filteredCount,
  allFlipped,
  dualMode,
  onToggleUnit,
  onToggleLesson,
  onToggleWord,
  onClearWords,
  onFlipAll,
  onToggleDualMode,
  onShuffleOrder,
  masteryFilter,
  onMasteryFilter,
}: FilterBarProps) {
  return (
    <VocabRangeFilter
      vocab={vocab}
      variant="bar"
      stageMode="single"
      selectedStages={selStage}
      onStagesChange={(value) => onSetStage(value as string)}
      showUnits
      selectedUnits={selUnits}
      onToggleUnit={onToggleUnit}
      lessonLayout="cascade"
      selectedLessons={selLessons}
      onToggleLesson={onToggleLesson}
      showWords
      selectedWords={selWords}
      onToggleWord={onToggleWord}
      showMastery={!!onMasteryFilter}
      masteryFilter={masteryFilter}
      onMasteryFilter={onMasteryFilter}
    >
      <div className="mt-0.5 flex flex-wrap items-center gap-2">
        <span className="rounded-lg border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-2.5 py-1.5 text-[0.875rem] font-bold text-[var(--wm-text-dim)]">
          {filteredCount} 词
        </span>
        <button
          onClick={onClearWords}
          disabled={selWords.size === 0}
          className="font-nunito cursor-pointer rounded-lg border-[1.5px] border-[var(--wm-border)] bg-transparent px-3 py-1.5 text-[.75rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--wm-border)] disabled:hover:text-[var(--wm-text-dim)]"
        >
          清除单词筛选
        </button>
        {(onFlipAll || onShuffleOrder || onToggleDualMode) && (
          <>
            <div className="h-[22px] w-px bg-[var(--wm-border)]" />
            {onShuffleOrder && (
              <button
                type="button"
                onClick={onShuffleOrder}
                disabled={filteredCount === 0}
                className="font-nunito flex cursor-pointer items-center gap-1.5 rounded-lg border-[1.5px] border-[var(--wm-border)] bg-[var(--wm-surface2)] px-3.5 py-1.5 text-[0.875rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[#a855f7] hover:text-[#a855f7] disabled:cursor-not-allowed disabled:opacity-40"
              >
                🔀 随机排序
              </button>
            )}
            {onFlipAll && (
              <button
                onClick={onFlipAll}
                disabled={dualMode}
                className="font-nunito flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-gradient-to-br from-[var(--wm-accent4)] to-[#3b82f6] px-4 py-1.5 text-[0.875rem] font-bold text-white transition-all hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(96,165,250,.4)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                🔄 {allFlipped ? '全部翻回' : '全部翻面'}
              </button>
            )}
            {onToggleDualMode && (
              <button
                type="button"
                onClick={onToggleDualMode}
                className={`font-nunito flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-1.5 text-[0.875rem] font-bold transition-all ${
                  dualMode
                    ? 'border-0 bg-gradient-to-br from-[#10b981] to-[#059669] text-white hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(16,185,129,.4)]'
                    : 'border-[1.5px] border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[#10b981] hover:text-[#10b981]'
                }`}
              >
                📖 {dualMode ? '退出双面' : '双面模式'}
              </button>
            )}
          </>
        )}
      </div>
    </VocabRangeFilter>
  )
}
