#!/usr/bin/env node

import { createHash } from 'node:crypto'
import type { CalcProblemState, CalcSettings, QuestionAttempt } from '@rosie/core'
import { blockById } from '../packages/calc/src/utils/calc-blocks'
import { buildSession } from '../packages/calc/src/utils/calc-helpers'
import {
  calculateAllCoverage,
  coverageUniverse,
  finiteCoverageUniverses,
  learningStatusOf,
} from '../packages/calc/src/utils/calc-coverage'
import { conceptKeyOf } from '../packages/calc/src/utils/calc-concept-key'
import { structureCoverageModels } from '../packages/calc/src/utils/calc-structure-coverage'
import { classifyRuleSignature } from '../packages/calc/src/utils/calc-rule-coverage'

interface AuditOptions {
  blockId: string
  count: number
  sessions: number
  seed: number
}

function numberArg(name: string, fallback: number): number {
  const index = process.argv.indexOf(name)
  if (index < 0) return fallback
  const value = Number(process.argv[index + 1])
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} 必须是正数`)
  return Math.floor(value)
}

function stringArg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name)
  return index < 0 ? fallback : (process.argv[index + 1] ?? fallback)
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function auditUniverses(): void {
  for (const universe of finiteCoverageUniverses()) {
    const seen = new Set<string>()
    for (let i = 0; i < universe.size; i++) {
      const signature = universe.signatureAt(i)
      if (seen.has(signature)) throw new Error(`${universe.blockId} 存在重复签名 ${signature}`)
      if (universe.indexOf(signature) !== i) {
        throw new Error(`${universe.blockId} indexOf(signatureAt(${i})) 不可逆`)
      }
      seen.add(signature)
    }
  }
}

function auditConceptKeys(): Record<string, unknown>[] {
  return finiteCoverageUniverses().map((universe) => {
    const concepts = new Map<string, string[]>()
    for (let i = 0; i < universe.size; i++) {
      const signature = universe.signatureAt(i)
      const concept = conceptKeyOf(signature)
      if (conceptKeyOf(concept) !== concept) {
        throw new Error(`${universe.blockId} conceptKey 非幂等：${signature} → ${concept}`)
      }
      const members = concepts.get(concept) ?? []
      members.push(signature)
      if (members.length > 2) {
        throw new Error(
          `${universe.blockId} 概念 ${concept} 聚合了 ${members.length} 个形式（${members.join('、')}）`,
        )
      }
      concepts.set(concept, members)
    }
    const pairs = [...concepts.values()].filter((members) => members.length === 2).length
    return {
      blockId: universe.blockId,
      universeSize: universe.size,
      concepts: concepts.size,
      collapsedPairs: pairs,
    }
  })
}

function auditStructures(samples: number, seed: number): Record<string, unknown>[] {
  const originalRandom = Math.random
  Math.random = seededRandom(seed)
  try {
    return structureCoverageModels().map((model) => {
      const block = blockById(model.id)
      if (!block) throw new Error(`结构模型缺少题型：${model.id}`)
      const declared = new Set(model.cells.map((cell) => cell.key))
      if (declared.size !== model.cells.length) throw new Error(`${model.id} 存在重复结构格 key`)
      const reached = new Set<string>()
      let unclassified = 0
      let unknownKeys = 0
      for (let index = 0; index < samples; index++) {
        const keys = model.classify(block.generateSingle().signature)
        if (keys.length === 0) unclassified++
        for (const key of keys) {
          if (declared.has(key)) reached.add(key)
          else unknownKeys++
        }
      }
      return {
        blockId: model.id,
        declaredCells: declared.size,
        reachedCells: reached.size,
        missingCells: model.cells.filter((cell) => !reached.has(cell.key)).map((cell) => cell.key),
        unclassified,
        unknownKeys,
      }
    })
  } finally {
    Math.random = originalRandom
  }
}

function simulate(options: AuditOptions): Record<string, unknown> {
  const block = blockById(options.blockId)
  if (!block) throw new Error(`未知题型：${options.blockId}`)
  const universe = coverageUniverse(options.blockId)
  const settings: CalcSettings = {
    countMode: 'manual',
    selectedBlocks: [{ id: options.blockId, count: options.count, seconds: 0 }],
    mixedOps: [],
    soundEnabled: false,
    includeInverse: false,
    verticalForBigNumbers: false,
    timedAnswerEnabled: false,
    immersiveMode: false,
    lastCount: options.count,
    sessionCounter: 0,
    timingMode: 'relaxed',
    bonusSec: 0,
    autoSubmitOnMatch: true,
    adaptiveExpansionEnabled: false,
  }

  const originalRandom = Math.random
  Math.random = seededRandom(options.seed)
  let questions = 0
  let repeatedOccurrences = 0
  let consecutive = 0
  let fallback = 0
  let outOfUniverse = 0
  const frequencies = new Map<string, number>()
  try {
    for (let run = 0; run < options.sessions; run++) {
      const session = buildSession(settings, { problemStates: new Map() })
      const seen = new Set<string>()
      let previous: string | null = null
      for (const question of session) {
        questions++
        if (seen.has(question.signature)) repeatedOccurrences++
        if (previous === question.signature) consecutive++
        if (question.selectionReason === 'fallback') fallback++
        if (
          universe &&
          universe.indexOf(question.signature) === null &&
          !classifyRuleSignature(question.signature)
        )
          outOfUniverse++
        seen.add(question.signature)
        previous = question.signature
        frequencies.set(question.signature, (frequencies.get(question.signature) ?? 0) + 1)
      }
    }
  } finally {
    Math.random = originalRandom
  }

  const top = [...frequencies.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  const pct = (value: number) =>
    questions > 0 ? `${((value / questions) * 100).toFixed(2)}%` : '0%'
  return {
    blockId: options.blockId,
    countPerSession: options.count,
    simulatedSessions: options.sessions,
    seed: options.seed,
    universeSize: universe?.size ?? null,
    distinctGenerated: frequencies.size,
    questions,
    repeatedOccurrences,
    repeatRate: pct(repeatedOccurrences),
    consecutive,
    fallback,
    fallbackRate: pct(fallback),
    outsideCoreUniverse: outOfUniverse,
    top,
  }
}

function auditSessionLogs(
  rows: {
    finished_at?: string
    mode?: string
    question_log: Array<{
      signature?: string
      intentionalRepeat?: boolean
      selectionReason?: string
    }> | null
  }[],
) {
  let questions = 0
  let repeats = 0
  let intentional = 0
  let accidental = 0
  let consecutive = 0
  let newFormatSessions = 0
  let currentMaintenance = 0
  let nextExploration = 0
  let weakReinforcement = 0
  let makeup = 0
  let unclassifiedSelection = 0
  const recentNewSessions: Array<Record<string, unknown>> = []
  for (const row of rows) {
    const seen = new Set<string>()
    let previous: string | null = null
    const entries = row.question_log ?? []
    const isNewFormat = entries.some((entry) => !!entry.signature)
    if (isNewFormat) newFormatSessions++
    let sessionCurrent = 0
    let sessionNext = 0
    let sessionWeak = 0
    let sessionMakeup = 0
    let sessionRepeats = 0
    for (const entry of entries) {
      if (!entry.signature) continue
      questions++
      if (seen.has(entry.signature)) {
        repeats++
        sessionRepeats++
        if (entry.intentionalRepeat) intentional++
        else accidental++
      }
      if (previous === entry.signature) consecutive++
      seen.add(entry.signature)
      previous = entry.signature
      if (entry.selectionReason === 'next-difficulty') {
        nextExploration++
        sessionNext++
      }
      else if (
        entry.selectionReason === 'weak' ||
        entry.selectionReason === 'lagging' ||
        entry.selectionReason === 'prerequisite-recovery'
      ) {
        weakReinforcement++
        sessionWeak++
      } else if (
        entry.selectionReason === 'same-session-makeup' ||
        entry.selectionReason === 'carried-mistake'
      ) {
        makeup++
        sessionMakeup++
      } else if (entry.selectionReason) {
        currentMaintenance++
        sessionCurrent++
      }
      else unclassifiedSelection++
    }
    if (isNewFormat && recentNewSessions.length < 10) {
      const sessionPlanned = sessionCurrent + sessionNext + sessionWeak
      const sessionQuestions = sessionPlanned + sessionMakeup
      const sessionPercent = (value: number) =>
        sessionPlanned > 0 ? `${((value / sessionPlanned) * 100).toFixed(1)}%` : '0%'
      recentNewSessions.push({
        finishedAt: row.finished_at,
        mode: row.mode,
        questions: sessionQuestions,
        repeats: sessionRepeats,
        currentMaintenance: sessionPercent(sessionCurrent),
        nextExploration: sessionPercent(sessionNext),
        weakReinforcement: sessionPercent(sessionWeak),
        appendedMakeup: sessionMakeup,
      })
    }
  }
  const percent = (value: number) =>
    questions > 0 ? `${((value / questions) * 100).toFixed(2)}%` : '0%'
  return {
    sessions: rows.length,
    questions,
    repeats,
    repeatRate: percent(repeats),
    intentional,
    accidental,
    accidentalRate: percent(accidental),
    consecutive,
    calibration: {
      newFormatSessions,
      requiredSessions: 5,
      ready: newFormatSessions >= 5,
      remainingSessions: Math.max(0, 5 - newFormatSessions),
      selectionCounts: {
        currentMaintenance,
        nextExploration,
        weakReinforcement,
        appendedMakeup: makeup,
        unclassified: unclassifiedSelection,
      },
      selectionRatios: {
        currentMaintenance:
          currentMaintenance + nextExploration + weakReinforcement > 0
            ? `${((currentMaintenance / (currentMaintenance + nextExploration + weakReinforcement)) * 100).toFixed(2)}%`
            : '0%',
        nextExploration:
          currentMaintenance + nextExploration + weakReinforcement > 0
            ? `${((nextExploration / (currentMaintenance + nextExploration + weakReinforcement)) * 100).toFixed(2)}%`
            : '0%',
        weakReinforcement:
          currentMaintenance + nextExploration + weakReinforcement > 0
            ? `${((weakReinforcement / (currentMaintenance + nextExploration + weakReinforcement)) * 100).toFixed(2)}%`
            : '0%',
      },
      recentNewSessions,
    },
  }
}

async function auditUserSessions(userId: string, limit: number): Promise<Record<string, unknown>> {
  // Resolve from the core workspace dependency; the root CLI does not duplicate
  // the SDK in its own dependency tree.
  const { createClient } = await import('../packages/core/node_modules/@supabase/supabase-js')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key)
    throw new Error('用户审计需要 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const [{ data, error }, { data: stateRows, error: stateError }] = await Promise.all([
    client
    .from('calc_sessions')
    .select('finished_at,mode,question_log')
    .eq('user_id', userId)
    .order('finished_at', { ascending: false })
    .limit(limit),
    client
      .from('calc_problem_state')
      .select(
        'signature,level,proficiency,attempt_count,appearance_count,recent_results,status,consecutive_wrong,consecutive_correct,last_within_limit,updated_at,block_id,mixed_op_id',
      )
      .eq('user_id', userId),
  ])
  if (error) throw new Error(`读取用户会话失败：${error.message}`)
  if (stateError) throw new Error(`读取用户掌握状态失败：${stateError.message}`)
  const states = new Map<string, CalcProblemState>()
  for (const row of stateRows ?? []) {
    const recentResults = Array.isArray(row.recent_results)
      ? (row.recent_results as unknown as QuestionAttempt[])
      : []
    states.set(row.signature, {
      signature: row.signature,
      level: row.level === 99 ? 'C' : row.level,
      proficiency: row.proficiency,
      attemptCount: row.attempt_count,
      appearanceCount: row.appearance_count,
      recentResults,
      status: row.status,
      consecutiveWrong: row.consecutive_wrong,
      consecutiveCorrect: row.consecutive_correct ?? 0,
      lastWithinLimit: row.last_within_limit,
      updatedAt: row.updated_at,
      blockId: row.block_id ?? undefined,
      mixedOpId: row.mixed_op_id ?? undefined,
    })
  }
  const learningCounts = { unseen: 0, learning: 0, fluent: 0, mastered: 0, 'review-due': 0 }
  for (const state of states.values()) learningCounts[learningStatusOf(state)]++
  const coverage = calculateAllCoverage(states)
  const coverageTotal = coverage.reduce((sum, item) => sum + item.total, 0)
  const independentCovered = coverage.reduce((sum, item) => sum + item.covered, 0)
  const legacyCovered = coverage.reduce((sum, item) => {
    let covered = 0
    const universe = coverageUniverse(item.blockId)
    if (!universe) return sum
    for (let index = 0; index < universe.size; index++) {
      if ((states.get(universe.signatureAt(index))?.appearanceCount ?? 0) > 0) covered++
    }
    return sum + covered
  }, 0)
  return {
    user: createHash('sha256').update(userId).digest('hex').slice(0, 12),
    ...auditSessionLogs(data ?? []),
    problemStates: states.size,
    learningCounts,
    finiteCoverage: {
      denominator: coverageTotal,
      legacyAppearanceCovered: legacyCovered,
      independentCovered,
      delta: independentCovered - legacyCovered,
    },
  }
}

async function latestCalcUserId(): Promise<string> {
  const { createClient } = await import('../packages/core/node_modules/@supabase/supabase-js')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key)
    throw new Error('用户审计需要 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client
    .from('calc_sessions')
    .select('user_id')
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data?.user_id) throw new Error(`无法定位最近口算用户：${error?.message ?? '无会话'}`)
  return data.user_id
}

async function main(): Promise<void> {
  if (process.argv.includes('--help')) {
    console.log('pnpm calc:audit -- --block mul:29 --count 20 --sessions 10000 --seed 20260829')
    console.log('pnpm calc:audit -- --latest-user --limit 100  # 只读真实数据校准')
    return
  }
  auditUniverses()
  const conceptAudit = auditConceptKeys()
  const count = numberArg('--count', 20)
  const sessions = numberArg('--sessions', 10000)
  const seed = numberArg('--seed', 20260829)
  const userId = process.argv.includes('--latest-user')
    ? await latestCalcUserId()
    : stringArg('--user-id', '')
  if (userId) {
    console.log(JSON.stringify(await auditUserSessions(userId, numberArg('--limit', 30)), null, 2))
    return
  }
  if (process.argv.includes('--concepts')) {
    console.log(JSON.stringify(conceptAudit, null, 2))
    return
  }
  if (process.argv.includes('--structures')) {
    console.log(JSON.stringify(auditStructures(numberArg('--samples', 10000), seed), null, 2))
    return
  }
  if (process.argv.includes('--all')) {
    console.log(
      JSON.stringify(
        finiteCoverageUniverses().map((universe, index) =>
          simulate({
            blockId: universe.blockId,
            count: Math.min(count, universe.size),
            sessions,
            seed: seed + index,
          }),
        ),
        null,
        2,
      ),
    )
    return
  }
  console.log(
    JSON.stringify(
      simulate({
        blockId: stringArg('--block', 'mul:29'),
        count,
        sessions,
        seed,
      }),
      null,
      2,
    ),
  )
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
