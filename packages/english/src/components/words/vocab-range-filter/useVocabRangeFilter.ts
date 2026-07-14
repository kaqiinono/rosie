'use client'

import { useMemo } from 'react'
import type { WordEntry } from '@rosie/core'
import { getAllStages } from '../../../utils/english-helpers'
import {
  buildOrderedLessons,
  lessonCompositeKey,
  toStageSet,
  type LessonOption,
  type StageMode,
} from './types'

export type UseVocabRangeFilterOptions = {
  vocab: WordEntry[]
  stageMode: StageMode
  selectedStages: string | Set<string>
  selectedUnits?: Set<string>
  selectedLessons?: Set<string>
  /** When multi-stage and empty, show all lessons (weekly plan). When true and empty, show none (adaptive). */
  emptyStagesShowAllLessons?: boolean
}

export function pruneUnitsForStages(
  units: Set<string>,
  vocab: WordEntry[],
  stages: Set<string>,
): Set<string> {
  if (units.size === 0 || stages.size === 0) return units
  const validUnits = new Set(
    vocab.filter((entry) => entry.stage && stages.has(entry.stage)).map((entry) => entry.unit),
  )
  return new Set([...units].filter((unit) => validUnits.has(unit)))
}

export function lessonKeysToPendingLessons(keys: Set<string>): { unit: string; lesson: string }[] {
  return [...keys]
    .map((key) => {
      const split = key.split('::')
      const unit = split[0] ?? ''
      const lesson = split.slice(1).join('::')
      return { unit, lesson }
    })
    .sort((a, b) => {
      const unitCmp = a.unit.localeCompare(b.unit, undefined, { numeric: true, sensitivity: 'base' })
      if (unitCmp !== 0) return unitCmp
      return a.lesson.localeCompare(b.lesson, undefined, { numeric: true, sensitivity: 'base' })
    })
}

export function pendingLessonsToLessonKeys(lessons: { unit: string; lesson: string }[]): Set<string> {
  return new Set(lessons.map((lesson) => lessonCompositeKey(lesson.unit, lesson.lesson)))
}
export function pruneLessonsForStages(
  lessons: Set<string>,
  orderedLessons: LessonOption[],
  stages: Set<string>,
): Set<string> {
  if (lessons.size === 0 || stages.size === 0) return lessons
  const next = new Set<string>()
  for (const lesson of orderedLessons) {
    const key = lessonCompositeKey(lesson.unit, lesson.lesson)
    if (lessons.has(key) && stages.has(lesson.stage)) next.add(key)
  }
  return next
}

export function toggleUnitSelection(
  units: Set<string>,
  lessons: Set<string>,
  unit: string,
): { units: Set<string>; lessons: Set<string> } {
  const nextUnits = new Set(units)
  if (nextUnits.has(unit)) {
    nextUnits.delete(unit)
    const nextLessons = new Set(
      [...lessons].filter((key) => !key.startsWith(`${unit}::`)),
    )
    return { units: nextUnits, lessons: nextLessons }
  }
  nextUnits.add(unit)
  return { units: nextUnits, lessons: lessons }
}

export function useVocabRangeFilter({
  vocab,
  stageMode,
  selectedStages,
  selectedUnits = new Set(),
  selectedLessons = new Set(),
  emptyStagesShowAllLessons = false,
}: UseVocabRangeFilterOptions) {
  const stages = useMemo(() => getAllStages(vocab), [vocab])
  const stageSet = useMemo(
    () => toStageSet(stageMode, selectedStages),
    [stageMode, selectedStages],
  )
  const singleStage = stageMode === 'single' ? (selectedStages as string) : ''

  const stageScopedVocab = useMemo(() => {
    if (stageMode === 'single') {
      if (!singleStage) return vocab
      return vocab.filter((entry) => !entry.stage || entry.stage === singleStage)
    }
    if (stageSet.size === 0) return vocab
    return vocab.filter((entry) => entry.stage && stageSet.has(entry.stage))
  }, [vocab, stageMode, singleStage, stageSet])

  const units = useMemo(
    () =>
      [...new Set(stageScopedVocab.map((entry) => entry.unit))].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
      ),
    [stageScopedVocab],
  )

  const orderedLessons = useMemo(() => buildOrderedLessons(vocab), [vocab])

  const pickerLessons = useMemo(() => {
    if (stageMode === 'multi') {
      if (stageSet.size === 0) return emptyStagesShowAllLessons ? orderedLessons : []
      return orderedLessons.filter((lesson) => stageSet.has(lesson.stage))
    }
    if (!singleStage) return orderedLessons
    return orderedLessons.filter((lesson) => !lesson.stage || lesson.stage === singleStage)
  }, [stageMode, stageSet, singleStage, orderedLessons, emptyStagesShowAllLessons])

  const lessonsByStage = useMemo(() => {
    const groups = new Map<string, LessonOption[]>()
    for (const lesson of pickerLessons) {
      const stage = lesson.stage || '未分词库'
      const list = groups.get(stage)
      if (list) list.push(lesson)
      else groups.set(stage, [lesson])
    }
    const stageOrder = stages.length > 0 ? stages : [...groups.keys()].sort()
    const ordered: { stage: string; lessons: LessonOption[] }[] = []
    for (const stage of stageOrder) {
      const lessons = groups.get(stage)
      if (lessons && lessons.length > 0) ordered.push({ stage, lessons })
    }
    for (const [stage, lessons] of groups) {
      if (!stageOrder.includes(stage)) ordered.push({ stage, lessons })
    }
    return ordered
  }, [pickerLessons, stages])

  const lessonsByUnit = useMemo(
    () =>
      [...selectedUnits].sort().map((unit) => ({
        unit,
        lessons: [
          ...new Set(
            stageScopedVocab
              .filter((entry) => entry.unit === unit)
              .map((entry) => entry.lesson),
          ),
        ].sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
        ),
      })),
    [selectedUnits, stageScopedVocab],
  )

  const baseWords = useMemo(
    () =>
      vocab.filter((entry) => {
        if (stageMode === 'single' && singleStage && entry.stage && entry.stage !== singleStage) {
          return false
        }
        if (stageMode === 'multi' && stageSet.size > 0 && entry.stage && !stageSet.has(entry.stage)) {
          return false
        }
        if (selectedUnits.size > 0 && !selectedUnits.has(entry.unit)) return false
        if (
          selectedLessons.size > 0 &&
          !selectedLessons.has(lessonCompositeKey(entry.unit, entry.lesson))
        ) {
          return false
        }
        return true
      }),
    [vocab, stageMode, singleStage, stageSet, selectedUnits, selectedLessons],
  )

  return {
    stages,
    stageSet,
    singleStage,
    stageScopedVocab,
    units,
    orderedLessons,
    pickerLessons,
    lessonsByStage,
    lessonsByUnit,
    baseWords,
  }
}
