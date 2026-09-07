#!/usr/bin/env node

import { createHash } from 'node:crypto'
import {
  curriculumHashInput,
  curriculumRegistrySources,
  type CurriculumRegistrySource,
} from '../packages/calc/src/utils/calc-curriculum-registry'
import type {
  CalcProblemState,
  CalcProblemStatus,
  QuestionAttempt,
} from '../packages/core/src/type'
import { reportFieldsOf } from '../packages/calc/src/utils/calc-report-facets'
import { finiteCoverageUniverses, learningStatusOf } from '../packages/calc/src/utils/calc-coverage'
import {
  hasIndependentAttempt,
  hasWithinTargetAttempt,
} from '../packages/calc/src/utils/calc-evidence'

interface RegistryManifestRow {
  blockId: string
  curriculumVersion: string
  universeSize: number
  curriculumHash: string
  coverageKind: CurriculumRegistrySource['coverageKind']
}

interface ProblemStateRow {
  signature: string
  level: number
  proficiency: number
  attempt_count: number
  appearance_count: number
  recent_results: QuestionAttempt[]
  status: CalcProblemStatus
  consecutive_wrong: number
  consecutive_correct: number | null
  last_within_limit: boolean | null
  updated_at: string
  block_id: string | null
  mixed_op_id: string | null
  needs_remediation: boolean | null
  last_wrong_at: string | null
  last_wrong_session_no: number | null
  last_error_tag: CalcProblemState['lastErrorTag']
  last_user_answer: string | null
  last_answer_json: CalcProblemState['lastAnswerJson']
  remediation_correct_count: number | null
  applied_revision: number | null
}

const PROBLEM_STATE_SELECT_COLS =
  'signature,level,proficiency,attempt_count,appearance_count,recent_results,status,consecutive_wrong,consecutive_correct,last_within_limit,updated_at,block_id,mixed_op_id,needs_remediation,last_wrong_at,last_wrong_session_no,last_error_tag,last_user_answer,last_answer_json,remediation_correct_count,applied_revision'

function rowToState(row: ProblemStateRow): CalcProblemState {
  const grandfathered =
    row.proficiency >= 4 &&
    row.attempt_count >= 3 &&
    (row.consecutive_correct ?? 0) === 0 &&
    row.status !== 'lagging'
  return {
    signature: row.signature,
    level: row.level === 99 ? 'C' : row.level,
    proficiency: row.proficiency,
    attemptCount: row.attempt_count,
    appearanceCount: row.appearance_count,
    recentResults: Array.isArray(row.recent_results) ? row.recent_results : [],
    status: grandfathered ? 'mastered' : row.status,
    consecutiveWrong: row.consecutive_wrong,
    consecutiveCorrect: grandfathered ? 3 : (row.consecutive_correct ?? 0),
    lastWithinLimit: row.last_within_limit,
    updatedAt: row.updated_at,
    blockId: row.block_id ?? undefined,
    mixedOpId: row.mixed_op_id ?? undefined,
    needsRemediation: row.needs_remediation ?? false,
    lastWrongAt: row.last_wrong_at,
    lastWrongSessionNo: row.last_wrong_session_no,
    lastErrorTag: row.last_error_tag ?? null,
    lastUserAnswer: row.last_user_answer,
    lastAnswerJson: row.last_answer_json,
    remediationCorrectCount: row.remediation_correct_count ?? 0,
    appliedRevision: row.applied_revision ?? 0,
  }
}

function stateReportRow(state: CalcProblemState, userId: string, updatedAt: string) {
  return {
    user_id: userId,
    signature: state.signature,
    level: state.level === 'C' ? 99 : state.level,
    proficiency: state.proficiency,
    attempt_count: state.attemptCount,
    appearance_count: state.appearanceCount,
    recent_results: state.recentResults,
    status: state.status,
    consecutive_wrong: state.consecutiveWrong,
    consecutive_correct: state.consecutiveCorrect,
    last_within_limit: state.lastWithinLimit ?? null,
    updated_at: updatedAt,
    block_id: state.blockId ?? null,
    mixed_op_id: state.mixedOpId ?? null,
    needs_remediation: state.needsRemediation ?? false,
    last_wrong_at: state.lastWrongAt ?? null,
    last_wrong_session_no: state.lastWrongSessionNo ?? null,
    last_error_tag: state.lastErrorTag ?? null,
    last_user_answer: state.lastUserAnswer ?? null,
    last_answer_json: state.lastAnswerJson ?? null,
    remediation_correct_count: state.remediationCorrectCount ?? 0,
    applied_revision: state.appliedRevision ?? 0,
    ...reportFieldsOf(state),
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function buildRegistryManifest(): RegistryManifestRow[] {
  return curriculumRegistrySources().map((source) => ({
    blockId: source.blockId,
    curriculumVersion: source.version,
    universeSize: source.members.length,
    curriculumHash: sha256(curriculumHashInput(source)),
    coverageKind: source.coverageKind,
  }))
}

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

export function registrySeedSql(rows: RegistryManifestRow[]): string {
  const values = rows
    .map(
      (row) =>
        `  (${quoteSql(row.blockId)}, ${quoteSql(row.curriculumVersion)}, ${row.universeSize}, ${quoteSql(row.curriculumHash)}, ${quoteSql(row.coverageKind)}, 'draft')`,
    )
    .join(',\n')
  return [
    '-- Generated by pnpm calc:progress -- registry-sql.',
    '-- Draft-only and non-destructive: activation is a separate reviewed migration.',
    'INSERT INTO public.calc_curriculum_registry (',
    '  block_id, curriculum_version, universe_size, curriculum_hash, coverage_kind, status',
    ') VALUES',
    values,
    'ON CONFLICT (block_id, curriculum_version) DO UPDATE SET',
    '  universe_size = EXCLUDED.universe_size,',
    '  curriculum_hash = EXCLUDED.curriculum_hash,',
    '  coverage_kind = EXCLUDED.coverage_kind',
    "WHERE public.calc_curriculum_registry.status = 'draft';",
  ].join('\n')
}

function usage(): void {
  console.log('pnpm calc:progress -- registry-manifest')
  console.log('pnpm calc:progress -- registry-sql')
  console.log('pnpm calc:progress -- audit-registry scripts/calc-curriculum-registry.json')
  console.log('pnpm calc:progress -- audit --user <uuid>  # read-only')
  console.log('pnpm calc:progress -- rebuild-report --user <uuid>')
  console.log('pnpm calc:progress -- rebuild-report --all [--after <uuid>]')
}

async function serviceClient() {
  const { createClient } = await import('../packages/core/node_modules/@supabase/supabase-js')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('需要 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function auditUser(userId: string): Promise<void> {
  const client = await serviceClient()
  const [runtimeResult, progressResult, sessionResult, stateResult] = await Promise.all([
    client
      .from('calc_user_runtime')
      .select('state_revision,last_session_no')
      .eq('user_id', userId)
      .maybeSingle(),
    client
      .from('calc_block_progress')
      .select(
        'block_id,curriculum_version,universe_size,covered_count,within_target_count,fluent_count,mastered_count,applied_revision,health_status',
      )
      .eq('user_id', userId),
    client
      .from('calc_sessions')
      .select('id,session_no,state_revision,idempotency_key,question_log')
      .eq('user_id', userId)
      .not('idempotency_key', 'is', null)
      .order('session_no', { ascending: false })
      .limit(500),
    client
      .from('calc_problem_state')
      .select('signature,needs_remediation,applied_revision,report_facets_version')
      .eq('user_id', userId),
  ])
  for (const result of [runtimeResult, progressResult, sessionResult, stateResult]) {
    if (result.error) throw new Error(result.error.message)
  }
  const sessions = sessionResult.data ?? []
  const duplicateKeys = new Set<string>()
  const seenKeys = new Set<string>()
  let incompleteFacts = 0
  for (const session of sessions) {
    if (session.idempotency_key) {
      if (seenKeys.has(session.idempotency_key)) duplicateKeys.add(session.idempotency_key)
      seenKeys.add(session.idempotency_key)
    }
    if (
      !Array.isArray(session.question_log) ||
      session.question_log.some(
        (entry) =>
          typeof entry !== 'object' ||
          entry === null ||
          !('signature' in entry) ||
          !('ms' in entry),
      )
    ) {
      incompleteFacts += 1
    }
  }
  console.log(
    JSON.stringify(
      {
        user: sha256(userId).slice(0, 12),
        runtime: runtimeResult.data,
        unifiedSessions: sessions.length,
        incompleteSessionFacts: incompleteFacts,
        duplicateIdempotencyKeys: duplicateKeys.size,
        progressRows: progressResult.data?.length ?? 0,
        unhealthyProgressRows: (progressResult.data ?? []).filter(
          (row) => row.health_status !== 'healthy',
        ).length,
        remediationRows: (stateResult.data ?? []).filter((row) => row.needs_remediation).length,
        reportProjectionRows: (stateResult.data ?? []).filter(
          (row) => row.report_facets_version === 1,
        ).length,
        reportProjectionComplete: (stateResult.data ?? []).every(
          (row) => row.report_facets_version === 1,
        ),
        rebuildSafe: incompleteFacts === 0 && duplicateKeys.size === 0,
      },
      null,
      2,
    ),
  )
}

async function rebuildReport(userId: string): Promise<void> {
  const client = await serviceClient()
  const { data: stateRows, error: stateError } = await client
    .from('calc_problem_state')
    .select(PROBLEM_STATE_SELECT_COLS)
    .eq('user_id', userId)
  if (stateError) throw new Error(stateError.message)

  const projected = (stateRows as ProblemStateRow[]).map((row) => {
    const state = rowToState(row)
    return stateReportRow(state, userId, row.updated_at)
  })
  for (let index = 0; index < projected.length; index += 500) {
    const { error } = await client
      .from('calc_problem_state')
      .upsert(projected.slice(index, index + 500), { onConflict: 'user_id,signature' })
    if (error) throw new Error(error.message)
  }

  const stateMap = new Map(
    (stateRows as ProblemStateRow[]).map((row) => {
      const state = rowToState(row)
      return [state.signature, state]
    }),
  )
  const runtime = await client
    .from('calc_user_runtime')
    .select('state_revision')
    .eq('user_id', userId)
    .maybeSingle()
  if (runtime.error) throw new Error(runtime.error.message)
  const revision = runtime.data?.state_revision ?? 0
  const encodeBits = (indices: number[], size: number): string => {
    const bytes = new Uint8Array(Math.ceil(size / 8))
    for (const item of indices) bytes[Math.floor(item / 8)] |= 1 << (item % 8)
    return `\\x${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
  }
  const progressRows = finiteCoverageUniverses().map((universe) => {
    const covered: number[] = []
    const within: number[] = []
    const fluent: number[] = []
    const mastered: number[] = []
    for (let index = 0; index < universe.size; index++) {
      const state = stateMap.get(universe.signatureAt(index))
      const status = learningStatusOf(state)
      if (hasIndependentAttempt(state)) covered.push(index)
      if (hasWithinTargetAttempt(state)) within.push(index)
      if (status === 'fluent' || status === 'mastered') fluent.push(index)
      if (status === 'mastered') mastered.push(index)
    }
    return {
      user_id: userId,
      block_id: universe.blockId,
      curriculum_version: universe.version,
      universe_size: universe.size,
      coverage_kind: 'formula',
      formula_covered_bits: encodeBits(covered, universe.size),
      formula_within_target_bits: encodeBits(within, universe.size),
      formula_fluent_bits: encodeBits(fluent, universe.size),
      formula_mastered_bits: encodeBits(mastered, universe.size),
      applied_revision: revision,
      health_status: 'healthy',
    }
  })
  const { error: progressError } = await client
    .from('calc_block_progress')
    .upsert(progressRows, { onConflict: 'user_id,block_id,curriculum_version' })
  if (progressError) throw new Error(progressError.message)
  console.log(
    JSON.stringify(
      {
        user: sha256(userId).slice(0, 12),
        reportFacetsRebuilt: projected.length,
        formulaProgressRebuilt: progressRows.length,
      },
      null,
      2,
    ),
  )
}

async function rebuildAllReports(after?: string): Promise<void> {
  const client = await serviceClient()
  const userIds = new Set<string>()
  for (const table of ['calc_problem_state', 'calc_user_runtime'] as const) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client
        .from(table)
        .select('user_id')
        .order('user_id', { ascending: true })
        .range(offset, offset + 999)
      if (error) throw new Error(error.message)
      for (const item of data ?? []) userIds.add(item.user_id)
      if (!data || data.length < 1000) break
    }
  }
  const orderedUserIds = [...userIds]
    .sort((left, right) => left.localeCompare(right))
    .filter((userId) => !after || userId > after)
  let users = 0
  let rows = 0
  let cursor = after ?? ''
  for (const userId of orderedUserIds) {
    const before = Date.now()
    await rebuildReport(userId)
    users++
    const { count, error: countError } = await client
      .from('calc_problem_state')
      .select('signature', { count: 'exact', head: true })
      .eq('user_id', userId)
    if (countError) throw new Error(countError.message)
    rows += count ?? 0
    console.log(
      `report rebuild progress users=${users} rows=${rows} cursor=${userId} ms=${Date.now() - before}`,
    )
    cursor = userId
  }
  console.log(JSON.stringify({ complete: true, users, rows, cursor }, null, 2))
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

async function auditManifest(path: string): Promise<void> {
  const { readFile } = await import('node:fs/promises')
  const expected = buildRegistryManifest()
  const actual = JSON.parse(await readFile(path, 'utf8')) as unknown
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`registry manifest 与代码课程不一致：${path}`)
  }
  console.log(`registry manifest OK: ${expected.length} curricula`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((argument) => argument !== '--')
  const command = args[0]
  if (!command || command === '--help' || command === 'help') {
    usage()
    return
  }
  if (command === 'registry-manifest') {
    console.log(JSON.stringify(buildRegistryManifest(), null, 2))
    return
  }
  if (command === 'registry-sql') {
    console.log(registrySeedSql(buildRegistryManifest()))
    return
  }
  if (command === 'audit-registry') {
    const path = args[1]
    if (!path) throw new Error('audit-registry 需要 manifest 路径')
    await auditManifest(path)
    return
  }
  if (command === 'audit') {
    const userId = option(args, '--user')
    if (!userId) throw new Error('audit 必须显式提供 --user <uuid>；禁止默认全量扫描')
    await auditUser(userId)
    return
  }
  if (command === 'rebuild-report') {
    const userId = option(args, '--user')
    if (args.includes('--all')) await rebuildAllReports(option(args, '--after'))
    else if (userId) await rebuildReport(userId)
    else throw new Error('rebuild-report 需要 --user <uuid> 或 --all')
    return
  }
  throw new Error(`未知命令：${command}`)
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
