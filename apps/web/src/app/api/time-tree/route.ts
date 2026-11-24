import { NextResponse } from 'next/server'
import type { Homework } from '@rosie/tasks'
import { createAdminSupabase, lookupUserFromClaims, lookupUserFromRequest } from '@/lib/api-auth'
import { isValidParentPin, verifyParentPin } from '@/lib/parent-pin'
import { act, awardCompletedDay, newTree, placeTodayBubbles, roll, TreeConflict } from '@/lib/time-tree/engine'
import { loadHomeworkTemplates } from '@/lib/time-tree/maintenance'
import { bindPractice, settlePractice } from '@/lib/time-tree/practice'
import { editMathQuestion, hasMathQuestions, settleMathQuestions } from '@/lib/time-tree/mathQuestions'
import { schedule } from '@/lib/time-tree/schedule'
import { regenerateHomework, regenerationTargets } from '@/lib/time-tree/regenerate'
import { tomatoPrices } from '@/lib/time-tree/rewards'
import { hasRowChanges, rowChanges } from '@/lib/time-tree/rowChanges'
import { dayOf, isInstantHomework, shift, PRACTICE_SCHEDULE_VERSION, WEEKLY_SCHEDULE_VERSION, type TreeAction, type TreeData } from '@/lib/time-tree/types'
import { isClosedHomeworkCycle, isMultiweekCycle } from '@/lib/time-tree/cycleHomework'
import { canCompleteOffline, signTreeOfflineWork, verifyTreeOfflineWork } from '@/lib/offline/tree-proof'

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
  const params = new URL(req.url).searchParams
  const wheel = params.get('box') === 'wheel'
  const offline = params.get('offline') === '1'
  const verify = wheel || offline ? lookupUserFromRequest : lookupUserFromClaims
  const { user, unreachable, reason } = await verify(req, authOptions)
  if (unreachable) {
    console.warn('[time-tree-auth]', { action: 'read', stage: 'identity', reason })
    return failure(authUnavailable, 503)
  }
  if (!user) return failure('请先登录。', 401)
  const today = dayOf(new Date())
  const db = createAdminSupabase()
  const authAt = performance.now()
  if (wheel) {
    const { data, error } = await db.rpc('read_time_tree_box_wheel', { p_user: user.id })
    if (error || !data) return failure('奖励转盘暂时无法读取。', 503)
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
  }
  const days = params.get('days')?.split(',')
  if (days && (days.length > 62 || !days.every(validDate))) return failure('请选择有效的日期范围。', 400)
  const headers = () => ({ 'X-Tree-Time': new Date().toISOString(), 'Cache-Control': 'private, no-store',
    'Server-Timing': `auth;dur=${Math.round(authAt - started)}, tree;dur=${Math.round(performance.now() - authAt)}` })
  const knownRevision = params.get('knownRevision')
  if (!days && knownRevision && /^\d{1,16}$/.test(knownRevision) && params.get('knownDay') === today) {
    const { data: known } = await db.from('time_tree_accounts').select('revision')
      .eq('user_id', user.id).eq('revision', knownRevision).eq('state->>today', today).maybeSingle()
    if (known) return new NextResponse(null, { status: 204, headers: headers() })
  }
  const { data, error } = days
    ? await db.rpc('read_time_tree_history', { p_user: user.id, p_days: days })
    : await db.rpc('read_time_tree_scene', { p_user: user.id, p_today: today })
  if (error) return failure('生命树暂时无法读取。', 503)
  if (days) return NextResponse.json(data ?? { revision: 0, steps: [], spends: [] }, { headers: headers() })
  const tree = (data?.tree ?? newTree(today)) as TreeData
  const revision = Number(data?.revision ?? 0)
  const offlineProofs = offline ? Object.fromEntries(tree.steps.filter(step => canCompleteOffline(step, today))
    .map(step => [step.id, signTreeOfflineWork(user.id, step.id, revision, today)])) : undefined
  return NextResponse.json({ revision, tree, offlineProofs,
    historyMinutes: data?.historyMinutes, homeworkRevision: data?.appliedHomework,
    syncDeferred: Boolean(data?.tree && data.tree.today !== today) }, { headers: headers() })
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
      returnScene?: boolean
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
    const offlineCompletion = input.kind === 'completeOffline'
    if (offlineCompletion && (
      typeof input.id !== 'string' || !Number.isSafeInteger(input.revision) ||
      typeof input.day !== 'string' || typeof input.start !== 'string' || typeof input.end !== 'string' ||
      !verifyTreeOfflineWork(user.id, input.id, input.revision!, input.day,
        input.offlineProof, input.start, input.end, new Date().toISOString())
    )) return failure('离线作业记录需要在生命树中核对。', 409, 'offline_conflict')
    const command = input.kind === 'pop' ? { kind: 'pop', id: input.id } :
      Object.fromEntries(Object.entries(input).filter(([key]) => [
        'kind','id','name','day','notes','start','end','flowerSelection','questionEdit','rowId','problemId',
        'popOnFinish','regenerate','color','rules','tomatoPrice',
      ].includes(key)))
    // Read the overlap window used for time records, keeping a distinct command hash.
    if (offlineCompletion) Object.assign(command, { kind: 'record', offline: true })
    // Popping a cycle task also hands the bubble over to the next occurrence.
    if (input.kind === 'pop' && typeof input.id === 'string' && !isMultiweekCycle(input.id.split('/')[1])) {
      const fast = await db.rpc('pop_time_tree_step', { p_user: user.id, p_id: input.id, p_operation: input.operationId })
      if (fast.error) throw fast.error
      if (fast.data) return reply(fast.data)
    }
    if (input.kind === 'addCrown') {
      if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 120)
        return failure('请输入 1 到 120 个字的小目标。', 400)
      if (typeof input.id !== 'string' || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(input.id))
        return failure('无效的泡泡编号。', 400)
      const fast = await db.rpc('add_time_tree_crown', { p_user: user.id, p_id: input.id, p_day: input.day ?? null,
        p_name: input.name, p_operation: input.operationId })
      if (fast.error?.message === 'crown_day_changed') return failure('只能给今天添加皇冠泡泡。', 409)
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
        ['start','stop','finish','completeUntimed','return','move','nextDay','saveNotes','preparePractice','water',
          'collectFlowers','editMathQuestion','answerHomeworkQuestion','skip','completeOffline'].includes(input.kind) &&
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
        const templates = await loadHomeworkTemplates(db, user.id)
        if (input.kind === 'regenerate' && input.regenerate)
          regenerateHomework(tree, templates, input.regenerate.from, input.regenerate.through)
        else schedule(tree, templates, previousDay, shift(today, 6))
      }
      const step = tree.steps.find((s) => s.id === input.id)
      if (offlineCompletion && (!step || !canCompleteOffline(step, input.day!) ||
        (step.start && step.start !== input.start))) return failure('这份作业状态已变化，请在生命树中核对。', 409, 'offline_conflict')
      const editingQuestions = input.kind === 'editMathQuestion'
      const instantPop = input.kind === 'pop' && step && isInstantHomework(step)
      const settling = !step?.end && !step?.skipped && (instantPop || ['finish', 'completeUntimed', 'collectFlowers', 'record', 'skip'].includes(input.kind))
      const needsBinding = step && step.practice === undefined && step.subject !== 'life' && !step.end &&
        (instantPop || editingQuestions || ['preparePractice', 'start', 'completeUntimed', 'collectFlowers', 'record'].includes(input.kind))
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
        if (isClosedHomeworkCycle(step, today)) throw new TreeConflict('这个周期已结束。')
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
        return input.returnScene === false ? reply(null, 204) :
          reply({ revision, tree, homeworkRevision, historyMinutes: read.data.historyMinutes })
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
        if (input.returnScene === false) return reply(null, 204)
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
