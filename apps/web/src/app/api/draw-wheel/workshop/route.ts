import { NextResponse } from 'next/server'
import { createAdminSupabase, lookupUserFromRequest } from '@/lib/api-auth'
import defaults from './defaults.json'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const actions = new Set(['preferences', 'add', 'edit', 'delete', 'shuffle', 'enableAll', 'reset', 'draw', 'stamp', 'clearHistory'])
const messages: Record<string, string> = {
  draw_changed: '奖池已在别处更新，请重新读取后再操作。',
  draw_reserved: '条目正在被生命树或待领取奖券预留，请先领取后再操作。',
  pool_empty: '当前没有可抽取的条目，请添加或启用条目。',
  pool_full: '每个转盘最多添加 100 个条目。',
  operation_conflict: '请求编号重复，请重新读取后再操作。',
  invalid_request: '提交内容不正确，请检查后重试。',
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function validPayload(action: string, payload: Record<string, unknown>): boolean {
  const text = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && Array.from(value).length <= max
  const id = (value: unknown) => typeof value === 'string' && uuid.test(value)
  const fields: Record<string, string[]> = {
    add: ['text', 'emoji', 'color', 'weight'], edit: ['id', 'text', 'emoji', 'color', 'weight', 'enabled'],
    delete: ['id'], stamp: ['id', 'done'], preferences: ['mode', 'soundOn', 'voiceOn', 'mysteryMode', 'noRepeatMode'],
  }
  if (Object.keys(payload).some(key => !(fields[action] ?? []).includes(key))) return false
  if (['edit', 'delete', 'stamp'].includes(action) && !id(payload.id)) return false
  if (action === 'add' && !['text', 'emoji', 'color', 'weight'].every(key => key in payload)) return false
  if (action === 'edit' && Object.keys(payload).length < 2) return false
  if ('text' in payload && !text(payload.text, 100)) return false
  if ('emoji' in payload && !text(payload.emoji, 24)) return false
  if ('color' in payload && !(typeof payload.color === 'string' && /^#[\da-f]{6}$/i.test(payload.color))) return false
  if ('weight' in payload && ![1, 2, 3].includes(payload.weight as number)) return false
  if ('mode' in payload && !['reward', 'punishment'].includes(payload.mode as string)) return false
  for (const key of ['enabled', 'done', 'soundOn', 'voiceOn', 'mysteryMode', 'noRepeatMode']) {
    if (key in payload && typeof payload[key] !== 'boolean') return false
  }
  if (action === 'stamp' && typeof payload.done !== 'boolean') return false
  return true
}

async function handle(request: Request, read: boolean) {
  const auth = await lookupUserFromRequest(request)
  if (!auth.user) return NextResponse.json({ error: auth.unreachable ? '登录服务暂时不可用，请重试。' : '请先登录。' }, { status: auth.unreachable ? 503 : 401, headers })
  let action = 'read'
  let kind = 'reward'
  let payload: Record<string, unknown> = { defaults }
  let revision: number | null = null
  let operation: string | null = null
  if (!read) {
    const raw = await request.text()
    if (raw.length > 8192) return NextResponse.json({ error: '请求内容过大。' }, { status: 413, headers })
    let body: unknown
    try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: '请求格式错误。' }, { status: 400, headers }) }
    if (!object(body) || typeof body.action !== 'string' || !actions.has(body.action)
      || !['reward', 'penalty'].includes(body.kind as string) || !object(body.payload)
      || !Number.isSafeInteger(body.revision) || (body.revision as number) < 0
      || typeof body.operation !== 'string' || !uuid.test(body.operation)
      || !validPayload(body.action, body.payload)) {
      return NextResponse.json({ error: '提交内容不正确。' }, { status: 400, headers })
    }
    action = body.action
    kind = body.kind as string
    payload = action === 'reset' ? { defaults: defaults.filter(entry => entry.kind === kind) } : body.payload
    revision = body.revision as number
    operation = body.operation
  }
  try {
    const { data, error } = await createAdminSupabase().rpc('change_draw_workshop', {
      p_user: auth.user.id, p_action: action, p_kind: kind, p_payload: payload, p_revision: revision, p_operation: operation,
    })
    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01') {
        return NextResponse.json({ error: '转盘升级尚未完成，请先应用奖池迁移。' }, { status: 503, headers })
      }
      const message = error.code === '23505' ? '池中已有这个名称。' : messages[error.message]
      return NextResponse.json({ error: message ?? '操作未完成，请重新读取奖池确认结果。', conflict: error.message === 'draw_changed' }, { status: message ? 409 : 503, headers })
    }
    return NextResponse.json(data, { headers })
  } catch {
    return NextResponse.json({ error: '暂时无法连接奖池，请重新读取确认操作结果。' }, { status: 503, headers })
  }
}
export async function GET(request: Request) { return handle(request, true) }
export async function POST(request: Request) { return handle(request, false) }
