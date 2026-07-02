import type { CharMasteryMap } from '../hooks/useCharMastery'
import type { ChineseLessonRow, LessonCharGroup } from '../types/chineseCharData'
import type { LessonKind } from './g1b/types'
import { bookSlug, charKey, masteryKey } from './chinese-helpers'
import { getLessonDisplayInfo, sortLessonsPedagogically } from './chinese-lesson-display'

/**
 * 一节课的生字掌握进度。「完成」判定：本课全部生字（认读 + 会写）都至少答对过一次。
 * 认读字看 recognize 轨、会写字看 write 轨；无生字的课（如部分语文园地）视为通关（不阻塞路线）。
 */
export interface LessonCharStatus {
  total: number
  correct: number
  isComplete: boolean
}

export function getLessonCharStatus(
  group: LessonCharGroup | undefined,
  masteryMap: CharMasteryMap,
  slug = 'g1b',
): LessonCharStatus {
  if (!group) return { total: 0, correct: 0, isComplete: true }
  let total = 0
  let correct = 0
  for (const ch of group.recognize) {
    total += 1
    if ((masteryMap[masteryKey(charKey(ch, slug), 'recognize')]?.correct ?? 0) > 0) correct += 1
  }
  for (const ch of group.write) {
    total += 1
    if ((masteryMap[masteryKey(charKey(ch, slug), 'write')]?.correct ?? 0) > 0) correct += 1
  }
  return { total, correct, isComplete: total === 0 ? true : correct === total }
}

export interface GradeSemester {
  grade: number
  semester: '上' | '下'
}

export function gradeSemesterKey(grade: number, semester: '上' | '下'): string {
  return bookSlug(grade, semester)
}

const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']

/** 如 (1,'下') → 「一年级下册」 */
export function formatGradeSemester(grade: number, semester: '上' | '下'): string {
  const n = CN_NUM[grade] ?? String(grade)
  return `${n}年级${semester}册`
}

/** 从课文表里去重出全部「年级+学期」，按年级、上册优先排序 */
export function listGradeSemesters(lessons: ChineseLessonRow[]): GradeSemester[] {
  const seen = new Map<string, GradeSemester>()
  for (const l of lessons) {
    const key = gradeSemesterKey(l.grade, l.semester)
    if (!seen.has(key)) seen.set(key, { grade: l.grade, semester: l.semester })
  }
  return [...seen.values()].sort(
    (a, b) => a.grade - b.grade || (a.semester === b.semester ? 0 : a.semester === '上' ? -1 : 1),
  )
}

export type RoadmapNodeState = 'completed' | 'current' | 'locked'

export interface RoadmapNode {
  lessonKey: string
  unit: number
  lessonTitle: string
  lessonKind: LessonKind
  /** 带课序的展示文案，如「课3 树和喜鹊」 */
  label: string
  unitLessonNo: number | null
  bookLessonNo: number | null
  group?: LessonCharGroup
  status: LessonCharStatus
  state: RoadmapNodeState
}

export interface ChineseRoadmap {
  nodes: RoadmapNode[]
  /** 首个未完成课程的 lessonKey（即「今日/下一课」）；全部完成时为 null */
  currentLessonKey: string | null
  currentIndex: number
  completedCount: number
  totalCount: number
}

/**
 * 按教学顺序（正课 → 语文园地，排除快乐读书吧）把课文串成一条闯关路线，
 * 并结合掌握度标注每节课的状态：已完成 / 当前（首个未完成） / 未解锁。
 * 顺序解锁：上一课完成后才解锁下一课。
 */
export function buildChineseRoadmap(
  lessons: ChineseLessonRow[],
  lessonGroups: LessonCharGroup[],
  masteryMap: CharMasteryMap,
  slug = 'g1b',
): ChineseRoadmap {
  const ordered = sortLessonsPedagogically(lessons).filter(
    (l) => l.lessonKind !== 'happy_reading',
  )
  const groupByKey = new Map(lessonGroups.map((g) => [g.lessonKey, g]))

  let currentAssigned = false
  let currentIndex = -1
  let completedCount = 0

  const nodes: RoadmapNode[] = ordered.map((lesson, idx) => {
    const unitLessons = lessons.filter((l) => l.unit === lesson.unit)
    const display = getLessonDisplayInfo(lesson, unitLessons)
    const group = groupByKey.get(lesson.lessonKey)
    const status = getLessonCharStatus(group, masteryMap, slug)

    let state: RoadmapNodeState
    if (status.isComplete) {
      state = 'completed'
      completedCount += 1
    } else if (!currentAssigned) {
      state = 'current'
      currentAssigned = true
      currentIndex = idx
    } else {
      state = 'locked'
    }

    return {
      lessonKey: lesson.lessonKey,
      unit: lesson.unit,
      lessonTitle: lesson.lessonTitle,
      lessonKind: lesson.lessonKind,
      label: display.label,
      unitLessonNo: display.unitLessonNo,
      bookLessonNo: display.bookLessonNo,
      group,
      status,
      state,
    }
  })

  const currentLessonKey = currentIndex >= 0 ? nodes[currentIndex].lessonKey : null
  return {
    nodes,
    currentLessonKey,
    currentIndex,
    completedCount,
    totalCount: nodes.length,
  }
}
