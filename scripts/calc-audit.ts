#!/usr/bin/env node

import type { CalcSettings } from '@rosie/core'
import { blockById } from '../packages/calc/src/utils/calc-blocks'
import { buildSession } from '../packages/calc/src/utils/calc-helpers'
import { coverageUniverse, finiteCoverageUniverses } from '../packages/calc/src/utils/calc-coverage'
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
  rows: { question_log: Array<{ signature?: string; intentionalRepeat?: boolean }> | null }[],
) {
  let questions = 0
  let repeats = 0
  let intentional = 0
  let accidental = 0
  let consecutive = 0
  for (const row of rows) {
    const seen = new Set<string>()
    let previous: string | null = null
    for (const entry of row.question_log ?? []) {
      if (!entry.signature) continue
      questions++
      if (seen.has(entry.signature)) {
        repeats++
        if (entry.intentionalRepeat) intentional++
        else accidental++
      }
      if (previous === entry.signature) consecutive++
      seen.add(entry.signature)
      previous = entry.signature
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
  const { data, error } = await client
    .from('calc_sessions')
    .select('question_log')
    .eq('user_id', userId)
    .order('finished_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`读取用户会话失败：${error.message}`)
  return { userId, ...auditSessionLogs(data ?? []) }
}

async function main(): Promise<void> {
  if (process.argv.includes('--help')) {
    console.log('pnpm calc:audit -- --block mul:29 --count 20 --sessions 10000 --seed 20260829')
    return
  }
  auditUniverses()
  const count = numberArg('--count', 20)
  const sessions = numberArg('--sessions', 10000)
  const seed = numberArg('--seed', 20260829)
  const userId = stringArg('--user-id', '')
  if (userId) {
    console.log(JSON.stringify(await auditUserSessions(userId, numberArg('--limit', 30)), null, 2))
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
