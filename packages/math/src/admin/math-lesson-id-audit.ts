import { supabase } from '@rosie/core'
import {
  LESSONS,
  migrateProblemId,
  routeForLesson,
  type LessonEntry,
} from '@rosie/math/utils/lesson-registry'
import {
  runBundledSourceAudit,
  type SourceAuditReport,
} from '@rosie/math/admin/math-lesson-source-audit'

export type TableProbe = {
  table: string
  exists: boolean
  rowCount: number
  error?: string
}

export type LessonImpactRow = {
  entry: LessonEntry
  problemIds: {
    solved: number
    wrong: number
    favorites: number
    scratchWorking: number
    notes: number
    images: number
  }
  lessonIdRows: {
    weeklyPlans: number
    notes: number
    images: number
    scratchDrafts: number
    practiceAttempts: number
  }
  storagePaths: number
  total: number
}

export type OrphanProblemId = {
  problemId: string
  solved: number
  wrong: number
  favorites: number
}

export type MigrationConflict = {
  userId: string
  oldProblemId: string
  newProblemId: string
  table: string
}

export type JsonLegacyHit = {
  table: string
  rowKey: string
  field: string
  sample: string
}

export type SlugStorageHit = {
  lessonKey: string
  legacyId: string
  slug: string
  storagePath: string
}

export type RefactorRiskAssessment = {
  /** 综合判断：是否建议按 docs/math/lesson-id-cleanup.md 分阶段推进 */
  controllable: boolean
  level: 'green' | 'amber' | 'red'
  headline: string
  dbUncleanedRows: number
  sourceUncleanedItems: number
  totalUncleanedEstimate: number
  blockers: string[]
  mitigations: string[]
  scopeLines: string[]
}

export type MathLessonIdAuditReport = {
  generatedAt: string
  mapping: {
    legacyId: string
    lessonKey: string
    grade: number
    seq: number
    slug: string
    newRoute: string
    legacyRoute: string
  }[]
  tables: TableProbe[]
  byLesson: LessonImpactRow[]
  orphans: OrphanProblemId[]
  conflicts: MigrationConflict[]
  jsonLegacyHits: JsonLegacyHit[]
  slugStorageHits: SlugStorageHit[]
  source: SourceAuditReport
  risk: RefactorRiskAssessment
  totals: {
    legacyProblemRows: number
    legacyLessonIdRows: number
    legacyStoragePathRows: number
    legacySlugStorageRows: number
    orphanProblemRows: number
    imageRows: number
    weeklyPlanRows: number
    quizPaperRows: number
    jsonLegacyHitRows: number
    dbUncleanedTotal: number
    sourceLegacyIdHits: number
    sourceSlugHits: number
    sourceUncleanedTotal: number
    grandUncleanedTotal: number
  }
  sourceCodeNote: string
}

const LEGACY_IDS = new Set(LESSONS.map((e) => e.legacyId))

const PROBLEM_ID_TABLES = [
  'math_solved',
  'math_wrong',
  'math_favorites',
  'math_scratch_working',
] as const

const OPTIONAL_TABLES = [
  'math_scratch_drafts',
  'math_practice_attempts',
  'math_quiz_scratch_links',
  'math_rotating_review',
  'math_weekly_lesson_review',
] as const

const ALL_TABLES = [
  ...PROBLEM_ID_TABLES,
  'math_problem_notes',
  'math_problem_images',
  'math_weekly_plans',
  'math_quiz_papers',
  ...OPTIONAL_TABLES,
] as const

export function legacyPrefixFromProblemId(problemId: string): string | null {
  if (problemId.endsWith('__SUMMARY')) {
    const prefix = problemId.slice(0, -'__SUMMARY'.length)
    return LEGACY_IDS.has(prefix) ? prefix : null
  }
  for (const entry of [...LESSONS].sort((a, b) => b.legacyId.length - a.legacyId.length)) {
    if (problemId.startsWith(`${entry.legacyId}-`)) return entry.legacyId
  }
  return null
}

async function probeTable(table: string): Promise<TableProbe> {
  try {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (error) {
      const missing =
        error.code === '42P01' || error.message?.toLowerCase().includes('does not exist')
      if (missing) return { table, exists: false, rowCount: 0 }
      return { table, exists: false, rowCount: 0, error: error.message }
    }
    return { table, exists: true, rowCount: count ?? 0 }
  } catch (e) {
    return { table, exists: false, rowCount: 0, error: (e as Error).message }
  }
}

async function fetchColumn(table: string, column: string): Promise<string[]> {
  const values: string[] = []
  const pageSize = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase.from(table).select(column).range(from, from + pageSize - 1)
    if (error) throw new Error(`${table}.${column}: ${error.message}`)
    if (!data || data.length === 0) break
    for (const row of data as unknown as Record<string, string>[]) {
      const v = row[column]
      if (typeof v === 'string') values.push(v)
    }
    if (data.length < pageSize) break
    from += pageSize
  }
  return values
}

async function fetchRows<T extends Record<string, unknown>>(
  table: string,
  columns: string,
): Promise<T[]> {
  const rows: T[] = []
  const pageSize = 200
  let from = 0
  while (true) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + pageSize - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...(data as unknown as T[]))
    if (data.length < pageSize) break
    from += pageSize
  }
  return rows
}

function countByLegacyId(values: string[], legacyId: string): number {
  return values.filter((v) => v === legacyId).length
}

function countProblemIdsForLegacy(problemIds: string[], legacyId: string): number {
  return problemIds.filter((pid) => legacyPrefixFromProblemId(pid) === legacyId).length
}

function findConflicts(
  table: string,
  rows: { user_id: string; problem_id: string }[],
): MigrationConflict[] {
  const out: MigrationConflict[] = []
  const byUserNew = new Map<string, Set<string>>()
  for (const row of rows) {
    const newId = migrateProblemId(row.problem_id)
    if (!newId || newId === row.problem_id) continue
    const key = `${row.user_id}::${newId}`
    if (!byUserNew.has(row.user_id)) byUserNew.set(row.user_id, new Set())
    byUserNew.get(row.user_id)!.add(newId)
  }
  for (const row of rows) {
    const newId = migrateProblemId(row.problem_id)
    if (!newId || newId === row.problem_id) continue
    const set = byUserNew.get(row.user_id)
    if (set?.has(newId) && row.problem_id !== newId) {
      const existsNew = rows.some((r) => r.user_id === row.user_id && r.problem_id === newId)
      if (existsNew) {
        out.push({
          userId: row.user_id,
          oldProblemId: row.problem_id,
          newProblemId: newId,
          table,
        })
      }
    }
  }
  return out
}

function scanJsonForLegacy(
  table: string,
  rowKey: string,
  field: string,
  json: unknown,
  hits: JsonLegacyHit[],
  limit: number,
): void {
  if (hits.length >= limit || json === null || json === undefined) return
  const text = typeof json === 'string' ? json : JSON.stringify(json)
  for (const entry of LESSONS) {
    const { legacyId, slug } = entry
    if (
      text.includes(`"${legacyId}"`) ||
      text.includes(`"${legacyId}-`) ||
      text.includes(`/${legacyId}/`) ||
      text.includes(`${legacyId}__SUMMARY`) ||
      text.includes(`"${slug}"`) ||
      text.includes(`/${slug}/`)
    ) {
      hits.push({
        table,
        rowKey,
        field,
        sample: text.length > 120 ? `${text.slice(0, 120)}…` : text,
      })
      return
    }
  }
}

function buildRiskAssessment(
  totals: MathLessonIdAuditReport['totals'],
  conflicts: MigrationConflict[],
  source: SourceAuditReport,
): RefactorRiskAssessment {
  const blockers: string[] = []
  const mitigations: string[] = []
  if (conflicts.length > 0) {
    blockers.push(`math_solved 存在 ${conflicts.length} 组迁移主键冲突，需先合并或删除重复行`)
  }
  if (totals.legacyProblemRows > 0) {
    mitigations.push(
      '用户做题记录：运行 docs/sql/math-lesson-id-migrate.sql（事务内一次执行）',
    )
  }
  if (totals.jsonLegacyHitRows > 0) {
    mitigations.push(
      '周计划/组卷 JSON：可跑 math-lesson-id-delete-disposable.sql 清空后重建，或写 JSON 键迁移脚本',
    )
  }
  if (totals.legacyStoragePathRows > 0 || totals.legacySlugStorageRows > 0) {
    mitigations.push('Storage 路径：SQL 迁移 + node scripts/migrate-math-lesson-ids.mjs --apply --storage')
  }
  if (source.totals.bundledProblemIdsLegacy > 0) {
    mitigations.push('源码题目 ID：按 docs/math/lesson-id-cleanup.md Phase 1 改 lesson*-data')
  }
  if (source.totals.seaLegacyIds > 0) {
    mitigations.push('题海/组卷/计划静态表：将 id 键改为 lessonKey（见 cleanup 文档 Phase 1）')
  }

  const scopeLines = [
    `注册表：${LESSONS.length} 讲，每讲含 legacyId + slug 双字段（收尾后仅 lessonKey/grade/seq）`,
    `模块表：${source.totals.moduleSlugKeys} 个 lessonNN 键待改为 lessonKey`,
    `静态路由：${source.legacyRoutes.length} 条 /math/ny/{legacyId} 目录应删除（若仍存在）`,
    `apps/web 已知待改文件：${source.manualSites.length} 处（见下方清单）`,
    'DB 表：math_solved / wrong / favorites / notes / images / weekly_plans 等（见 SQL 审计脚本）',
  ]

  let level: RefactorRiskAssessment['level'] = 'green'
  if (
    totals.dbUncleanedTotal > 0 ||
    source.totals.legacyIdHits > 0 ||
    conflicts.length > 0
  ) {
    level = 'amber'
  }
  if (conflicts.length > 10 || totals.dbUncleanedTotal > 5000) {
    level = 'red'
  }

  const controllable =
    conflicts.length === 0 &&
    (totals.dbUncleanedTotal === 0 ||
      (totals.legacyProblemRows > 0 && mitigations.some((m) => m.includes('migrate.sql'))))

  const headline =
    totals.grandUncleanedTotal === 0
      ? '✅ 未发现 legacyId/slug 脏数据（DB + 已打包源码）'
      : level === 'red'
        ? '⚠️ 改造范围较大或存在阻塞项，建议先处理冲突再迁移'
        : controllable
          ? '✅ 改造范围清晰、风险可控：DB 有现成 SQL/脚本，源码按文档分 PR 收尾'
          : '⚠️ 仍有未清理数据，建议按推荐顺序执行后再部署代码收尾'

  return {
    controllable,
    level,
    headline,
    dbUncleanedRows: totals.dbUncleanedTotal,
    sourceUncleanedItems: totals.sourceUncleanedTotal,
    totalUncleanedEstimate: totals.grandUncleanedTotal,
    blockers,
    mitigations,
    scopeLines,
  }
}

export async function runMathLessonIdAudit(): Promise<MathLessonIdAuditReport> {
  const tables = await Promise.all(ALL_TABLES.map((t) => probeTable(t)))

  const problemIdsByTable: Record<string, string[]> = {}
  for (const table of PROBLEM_ID_TABLES) {
    const probe = tables.find((t) => t.table === table)
    if (probe?.exists) {
      problemIdsByTable[table] = await fetchColumn(table, 'problem_id')
    }
  }

  const noteProblemIds: string[] = []
  const notesProbe = tables.find((t) => t.table === 'math_problem_notes')
  if (notesProbe?.exists) {
    const rows = await fetchRows<{ problem_id: string; lesson_id: string }>(
      'math_problem_notes',
      'problem_id, lesson_id',
    )
    noteProblemIds.push(...rows.map((r) => r.problem_id))
  }

  const imageRows = tables.find((t) => t.table === 'math_problem_images')?.exists
    ? await fetchRows<{ lesson_id: string; problem_id: string; storage_path: string }>(
        'math_problem_images',
        'lesson_id, problem_id, storage_path',
      )
    : []

  const weeklyPlans = tables.find((t) => t.table === 'math_weekly_plans')?.exists
    ? await fetchRows<{ user_id: string; week_start: string; lesson_id: string }>(
        'math_weekly_plans',
        'user_id, week_start, lesson_id, plan_data, progress_data',
      )
    : []

  const conflicts: MigrationConflict[] = []
  if (problemIdsByTable.math_solved) {
    const solvedRows = await fetchRows<{ user_id: string; problem_id: string }>(
      'math_solved',
      'user_id, problem_id',
    )
    conflicts.push(...findConflicts('math_solved', solvedRows))
  }

  const jsonLegacyHits: JsonLegacyHit[] = []
  if (weeklyPlans.length > 0) {
    for (const row of weeklyPlans as Array<{
      user_id: string
      week_start: string
      lesson_id: string
      plan_data: unknown
      progress_data: unknown
    }>) {
      const key = `${row.user_id}@${row.week_start}`
      scanJsonForLegacy('math_weekly_plans', key, 'plan_data', row.plan_data, jsonLegacyHits, 30)
      scanJsonForLegacy(
        'math_weekly_plans',
        key,
        'progress_data',
        row.progress_data,
        jsonLegacyHits,
        30,
      )
    }
  }

  if (tables.find((t) => t.table === 'math_quiz_papers')?.exists) {
    const quizzes = await fetchRows<{ id: string; problems: unknown; answers: unknown }>(
      'math_quiz_papers',
      'id, problems, answers',
    )
    for (const q of quizzes) {
      scanJsonForLegacy('math_quiz_papers', q.id, 'problems', q.problems, jsonLegacyHits, 40)
      scanJsonForLegacy('math_quiz_papers', q.id, 'answers', q.answers, jsonLegacyHits, 40)
    }
  }

  const orphanMap = new Map<string, OrphanProblemId>()
  const bumpOrphan = (pid: string, field: keyof Omit<OrphanProblemId, 'problemId'>) => {
    if (legacyPrefixFromProblemId(pid)) return
    if (isAlreadyMigratedProblemId(pid)) return
    const cur = orphanMap.get(pid) ?? { problemId: pid, solved: 0, wrong: 0, favorites: 0 }
    cur[field] += 1
    orphanMap.set(pid, cur)
  }
  for (const pid of problemIdsByTable.math_solved ?? []) bumpOrphan(pid, 'solved')
  for (const pid of problemIdsByTable.math_wrong ?? []) bumpOrphan(pid, 'wrong')
  for (const pid of problemIdsByTable.math_favorites ?? []) bumpOrphan(pid, 'favorites')
  for (const pid of noteProblemIds) {
    if (!legacyPrefixFromProblemId(pid) && !pid.endsWith('__SUMMARY')) {
      bumpOrphan(pid, 'solved')
    }
  }

  const scratchDraftLessonIds = tables.find((t) => t.table === 'math_scratch_drafts')?.exists
    ? await fetchColumn('math_scratch_drafts', 'lesson_id')
    : []
  const practiceLessonIds = tables.find((t) => t.table === 'math_practice_attempts')?.exists
    ? await fetchColumn('math_practice_attempts', 'lesson_id')
    : []
  const noteLessonIds = notesProbe?.exists
    ? (await fetchRows<{ lesson_id: string }>('math_problem_notes', 'lesson_id')).map((r) => r.lesson_id)
    : []

  const byLesson: LessonImpactRow[] = LESSONS.map((entry) => {
    const problemIds = {
      solved: countProblemIdsForLegacy(problemIdsByTable.math_solved ?? [], entry.legacyId),
      wrong: countProblemIdsForLegacy(problemIdsByTable.math_wrong ?? [], entry.legacyId),
      favorites: countProblemIdsForLegacy(problemIdsByTable.math_favorites ?? [], entry.legacyId),
      scratchWorking: countProblemIdsForLegacy(
        problemIdsByTable.math_scratch_working ?? [],
        entry.legacyId,
      ),
      notes: noteProblemIds.filter(
        (pid) =>
          legacyPrefixFromProblemId(pid) === entry.legacyId ||
          pid === `${entry.legacyId}__SUMMARY`,
      ).length,
      images: imageRows.filter(
        (r) => r.lesson_id === entry.legacyId || legacyPrefixFromProblemId(r.problem_id) === entry.legacyId,
      ).length,
    }
    const lessonIdRows = {
      weeklyPlans: countByLegacyId(
        weeklyPlans.map((r) => r.lesson_id),
        entry.legacyId,
      ),
      notes: countByLegacyId(noteLessonIds, entry.legacyId),
      images: countByLegacyId(
        imageRows.map((r) => r.lesson_id),
        entry.legacyId,
      ),
      scratchDrafts: countByLegacyId(scratchDraftLessonIds, entry.legacyId),
      practiceAttempts: countByLegacyId(practiceLessonIds, entry.legacyId),
    }
    const storagePaths = imageRows.filter((r) =>
      r.storage_path.includes(`/${entry.legacyId}/`),
    ).length
    const total =
      Object.values(problemIds).reduce((a, b) => a + b, 0) +
      Object.values(lessonIdRows).reduce((a, b) => a + b, 0) +
      storagePaths
    return { entry, problemIds, lessonIdRows, storagePaths, total }
  })

  const orphans = [...orphanMap.values()].sort((a, b) => b.solved + b.wrong - (a.solved + a.wrong))

  const legacyProblemRows = byLesson.reduce(
    (sum, row) =>
      sum +
      row.problemIds.solved +
      row.problemIds.wrong +
      row.problemIds.favorites +
      row.problemIds.scratchWorking +
      row.problemIds.notes +
      row.problemIds.images,
    0,
  )

  const legacyLessonIdRows = byLesson.reduce(
    (sum, row) =>
      sum +
      row.lessonIdRows.weeklyPlans +
      row.lessonIdRows.notes +
      row.lessonIdRows.images +
      row.lessonIdRows.scratchDrafts +
      row.lessonIdRows.practiceAttempts,
    0,
  )

  const legacyStoragePathRows = imageRows.filter((r) =>
    LESSONS.some((e) => r.storage_path.includes(`/${e.legacyId}/`)),
  ).length

  const slugStorageHits: SlugStorageHit[] = []
  for (const row of imageRows) {
    for (const entry of LESSONS) {
      if (
        row.storage_path.includes(`/${entry.slug}/`) ||
        row.storage_path.includes(`${entry.slug}/`) ||
        row.storage_path.includes(`summaries/${entry.legacyId}/`)
      ) {
        slugStorageHits.push({
          lessonKey: entry.lessonKey,
          legacyId: entry.legacyId,
          slug: entry.slug,
          storagePath: row.storage_path,
        })
        break
      }
    }
    if (slugStorageHits.length >= 50) break
  }
  const legacySlugStorageRows = imageRows.filter((r) =>
    LESSONS.some(
      (e) =>
        r.storage_path.includes(`/${e.slug}/`) ||
        r.storage_path.includes(`${e.slug}/`),
    ),
  ).length

  const source = runBundledSourceAudit()

  const dbUncleanedTotal =
    legacyProblemRows +
    legacyLessonIdRows +
    legacyStoragePathRows +
    jsonLegacyHits.length

  const sourceUncleanedTotal = source.buckets.reduce((sum, b) => sum + b.count, 0)

  const totals = {
    legacyProblemRows,
    legacyLessonIdRows,
    legacyStoragePathRows,
    legacySlugStorageRows,
    orphanProblemRows: orphans.length,
    imageRows: imageRows.length,
    weeklyPlanRows: weeklyPlans.length,
    quizPaperRows: tables.find((t) => t.table === 'math_quiz_papers')?.rowCount ?? 0,
    jsonLegacyHitRows: jsonLegacyHits.length,
    dbUncleanedTotal,
    sourceLegacyIdHits: source.totals.legacyIdHits,
    sourceSlugHits: source.totals.slugHits,
    sourceUncleanedTotal,
    grandUncleanedTotal: dbUncleanedTotal + sourceUncleanedTotal,
  }

  const risk = buildRiskAssessment(totals, conflicts, source)

  return {
    generatedAt: new Date().toISOString(),
    mapping: LESSONS.map((e) => ({
      legacyId: e.legacyId,
      lessonKey: e.lessonKey,
      grade: e.grade,
      seq: e.seq,
      slug: e.slug,
      newRoute: routeForLesson(e),
      legacyRoute: `/math/ny/${e.legacyId}`,
    })),
    tables,
    byLesson,
    orphans,
    conflicts,
    jsonLegacyHits,
    slugStorageHits,
    source,
    risk,
    totals,
    sourceCodeNote:
      '源码审计扫描已打包的 registry / sea-data / LESSON_MODULES 题目；apps/web 内联常量见「待改文件清单」。完整方案：docs/math/lesson-id-cleanup.md',
  }
}

export function previewMigration(problemId: string): string | null {
  return migrateProblemId(problemId)
}

export function isAlreadyMigratedProblemId(problemId: string): boolean {
  if (problemId.endsWith('__SUMMARY')) {
    const prefix = problemId.slice(0, -'__SUMMARY'.length)
    return LESSONS.some((e) => e.lessonKey === prefix)
  }
  return LESSONS.some((e) => problemId.startsWith(`${e.lessonKey}-`))
}
