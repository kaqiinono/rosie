import { supabase } from '@rosie/core'
import type { CalcProblemState, CalcSession } from '@rosie/core'
import { curriculumForBlock, factFromSignature, coverageSignature, type IntegerFact } from './calc-curriculum'

export type CompletedCurriculumMap = Map<string, Set<number>>

export interface CurriculumHistoryBackfillResult {
  tagged: number
  legacyExcluded: number
  unsupported: number
}

interface CompletedRow { block_id: string; curriculum_version: number; curriculum_index: number }

export async function fetchCurriculumCompleted(userId: string): Promise<CompletedCurriculumMap> {
  const { data, error } = await supabase.from('calc_curriculum_completed')
    .select('block_id,curriculum_version,curriculum_index').eq('user_id', userId)
  if (error) {
    console.error('[calc curriculum] failed to load completed facts', error)
    return new Map()
  }
  const out: CompletedCurriculumMap = new Map()
  for (const row of (data ?? []) as CompletedRow[]) {
    const curriculum = curriculumForBlock(row.block_id)
    if (!curriculum || curriculum.version !== row.curriculum_version) continue
    const set = out.get(row.block_id) ?? new Set<number>()
    set.add(row.curriculum_index)
    out.set(row.block_id, set)
  }
  return out
}

export async function recordCurriculumCompletions(
  userId: string,
  states: CalcProblemState[],
  source: 'practice' | 'history' = 'practice',
): Promise<void> {
  const rows = states.flatMap((state) => {
    if (!state.blockId || state.appearanceCount <= 0) return []
    const curriculum = curriculumForBlock(state.blockId)
    const fact = factFromSignature(state.signature)
    const index = curriculum && fact ? curriculum.rank(fact) : null
    if (!curriculum || !fact || index === null) return []
    return [{ user_id: userId, block_id: state.blockId, curriculum_version: curriculum.version,
      curriculum_index: index, coverage_signature: coverageSignature(fact), source }]
  })
  if (rows.length === 0) return
  const { error } = await supabase.from('calc_curriculum_completed')
    .upsert(rows, { onConflict: 'user_id,block_id,curriculum_version,curriculum_index' })
  if (error) throw error
  await persistPointers(userId, [...new Set(rows.map((row) => row.block_id))])
}

async function persistPointers(userId: string, blockIds: string[]): Promise<void> {
  if (blockIds.length === 0) return
  const { data, error } = await supabase.from('calc_curriculum_completed')
    .select('block_id,curriculum_version,curriculum_index')
    .eq('user_id', userId).in('block_id', blockIds)
  if (error) throw error
  const completed = new Map<string, Set<number>>()
  for (const row of (data ?? []) as CompletedRow[]) {
    const curriculum = curriculumForBlock(row.block_id)
    if (!curriculum || curriculum.version !== row.curriculum_version) continue
    const set = completed.get(row.block_id) ?? new Set<number>()
    set.add(row.curriculum_index)
    completed.set(row.block_id, set)
  }
  const progressRows = blockIds.flatMap((blockId) => {
    const curriculum = curriculumForBlock(blockId)
    if (!curriculum) return []
    const indices = completed.get(blockId) ?? new Set<number>()
    let pointer = 0
    while (pointer < curriculum.count() && indices.has(pointer)) pointer++
    const stageFact = curriculum.unrank(Math.min(pointer, curriculum.count() - 1))
    return [{ user_id: userId, block_id: blockId, curriculum_version: curriculum.version,
      pointer_index: pointer, stage_id: curriculum.stageOf(stageFact), updated_at: new Date().toISOString() }]
  })
  const { error: progressError } = await supabase.from('calc_curriculum_progress')
    .upsert(progressRows, { onConflict: 'user_id,block_id' })
  if (progressError) throw progressError
}

function factFromDisplay(display: string | undefined): IntegerFact | null {
  if (!display) return null
  const match = display.replace(/\s*=\s*\?\s*$/, '').trim().match(/^(\d+)\s*([+×÷−-])\s*(\d+)$/)
  if (!match) return null
  const op = match[2] === '+' ? 'add' : match[2] === '×' ? 'mul' : match[2] === '÷' ? 'div' : 'sub'
  return { op, left: Number(match[1]), right: Number(match[3]) }
}

/** Idempotently rebuild derived curriculum markers from permanent completed-session logs. */
export async function backfillCurriculumHistory(
  userId: string,
  sessions: CalcSession[],
): Promise<CurriculumHistoryBackfillResult> {
  const rows = new Map<string, {
    user_id: string
    block_id: string
    curriculum_version: number
    curriculum_index: number
    coverage_signature: string
    source: 'history'
  }>()
  let legacyExcluded = 0
  let unsupported = 0
  for (const session of sessions) {
    for (const entry of session.questionLog ?? []) {
      if (!entry.key.startsWith('block:')) continue
      const blockId = entry.key.slice('block:'.length)
      const curriculum = curriculumForBlock(blockId)
      if (!curriculum) { unsupported++; continue }
      const fact = factFromSignature(entry.coverageSignature ?? entry.displaySignature ?? '')
        ?? factFromDisplay(entry.display)
      const index = fact ? curriculum.rank(fact) : null
      if (!fact || index === null) { legacyExcluded++; continue }
      rows.set(`${blockId}:${curriculum.version}:${index}`, {
        user_id: userId,
        block_id: blockId,
        curriculum_version: curriculum.version,
        curriculum_index: index,
        coverage_signature: coverageSignature(fact),
        source: 'history',
      })
    }
  }
  const values = [...rows.values()]
  for (let start = 0; start < values.length; start += 500) {
    const { error } = await supabase.from('calc_curriculum_completed').upsert(
      values.slice(start, start + 500),
      { onConflict: 'user_id,block_id,curriculum_version,curriculum_index' },
    )
    if (error) throw error
  }
  await persistPointers(userId, [...new Set(values.map((row) => row.block_id))])
  const { error } = await supabase.from('calc_curriculum_history_audit').upsert({
    user_id: userId,
    curriculum_version: 1,
    tagged_count: values.length,
    legacy_excluded_count: legacyExcluded,
    unsupported_count: unsupported,
    rebuilt_at: new Date().toISOString(),
  }, { onConflict: 'user_id,curriculum_version' })
  if (error) throw error
  return { tagged: values.length, legacyExcluded, unsupported }
}
