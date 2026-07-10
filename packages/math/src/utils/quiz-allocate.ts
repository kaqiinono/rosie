import type { ProblemMasteryMap } from '@rosie/core'
import type { QuizProblemItem } from '@rosie/math/hooks/useMathQuiz'
import {
  buildQuizPool,
  type QuizEntry,
  type QuizSection,
} from '@rosie/math/utils/quiz-lesson-meta'

export type QuizBatchLessonConfig = {
  countPerVolume: number
  problemIds: string[]
}

export type QuizBatchConfig = {
  sections: QuizSection[]
  lessons: Record<string, QuizBatchLessonConfig>
}

export type AllocationContext = {
  wrongIds: Set<string>
  solveCount: Record<string, number>
  masteryMap: ProblemMasteryMap
}

export type QuizVolumePlan = {
  batchIndex: number
  entries: QuizEntry[]
}

export type QuizPaperUpdatePlan = {
  paperId: string
  appendEntries: QuizEntry[]
}

export type QuizAppendPlan = {
  updates: QuizPaperUpdatePlan[]
  newVolumes: QuizVolumePlan[]
  config: QuizBatchConfig
}

export type QuizPoolStats = {
  totalPool: number
  perVolume: number
  volumeCount: number
  lessonPoolSizes: Record<string, number>
}

export type ExistingBatchPaper = {
  id: string
  batchIndex: number | null
  completedAt: string | null
  problems: QuizProblemItem[]
}

export function quizTodayDateStr() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

export function quizBatchVolumeTitle(baseTitle: string, batchIndex: number, totalVolumes?: number) {
  const name = baseTitle.trim() || `综合测试卷${quizTodayDateStr()}`
  const pad = (totalVolumes ?? batchIndex) >= 10 ? 2 : 1
  return `${name}（第${String(batchIndex).padStart(pad, '0')}卷）`
}

export function compareQuizPriority(a: QuizEntry, b: QuizEntry, ctx: AllocationContext): number {
  const wa = ctx.wrongIds.has(a.problem.id) ? 0 : 1
  const wb = ctx.wrongIds.has(b.problem.id) ? 0 : 1
  if (wa !== wb) return wa - wb

  const ca = ctx.solveCount[a.problem.id] ?? 0
  const cb = ctx.solveCount[b.problem.id] ?? 0
  if (ca !== cb) return ca - cb

  const la = ctx.masteryMap[a.problem.id]?.lastSeen ?? ''
  const lb = ctx.masteryMap[b.problem.id]?.lastSeen ?? ''
  if (la !== lb) return la.localeCompare(lb)

  return a.problem.id.localeCompare(b.problem.id)
}

export function sortPoolByPriority(pool: QuizEntry[], ctx: AllocationContext): QuizEntry[] {
  return [...pool].sort((a, b) => compareQuizPriority(a, b, ctx))
}

export function chunkPool(sorted: QuizEntry[], size: number): QuizEntry[][] {
  const n = Math.max(1, size)
  const chunks: QuizEntry[][] = []
  for (let i = 0; i < sorted.length; i += n) {
    chunks.push(sorted.slice(i, i + n))
  }
  return chunks
}

/**
 * Build exactly `volumeCount` chunks of size `countPerVolume`.
 * Unique problems are assigned first (no replacement); once exhausted,
 * later volumes recycle from the same priority-sorted pool. Within a
 * single chunk, duplicates are avoided until the pool is smaller than
 * `countPerVolume`.
 */
export function buildPaddedLessonChunks(
  sorted: QuizEntry[],
  countPerVolume: number,
  volumeCount: number,
): QuizEntry[][] {
  const n = Math.max(1, countPerVolume)
  const target = Math.max(0, volumeCount)
  if (sorted.length === 0 || target === 0) return []

  const chunks: QuizEntry[][] = chunkPool(sorted, n)
  let recycleCursor = 0

  const takePadded = (seed: QuizEntry[]): QuizEntry[] => {
    const result = [...seed]
    const inChunk = new Set(result.map((e) => e.problem.id))

    while (result.length < n) {
      let found: QuizEntry | null = null
      for (let step = 0; step < sorted.length; step++) {
        const e = sorted[(recycleCursor + step) % sorted.length]!
        if (!inChunk.has(e.problem.id)) {
          found = e
          recycleCursor = (recycleCursor + step + 1) % sorted.length
          break
        }
      }
      if (found) {
        result.push(found)
        inChunk.add(found.problem.id)
        continue
      }
      // Pool smaller than countPerVolume — allow within-volume repeats.
      const e = sorted[recycleCursor % sorted.length]!
      result.push(e)
      recycleCursor = (recycleCursor + 1) % sorted.length
    }
    return result
  }

  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i]!.length < n) {
      chunks[i] = takePadded(chunks[i]!)
    }
  }
  while (chunks.length < target) {
    chunks.push(takePadded([]))
  }
  return chunks.slice(0, target)
}

export function pickByPriority(
  pool: QuizEntry[],
  exclude: Set<string>,
  ctx: AllocationContext,
): QuizEntry | null {
  const sorted = sortPoolByPriority(
    pool.filter((e) => !exclude.has(e.problem.id)),
    ctx,
  )
  return sorted[0] ?? null
}

function lessonSortedPool(
  lessonId: string,
  sections: QuizSection[],
  types: string[],
  ctx: AllocationContext,
  usedIds: Set<string>,
): QuizEntry[] {
  const pool = buildQuizPool(lessonId, sections, types).filter((e) => !usedIds.has(e.problem.id))
  return sortPoolByPriority(pool, ctx)
}

export function computeQuizPoolStats(
  lessonIds: string[],
  sections: QuizSection[],
  typesByLesson: Record<string, string[]>,
  countsByLesson: Record<string, number>,
  usedIds: Set<string> = new Set(),
): QuizPoolStats {
  let totalPool = 0
  let perVolume = 0
  let volumeCount = 0
  const lessonPoolSizes: Record<string, number> = {}

  for (const lessonId of lessonIds) {
    const types = typesByLesson[lessonId] ?? []
    const count = Math.max(1, countsByLesson[lessonId] ?? 1)
    const poolSize = buildQuizPool(lessonId, sections, types).filter(
      (e) => !usedIds.has(e.problem.id),
    ).length
    lessonPoolSizes[lessonId] = poolSize
    totalPool += poolSize
    perVolume += count
    if (poolSize > 0) {
      volumeCount = Math.max(volumeCount, Math.ceil(poolSize / count))
    }
  }

  return { totalPool, perVolume, volumeCount, lessonPoolSizes }
}

export function entriesToProblemItems(
  entries: QuizEntry[],
  sections: QuizSection[],
  typesByLesson: Record<string, string[]>,
): QuizProblemItem[] {
  return entries.map((entry) => ({
    lessonId: entry.lessonId,
    section: entry.section,
    problemId: entry.problem.id,
    sections,
    types: typesByLesson[entry.lessonId] ?? [],
  }))
}

function mergeLessonConfig(
  config: QuizBatchConfig,
  lessonId: string,
  countPerVolume: number,
  problemIds: string[],
): QuizBatchConfig {
  const prev = config.lessons[lessonId]
  const mergedIds = [...new Set([...(prev?.problemIds ?? []), ...problemIds])]
  return {
    ...config,
    sections: config.sections,
    lessons: {
      ...config.lessons,
      [lessonId]: { countPerVolume, problemIds: mergedIds },
    },
  }
}

export function allocateInitialBatch(
  lessonIds: string[],
  sections: QuizSection[],
  typesByLesson: Record<string, string[]>,
  countsByLesson: Record<string, number>,
  ctx: AllocationContext,
  usedIds: Set<string> = new Set(),
): { volumes: QuizVolumePlan[]; config: QuizBatchConfig } {
  const sortedPools: Record<string, QuizEntry[]> = {}
  const counts: Record<string, number> = {}
  let maxVolumes = 0
  let config: QuizBatchConfig = { sections, lessons: {} }

  for (const lessonId of lessonIds) {
    const types = typesByLesson[lessonId] ?? []
    const count = Math.max(1, countsByLesson[lessonId] ?? 1)
    counts[lessonId] = count
    const sorted = lessonSortedPool(lessonId, sections, types, ctx, usedIds)
    sortedPools[lessonId] = sorted
    if (sorted.length > 0) {
      maxVolumes = Math.max(maxVolumes, Math.ceil(sorted.length / count))
    }
  }

  const chunkMap: Record<string, QuizEntry[][]> = {}
  for (const lessonId of lessonIds) {
    const count = counts[lessonId]!
    const chunks = buildPaddedLessonChunks(sortedPools[lessonId] ?? [], count, maxVolumes)
    chunkMap[lessonId] = chunks
    const assignedIds = chunks.flat().map((e) => e.problem.id)
    config = mergeLessonConfig(config, lessonId, count, assignedIds)
  }

  const volumes: QuizVolumePlan[] = []
  for (let k = 1; k <= maxVolumes; k++) {
    const entries: QuizEntry[] = []
    for (const lessonId of lessonIds) {
      const chunk = chunkMap[lessonId]?.[k - 1]
      if (chunk) entries.push(...chunk)
    }
    if (entries.length > 0) volumes.push({ batchIndex: k, entries })
  }

  return { volumes, config }
}

export function allocateAppendLessons(
  newLessonIds: string[],
  sections: QuizSection[],
  typesByLesson: Record<string, string[]>,
  countsByLesson: Record<string, number>,
  existingPapers: ExistingBatchPaper[],
  batchConfig: QuizBatchConfig,
  ctx: AllocationContext,
): QuizAppendPlan {
  const usedIds = new Set<string>()
  for (const paper of existingPapers) {
    for (const p of paper.problems) usedIds.add(p.problemId)
  }

  const sortedPools: Record<string, QuizEntry[]> = {}
  const counts: Record<string, number> = {}
  let maxVolumes = 0
  let config = { ...batchConfig, sections, lessons: { ...batchConfig.lessons } }

  for (const lessonId of newLessonIds) {
    const types = typesByLesson[lessonId] ?? []
    const count = Math.max(1, countsByLesson[lessonId] ?? 1)
    counts[lessonId] = count
    const sorted = lessonSortedPool(lessonId, sections, types, ctx, usedIds)
    sortedPools[lessonId] = sorted
    if (sorted.length > 0) {
      maxVolumes = Math.max(maxVolumes, Math.ceil(sorted.length / count))
    }
  }

  const chunkMap: Record<string, QuizEntry[][]> = {}
  for (const lessonId of newLessonIds) {
    const count = counts[lessonId]!
    const chunks = buildPaddedLessonChunks(sortedPools[lessonId] ?? [], count, maxVolumes)
    chunkMap[lessonId] = chunks
    const assignedIds = chunks.flat().map((e) => e.problem.id)
    config = mergeLessonConfig(config, lessonId, count, assignedIds)
  }

  const papersByIndex = new Map<number, ExistingBatchPaper>()
  for (const paper of existingPapers) {
    if (paper.batchIndex != null) papersByIndex.set(paper.batchIndex, paper)
  }
  const maxExistingIndex =
    existingPapers.reduce((max, p) => Math.max(max, p.batchIndex ?? 0), 0) || 0

  const updates: QuizPaperUpdatePlan[] = []
  const newVolumes: QuizVolumePlan[] = []
  const overflowQueue: QuizEntry[][] = []

  for (let k = 1; k <= maxVolumes; k++) {
    const entries: QuizEntry[] = []
    for (const lessonId of newLessonIds) {
      const chunk = chunkMap[lessonId]?.[k - 1]
      if (chunk) entries.push(...chunk)
    }
    if (entries.length === 0) continue

    const paper = papersByIndex.get(k)
    if (paper?.completedAt) {
      overflowQueue.push(entries)
    } else if (paper) {
      updates.push({ paperId: paper.id, appendEntries: entries })
    } else {
      newVolumes.push({ batchIndex: k, entries })
    }
  }

  let nextIndex = Math.max(maxExistingIndex, maxVolumes) + 1
  for (const entries of overflowQueue) {
    newVolumes.push({ batchIndex: nextIndex, entries })
    nextIndex += 1
  }

  return { updates, newVolumes, config }
}
