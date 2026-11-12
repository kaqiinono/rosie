'use client'

import { createUserSessionStore, supabase } from '@rosie/core'

export type PoolKind = 'reward' | 'penalty'
export const poolLabels = { reward: '奖励', penalty: '惩罚' }
export interface PoolEntry { id: string; name: string; kind: PoolKind; tree_eligible?: boolean }
export interface DrawResult extends PoolEntry { ticket: string }

export interface WheelEntry extends PoolEntry {
  reserved: boolean
  drawn: boolean
  pending_ticket: string | null
}

export const wheelStore = createUserSessionStore<WheelEntry[]>('draw_wheel_entries', {
  empty: [],
  async fetch(userId) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || session.user.id !== userId) throw new Error('请先登录。')
    const response = await fetch('/api/draw-wheel', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    })
    if (!response.ok) throw new Error('暂时读不到奖惩池。')
    return await response.json() as WheelEntry[]
  },
})

export const entriesStore = createUserSessionStore<PoolEntry[]>('draw_pool_entries', {
  empty: [],
  async fetch(userId) {
    const { data, error } = await supabase.from('draw_pool_entries')
      .select('id,name,kind,tree_eligible').eq('user_id', userId).order('name')
    if (error) throw error
    return data as PoolEntry[]
  },
})

export async function changePool(kind: PoolKind, action: 'add' | 'delete' | 'draw' | 'accept' | 'tree_on' | 'tree_off', args: { p_name?: string; p_id?: string } = {}) {
  const { data, error } = await supabase.rpc('change_draw_pool', { p_kind: kind, p_action: action, ...args })
  if (error) {
    if (error.code === '23505') throw new Error('池中已有这个名称。')
    if (error.message === 'draw_changed') throw new Error('这张卡已处理或移除，请关闭后重新抽取。')
    throw new Error('操作未完成，请稍后重试。')
  }
  return data as DrawResult | null
}
