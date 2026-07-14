'use client'

import type { ReactNode } from 'react'
import type { MasteryLevel } from '@rosie/core'
import { MASTERY_ICON } from '@rosie/core'
import type { WordEntry } from '@rosie/core'
import FilterChip from './FilterChip'
import FilterRow from './FilterRow'
import { lessonCompositeKey, type LessonLayout, type StageMode, type VocabRangeFilterVariant } from './types'
import { pruneLessonsForStages, useVocabRangeFilter } from './useVocabRangeFilter'

type VocabRangeFilterProps = {
  vocab: WordEntry[]
  variant?: VocabRangeFilterVariant
  stageMode: StageMode
  selectedStages: string | Set<string>
  onStagesChange: (value: string | Set<string>) => void
  stageLabel?: string
  requireStage?: boolean
  emptyStagesShowAllLessons?: boolean
  showUnits?: boolean
  selectedUnits?: Set<string>
  onToggleUnit?: (unit: string) => void
  lessonLayout?: LessonLayout
  selectedLessons?: Set<string>
  onLessonsChange?: (lessons: Set<string>) => void
  /** When set, toggles one lesson key directly instead of replacing the whole set. */
  onToggleLesson?: (lessonKey: string) => void
  expandedStages?: Set<string>
  onExpandedStagesChange?: (stages: Set<string>) => void
  lessonHeaderExtra?: ReactNode
  showWords?: boolean
  selectedWords?: Set<string>
  onToggleWord?: (word: string) => void
  showMastery?: boolean
  masteryFilter?: MasteryLevel | null
  onMasteryFilter?: (level: MasteryLevel | null) => void
  hint?: string
  scopeCount?: number
  children?: ReactNode
}

function EmbeddedSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
      {children}
    </div>
  )
}

export default function VocabRangeFilter({
  vocab,
  variant = 'bar',
  stageMode,
  selectedStages,
  onStagesChange,
  stageLabel,
  requireStage = false,
  emptyStagesShowAllLessons = false,
  showUnits = false,
  selectedUnits = new Set(),
  onToggleUnit,
  lessonLayout = 'cascade',
  selectedLessons = new Set(),
  onLessonsChange,
  onToggleLesson,
  expandedStages = new Set(),
  onExpandedStagesChange,
  lessonHeaderExtra,
  showWords = false,
  selectedWords = new Set(),
  onToggleWord,
  showMastery = false,
  masteryFilter = null,
  onMasteryFilter,
  hint,
  scopeCount,
  children,
}: VocabRangeFilterProps) {
  const {
    stages,
    units,
    pickerLessons,
    lessonsByStage,
    lessonsByUnit,
    baseWords,
    orderedLessons,
  } = useVocabRangeFilter({
    vocab,
    stageMode,
    selectedStages,
    selectedUnits,
    selectedLessons,
    emptyStagesShowAllLessons,
  })

  const stageSet = stageMode === 'multi' ? (selectedStages as Set<string>) : new Set<string>()
  const singleStage = stageMode === 'single' ? (selectedStages as string) : ''
  const showScopeRows =
    !requireStage ||
    (stageMode === 'single' ? !!singleStage : stageSet.size > 0)
  const resolvedScopeCount = scopeCount ?? baseWords.length

  const handleToggleStage = (stage: string) => {
    if (stageMode === 'single') {
      onStagesChange(stage)
      return
    }
    const next = new Set(selectedStages as Set<string>)
    if (next.has(stage)) next.delete(stage)
    else next.add(stage)
    onStagesChange(next)
    if (onLessonsChange && selectedLessons.size > 0) {
      onLessonsChange(pruneLessonsForStages(selectedLessons, orderedLessons, next))
    }
  }

  const handleToggleLesson = (key: string) => {
    if (onToggleLesson) {
      onToggleLesson(key)
      return
    }
    if (!onLessonsChange) return
    const next = new Set(selectedLessons)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onLessonsChange(next)
  }

  const toggleLessonGroup = (lessons: { unit: string; lesson: string }[], selectAll: boolean) => {
    if (!onLessonsChange) return
    const next = new Set(selectedLessons)
    for (const lesson of lessons) {
      const key = lessonCompositeKey(lesson.unit, lesson.lesson)
      if (selectAll) next.add(key)
      else next.delete(key)
    }
    onLessonsChange(next)
  }

  const toggleStageExpanded = (stage: string) => {
    if (!onExpandedStagesChange) return
    const next = new Set(expandedStages)
    if (next.has(stage)) next.delete(stage)
    else next.add(stage)
    onExpandedStagesChange(next)
  }

  const allPickerSelected =
    pickerLessons.length > 0 &&
    pickerLessons.every((lesson) =>
      selectedLessons.has(lessonCompositeKey(lesson.unit, lesson.lesson)),
    )

  const stageSection = stages.length > 0 && (
    variant === 'bar' ? (
      <FilterRow label="Stage">
        <div className="flex flex-1 flex-wrap gap-1.5">
          {stages.map((stage) => (
            <FilterChip
              key={stage}
              tone="stage"
              active={stageMode === 'single' ? singleStage === stage : stageSet.has(stage)}
              onClick={() => handleToggleStage(stage)}
            >
              {stage}
            </FilterChip>
          ))}
        </div>
      </FilterRow>
    ) : (
      <div className="mb-4">
        <EmbeddedSectionLabel>{stageLabel ?? '选择词库（可多选）'}</EmbeddedSectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {stages.map((stage) => (
            <FilterChip
              key={stage}
              tone="stage"
              active={stageMode === 'single' ? singleStage === stage : stageSet.has(stage)}
              onClick={() => handleToggleStage(stage)}
            >
              {stage}
            </FilterChip>
          ))}
        </div>
        {hint && <p className="mt-1.5 text-[.65rem] text-[var(--wm-text-dim)]">{hint}</p>}
      </div>
    )
  )

  const unitSection =
    showScopeRows &&
    showUnits &&
    onToggleUnit && (
      <FilterRow label="Unit">
        <div className="flex flex-1 flex-wrap gap-1.5">
          {units.map((unit) => (
            <FilterChip
              key={unit}
              tone="unit"
              active={selectedUnits.has(unit)}
              onClick={() => onToggleUnit(unit)}
            >
              {unit}
            </FilterChip>
          ))}
        </div>
      </FilterRow>
    )

  const cascadeLessonSection =
    showScopeRows &&
    lessonLayout === 'cascade' &&
    (onLessonsChange || onToggleLesson) && (
      <FilterRow label="Lesson">
        <div className="flex flex-1 flex-col gap-1.5">
          {lessonsByUnit.map(({ unit, lessons }) => (
            <div key={unit} className="flex flex-wrap items-center gap-1.5">
              {selectedUnits.size > 1 && (
                <span className="min-w-[52px] text-[.65rem] font-bold text-[var(--wm-text-dim)]">
                  {unit}
                </span>
              )}
              {lessons.map((lesson) => {
                const key = lessonCompositeKey(unit, lesson)
                return (
                  <FilterChip
                    key={key}
                    tone="lesson"
                    active={selectedLessons.has(key)}
                    onClick={() => handleToggleLesson(key)}
                  >
                    {lesson}
                  </FilterChip>
                )
              })}
            </div>
          ))}
        </div>
      </FilterRow>
    )

  const groupedLessonSection =
    lessonLayout === 'grouped-by-stage' &&
    onLessonsChange && (
      <div className={variant === 'embedded' ? 'mb-4' : ''}>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
            选择课程
            {selectedLessons.size > 0 ? `（已选 ${selectedLessons.size}）` : '（可多选）'}
          </span>
          {lessonHeaderExtra ??
            (pickerLessons.length > 0 && (
              <button
                type="button"
                onClick={() => toggleLessonGroup(pickerLessons, !allPickerSelected)}
                className="cursor-pointer rounded-lg border-[1.5px] border-[var(--wm-border)] bg-transparent px-3 py-1 text-[.7rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]"
              >
                {allPickerSelected ? '取消全选' : '全部全选'}
              </button>
            ))}
        </div>
        {requireStage && stageSet.size === 0 ? (
          <div className="rounded-xl border border-[var(--wm-border)] px-4 py-3 text-[.8rem] text-[var(--wm-text-dim)]">
            请先选择词库
          </div>
        ) : lessonsByStage.length === 0 ? (
          <div className="rounded-xl border border-[var(--wm-border)] px-4 py-3 text-[.8rem] text-[var(--wm-text-dim)]">
            该词库下暂无课程
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {lessonsByStage.map(({ stage, lessons }) => {
              const stageAllSelected =
                lessons.length > 0 &&
                lessons.every((lesson) =>
                  selectedLessons.has(lessonCompositeKey(lesson.unit, lesson.lesson)),
                )
              const stageSelectedCount = lessons.filter((lesson) =>
                selectedLessons.has(lessonCompositeKey(lesson.unit, lesson.lesson)),
              ).length
              const isExpanded = expandedStages.has(stage) || lessonsByStage.length === 1
              return (
                <div
                  key={stage}
                  className="rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleStageExpanded(stage)}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 bg-transparent py-0.5 text-left"
                      aria-expanded={isExpanded}
                    >
                      <span className="w-3 shrink-0 text-[.7rem] text-[var(--wm-text-dim)]">
                        {isExpanded ? '▾' : '▸'}
                      </span>
                      <span className="text-[.82rem] font-extrabold text-[#c4b5fd]">{stage}</span>
                      <span className="text-[.65rem] text-[var(--wm-text-dim)]">
                        {stageSelectedCount > 0
                          ? `${stageSelectedCount}/${lessons.length}`
                          : `${lessons.length} 课`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleLessonGroup(lessons, !stageAllSelected)}
                      className="shrink-0 cursor-pointer rounded-lg border border-[var(--wm-border)] bg-transparent px-2.5 py-0.5 text-[.65rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]"
                    >
                      {stageAllSelected ? '取消' : '全选'}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {lessons.map((lesson) => {
                        const key = lessonCompositeKey(lesson.unit, lesson.lesson)
                        const isSelected = selectedLessons.has(key)
                        return (
                          <FilterChip
                            key={key}
                            tone="lesson"
                            active={isSelected}
                            onClick={() => handleToggleLesson(key)}
                            className="inline-flex items-center gap-1.5 py-1 text-[.78rem]"
                          >
                            {isSelected && <span className="text-[.65rem] font-black">✓</span>}
                            <span>
                              {lesson.unit} · {lesson.lesson}
                            </span>
                          </FilterChip>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )

  const wordSection =
    showWords &&
    onToggleWord && (
      <FilterRow label="单词">
        <div className="flex max-h-40 flex-1 flex-wrap gap-1.5 overflow-y-auto">
          {baseWords.map((entry) => (
            <FilterChip
              key={entry.word}
              tone="word"
              active={selectedWords.has(entry.word)}
              onClick={() => onToggleWord(entry.word)}
            >
              {entry.word}
            </FilterChip>
          ))}
        </div>
      </FilterRow>
    )

  const masterySection =
    showMastery &&
    onMasteryFilter && (
      <FilterRow label="掌握度">
        <div className="flex flex-1 flex-wrap gap-1.5">
          {([null, 1, 2, 3] as (MasteryLevel | null)[]).map((level) => {
            const active = masteryFilter === level
            const label =
              level === null
                ? '全部'
                : `${MASTERY_ICON[level]} ${['', '练习中', '加深中', '已掌握'][level]}`
            return (
              <FilterChip
                key={level ?? 'all'}
                tone="mastery"
                active={active}
                onClick={() => onMasteryFilter(level)}
              >
                {label}
              </FilterChip>
            )
          })}
        </div>
      </FilterRow>
    )

  const scopeSummary =
    scopeCount !== undefined ? (
      <div className="mt-0.5 flex flex-wrap items-center gap-2">
        <span className="rounded-lg border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-2.5 py-1.5 text-[0.875rem] font-bold text-[var(--wm-text-dim)]">
          {resolvedScopeCount} 词
        </span>
        {hint && (
          <span className="text-[.72rem] font-bold text-[var(--wm-text-dim)]">{hint}</span>
        )}
      </div>
    ) : null

  const requireStagePrompt =
    requireStage && !showScopeRows ? (
      <p className="text-[.75rem] font-bold text-[var(--wm-text-dim)]">请先选择词库</p>
    ) : null

  const filterBody = (
    <>
      {stageSection}
      {requireStagePrompt}
      {unitSection}
      {cascadeLessonSection}
      {groupedLessonSection}
      {wordSection}
      {masterySection}
      {scopeSummary}
      {children}
    </>
  )

  if (variant === 'embedded') {
    return <div>{filterBody}</div>
  }

  return (
    <div className="border-b border-[var(--wm-border)] bg-[var(--wm-surface)] px-4 py-3">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-2.5">{filterBody}</div>
    </div>
  )
}
