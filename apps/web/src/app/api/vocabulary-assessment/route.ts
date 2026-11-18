import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminSupabase, lookupUserFromRequest } from '@/lib/api-auth'
import {
  addDiagnostics, attemptView, MAX_ITEMS, newAttempt, SEGMENT_SIZE,
  type Attempt, type AttemptAction, type Bank, type QueuedAnswer,
} from '@rosie/english/assessment/model'

export const dynamic = 'force-dynamic'

const ATTEMPTS = 'vocabulary_assessment_attempts'
const BANKS = 'vocabulary_assessment_banks'
const FIELDS = 'id,bank_version,revision,state'
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const AUTH_OPTIONS = { attempts: 2, timeoutMs: 5_000 }

type StoredAttempt = { id: string; bank_version: string; revision: number; state: Attempt }
type Db = ReturnType<typeof createAdminSupabase>

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

function view(row: StoredAttempt) {
  return attemptView(row.id, row.bank_version, row.revision, row.state)
}

async function latest(db: Db, userId: string): Promise<StoredAttempt | null> {
  const result = await db.from(ATTEMPTS).select(FIELDS).eq('user_id', userId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle()
  if (result.error) throw result.error
  return result.data as StoredAttempt | null
}

async function readBank(db: Db, version?: string) {
  const query = db.from(BANKS).select('version,content')
  const result = await (version ? query.eq('version', version)
    : query.order('published_at', { ascending: false }).order('version', { ascending: false }).limit(1))
    .maybeSingle()
  if (result.error) throw result.error
  return result.data as { version: string; content: Bank } | null
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
    const { questionId, operationId, index } = value
    const answer = parseAnswer(value)
    if (!answer || typeof questionId !== 'string' || !UUID.test(questionId) ||
        typeof operationId !== 'string' || !UUID.test(operationId) || used.has(operationId) ||
        typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= MAX_ITEMS ||
        (answers.length && index !== answers[0].index + answers.length)) return null
    used.add(operationId)
    answers.push({ ...answer, questionId, operationId, index })
  }
  return answers
}

function parseAction(value: unknown): AttemptAction | null {
  if (!value || typeof value !== 'object') return null
  const action = value as Record<string, unknown>
  const { kind, id, revision, previousId } = action
  if (kind === 'start') {
    return previousId === null || (typeof previousId === 'string' && UUID.test(previousId))
      ? { kind, previousId } : null
  }
  if (typeof id !== 'string' || !UUID.test(id) ||
      typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) return null
  if (kind === 'pause' || kind === 'continue' || kind === 'finish' || kind === 'diagnostic') return { kind, id, revision }
  if (kind === 'sync') {
    const answers = parseBatch(action.answers)
    return answers ? { kind, id, revision, answers } : null
  }
  const answer = kind === 'answer' ? parseAnswer(action) : null
  return answer ? { kind: 'answer', id, revision, ...answer } : null
}

function appendAnswers(
  state: Attempt,
  batch: (Pick<QueuedAnswer, 'decision' | 'optionIndex' | 'elapsedMs'> & { operationId?: string })[],
  now: string,
): Attempt {
  const answers = [...state.answers, ...batch.map((answer, offset) => ({
    decision: answer.decision,
    optionIndex: answer.optionIndex ?? null,
    elapsedMs: answer.elapsedMs ?? null,
    operationId: answer.operationId,
    answeredAt: now,
    item_role: state.questions[state.answers.length + offset].item_role,
  }))]
  return { ...state, answers, phase: answers.length === state.questions.length ? 'submitted'
    : answers.length % SEGMENT_SIZE === 0 ? 'break' : 'question' }
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
    const current = await latest(db, userId)
    if (!action) {
      if (current) return json({ attempt: view(current) })
      const { data, error } = await db.from(BANKS).select('version').limit(1)
      if (error) throw error
      return json({ attempt: null, bankReady: data.length > 0 })
    }
    const currentView = () => current ? view(current) : null
    if (action.kind === 'start') {
      if (current && current.state.phase !== 'submitted') return json({ attempt: view(current) })
      if (action.previousId !== (current?.id ?? null)) return conflict(currentView())
      const bank = await readBank(db)
      const state = bank && newAttempt(bank.content)
      if (!bank || !state) return json({ error: '测评题库正在准备中，请稍后再来。' }, 503)
      const inserted = await db.from(ATTEMPTS).insert({
        id: randomUUID(), user_id: userId, previous_id: action.previousId, bank_version: bank.version, state,
      }).select(FIELDS).single()
      if (inserted.error?.code === '23505') {
        const recovered = await latest(db, userId)
        if (recovered) return json({ attempt: view(recovered) })
      }
      if (inserted.error) throw inserted.error
      return json({ attempt: view(inserted.data as StoredAttempt) })
    }

    if (!current || current.id !== action.id) return conflict(currentView())

    if (action.kind === 'sync' && action.answers.every(answer => {
      const saved = current.state.answers[answer.index]
      return saved?.operationId === answer.operationId && saved.decision === answer.decision &&
        saved.optionIndex === (answer.optionIndex ?? null) &&
        current.state.questions[answer.index]?.senseId === answer.questionId
    })) return json({ attempt: view(current) })
    if (current.revision !== action.revision || current.state.phase === 'submitted') return conflict(currentView())

    const now = new Date().toISOString()
    let state = current.state
    switch (action.kind) {
      case 'answer': {
        const question = state.questions[state.answers.length]
        if (state.phase !== 'question' || !question) return conflict(currentView())
        state = appendAnswers(state, [action], now)
        break
      }
      case 'sync': {
        const start = state.answers.length
        const segmentEnd = (Math.floor(start / SEGMENT_SIZE) + 1) * SEGMENT_SIZE
        const used = new Set(state.answers.map(answer => answer.operationId))
        if (state.phase !== 'question' || action.answers[0].index !== start ||
            start + action.answers.length > segmentEnd || action.answers.some(answer =>
              used.has(answer.operationId) || state.questions[answer.index]?.senseId !== answer.questionId)) {
          return conflict(currentView())
        }
        state = appendAnswers(state, action.answers, now)
        break
      }
      case 'pause':
        if (state.phase === 'paused') return json({ attempt: view(current) })
        state = { ...state, phase: 'paused' }
        break
      case 'continue':
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
      const recovered = await latest(db, userId)
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

function conflict(attempt: ReturnType<typeof view> | null) {
  return json({ attempt, error: '测评进度已更新，已加载最新的一题。' }, 409)
}

export function GET(request: Request) {
  return run(request)
}

export async function POST(request: Request) {
  const action = parseAction(await request.json().catch(() => null))
  return action ? run(request, action) : json({ error: '无效的测评操作。' }, 400)
}
