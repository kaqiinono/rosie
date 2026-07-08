import type { ProblemSet } from '@rosie/core'
import { LESSONS, routeForLesson } from '@rosie/math/utils/lesson-registry'
import { LESSON_MODULES } from '@rosie/math/utils/lesson-module-registry'
import { SEA_LESSONS, SEA_POOL } from '@rosie/math/utils/sea-data'
import { LESSON_SOURCE_BTNS } from '@rosie/math/utils/lesson-source-btns'
import { legacyPrefixFromProblemId } from '@rosie/math/admin/legacy-migration-map'

export type SourceDirtyBucket = {
  id: string
  label: string
  count: number
  samples: string[]
  locations: string[]
}

export type SourceAuditReport = {
  buckets: SourceDirtyBucket[]
  totals: {
    moduleKeyDrift: number
    seaNonLessonKeyIds: number
    seaBrokenHrefs: number
    lessonSourceBtnDrift: number
    bundledProblemIdsLegacy: number
    bundledProblemIdsCanonical: number
  }
}

const LESSON_KEYS = new Set(LESSONS.map((e) => e.lessonKey))
const SECTIONS = ['pretest', 'lesson', 'homework', 'workbook', 'supplement'] as const

function collectProblemIds(set: ProblemSet): string[] {
  const ids: string[] = []
  for (const section of SECTIONS) {
    const list = set[section]
    if (list) ids.push(...list.map((p) => p.id))
  }
  return ids
}

function isCanonicalLessonKey(id: string): boolean {
  return LESSON_KEYS.has(id)
}

function isBrokenSeaHref(href: string): boolean {
  if (!href.startsWith('/math/ny/')) return false
  return !/^\/math\/ny\/\d+\/\d+\//.test(href)
}

function isAlreadyMigratedProblemId(problemId: string): boolean {
  if (problemId.endsWith('__SUMMARY')) {
    const prefix = problemId.slice(0, -'__SUMMARY'.length)
    return LESSON_KEYS.has(prefix)
  }
  return LESSONS.some((e) => problemId.startsWith(`${e.lessonKey}-`))
}

export function runBundledSourceAudit(): SourceAuditReport {
  const buckets: SourceDirtyBucket[] = []

  const moduleKeys = Object.keys(LESSON_MODULES)
  const moduleKeyDrift = moduleKeys.filter((k) => !LESSON_KEYS.has(k))
  buckets.push({
    id: 'module-keys',
    label: 'lesson-module-registry 键非 lessonKey',
    count: moduleKeyDrift.length,
    samples: moduleKeyDrift.slice(0, 5),
    locations: ['packages/math/src/utils/lesson-module-registry.ts'],
  })

  const seaNonKey = SEA_LESSONS.filter((l) => !isCanonicalLessonKey(l.id))
  buckets.push({
    id: 'sea-lesson-id',
    label: 'SEA_LESSONS[].id 非 lessonKey',
    count: seaNonKey.length,
    samples: seaNonKey.slice(0, 5).map((l) => l.id),
    locations: ['packages/math/src/utils/sea-data.ts'],
  })

  const seaBrokenHrefs = SEA_POOL.filter((sp) => isBrokenSeaHref(sp.href))
  buckets.push({
    id: 'sea-broken-href',
    label: '题海链接非 /math/ny/{grade}/{seq}/…',
    count: seaBrokenHrefs.length,
    samples: seaBrokenHrefs.slice(0, 5).map((sp) => sp.href),
    locations: ['packages/math/src/utils/sea-data.ts'],
  })

  const sourceBtnDrift = Object.keys(LESSON_SOURCE_BTNS).filter((k) => !LESSON_KEYS.has(k))
  buckets.push({
    id: 'lesson-source-btns',
    label: 'lesson-source-btns 键非 lessonKey',
    count: sourceBtnDrift.length,
    samples: sourceBtnDrift.slice(0, 5),
    locations: ['packages/math/src/utils/lesson-source-btns.ts'],
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
    label: '题目数据含 legacy 前缀 problem_id',
    count: bundledLegacy,
    samples: legacyProblemSamples,
    locations: ['packages/math/src/utils/lesson*-data.ts'],
  })

  // registry 完整性：每讲应有 module + sea 条目
  const missingModule = LESSONS.filter((e) => !LESSON_MODULES[e.lessonKey]).map((e) => e.lessonKey)
  if (missingModule.length > 0) {
    buckets.push({
      id: 'registry-module-gap',
      label: 'registry 讲次缺少 LESSON_MODULES 条目',
      count: missingModule.length,
      samples: missingModule,
      locations: ['lesson-registry.ts', 'lesson-module-registry.ts'],
    })
  }

  return {
    buckets,
    totals: {
      moduleKeyDrift: moduleKeyDrift.length,
      seaNonLessonKeyIds: seaNonKey.length,
      seaBrokenHrefs: seaBrokenHrefs.length,
      lessonSourceBtnDrift: sourceBtnDrift.length,
      bundledProblemIdsLegacy: bundledLegacy,
      bundledProblemIdsCanonical: bundledCanonical,
    },
  }
}

export function canonicalRoutesFromRegistry(): Array<{ lessonKey: string; route: string }> {
  return LESSONS.map((e) => ({
    lessonKey: e.lessonKey,
    route: routeForLesson(e),
  }))
}

export { isCanonicalLessonKey, isBrokenSeaHref }
