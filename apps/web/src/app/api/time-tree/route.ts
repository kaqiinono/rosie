import { NextResponse } from 'next/server'
import type { Homework } from '@rosie/tasks'
import { createAdminSupabase, lookupUserFromClaims, lookupUserFromRequest } from '@/lib/api-auth'
import { isValidParentPin, verifyParentPin } from '@/lib/parent-pin'
import { act, awardCompletedDay, newTree, placeTodayBubbles, roll, TreeConflict } from '@/lib/time-tree/engine'
import { bindPractice, settlePractice } from '@/lib/time-tree/practice'
import { editMathQuestion, hasMathQuestions, settleMathQuestions } from '@/lib/time-tree/mathQuestions'
import { schedule } from '@/lib/time-tree/schedule'
import { regenerateHomework, regenerationTargets } from '@/lib/time-tree/regenerate'
import { tomatoPrices } from '@/lib/time-tree/rewards'
import { hasRowChanges, rowChanges } from '@/lib/time-tree/rowChanges'
import { dayOf, shift, PRACTICE_SCHEDULE_VERSION, WEEKLY_SCHEDULE_VERSION, type TreeAction, type TreeData } from '@/lib/time-tree/types'

export const dynamic = 'force-dynamic'
const authOptions = { attempts: 2, timeoutMs: 5_000 }
const authUnavailable = '暂时无法验证登录，请稍后重试。'

function failure(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code }, { status })
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
}

export async function GET(req: Request) {
  const started = performance.now()
  const { user, unreachable } = await lookupUserFromRequest(req, authOptions)
  if (unreachable) return failure(authUnavailable, 503)
  if (!user) return failure('请先登录。', 401)
  const params = new URL(req.url).searchParams
  const today = dayOf(new Date())
  const db = createAdminSupabase()
  const authAt = performance.now()
  const days = params.get('days')?.split(',')
  if (days && (days.length > 62 || !days.every(validDate))) return failure('请选择有效的日期范围。', 400)
  const { data, error } = days
    ? await db.rpc('read_time_tree_history', { p_user: user.id, p_days: days })
    : await db.rpc('read_time_tree_scene', { p_user: user.id, p_today: today })
  if (error || !data) return failure('生命树暂时无法读取。', 503)
  return NextResponse.json(days ? data : { revision: data.revision, tree: data.tree,
    historyMinutes: data.historyMinutes, homeworkRevision: data.appliedHomework }, {
    headers: { 'X-Tree-Time': new Date().toISOString(), 'Cache-Control': 'private, no-store',
      'Server-Timing': `auth;dur=${Math.round(authAt - started)}, tree;dur=${Math.round(performance.now() - authAt)}` },
  })
}

export async function POST(req: Request) {
  const started = performance.now()
  const input = (await req.json().catch(() => null)) as
    | (TreeAction & {
      revision?: number
      background?: boolean
      knownRevision?: number
      knownHomeworkRevision?: string
      knownDay?: string
      protocol?: number
      operationId?: string
    })
    | null
  const claims = input?.kind === 'sync' && input.background === true ? await lookupUserFromClaims(req, authOptions) : null
  const { user, unreachable, reason } = claims ?? await lookupUserFromRequest(req, authOptions)
  if (unreachable) {
    console.warn('[time-tree-auth]', { action: input?.kind, stage: 'identity', reason })
    return failure(authUnavailable, 503)
  }
  if (!user) return failure('请先登录。', 401)
  if (!input || typeof input.kind !== 'string') return failure('无效的操作。', 400)
  if (input.protocol !== 2 || typeof input.operationId !== 'string' ||
    !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(input.operationId))
    return failure('请刷新页面后继续。', 409, 'reload_required')
  const authAt = performance.now()
  function reply(value: unknown, status = 200) {
    const headers = { 'X-Tree-Time': new Date().toISOString(), 'Cache-Control': 'private, no-store',
      'Server-Timing': `auth;dur=${Math.round(authAt - started)}, tree;dur=${Math.round(performance.now() - authAt)}` }
    return status === 204 ? new NextResponse(null, { status, headers }) : NextResponse.json(value, { status, headers })
  }
  let needsOnlineCheck = claims?.user?.verifiedOnline === false
  try {
    const db = createAdminSupabase()
    const command = input.kind === 'pop' ? { kind: 'pop', id: input.id } :
      Object.fromEntries(Object.entries(input).filter(([key]) => [
        'kind','id','name','day','notes','start','end','flowerSelection','questionEdit','rowId','problemId',
        'popOnFinish','regenerate','color','rules','tomatoPrice',
      ].includes(key)))
    if (input.kind === 'pop' && typeof input.id === 'string') {
      const fast = await db.rpc('pop_time_tree_step', { p_user: user.id, p_id: input.id, p_operation: input.operationId })
      if (fast.error) throw fast.error
      if (fast.data) return reply(fast.data)
    }
    if (['settings', 'record', 'exchange'].includes(input.kind)) {
      if (!isValidParentPin(input.pin)) return failure('请输入六位家长密码。', 403)
      const { data, error } = await db
        .from('user_parent_pins')
        .select('pin_hash,pin_salt')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error || !(await verifyParentPin(input.pin, data)))
        return failure('家长密码验证失败。', 403)
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const now = new Date().toISOString()
      const today = dayOf(now)
      if (input.kind === 'regenerate') {
        const range = input.regenerate
        if (!range || !validDate(range.from) || !validDate(range.through) || range.from < today ||
          range.through < range.from || range.through > shift(today, 365) ||
          !Number.isSafeInteger(range.expectedCount) || range.expectedCount < 0)
          return failure('请选择今天起一年内的有效日期范围。', 400)
      }
      if (input.kind === 'record' && (!Number.isFinite(Date.parse(input.start ?? '')) ||
        !Number.isFinite(Date.parse(input.end ?? '')) || Date.parse(input.start!) > Date.parse(input.end!) ||
        Date.parse(input.end!) > Date.parse(now))) return failure('请填写有效的实际起止时间。', 400)
      const ids = input.notes?.map(note => note.id) ?? []
      if (input.id) ids.push(input.id.split('#')[0])
      const read = await db.rpc('read_time_tree_command', { p_user: user.id, p_command: command,
        p_operation: input.operationId, p_today: today, p_ids: ids, p_known: input.knownRevision ?? null,
        p_known_day: input.knownDay ?? null, p_known_homework: input.knownHomeworkRevision ?? null,
        p_weekly: WEEKLY_SCHEDULE_VERSION, p_practice: PRACTICE_SCHEDULE_VERSION })
      if (read.error) throw read.error
      if (read.data.unchanged) return reply(null, 204)
      if (read.data.receipt) return reply(read.data.receipt)
      const { saved, schedule: scheduleNeeded, homeworkRevision, targetVersion } = read.data
      const revision = Number(saved?.revision ?? 0)
      const independent = input.kind === 'pop' || input.kind === 'pick' || (
        ['start','finish','completeUntimed','return','move','nextDay','saveNotes','preparePractice','water',
          'collectFlowers','editMathQuestion','answerHomeworkQuestion','skip'].includes(input.kind) &&
        targetVersion != null && Number.isSafeInteger(input.revision) && input.revision! <= revision && targetVersion <= input.revision!)
      if (input.kind !== 'sync' && !independent && revision !== input.revision)
        return failure('作业进度已更新，请查看最新状态后重试。', 409, 'stale_revision')
      const original = (saved?.tree ?? null) as TreeData | null
      const tree: TreeData = original ? structuredClone(original) : newTree(today)
      const previousDay = tree.today
      if (input.kind === 'regenerate') {
        if (previousDay !== today)
          return failure('日期已变化，请刷新作业后重新预览。', 409)
        const range = input.regenerate!
        if (regenerationTargets(tree, range.from, range.through).count !== range.expectedCount)
          return failure('待替换数量已变化，请重新预览后确认。', 409)
      }
      roll(tree, today)
      if (input.kind === 'school' || scheduleNeeded || input.kind === 'regenerate') {
        const templates: Homework[] = []
        for (let offset = 0; ; offset += 500) {
          const page = await db
            .from('task_homework')
            .select('*')
            .eq('user_id', user.id)
            .eq('enabled', true)
            .order('id')
            .range(offset, offset + 499)
          if (page.error) throw page.error
          templates.push(...(page.data as Homework[]))
          if (page.data.length < 500) break
        }
        if (input.kind === 'regenerate' && input.regenerate)
          regenerateHomework(tree, templates, input.regenerate.from, input.regenerate.through)
        else schedule(tree, templates, previousDay, shift(today, 6))
      }
      const step = tree.steps.find((s) => s.id === input.id)
      const editingQuestions = input.kind === 'editMathQuestion'
      const settling = !step?.end && !step?.skipped && ['finish', 'completeUntimed', 'collectFlowers', 'record', 'skip'].includes(input.kind)
      const needsBinding = step && step.practice === undefined && step.subject !== 'life' && !step.end &&
        (editingQuestions || ['preparePractice', 'start', 'completeUntimed', 'collectFlowers', 'record'].includes(input.kind))
      let template: Homework | null = null
      const needsCatalog = (editingQuestions && input.questionEdit === 'append') || (settling && step && hasMathQuestions(step))
      if (step && (needsBinding || needsCatalog)) {
        const result = await db.from('task_homework').select('*').eq('user_id', user.id)
          .eq('id', step.occurrence.split('/')[0]).maybeSingle()
        if (result.error) throw result.error
        template = result.data as Homework | null
        if (needsBinding) {
          try { bindPractice(tree, step, template ?? undefined) }
          catch (error) { return failure(error instanceof Error ? error.message : '练习入口配置无效', 409) }
        }
      }
      if (editingQuestions) {
        if (!step) throw new TreeConflict('找不到这份作业，请刷新。')
        editMathQuestion(tree, step, template?.practice_binding ?? undefined, input)
      } else if (input.kind !== 'regenerate') act(tree, input, now)
      if (step && settling) {
        if (hasMathQuestions(step) && (step.end || step.practice?.questions)) {
          if (step.practice && !step.practice.questions) step.practice.questions = { completed: [], added: [] }
          settleMathQuestions(tree, step, template)
        } else settlePractice(tree, step)
        if (step.end && dayOf(step.end) === tree.today) awardCompletedDay(tree, step, now)
      }
      placeTodayBubbles(tree)
      const delta = rowChanges(original, tree)
      if (input.kind === 'sync' && !scheduleNeeded && original && !hasRowChanges(delta))
        return reply({ revision, tree, homeworkRevision, historyMinutes: read.data.historyMinutes })
      // Sync can also persist newly scheduled work or a day rollover.
      if (needsOnlineCheck) {
        const online = await lookupUserFromRequest(req, authOptions)
        if (online.unreachable) {
          console.warn('[time-tree-auth]', { action: input.kind, stage: 'commit', reason: online.reason })
          if (!original) return failure(authUnavailable, 503)
          const scene = await db.rpc('read_time_tree_scene', { p_user: user.id, p_today: today })
          if (scene.error || !scene.data) return failure(authUnavailable, 503)
          return reply({ revision: scene.data.revision, tree: scene.data.tree, historyMinutes: scene.data.historyMinutes, syncDeferred: true })
        }
        if (online.user?.id !== user.id) return failure('请先登录。', 401)
        needsOnlineCheck = false
      }
      const { data, error } = await db.rpc('commit_time_tree_rows', {
        p_user: user.id, p_base: revision, p_operation: input.operationId, p_command: command,
        p_delta: delta, p_homework: scheduleNeeded ? homeworkRevision : null,
      })
      if (!error) {
        if (input.kind !== 'sync') return reply(data)
        const scene = await db.rpc('read_time_tree_scene', { p_user: user.id, p_today: today })
        if (scene.error) throw scene.error
        return reply({ revision: scene.data.revision, tree: scene.data.tree, historyMinutes: scene.data.historyMinutes,
          homeworkRevision: scene.data.appliedHomework })
      }
      if (error.message === 'tomatoes_short') return failure(`可用番茄不足 ${tomatoPrices(tree.rules).box} 颗。`, 409)
      if (error.message !== 'tree_changed') throw error
    }
    return failure('进度已变化，请重试。', 409)
  } catch (error) {
    if (error instanceof TreeConflict) return failure(error.message, 409)
    console.error('[time-tree]', input.kind, error instanceof Error ? error.message :
      typeof error === 'object' && error && 'code' in error ? error.code : 'unknown_error')
    return failure('生命树数据暂时无法读取或保存，请重试。', 503)
  }
}
