import type { WordEntry } from '@rosie/core'

export type LessonOption = {
  unit: string
  lesson: string
  stage: string
}

export type LessonLayout = 'cascade' | 'grouped-by-stage' | 'none'

export type StageMode = 'single' | 'multi'

export type VocabRangeFilterVariant = 'bar' | 'embedded'

export function toStageSet(stageMode: StageMode, selectedStages: string | Set<string>): Set<string> {
  if (stageMode === 'multi') return selectedStages as Set<string>
  const stage = selectedStages as string
  return stage ? new Set([stage]) : new Set()
}

export function lessonCompositeKey(unit: string, lesson: string): string {
  return `${unit}::${lesson}`
}

export function buildOrderedLessons(vocab: WordEntry[]): LessonOption[] {
  const seen = new Map<string, LessonOption>()
  for (const entry of vocab) {
    const key = lessonCompositeKey(entry.unit, entry.lesson)
    if (!seen.has(key)) {
      seen.set(key, {
        unit: entry.unit,
        lesson: entry.lesson,
        stage: entry.stage ?? '',
      })
    }
  }
  return [...seen.values()].sort((a, b) => {
    const unitCmp = a.unit.localeCompare(b.unit, undefined, { numeric: true, sensitivity: 'base' })
    if (unitCmp !== 0) return unitCmp
    return a.lesson.localeCompare(b.lesson, undefined, { numeric: true, sensitivity: 'base' })
  })
}
