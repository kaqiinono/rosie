import { NextResponse } from 'next/server'
import type { Homework } from '@rosie/tasks'
import { createAdminSupabase, getUserFromRequest } from '@/lib/api-auth'
import { isValidParentPin, verifyParentPin } from '@/lib/parent-pin'
import { act, newTree, roll, TreeConflict } from '@/lib/time-tree/engine'
import { schedule } from '@/lib/time-tree/schedule'
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
    // Most cross-device polls only need the version; avoid transferring the journal twice.
    if (input.kind === 'sync' && Number.isSafeInteger(input.knownRevision)) {
      const latest = await db
        .from('time_tree_gardens')
        .select('revision,today:garden->>today')
        .eq('user_id', user.id)
        .maybeSingle()
      if (latest.error) throw latest.error
      if (
        latest.data?.revision === input.knownRevision &&
        latest.data?.today === dayOf(new Date())
      ) {
        return new NextResponse(null, { status: 204 })
      }
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
      roll(tree, today)
      if (input.kind === 'school' || input.kind === 'sync' || today !== previousDay) {
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
        schedule(tree, templates, previousDay, shift(today, 6))
      }
      act(tree, input, now)
      if (saved.data && original === JSON.stringify(tree) && input.kind !== 'openBox')
        return NextResponse.json({ revision, tree })
      const { data, error } = await db.rpc('commit_time_tree', {
        p_user: user.id,
        p_revision: revision,
        p_garden: tree,
        p_action: input.kind,
        p_ticket: input.kind === 'acceptBox' ? input.id : null,
      })
      if (!error) return NextResponse.json(data)
      if (error.message !== 'tree_changed') throw error
    }
    return failure('进度已变化，请重试。', 409)
  } catch (error) {
    if (error instanceof TreeConflict) return failure(error.message, 409)
    return failure('生命树数据暂时无法读取或保存，请重试。', 503)
  }
}
