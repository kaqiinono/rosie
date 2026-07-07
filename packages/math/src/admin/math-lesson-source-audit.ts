import type { ProblemSet } from '@rosie/core'
import { LESSONS, routeForLesson } from '@rosie/math/utils/lesson-registry'
import { LESSON_MODULES } from '@rosie/math/utils/lesson-module-registry'
import { SEA_LESSONS, SEA_POOL } from '@rosie/math/utils/sea-data'

export type SourceDirtyBucket = {
  id: string
  label: string
  count: number
  samples: string[]
  locations: string[]
}

export type LegacyRouteCheck = {
  legacyId: string
  lessonKey: string
  legacyRoute: string
  canonicalRoute: string
  legacyAppFolder: string
}

export type ManualAuditSite = {
  path: string
  what: string
  idKind: 'legacyId' | 'slug' | 'both'
}

export type SourceAuditReport = {
  buckets: SourceDirtyBucket[]
  legacyRoutes: LegacyRouteCheck[]
  manualSites: ManualAuditSite[]
  totals: {
    legacyIdHits: number
    slugHits: number
    bundledProblemIdsLegacy: number
    bundledProblemIdsCanonical: number
    seaLegacyIds: number
    seaLegacyHrefs: number
    moduleSlugKeys: number
    registryFields: number
  }
}

const LESSON_KEYS = new Set(LESSONS.map((e) => e.lessonKey))
const LEGACY_IDS = new Set(LESSONS.map((e) => e.legacyId))
const SLUGS = new Set(LESSONS.map((e) => e.slug))

const SECTIONS = ['pretest', 'lesson', 'homework', 'workbook', 'supplement'] as const

function legacyPrefixFromProblemId(problemId: string): string | null {
  if (problemId.endsWith('__SUMMARY')) {
    const prefix = problemId.slice(0, -'__SUMMARY'.length)
    return LEGACY_IDS.has(prefix) ? prefix : null
  }
  for (const entry of [...LESSONS].sort((a, b) => b.legacyId.length - a.legacyId.length)) {
    if (problemId.startsWith(`${entry.legacyId}-`)) return entry.legacyId
  }
  return null
}

function isAlreadyMigratedProblemId(problemId: string): boolean {
  if (problemId.endsWith('__SUMMARY')) {
    const prefix = problemId.slice(0, -'__SUMMARY'.length)
    return LESSON_KEYS.has(prefix)
  }
  return LESSONS.some((e) => problemId.startsWith(`${e.lessonKey}-`))
}

function collectProblemIds(set: ProblemSet): string[] {
  const ids: string[] = []
  for (const section of SECTIONS) {
    const list = set[section]
    if (list) ids.push(...list.map((p) => p.id))
  }
  return ids
}

function isLegacySeaHref(href: string): boolean {
  const m = href.match(/^\/math\/ny\/(\d+)\//)
  if (!m) return false
  return LEGACY_IDS.has(m[1]!)
}

/** apps/web 内已知仍可能使用 legacyId / slug 的位置（需随收尾勾选） */
export const MANUAL_WEB_AUDIT_SITES: ManualAuditSite[] = [
  {
    path: 'apps/web/src/app/math/ny/plan/page.tsx',
    what: 'PROBLEM_SETS 键（legacyId）',
    idKind: 'legacyId',
  },
  {
    path: 'apps/web/src/app/math/ny/quiz/page.tsx',
    what: 'LESSON_META[].id',
    idKind: 'legacyId',
  },
  {
    path: 'apps/web/src/app/math/ny/quiz/[id]/page.tsx',
    what: 'LESSON_DATA / LESSON_NAMES 键',
    idKind: 'legacyId',
  },
  {
    path: 'apps/web/src/app/math/ny/quiz/[id]/print/page.tsx',
    what: 'LESSON_DATA 键',
    idKind: 'legacyId',
  },
  {
    path: 'apps/web/src/app/math/mistakes/page.tsx',
    what: 'LESSON_META[].id',
    idKind: 'legacyId',
  },
  {
    path: 'packages/math/src/components/MathWeeklyPractice.tsx',
    what: 'LESSONS[].id、Number(lessonId) 排序与链接',
    idKind: 'legacyId',
  },
  {
    path: 'apps/web/src/app/math/ny/{legacyId}/**',
    what: '静态 legacy 路由目录（应仅保留 [grade]/[seq]）',
    idKind: 'both',
  },
  {
    path: 'packages/math/src/utils/lesson-registry.ts',
    what: 'LessonEntry.legacyId / .slug 字段',
    idKind: 'both',
  },
  {
    path: 'packages/math/src/utils/lesson-module-registry.ts',
    what: 'LESSON_MODULES 键（lessonNN）与 legacyId 字段',
    idKind: 'both',
  },
]

export function runBundledSourceAudit(): SourceAuditReport {
  const buckets: SourceDirtyBucket[] = []

  const registryLegacyFields = LESSONS.filter((e) => e.legacyId && e.legacyId !== e.lessonKey).length
  const registrySlugFields = LESSONS.filter((e) => e.slug?.startsWith('lesson')).length
  buckets.push({
    id: 'registry-legacyId',
    label: 'lesson-registry 登记 legacyId 字段',
    count: registryLegacyFields,
    samples: LESSONS.slice(0, 3).map((e) => `${e.lessonKey} → legacyId=${e.legacyId}`),
    locations: ['packages/math/src/utils/lesson-registry.ts'],
  })
  buckets.push({
    id: 'registry-slug',
    label: 'lesson-registry 登记 slug 字段',
    count: registrySlugFields,
    samples: LESSONS.slice(0, 3).map((e) => `${e.lessonKey} → slug=${e.slug}`),
    locations: ['packages/math/src/utils/lesson-registry.ts'],
  })

  const moduleKeys = Object.keys(LESSON_MODULES)
  const moduleSlugKeys = moduleKeys.filter((k) => /^lesson\d+/.test(k))
  buckets.push({
    id: 'module-slug-keys',
    label: 'lesson-module-registry 模块键（lessonNN，非 lessonKey）',
    count: moduleSlugKeys.length,
    samples: moduleSlugKeys.slice(0, 5),
    locations: ['packages/math/src/utils/lesson-module-registry.ts'],
  })

  const moduleLegacyFields = Object.values(LESSON_MODULES).filter(
    (m) => m.legacyId && LEGACY_IDS.has(m.legacyId),
  ).length
  buckets.push({
    id: 'module-legacyId',
    label: 'lesson-module-registry 条目 legacyId 字段',
    count: moduleLegacyFields,
    samples: Object.values(LESSON_MODULES)
      .slice(0, 3)
      .map((m) => `${m.slug} → legacyId=${m.legacyId}`),
    locations: ['packages/math/src/utils/lesson-module-registry.ts'],
  })

  const seaLegacy = SEA_LESSONS.filter((l) => LEGACY_IDS.has(l.id))
  buckets.push({
    id: 'sea-lesson-id',
    label: 'sea-data SEA_LESSONS[].id 仍为 legacyId',
    count: seaLegacy.length,
    samples: seaLegacy.slice(0, 5).map((l) => `${l.id} (${l.shortTitle})`),
    locations: ['packages/math/src/utils/sea-data.ts'],
  })

  const seaLegacyHrefs = SEA_POOL.filter((sp) => isLegacySeaHref(sp.href))
  buckets.push({
    id: 'sea-href',
    label: '题海 SEA_POOL 链接仍为 /math/ny/{legacyId}/…',
    count: seaLegacyHrefs.length,
    samples: seaLegacyHrefs.slice(0, 5).map((sp) => sp.href),
    locations: ['packages/math/src/utils/sea-data.ts'],
  })

  let bundledLegacy = 0
  let bundledCanonical = 0
  const legacyProblemSamples: string[] = []
  for (const mod of Object.values(LESSON_MODULES)) {
    for (const pid of collectProblemIds(mod.PROBLEMS)) {
      if (isAlreadyMigratedProblemId(pid)) {
        bundledCanonical += 1
      } else if (legacyPrefixFromProblemId(pid)) {
        bundledLegacy += 1
        if (legacyProblemSamples.length < 8) legacyProblemSamples.push(pid)
      }
    }
  }
  buckets.push({
    id: 'bundled-problem-id',
    label: '已打包题目数据中 legacy 前缀 problem_id',
    count: bundledLegacy,
    samples: legacyProblemSamples,
    locations: ['packages/math/src/utils/lesson*-data.ts（经 LESSON_MODULES）'],
  })

  const legacyRoutes: LegacyRouteCheck[] = LESSONS.map((e) => ({
    legacyId: e.legacyId,
    lessonKey: e.lessonKey,
    legacyRoute: `/math/ny/${e.legacyId}`,
    canonicalRoute: routeForLesson(e),
    legacyAppFolder: `apps/web/src/app/math/ny/${e.legacyId}/`,
  }))

  const legacyIdHits =
    registryLegacyFields +
    moduleLegacyFields +
    seaLegacy.length +
    seaLegacyHrefs.length +
    bundledLegacy
  const slugHits = registrySlugFields + moduleSlugKeys.length + moduleLegacyFields

  return {
    buckets,
    legacyRoutes,
    manualSites: MANUAL_WEB_AUDIT_SITES,
    totals: {
      legacyIdHits,
      slugHits,
      bundledProblemIdsLegacy: bundledLegacy,
      bundledProblemIdsCanonical: bundledCanonical,
      seaLegacyIds: seaLegacy.length,
      seaLegacyHrefs: seaLegacyHrefs.length,
      moduleSlugKeys: moduleSlugKeys.length,
      registryFields: registryLegacyFields + registrySlugFields,
    },
  }
}

export function isCanonicalLessonKey(id: string): boolean {
  return LESSON_KEYS.has(id)
}

export function isLegacyLessonId(id: string): boolean {
  return LEGACY_IDS.has(id)
}

export function isLessonSlug(id: string): boolean {
  return SLUGS.has(id)
}
