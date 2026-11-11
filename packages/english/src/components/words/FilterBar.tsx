'use client'

import type { WordMasteryMap } from '@rosie/core'
import type { MasteryLevel } from '@rosie/core'
import type { WordEntry, WordVocabType } from '@rosie/core'
import VocabRangeFilter from './vocab-range-filter/VocabRangeFilter'
import { Button } from '@rosie/ui/themes'

interface FilterBarProps {
  vocab: WordEntry[]
  selStage?: string
  onSetStage?: (stage: string) => void
  /** When false the Stage chip row is hidden (switching moves to the header). */
  showStageFilter?: boolean
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
  onImmersive?: () => void
  onShuffleOrder?: () => void
  masteryFilter?: MasteryLevel | null
  onMasteryFilter?: (level: MasteryLevel | null) => void
  masteryMap?: WordMasteryMap
  selectedVocabTypes?: Set<WordVocabType>
  onToggleVocabType?: (vocabType: WordVocabType) => void
}

export default function FilterBar({
  vocab,
  selStage = '',
  onSetStage,
  showStageFilter = true,
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
  onImmersive,
  onShuffleOrder,
  masteryFilter,
  onMasteryFilter,
  selectedVocabTypes,
  onToggleVocabType,
}: FilterBarProps) {
  return (
    <VocabRangeFilter
      vocab={vocab}
      variant="bar"
      stageMode="single"
      selectedStages={selStage}
      onStagesChange={(value) => onSetStage?.(value as string)}
      showStages={showStageFilter}
      showUnits
      selectedUnits={selUnits}
      onToggleUnit={onToggleUnit}
      lessonLayout="cascade"
      selectedLessons={selLessons}
      onToggleLesson={onToggleLesson}
      showWords
      selectedWords={selWords}
      onToggleWord={onToggleWord}
      showVocabTypes={!!onToggleVocabType}
      selectedVocabTypes={selectedVocabTypes}
      onToggleVocabType={onToggleVocabType}
      showMastery={!!onMasteryFilter}
      masteryFilter={masteryFilter}
      onMasteryFilter={onMasteryFilter}
    >
      <div className="mt-0.5 flex flex-wrap items-center gap-2">
        <span className="rounded-lg border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-2.5 py-1.5 text-[0.875rem] font-bold text-[var(--wm-text-dim)]">
          {filteredCount} 词
        </span>
        <Button
          onClick={onClearWords}
          disabled={selWords.size === 0}
          variant="outline"
          color="gray"
          size="2"
        >
          清除单词筛选
        </Button>
        {(onFlipAll || onShuffleOrder || onToggleDualMode || onImmersive) && (
          <>
            <div className="h-[22px] w-px bg-[var(--wm-border)]" />
            {onShuffleOrder && (
              <Button
                type="button"
                onClick={onShuffleOrder}
                disabled={filteredCount === 0}
                variant="soft"
                color="gray"
                size="2"
              >
                🔀 随机排序
              </Button>
            )}
            {onFlipAll && (
              <Button onClick={onFlipAll} disabled={dualMode} variant="solid" color="blue" size="2">
                🔄 {allFlipped ? '全部翻回' : '全部翻面'}
              </Button>
            )}
            {onToggleDualMode && (
              <Button
                type="button"
                onClick={onToggleDualMode}
                variant={dualMode ? 'solid' : 'soft'}
                color={dualMode ? 'green' : 'gray'}
                size="2"
              >
                📖 {dualMode ? '退出双面' : '双面模式'}
              </Button>
            )}
            {onImmersive && (
              <Button
                type="button"
                onClick={onImmersive}
                disabled={filteredCount === 0}
                variant="solid"
                color="violet"
                size="2"
              >
                ⚡ 沉浸模式
              </Button>
            )}
          </>
        )}
      </div>
    </VocabRangeFilter>
  )
}
