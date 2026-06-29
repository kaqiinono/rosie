// packages/math/src/utils/lesson-grade.ts
// 讲次 → 年级 的唯一真相源。新增讲次只需在 LESSON_GRADE 加 1 行。

/** 讲次 id → 年级（1 = 一年级…）。 */
export const LESSON_GRADE: Record<string, number> = {
  '12': 1, '13': 1, '15': 1, '18': 1, '23': 1, '29': 1, '30': 1, '34': 1,
  '35': 1, '36': 1, '37': 1, '38': 1, '39': 1, '40': 1, '41': 1, '42': 1,
  '43': 1, '44': 1, '46': 1, '47': 1,
  // 二年级（将来）：'48': 2, …
}

/** 年级数字 → 中文名。 */
export const GRADE_LABEL: Record<number, string> = {
  1: '一年级',
  2: '二年级',
  3: '三年级',
}

/** 有讲次的年级，升序去重。 */
export function gradesInOrder(): number[] {
  return [...new Set(Object.values(LESSON_GRADE))].sort((a, b) => a - b)
}

/** 某年级下的讲次 id 列表，按 LESSON_GRADE 键的出现顺序。 */
export function lessonsForGrade(grade: number): string[] {
  return Object.keys(LESSON_GRADE).filter((id) => LESSON_GRADE[id] === grade)
}

/** 取某讲次的年级；未登记返回 undefined。 */
export function gradeOf(lessonId: string): number | undefined {
  return LESSON_GRADE[lessonId]
}

/** 从 `/math/ny/35` 取讲次 id `'35'`；非讲次路由返回 undefined。 */
export function lessonIdFromHref(href: string): string | undefined {
  const m = href.match(/^\/math\/ny\/(\d+)$/)
  return m ? m[1] : undefined
}
