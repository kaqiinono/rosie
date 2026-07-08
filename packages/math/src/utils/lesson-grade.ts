// 讲次年级与显示工具。讲次主数据见 lesson-registry.ts。

import {
  LESSONS,
  lessonFromHref,
  lessonDisplaySeq,
  lessonDisplayLabelFromRegistry,
  lessonsForGradeRegistry,
  gradesInOrderFromRegistry,
  highestGradeFromRegistry,
  lessonByKey,
} from './lesson-registry'

/** 年级数字 → 中文名。 */
export const GRADE_LABEL: Record<number, string> = {
  1: '一年级',
  2: '二年级',
  3: '三年级',
}

/** lessonKey → 年级（题海/组卷/计划筛选用） */
export const LESSON_GRADE: Record<string, number> = Object.fromEntries(
  LESSONS.map((e) => [e.lessonKey, e.grade]),
)

/** 有讲次的年级，升序去重。 */
export function gradesInOrder(): number[] {
  return gradesInOrderFromRegistry()
}

/** 首页年级卡片：高年级在前。 */
export function gradesForLanding(): number[] {
  return gradesInOrder().slice().reverse()
}

/** 当前已登记讲次中的最高年级（无讲次时返回 1）。 */
export function highestGrade(): number {
  return highestGradeFromRegistry()
}

/** 解析新增讲次的年级：显式指定优先，否则取 `highestGrade()`。 */
export function gradeForNewLesson(explicitGrade?: number): number {
  return explicitGrade ?? highestGrade()
}

/** 某年级下的讲次 lessonKey 列表 */
export function lessonsForGrade(grade: number): string[] {
  return lessonsForGradeRegistry(grade).map((e) => e.lessonKey)
}

/** @deprecated 使用 lessonsForGrade；保留别名 */
export const lessonKeysForGrade = lessonsForGrade

/** 某年级默认选中的讲次（lessonKey） */
export function defaultLessonForGrade(grade: number): string | undefined {
  const entries = lessonsForGradeRegistry(grade)
  return entries[entries.length - 1]?.lessonKey
}

/** 取某讲次的年级（lessonKey） */
export function gradeOf(lessonKey: string): number | undefined {
  return lessonByKey(lessonKey)?.grade
}

/** 从课程卡片 href 取讲次 lessonKey */
export function lessonIdFromHref(href: string): string | undefined {
  return lessonFromHref(href)?.lessonKey
}

/** 从 href 取 canonical lessonKey */
export function lessonKeyFromHref(href: string): string | undefined {
  return lessonFromHref(href)?.lessonKey
}

/** 年级内显示用讲次号 */
export function lessonDisplayNum(lessonKey: string): number | undefined {
  return lessonDisplaySeq(lessonKey)
}

/** 显示用讲次标签，如「第 1 讲」或「第 35 讲」 */
export function lessonDisplayLabel(lessonKey: string, compact = false): string {
  return lessonDisplayLabelFromRegistry(lessonKey, compact)
}
