import { NextResponse } from 'next/server'
import type { Homework } from '@rosie/tasks'
import { createAdminSupabase, getUserFromRequest } from '@/lib/api-auth'
import { isValidParentPin, verifyParentPin } from '@/lib/parent-pin'
import { act, newTree, placeTodayBubbles, roll, TreeConflict } from '@/lib/time-tree/engine'
import { bindPractice, settlePractice } from '@/lib/time-tree/practice'
import { schedule } from '@/lib/time-tree/schedule'
import { regenerateHomework, regenerationTargets } from '@/lib/time-tree/regenerate'
import { dayOf, shift, type TreeAction, type TreeData } from '@/lib/time-tree/types'

export const dynamic = 'force-dynamic'
function failure(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return failure('请先登录。', 401)
  const input = (await req.json().catch(() => null)) as
    | (TreeAction & { revision?: number; knownRevision?: number })
    | null
  if (!input || typeof input.kind !== 'string') return failure('无效的操作。', 400)
  try {
    const db = createAdminSupabase()
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
      const saved = await db
        .from('time_tree_gardens')
        .select('revision,garden')
        .eq('user_id', user.id)
        .maybeSingle()
      if (saved.error) throw saved.error
      const revision = Number(saved.data?.revision ?? 0)
      if (input.kind !== 'sync' && revision !== input.revision)
        return failure('作业进度已更新，请查看最新状态后重试。', 409)
      const now = new Date().toISOString()
      const today = dayOf(now)
      const tree: TreeData = saved.data?.garden ?? newTree(today)
      const original = JSON.stringify(tree)
      const previousDay = tree.today
      if (input.kind === 'regenerate') {
        if (previousDay !== today)
          return failure('日期已变化，请刷新作业后重新预览。', 409)
        const range = input.regenerate
        const validDate = (value: unknown): value is string => typeof value === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) &&
          new Date(value).toISOString().slice(0, 10) === value
        if (!range || !validDate(range.from) || !validDate(range.through) || range.from < today ||
          range.through < range.from || range.through > shift(today, 365) || !Number.isSafeInteger(range.expectedCount) || range.expectedCount < 0)
          return failure('请选择今天起一年内的有效日期范围。', 400)
        if (regenerationTargets(tree, range.from, range.through).count !== range.expectedCount)
          return failure('待替换数量已变化，请重新预览后确认。', 409)
      }
      roll(tree, today)
      if (input.kind === 'school' || input.kind === 'sync' || input.kind === 'regenerate' || today !== previousDay) {
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
      if (step && step.subject !== 'life' && !step.end && ['preparePractice', 'start', 'completeUntimed', 'record'].includes(input.kind)) {
        const templateId = step.occurrence.split('/')[0]
        const template = await db.from('task_homework').select('*').eq('user_id', user.id).eq('id', templateId).maybeSingle()
        if (template.error) throw template.error
        try { bindPractice(tree, step, template.data as Homework | undefined) }
        catch (error) { return failure(error instanceof Error ? error.message : '练习入口配置无效', 409) }
      }
      if (input.kind !== 'regenerate') act(tree, input, now)
      placeTodayBubbles(tree)
      if (step && ['finish', 'completeUntimed', 'record', 'skip'].includes(input.kind)) settlePractice(tree, step)
      if (saved.data && original === JSON.stringify(tree) && input.kind !== 'openBox')
        return NextResponse.json({ revision, tree }, { headers: { 'X-Tree-Time': new Date().toISOString() } })
      const { data, error } = await db.rpc('commit_time_tree', {
        p_user: user.id,
        p_revision: revision,
        p_garden: tree,
        p_action: input.kind,
        p_ticket: input.kind === 'acceptBox' ? input.id : null,
      })
      if (!error) return NextResponse.json(data, { headers: { 'X-Tree-Time': new Date().toISOString() } })
      if (error.message !== 'tree_changed') throw error
    }
    return failure('进度已变化，请重试。', 409)
  } catch (error) {
    if (error instanceof TreeConflict) return failure(error.message, 409)
    return failure('生命树数据暂时无法读取或保存，请重试。', 503)
  }
}
