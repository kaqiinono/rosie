// 讲次 → 年级 的唯一真相源。新增讲次只需在 LESSON_GRADE 加 1 行。

/** 讲次 id → 年级（1 = 一年级…）。 */
export const LESSON_GRADE: Record<string, number> = {
  '12': 1, '13': 1, '15': 1, '18': 1, '23': 1, '29': 1, '30': 1, '34': 1,
  '35': 1, '36': 1, '37': 1, '38': 1, '39': 1, '40': 1, '41': 1, '42': 1,
  '43': 1, '44': 1, '46': 1, '47': 1,
  '49': 2,
  '50': 2,
  '51': 2,
  '52': 2,
}

/** 年级数字 → 中文名。 */
export const GRADE_LABEL: Record<number, string> = {
  1: '一年级',
  2: '二年级',
  3: '三年级',
}

/** 有讲次的年级，升序去重（题海/组卷/计划筛选用）。 */
export function gradesInOrder(): number[] {
  return [...new Set(Object.values(LESSON_GRADE))].sort((a, b) => a - b)
}

/** 首页年级卡片：高年级在前。 */
export function gradesForLanding(): number[] {
  return gradesInOrder().slice().reverse()
}

/** 当前已登记讲次中的最高年级（无讲次时返回 1）。新增讲次未说明年级时默认用此值。 */
export function highestGrade(): number {
  const grades = gradesInOrder()
  return grades.length > 0 ? grades[grades.length - 1]! : 1
}

/** 解析新增讲次的年级：显式指定优先，否则取 `highestGrade()`。 */
export function gradeForNewLesson(explicitGrade?: number): number {
  return explicitGrade ?? highestGrade()
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

/**
 * 年级内显示用讲次号：一年级保留真实教材讲次号；二年级起按该年级内顺序从 1 计。
 */
export function lessonDisplayNum(lessonId: string): number | undefined {
  const grade = gradeOf(lessonId)
  if (grade === undefined) return undefined
  if (grade === 1) return Number(lessonId)
  const ids = lessonsForGrade(grade)
  const idx = ids.indexOf(lessonId)
  return idx === -1 ? undefined : idx + 1
}

/** 显示用讲次标签，如「第 1 讲」或「第 35 讲」。 */
export function lessonDisplayLabel(lessonId: string, compact = false): string {
  const n = lessonDisplayNum(lessonId)
  if (n === undefined) return `第 ${lessonId} 讲`
  return compact ? `第${n}讲` : `第 ${n} 讲`
}
