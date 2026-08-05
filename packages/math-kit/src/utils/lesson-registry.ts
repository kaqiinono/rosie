/**
 * 讲次注册表 — math 模块讲次 ID / 路由的唯一真相源。
 *
 * - lessonKey（如 `1-12`、`2-1`）：全局唯一主键，用于路由、题目 ID、DB 存储。
 * - grade + seq：canonical 路由 `/math/ny/{grade}/{seq}`。
 *
 * 新增讲次只在此文件追加一行 LESSON_ENTRIES。
 */

export type LessonEntry = {
  /** 全局唯一讲次键：`{grade}-{seq}` */
  lessonKey: string
  grade: number
  /** 年级内讲次序号：一年级 = 教材讲次号；二年级起从 1 递增 */
  seq: number
}

/** 声明顺序 = 各年级内讲次顺序（题海、计划、首页列表沿用此序） */
const LESSON_ENTRIES: LessonEntry[] = [
  // ── 一年级（seq = 高斯课本讲次号）──
  { lessonKey: '1-12', grade: 1, seq: 12 },
  { lessonKey: '1-13', grade: 1, seq: 13 },
  { lessonKey: '1-15', grade: 1, seq: 15 },
  { lessonKey: '1-18', grade: 1, seq: 18 },
  { lessonKey: '1-23', grade: 1, seq: 23 },
  { lessonKey: '1-29', grade: 1, seq: 29 },
  { lessonKey: '1-30', grade: 1, seq: 30 },
  { lessonKey: '1-34', grade: 1, seq: 34 },
  { lessonKey: '1-35', grade: 1, seq: 35 },
  { lessonKey: '1-36', grade: 1, seq: 36 },
  { lessonKey: '1-37', grade: 1, seq: 37 },
  { lessonKey: '1-38', grade: 1, seq: 38 },
  { lessonKey: '1-39', grade: 1, seq: 39 },
  { lessonKey: '1-40', grade: 1, seq: 40 },
  { lessonKey: '1-41', grade: 1, seq: 41 },
  { lessonKey: '1-42', grade: 1, seq: 42 },
  { lessonKey: '1-43', grade: 1, seq: 43 },
  { lessonKey: '1-44', grade: 1, seq: 44 },
  { lessonKey: '1-46', grade: 1, seq: 46 },
  { lessonKey: '1-47', grade: 1, seq: 47 },
  // ── 二年级（seq 从 1 起）──
  { lessonKey: '2-1', grade: 2, seq: 1 },
  { lessonKey: '2-2', grade: 2, seq: 2 },
  { lessonKey: '2-3', grade: 2, seq: 3 },
  { lessonKey: '2-4', grade: 2, seq: 4 },
  { lessonKey: '2-5', grade: 2, seq: 5 },
  { lessonKey: '2-6', grade: 2, seq: 6 },
  { lessonKey: '2-7', grade: 2, seq: 7 },
]

export const LESSONS: readonly LessonEntry[] = LESSON_ENTRIES

const BY_KEY = new Map(LESSON_ENTRIES.map((e) => [e.lessonKey, e]))
const BY_ROUTE = new Map(LESSON_ENTRIES.map((e) => [`${e.grade}:${e.seq}`, e]))

/** Canonical 路由：`/math/ny/1/12` */
export function lessonRoutePath(grade: number, seq: number): string {
  return `/math/ny/${grade}/${seq}`
}

/** 讲次 canonical 路由 */
export function routeForLesson(entry: LessonEntry): string {
  return lessonRoutePath(entry.grade, entry.seq)
}

export function lessonByKey(lessonKey: string): LessonEntry | undefined {
  return BY_KEY.get(lessonKey)
}

export function lessonByRoute(grade: number, seq: number): LessonEntry | undefined {
  return BY_ROUTE.get(`${grade}:${seq}`)
}

/** 按年级、再按 seq 排序；参数为 lessonKey */
export function compareLessonIds(a: string, b: string): number {
  const ea = BY_KEY.get(a)
  const eb = BY_KEY.get(b)
  if (!ea && !eb) return a.localeCompare(b)
  if (!ea) return 1
  if (!eb) return -1
  if (ea.grade !== eb.grade) return ea.grade - eb.grade
  return ea.seq - eb.seq
}

export function lessonsForGradeRegistry(grade: number): LessonEntry[] {
  return LESSON_ENTRIES.filter((e) => e.grade === grade)
}

/** 某年级 seq 最小的讲次 canonical 路由（切换年级时默认进入）。 */
export function firstLessonRouteForGrade(grade: number): string | undefined {
  const entries = lessonsForGradeRegistry(grade)
    .slice()
    .sort((a, b) => a.seq - b.seq)
  const first = entries[0]
  return first ? routeForLesson(first) : undefined
}

export function gradesInOrderFromRegistry(): number[] {
  return [...new Set(LESSON_ENTRIES.map((e) => e.grade))].sort((a, b) => a - b)
}

export function highestGradeFromRegistry(): number {
  const grades = gradesInOrderFromRegistry()
  return grades.length > 0 ? grades[grades.length - 1]! : 1
}

/** 构造题目 ID：`2-1-L1` */
export function problemIdForLesson(lessonKey: string, suffix: string): string {
  return `${lessonKey}-${suffix}`
}

/** 讲次总结 sentinel：`2-1__SUMMARY` */
export function lessonSummaryProblemId(lessonKey: string): string {
  return `${lessonKey}__SUMMARY`
}

export function isLessonSummaryProblemId(problemId: string): boolean {
  return problemId.endsWith('__SUMMARY')
}

const SUMMARY_SUFFIX = '__SUMMARY'

/** 从题目 ID 解析讲次 lessonKey（`1-12-L1` / `2-1__SUMMARY`） */
export function lessonKeyFromProblemId(problemId: string): string | undefined {
  if (isLessonSummaryProblemId(problemId)) {
    const prefix = problemId.slice(0, -SUMMARY_SUFFIX.length)
    return BY_KEY.has(prefix) ? prefix : undefined
  }
  const parts = problemId.split('-')
  if (parts.length >= 3 && /^\d+$/.test(parts[0]!) && /^\d+$/.test(parts[1]!)) {
    const key = `${parts[0]}-${parts[1]}`
    if (BY_KEY.has(key)) return key
  }
  return undefined
}

/** 从 canonical 路由 `/math/ny/2/1` 解析讲次 */
export function lessonFromHref(href: string): LessonEntry | undefined {
  const canonical = href.match(/^\/math\/ny\/(\d+)\/(\d+)(?:\/|$)/)
  if (!canonical) return undefined
  return lessonByRoute(Number(canonical[1]), Number(canonical[2]))
}

/** 显示用讲次号：一年级 = 教材 seq；二年级起 = 年级内序号 */
export function lessonDisplaySeq(lessonKey: string): number | undefined {
  return BY_KEY.get(lessonKey)?.seq
}

export function lessonDisplayLabelFromRegistry(lessonKey: string, compact = false): string {
  const entry = BY_KEY.get(lessonKey)
  if (!entry) return `第 ${lessonKey} 讲`
  const n = entry.seq
  return compact ? `第${n}讲` : `第 ${n} 讲`
}
