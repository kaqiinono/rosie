import { PROBLEMS as G1Lesson12PROBLEMS, PROBLEM_TYPES as G1Lesson12PT } from '@rosie/math/utils/g1/lesson12-data'
import { PROBLEMS as G1Lesson13PROBLEMS, PROBLEM_TYPES as G1Lesson13PT } from '@rosie/math/utils/g1/lesson13-data'
import { PROBLEMS as G1Lesson15PROBLEMS, PROBLEM_TYPES as G1Lesson15PT } from '@rosie/math/utils/g1/lesson15-data'
import { PROBLEMS as G1Lesson18PROBLEMS, PROBLEM_TYPES as G1Lesson18PT } from '@rosie/math/utils/g1/lesson18-data'
import { PROBLEMS as G1Lesson23PROBLEMS, PROBLEM_TYPES as G1Lesson23PT } from '@rosie/math/utils/g1/lesson23-data'
import { PROBLEMS as G1Lesson29PROBLEMS, PROBLEM_TYPES as G1Lesson29PT } from '@rosie/math/utils/g1/lesson29-data'
import { PROBLEMS as G1Lesson30PROBLEMS, PROBLEM_TYPES as G1Lesson30PT } from '@rosie/math/utils/g1/lesson30-data'
import { PROBLEMS as G1Lesson34PROBLEMS, PROBLEM_TYPES as G1Lesson34PT } from '@rosie/math/utils/g1/lesson34-data'
import { PROBLEMS as G1Lesson35PROBLEMS, PROBLEM_TYPES as G1Lesson35PT } from '@rosie/math/utils/g1/lesson35-data'
import { PROBLEMS as G1Lesson36PROBLEMS, PROBLEM_TYPES as G1Lesson36PT } from '@rosie/math/utils/g1/lesson36-data'
import { PROBLEMS as G1Lesson37PROBLEMS, PROBLEM_TYPES as G1Lesson37PT } from '@rosie/math/utils/g1/lesson37-data'
import { PROBLEMS as G1Lesson38PROBLEMS, PROBLEM_TYPES as G1Lesson38PT } from '@rosie/math/utils/g1/lesson38-data'
import { PROBLEMS as G1Lesson39PROBLEMS, PROBLEM_TYPES as G1Lesson39PT } from '@rosie/math/utils/g1/lesson39-data'
import { PROBLEMS as G1Lesson40PROBLEMS, PROBLEM_TYPES as G1Lesson40PT } from '@rosie/math/utils/g1/lesson40-data'
import { PROBLEMS as G1Lesson41PROBLEMS, PROBLEM_TYPES as G1Lesson41PT } from '@rosie/math/utils/g1/lesson41-data'
import { PROBLEMS as G1Lesson42PROBLEMS, PROBLEM_TYPES as G1Lesson42PT } from '@rosie/math/utils/g1/lesson42-data'
import { PROBLEMS as G1Lesson43PROBLEMS, PROBLEM_TYPES as G1Lesson43PT } from '@rosie/math/utils/g1/lesson43-data'
import { PROBLEMS as G1Lesson44PROBLEMS, PROBLEM_TYPES as G1Lesson44PT } from '@rosie/math/utils/g1/lesson44-data'
import { PROBLEMS as G1Lesson46PROBLEMS, PROBLEM_TYPES as G1Lesson46PT } from '@rosie/math/utils/g1/lesson46-data'
import { PROBLEMS as G1Lesson47PROBLEMS, PROBLEM_TYPES as G1Lesson47PT } from '@rosie/math/utils/g1/lesson47-data'
import { PROBLEMS as G2Lesson1PROBLEMS, PROBLEM_TYPES as G2Lesson1PT } from '@rosie/math/utils/g2/lesson1-data'
import { PROBLEMS as G2Lesson2PROBLEMS, PROBLEM_TYPES as G2Lesson2PT } from '@rosie/math/utils/g2/lesson2-data'
import { PROBLEMS as G2Lesson6PROBLEMS, PROBLEM_TYPES as G2Lesson6PT } from '@rosie/math/utils/g2/lesson6-data'
import { PROBLEMS as G2Lesson7PROBLEMS, PROBLEM_TYPES as G2Lesson7PT } from '@rosie/math/utils/g2/lesson7-data'
import { PROBLEMS as G2Lesson5PROBLEMS, PROBLEM_TYPES as G2Lesson5PT } from '@rosie/math/utils/g2/lesson5-data'
import { PROBLEMS as G2Lesson4PROBLEMS, PROBLEM_TYPES as G2Lesson4PT } from '@rosie/math/utils/g2/lesson4-data'
import { PROBLEMS as G2Lesson3PROBLEMS, PROBLEM_TYPES as G2Lesson3PT } from '@rosie/math/utils/g2/lesson3-data'
import type { Problem, ProblemSet } from '@rosie/core'

export type QuizSection = 'pretest' | 'lesson' | 'homework' | 'workbook' | 'supplement'

export type QuizEntry = { problem: Problem; lessonId: string; section: QuizSection }

export const ALL_QUIZ_SECTIONS: QuizSection[] = [
  'lesson',
  'homework',
  'workbook',
  'supplement',
  'pretest',
]

export const QUIZ_SECTION_INFO: Record<QuizSection, { label: string; icon: string }> = {
  lesson: { label: '课堂讲解', icon: '📖' },
  homework: { label: '课后巩固', icon: '✏️' },
  workbook: { label: '拓展练习', icon: '📚' },
  supplement: { label: '附加题', icon: '📒' },
  pretest: { label: '课前测', icon: '📝' },
}

export const QUIZ_LESSON_META: Array<{
  id: string
  name: string
  data: ProblemSet
  types: ReadonlyArray<{ tag: string; label: string }>
}> = [
  { id: '1-12', name: '巧算加减法进阶', data: G1Lesson12PROBLEMS, types: G1Lesson12PT },
  { id: '1-13', name: '植树问题', data: G1Lesson13PROBLEMS, types: G1Lesson13PT },
  { id: '1-15', name: '和差问题', data: G1Lesson15PROBLEMS, types: G1Lesson15PT },
  { id: '1-18', name: '和差倍初步', data: G1Lesson18PROBLEMS, types: G1Lesson18PT },
  { id: '1-23', name: '逻辑推理', data: G1Lesson23PROBLEMS, types: G1Lesson23PT },
  { id: '1-29', name: '算符大作战', data: G1Lesson29PROBLEMS, types: G1Lesson29PT },
  { id: '1-30', name: '和差倍进阶', data: G1Lesson30PROBLEMS, types: G1Lesson30PT },
  { id: '1-34', name: '乘法分配律', data: G1Lesson34PROBLEMS, types: G1Lesson34PT },
  { id: '1-35', name: '归一问题', data: G1Lesson35PROBLEMS, types: G1Lesson35PT },
  { id: '1-36', name: '星期几问题', data: G1Lesson36PROBLEMS, types: G1Lesson36PT },
  { id: '1-37', name: '鸡兔同笼', data: G1Lesson37PROBLEMS, types: G1Lesson37PT },
  { id: '1-38', name: '一笔画', data: G1Lesson38PROBLEMS, types: G1Lesson38PT },
  { id: '1-39', name: '盈亏问题', data: G1Lesson39PROBLEMS, types: G1Lesson39PT },
  { id: '1-40', name: '周长问题', data: G1Lesson40PROBLEMS, types: G1Lesson40PT },
  { id: '1-41', name: '间隔趣题', data: G1Lesson41PROBLEMS, types: G1Lesson41PT },
  { id: '1-42', name: '生活智力题', data: G1Lesson42PROBLEMS, types: G1Lesson42PT },
  { id: '1-43', name: '等差数列初识', data: G1Lesson43PROBLEMS, types: G1Lesson43PT },
  { id: '1-44', name: '统筹优化', data: G1Lesson44PROBLEMS, types: G1Lesson44PT },
  { id: '1-46', name: '抽屉原理与最不利', data: G1Lesson46PROBLEMS, types: G1Lesson46PT },
  { id: '1-47', name: '方格中的秘密', data: G1Lesson47PROBLEMS, types: G1Lesson47PT },
  { id: '2-1', name: '加减法速算与巧算', data: G2Lesson1PROBLEMS, types: G2Lesson1PT },
  { id: '2-2', name: '等量代换与归一问题', data: G2Lesson2PROBLEMS, types: G2Lesson2PT },
  { id: '2-6', name: '简单枚举', data: G2Lesson6PROBLEMS, types: G2Lesson6PT },
  { id: '2-7', name: '数字谜', data: G2Lesson7PROBLEMS, types: G2Lesson7PT },
  { id: '2-5', name: '找规律', data: G2Lesson5PROBLEMS, types: G2Lesson5PT },
  { id: '2-4', name: '差倍问题', data: G2Lesson4PROBLEMS, types: G2Lesson4PT },
  { id: '2-3', name: '等量代换与归一问题', data: G2Lesson3PROBLEMS, types: G2Lesson3PT },
]

export function buildQuizPool(
  lessonId: string,
  sections: QuizSection[],
  types: string[],
): QuizEntry[] {
  const meta = QUIZ_LESSON_META.find((l) => l.id === lessonId)
  if (!meta) return []
  const activeSections = sections.length > 0 ? sections : ALL_QUIZ_SECTIONS
  const entries: QuizEntry[] = []
  for (const section of activeSections) {
    const problems = meta.data[section]
    if (!problems) continue
    for (const problem of problems) {
      if (types.length > 0 && !types.includes(problem.tag)) continue
      entries.push({ problem, lessonId, section })
    }
  }
  return entries
}

export const QUIZ_ALL_ENTRIES_MAP = (() => {
  const map = new Map<string, QuizEntry>()
  for (const { id, data } of QUIZ_LESSON_META) {
    for (const section of ALL_QUIZ_SECTIONS) {
      const problems = data[section]
      if (!problems) continue
      for (const p of problems) map.set(p.id, { problem: p, lessonId: id, section })
    }
  }
  return map
})()
