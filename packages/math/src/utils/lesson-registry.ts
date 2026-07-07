/**
 * 讲次注册表 — math 模块讲次 ID / 路由的唯一真相源。
 *
 * - lessonKey（如 `1-12`、`2-1`）：全局唯一主键，用于路由、题目 ID、DB 迁移后的存储。
 * - legacyId（如 `12`、`49`）：迁移期旧 ID，与源码目录 slug 对应。
 * - slug（如 `lesson12`）：`packages/math/src/components/lessonNN` 目录名，迁移完成前不变。
 *
 * 新增讲次只在此文件追加一行 LESSON_ENTRIES。
 */

export type LessonEntry = {
  /** 全局唯一讲次键：`{grade}-{seq}` */
  lessonKey: string
  grade: number
  /** 年级内讲次序号：一年级 = 教材讲次号；二年级起从 1 递增 */
  seq: number
  /** 迁移前旧讲次 ID（纯数字字符串） */
  legacyId: string
  /** 源码组件 / data 目录 slug，如 `lesson49` */
  slug: string
}

/** 声明顺序 = 各年级内讲次顺序（题海、计划、首页列表沿用此序） */
const LESSON_ENTRIES: LessonEntry[] = [
  // ── 一年级（seq = 高斯课本讲次号）──
  { lessonKey: '1-12', grade: 1, seq: 12, legacyId: '12', slug: 'lesson12' },
  { lessonKey: '1-13', grade: 1, seq: 13, legacyId: '13', slug: 'lesson13' },
  { lessonKey: '1-15', grade: 1, seq: 15, legacyId: '15', slug: 'lesson15' },
  { lessonKey: '1-18', grade: 1, seq: 18, legacyId: '18', slug: 'lesson18' },
  { lessonKey: '1-23', grade: 1, seq: 23, legacyId: '23', slug: 'lesson23' },
  { lessonKey: '1-29', grade: 1, seq: 29, legacyId: '29', slug: 'lesson29' },
  { lessonKey: '1-30', grade: 1, seq: 30, legacyId: '30', slug: 'lesson30' },
  { lessonKey: '1-34', grade: 1, seq: 34, legacyId: '34', slug: 'lesson34' },
  { lessonKey: '1-35', grade: 1, seq: 35, legacyId: '35', slug: 'lesson35' },
  { lessonKey: '1-36', grade: 1, seq: 36, legacyId: '36', slug: 'lesson36' },
  { lessonKey: '1-37', grade: 1, seq: 37, legacyId: '37', slug: 'lesson37' },
  { lessonKey: '1-38', grade: 1, seq: 38, legacyId: '38', slug: 'lesson38' },
  { lessonKey: '1-39', grade: 1, seq: 39, legacyId: '39', slug: 'lesson39' },
  { lessonKey: '1-40', grade: 1, seq: 40, legacyId: '40', slug: 'lesson40' },
  { lessonKey: '1-41', grade: 1, seq: 41, legacyId: '41', slug: 'lesson41' },
  { lessonKey: '1-42', grade: 1, seq: 42, legacyId: '42', slug: 'lesson42' },
  { lessonKey: '1-43', grade: 1, seq: 43, legacyId: '43', slug: 'lesson43' },
  { lessonKey: '1-44', grade: 1, seq: 44, legacyId: '44', slug: 'lesson44' },
  { lessonKey: '1-46', grade: 1, seq: 46, legacyId: '46', slug: 'lesson46' },
  { lessonKey: '1-47', grade: 1, seq: 47, legacyId: '47', slug: 'lesson47' },
  // ── 二年级（seq 从 1 起，legacyId 为迁移前全局编号）──
  { lessonKey: '2-1', grade: 2, seq: 1, legacyId: '49', slug: 'lesson49' },
  { lessonKey: '2-2', grade: 2, seq: 2, legacyId: '50', slug: 'lesson50' },
  { lessonKey: '2-3', grade: 2, seq: 3, legacyId: '51', slug: 'lesson51' },
  { lessonKey: '2-4', grade: 2, seq: 4, legacyId: '52', slug: 'lesson52' },
  { lessonKey: '2-5', grade: 2, seq: 5, legacyId: '53', slug: 'lesson53' },
  { lessonKey: '2-6', grade: 2, seq: 6, legacyId: '55', slug: 'lesson55' },
]

export const LESSONS: readonly LessonEntry[] = LESSON_ENTRIES

const BY_KEY = new Map(LESSON_ENTRIES.map((e) => [e.lessonKey, e]))
const BY_LEGACY = new Map(LESSON_ENTRIES.map((e) => [e.legacyId, e]))
const BY_ROUTE = new Map(LESSON_ENTRIES.map((e) => [`${e.grade}:${e.seq}`, e]))
const BY_SLUG = new Map(LESSON_ENTRIES.map((e) => [e.slug, e]))

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

export function lessonByLegacyId(legacyId: string): LessonEntry | undefined {
  return BY_LEGACY.get(legacyId)
}

export function lessonByRoute(grade: number, seq: number): LessonEntry | undefined {
  return BY_ROUTE.get(`${grade}:${seq}`)
}

export function lessonBySlug(slug: string): LessonEntry | undefined {
  return BY_SLUG.get(slug)
}

/** 接受 lessonKey 或 legacyId，统一解析为注册项 */
export function resolveLesson(id: string): LessonEntry | undefined {
  return BY_KEY.get(id) ?? BY_LEGACY.get(id)
}

export function lessonKeyFromLegacy(legacyId: string): string | undefined {
  return BY_LEGACY.get(legacyId)?.lessonKey
}

export function legacyIdFromKey(lessonKey: string): string | undefined {
  return BY_KEY.get(lessonKey)?.legacyId
}

/** 按年级、再按 seq 排序；可传 lessonKey 或 legacyId */
export function compareLessonIds(a: string, b: string): number {
  const ea = resolveLesson(a)
  const eb = resolveLesson(b)
  if (!ea && !eb) return a.localeCompare(b)
  if (!ea) return 1
  if (!eb) return -1
  if (ea.grade !== eb.grade) return ea.grade - eb.grade
  return ea.seq - eb.seq
}

export function lessonsForGradeRegistry(grade: number): LessonEntry[] {
  return LESSON_ENTRIES.filter((e) => e.grade === grade)
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

/**
 * 从题目 ID 解析讲次（支持新 `1-12-L1` 与旧 `12-L1` 两种前缀）。
 * 返回 canonical lessonKey，未登记时 undefined。
 */
export function lessonKeyFromProblemId(problemId: string): string | undefined {
  if (isLessonSummaryProblemId(problemId)) {
    const prefix = problemId.slice(0, -SUMMARY_SUFFIX.length)
    const resolved = resolveLesson(prefix)
    if (resolved) return resolved.lessonKey
    return BY_KEY.has(prefix) ? prefix : undefined
  }
  const parts = problemId.split('-')
  if (parts.length >= 3 && /^\d+$/.test(parts[0]!) && /^\d+$/.test(parts[1]!)) {
    const key = `${parts[0]}-${parts[1]}`
    if (BY_KEY.has(key)) return key
  }
  const legacyPrefix = parts[0]!
  return BY_LEGACY.get(legacyPrefix)?.lessonKey
}

/**
 * 将旧题目 ID 转为新格式。已是新格式则原样返回；无法映射则返回 null。
 * @example migrateProblemId('49-L1') → '2-1-L1'
 */
export function migrateProblemId(problemId: string): string | null {
  if (isLessonSummaryProblemId(problemId)) {
    const prefix = problemId.slice(0, -SUMMARY_SUFFIX.length)
    const entry = resolveLesson(prefix)
    return entry ? lessonSummaryProblemId(entry.lessonKey) : null
  }
  const parts = problemId.split('-')
  if (parts.length < 2) return null
  if (parts.length >= 3 && /^\d+$/.test(parts[0]!) && /^\d+$/.test(parts[1]!)) {
    const key = `${parts[0]}-${parts[1]}`
    if (BY_KEY.has(key)) return problemId
  }
  const legacyPrefix = parts[0]!
  const entry = BY_LEGACY.get(legacyPrefix)
  if (!entry) return null
  const suffix = parts.slice(1).join('-')
  return problemIdForLesson(entry.lessonKey, suffix)
}

/** 从 canonical 路由 `/math/ny/2/1` 解析讲次 */
export function lessonFromHref(href: string): LessonEntry | undefined {
  const canonical = href.match(/^\/math\/ny\/(\d+)\/(\d+)(?:\/|$)/)
  if (!canonical) return undefined
  return lessonByRoute(Number(canonical[1]), Number(canonical[2]))
}

/** 显示用讲次号：一年级 = 教材 seq；二年级起 = 年级内 1、2、3…（与 seq 一致） */
export function lessonDisplaySeq(id: string): number | undefined {
  return resolveLesson(id)?.seq
}

export function lessonDisplayLabelFromRegistry(id: string, compact = false): string {
  const entry = resolveLesson(id)
  if (!entry) return `第 ${id} 讲`
  const n = entry.seq
  return compact ? `第${n}讲` : `第 ${n} 讲`
}

/** DB / JSON 迁移用：legacyId → lessonKey 全表 */
export function buildLegacyToKeyMap(): Record<string, string> {
  return Object.fromEntries(LESSON_ENTRIES.map((e) => [e.legacyId, e.lessonKey]))
}

/** DB / JSON 迁移用：lessonKey → legacyId 全表 */
export function buildKeyToLegacyMap(): Record<string, string> {
  return Object.fromEntries(LESSON_ENTRIES.map((e) => [e.lessonKey, e.legacyId]))
}
