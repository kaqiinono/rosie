import { randomBytes, randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminSupabase, lookupUserFromRequest } from '@/lib/api-auth'
import {
  addDiagnostics, attemptView, MAX_ITEMS, newAttempt, SEGMENT_SIZE,
  type Attempt, type AttemptAction, type Bank, type QueuedAnswer,
} from '@rosie/english/assessment/model'

import { frequencyEstimate } from '@rosie/english/assessment/frequency'
import { issueSegment, pilotView, startPilot, type PilotAttempt, type PilotBank } from '@rosie/english/assessment/adaptive'
import { pilotBank, pilotVersion } from '@/lib/vocabulary-pilot-bank'

const seed = () => randomBytes(4).readUInt32LE()
export const dynamic = 'force-dynamic'

const ATTEMPTS = 'vocabulary_assessment_attempts'
const BANKS = 'vocabulary_assessment_banks'
const FIELDS = 'id,bank_version,revision,state'
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const AUTH_OPTIONS = { attempts: 2, timeoutMs: 5_000 }

type StoredAttempt = { id: string; bank_version: string; revision: number; state: Attempt | PilotAttempt }
type Db = ReturnType<typeof createAdminSupabase>

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

function project(row: StoredAttempt, device: string) {
  if (row.state.modelVersion === 'frequency-v2-pilot-1') return pilotView(row.id, row.bank_version, row.revision, row.state, device)
  return attemptView(row.id, row.bank_version, row.revision, row.state)
}

async function latest(db: Db, userId: string, version?: 1 | 2): Promise<StoredAttempt | null> {
  let query = db.from(ATTEMPTS).select(FIELDS).eq('user_id', userId)
  if (version) query = query.like('bank_version', version === 1 ? 'va-%' : 'va2-%')
  const result = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle()
  if (result.error) throw result.error
  return result.data as StoredAttempt | null
}

async function readBank(db: Db, version?: string) {
  const query = db.from(BANKS).select('version,content')
  const result = await (version ? query.eq('version', version)
    : query.like('version', 'va-%').order('published_at', { ascending: false }).order('version', { ascending: false }).limit(1))
    .maybeSingle()
  if (result.error) throw result.error
  return result.data as { version: string; content: Bank } | null
}

async function latestId(db: Db, userId: string, version: 1 | 2) {
  const result = await db.from(ATTEMPTS).select('id').eq('user_id', userId)
    .like('bank_version', version === 1 ? 'va-%' : 'va2-%')
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle()
  if (result.error) throw result.error
  return result.data?.id as string | undefined
}

async function byId(db: Db, userId: string, id: string) {
  const result = await db.from(ATTEMPTS).select(FIELDS).eq('user_id', userId).eq('id', id).maybeSingle()
  if (result.error) throw result.error
  return result.data as StoredAttempt | null
}

async function frozenBank(db: Db, version: string): Promise<PilotBank> {
  if (version === pilotVersion) return pilotBank
  const result = await db.from(BANKS).select('content').eq('version', version).single()
  if (result.error) throw result.error
  return result.data.content as PilotBank
}

async function legacyExposures(db: Db, userId: string) {
  const identities = new Set<string>()
  for (let offset = 0; ; offset += 25) {
    const result = await db.from(ATTEMPTS).select('state').eq('user_id', userId)
      .like('bank_version', 'va-%').order('id').range(offset, offset + 24)
    if (result.error) throw result.error
    for (const { state } of result.data as { state: Attempt }[]) {
      // A prefetched segment may already have been answered on an offline device.
      const limit = state.phase === 'submitted' || state.phase === 'break'
        ? state.answers.length : (Math.floor(state.answers.length / SEGMENT_SIZE) + 1) * SEGMENT_SIZE
      for (const q of state.questions.slice(0, limit)) {
        identities.add(q.headwordId)
        identities.add(q.senseId)
        identities.add(q.word.toLowerCase())
      }
    }
    if (result.data.length < 25) break
  }
  return [...new Set([...pilotBank.main, ...pilotBank.diagnostic]
    .filter(i => identities.has(i.word.toLowerCase()) || identities.has(i.referenceHeadword ?? '') ||
        identities.has(i.catalogHeadwordId ?? '') || identities.has(i.legacySource?.senseId ?? ''))
    .map(i => i.referenceHeadword ?? i.word.toLowerCase()))]
}

function parseAnswer(value: Record<string, unknown>): Pick<QueuedAnswer, 'decision' | 'optionIndex' | 'elapsedMs'> | null {
  const { decision, optionIndex, elapsedMs } = value
  if (decision !== 'answer' && decision !== 'unknown' && decision !== 'unreadable') return null
  if (decision === 'answer' && (typeof optionIndex !== 'number' ||
      !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3)) return null
  return {
    decision,
    optionIndex: decision === 'answer' ? optionIndex as number : undefined,
    elapsedMs: typeof elapsedMs === 'number' && Number.isFinite(elapsedMs)
      ? Math.min(600_000, Math.max(0, Math.round(elapsedMs))) : undefined,
  }
}

function parseBatch(values: unknown): QueuedAnswer[] | null {
  if (!Array.isArray(values) || !values.length || values.length > SEGMENT_SIZE) return null
  const answers: QueuedAnswer[] = []
  const used = new Set<string>()
  for (const value of values) {
    if (!value || typeof value !== 'object') return null
    const { questionId, operationId, index, segmentId } = value
    const answer = parseAnswer(value)
    if (!answer || typeof questionId !== 'string' || !(UUID.test(questionId) || (questionId.startsWith('rosie-v2-') && questionId.length <= 150)) ||
        (segmentId !== undefined && (typeof segmentId !== 'string' || !UUID.test(segmentId))) ||
        typeof operationId !== 'string' || !UUID.test(operationId) || used.has(operationId) ||
        typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= MAX_ITEMS ||
        (answers.length && index !== answers[0].index + answers.length)) return null
    used.add(operationId)
    answers.push({ ...answer, questionId, operationId, index, segmentId })
  }
  return answers
}

function parseAction(value: unknown): AttemptAction | null {
  if (!value || typeof value !== 'object') return null
  const action = value as Record<string, unknown>
  const { kind, id, revision, previousId } = action
  if (kind === 'start') {
    return previousId === null || (typeof previousId === 'string' && UUID.test(previousId))
      ? { kind, previousId, version: action.version === 2 ? 2 : undefined } : null
  }
  if (typeof id !== 'string' || !UUID.test(id) ||
      typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) return null
  if (kind === 'fallback' && typeof action.segmentId === 'string' && UUID.test(action.segmentId)) {
    return { kind, id, revision, segmentId: action.segmentId }
  }
  if (kind === 'pause' || kind === 'continue' || kind === 'finish' || kind === 'diagnostic') return { kind, id, revision }
  if (kind === 'sync') {
    const answers = parseBatch(action.answers)
    return answers ? { kind, id, revision, answers } : null
  }
  const answer = kind === 'answer' ? parseAnswer(action) : null
  return answer ? { kind: 'answer', id, revision, ...answer } : null
}

function appendAnswers(
  state: StoredAttempt['state'],
  batch: (Pick<QueuedAnswer, 'decision' | 'optionIndex' | 'elapsedMs'> & Partial<Pick<QueuedAnswer, 'operationId' | 'questionId' | 'segmentId'>>)[],
  now: string,
): StoredAttempt['state'] {
  const answers = [...state.answers, ...batch.map((answer, offset) => ({
    decision: answer.decision,
    optionIndex: answer.optionIndex ?? null,
    elapsedMs: answer.elapsedMs ?? null,
    operationId: answer.operationId,
    questionId: answer.questionId,
    segmentId: answer.segmentId,
    answeredAt: now,
    item_role: state.questions[state.answers.length + offset].item_role,
  }))]
  const final = state.modelVersion === 'stratified-v1' ? answers.length === state.questions.length : answers.length === MAX_ITEMS
  const phase = final ? 'submitted' : answers.length % SEGMENT_SIZE === 0 ? 'break' : 'question'
  if (state.modelVersion === 'frequency-v2-pilot-1' && phase === 'break' && answers.at(-1)?.item_role === 'main') {
    const { main, range, bands } = frequencyEstimate(state.questions, answers)
    return { ...state, answers, phase, checkpoints: [...state.checkpoints, { main, range, bands }] }
  }
  return { ...state, answers, phase }
}

async function run(request: Request, action?: AttemptAction) {
  const identity = await lookupUserFromRequest(request, AUTH_OPTIONS)
  if (identity.unreachable) {
    console.warn('[vocabulary-assessment-auth]', { action: action?.kind ?? 'load', reason: identity.reason })
    const error = identity.reason === 'timeout' ? '登录验证超时，请重试。'
      : identity.reason === 'network_error' ? '测评服务暂时连不上登录服务，请重试。'
      : '暂时无法验证登录，请稍后重试。'
    return json({ error }, 503)
  }
  if (!identity.user) return json({ error: '请先登录。' }, 401)
  const userId = identity.user.id

  try {
    const db = createAdminSupabase()
    const rawDevice = request.headers.get('X-Assessment-Device') ?? ''
    const device = UUID.test(rawDevice) ? rawDevice : ''
    const view = (row: StoredAttempt) => project(row, device)
    const requestedId = action && action.kind !== 'start' ? action.id : new URL(request.url).searchParams.get('attempt')
    if (requestedId && !UUID.test(requestedId)) return json({ error: '答卷编号无效。' }, 400)
    const current = requestedId ? await byId(db, userId, requestedId) : await latest(db, userId)
    if (!action) {
      if (requestedId && !current) return json({ error: '找不到这份答卷。' }, 404)
      const legacy = current?.state.modelVersion === 'frequency-v2-pilot-1' ? await latestId(db, userId, 1) : undefined
      const newer = requestedId && current?.state.modelVersion === 'stratified-v1' ? await latestId(db, userId, 2) : undefined
      if (current || device) return json({ attempt: current ? view(current) : null, pilotAvailable: Boolean(device),
        legacyId: legacy, pilotId: newer, bankReady: true })
      const { data, error } = await db.from(BANKS).select('version').like('version', 'va-%').limit(1)
      if (error) throw error
      return json({ attempt: null, bankReady: data.length > 0 })
    }
    const currentView = () => current ? view(current) : null
    if (action.kind === 'start') {
      const pilot = action.version === 2
      if (pilot && !device) return json({ error: '缺少有效的设备标识，请刷新测评页面。' }, 400)
      if (current && (current.state.phase !== 'submitted' || current.id !== action.previousId) &&
          (pilot === (current.state.modelVersion === 'frequency-v2-pilot-1'))) {
        return json({ attempt: view(current) })
      }
      if (action.previousId !== (current?.id ?? null)) return conflict(currentView())
      let state: StoredAttempt['state'] | null
      let version: string | undefined
      if (pilot) {
        const existing = await latest(db, userId, 2)
        if (existing && existing.state.phase !== 'submitted') return json({ attempt: view(existing) })
        state = startPilot(pilotBank, pilotVersion, await legacyExposures(db, userId), device, randomUUID, seed)
        version = pilotVersion
        const bankRow = await db.from(BANKS).select('version').eq('version', version).maybeSingle()
        if (bankRow.error) throw bankRow.error
        if (!bankRow.data) {
          const registered = await db.from(BANKS).insert({ version, content: pilotBank })
          if (registered.error && registered.error.code !== '23505') throw registered.error
        }
      } else {
        const legacy = current?.state.modelVersion === 'frequency-v2-pilot-1' ? await latest(db, userId, 1) : null
        if (legacy && legacy.state.phase !== 'submitted') return json({ attempt: view(legacy) })
        const bank = await readBank(db)
        state = bank && newAttempt(bank.content)
        version = bank?.version
      }
      if (!version || !state) return json({ error: '可用测评题不足，暂时无法开测。' }, 503)
      const inserted = await db.from(ATTEMPTS).insert({
        id: randomUUID(), user_id: userId, previous_id: action.previousId, bank_version: version, state,
      }).select(FIELDS).single()
      if (inserted.error?.code === '23505') {
        const recovered = await latest(db, userId)
        if (recovered && (pilot === (recovered.state.modelVersion === 'frequency-v2-pilot-1'))) return json({ attempt: view(recovered) })
        return json({ error: '新版与旧版答卷暂时无法并存，请检查测评数据迁移。' }, 409)
      }
      if (inserted.error) throw inserted.error
      return json({ attempt: view(inserted.data as StoredAttempt), pilotAvailable: Boolean(device),
        legacyId: pilot ? await latestId(db, userId, 1) : undefined })
    }

    if (!current || current.id !== action.id) return conflict(currentView())

    if (current.state.modelVersion === 'frequency-v2-pilot-1' && !device) {
      return json({ error: '请重新打开新版测评以恢复本机答卷。' }, 400)
    }
    const matchesQuestion = (answer: QueuedAnswer) => {
      const q = current.state.questions[answer.index]
      return Boolean(q && q.senseId === answer.questionId && (!('segmentId' in q) || q.segmentId === answer.segmentId))
    }
    if (action.kind === 'fallback' && current.state.modelVersion === 'frequency-v2-pilot-1' &&
        current.state.segments.some(s => s.id === action.segmentId && s.mode === 'fallback' && s.device === device)) {
      return json({ attempt: view(current) })
    }
    if (action.kind === 'sync' && action.answers.every(answer => {
      const saved = current.state.answers[answer.index]
      return saved?.operationId === answer.operationId && saved.decision === answer.decision &&
        saved.optionIndex === (answer.optionIndex ?? null) &&
        matchesQuestion(answer)
    })) return json({ attempt: view(current) })
    if ((action.kind === 'finish' && current.state.phase === 'submitted') ||
        (action.kind === 'pause' && current.state.phase === 'paused')) return json({ attempt: view(current) })
    if (current.revision !== action.revision || current.state.phase === 'submitted') return conflict(currentView())

    const now = new Date().toISOString()
    let state = current.state
    switch (action.kind) {
      case 'answer': {
        const question = state.questions[state.answers.length]
        if (state.modelVersion !== 'stratified-v1' || state.phase !== 'question' || !question) return conflict(currentView())
        state = appendAnswers(state, [action], now)
        break
      }
      case 'sync': {
        const start = state.answers.length
        const segmentEnd = (Math.floor(start / SEGMENT_SIZE) + 1) * SEGMENT_SIZE
        const used = new Set(state.answers.map(answer => answer.operationId))
        if (state.phase !== 'question' || action.answers[0].index !== start ||
            start + action.answers.length > segmentEnd || action.answers.some(answer =>
              used.has(answer.operationId) || !matchesQuestion(answer))) {
          return conflict(currentView())
        }
        state = appendAnswers(state, action.answers, now)
        break
      }
      case 'pause':
        state = { ...state, phase: 'paused' }
        break
      case 'fallback':
      case 'continue':
        if (state.modelVersion === 'frequency-v2-pilot-1' && state.answers.length === state.questions.length) {
          const next = issueSegment(state, await frozenBank(db, current.bank_version),
            action.kind === 'fallback' ? 'fallback' : 'adaptive', current.revision, device, randomUUID, seed,
            action.kind === 'fallback' ? action.segmentId : undefined)
          if (!next) return conflict(currentView())
          state = next
          break
        }
        if (action.kind === 'fallback') return conflict(currentView())
        if (state.phase === 'question') return json({ attempt: view(current) })
        state = { ...state, phase: 'question' }
        break
      case 'finish':
        if (!state.answers.length) return json({ error: '答完至少一道题后可以交卷。' }, 400)
        state = { ...state, phase: 'submitted' }
        break
      case 'diagnostic': {
        const before = view(current)
        if (!before.canAddDiagnostics) return conflict(before)
        if (state.modelVersion === 'frequency-v2-pilot-1') {
          const next = issueSegment(state, await frozenBank(db, current.bank_version), 'diagnostic',
            current.revision, device, randomUUID, seed)
          if (!next) return conflict(before)
          state = next
          break
        }
        const bank = await readBank(db, current.bank_version)
        const supplemented = bank && addDiagnostics(state, bank.content)
        if (!supplemented) return json({ error: '可用的补测词不足，可以直接查看当前结果。' }, 422)
        state = supplemented
        break
      }
    }
    const saved = await db.from(ATTEMPTS).update({
      revision: current.revision + 1, state, submitted_at: state.phase === 'submitted' ? now : null,
    }).eq('user_id', userId).eq('id', current.id).eq('revision', current.revision)
      .select(FIELDS).maybeSingle()
    if (saved.error) throw saved.error
    if (!saved.data) {
      const recovered = await byId(db, userId, current.id)
      return conflict(recovered ? view(recovered) : null)
    }
    return json({ attempt: view(saved.data as StoredAttempt) })
  } catch (error) {
    if (!action && error && typeof error === 'object' && 'code' in error &&
        (error.code === '42P01' || error.code === 'PGRST205')) {
      return json({ attempt: null, bankReady: false })
    }
    console.error('[vocabulary-assessment]', error instanceof Error ? error.name : 'database_error')
    return json({ error: '暂时无法保存或读取测评，请重试。' }, 503)
  }
}

function conflict(attempt: ReturnType<typeof project> | null) {
  return json({ attempt, error: '测评进度已更新，已加载最新的一题。' }, 409)
}

export function GET(request: Request) {
  return run(request)
}

export async function POST(request: Request) {
  const action = parseAction(await request.json().catch(() => null))
  return action ? run(request, action) : json({ error: '无效的测评操作。' }, 400)
}
