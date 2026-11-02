import { createUserSessionStore, supabase } from '@rosie/core'

export type PoolKind = 'reward' | 'penalty'
export const poolLabels = { reward: '奖励', penalty: '惩罚' }
export interface PoolEntry { id: string; name: string; kind: PoolKind }
export interface DrawResult extends PoolEntry { ticket: string }

export const entriesStore = createUserSessionStore<PoolEntry[]>('draw_pool_entries', {
  empty: [],
  async fetch(userId) {
    const { data, error } = await supabase.from('draw_pool_entries')
      .select('id,name,kind').eq('user_id', userId).order('name')
    if (error) throw error
    return data as PoolEntry[]
  },
})

export async function changePool(kind: PoolKind, action: 'add' | 'delete' | 'draw' | 'accept', args: { p_name?: string; p_id?: string } = {}) {
  const { data, error } = await supabase.rpc('change_draw_pool', { p_kind: kind, p_action: action, ...args })
  if (error) {
    if (error.code === '23505') throw new Error('池中已有这个名称。')
    if (error.message === 'draw_changed') throw new Error('这张卡已处理或移除，请关闭后重新抽取。')
    throw new Error('操作未完成，请稍后重试。')
  }
  return data as DrawResult | null
}
