'use client'

import { createUserSessionStore, supabase } from '@rosie/core'
import { entriesStore, wheelStore, type PoolKind } from './drawPools'

export interface WorkshopEntry {
  id: string
  text: string
  kind: PoolKind
  emoji: string
  color: string
  weight: number
  enabled: boolean
  reserved: boolean
  treeEligible: boolean
  position: number
}
export interface WorkshopHistory {
  id: string
  entryId: string
  mode: 'reward' | 'punishment'
  text: string
  emoji: string
  pct: number
  done: boolean
  createdAt: string
}
export interface WorkshopSnapshot {
  revision: number
  preferences: {
    mode: 'reward' | 'punishment'
    soundOn: boolean
    voiceOn: boolean
    mysteryMode: boolean
    noRepeatMode: boolean
  }
  entries: WorkshopEntry[]
  history: WorkshopHistory[]
}
export interface WorkshopCommand {
  action: 'preferences' | 'add' | 'edit' | 'delete' | 'shuffle' | 'enableAll' | 'reset' | 'draw' | 'stamp' | 'clearHistory'
  kind: PoolKind
  payload: Record<string, unknown>
  revision: number
  operation: string
}
export interface WorkshopResponse {
  snapshot: WorkshopSnapshot
  result: (WorkshopHistory & { items: WorkshopEntry[] }) | null
}

async function fetchWorkshop(userId: string, command?: WorkshopCommand): Promise<WorkshopResponse> {
  // Same operation UUID on a transport retry; the database returns its original receipt.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || session.user.id !== userId) throw new Error('请先登录。')
      const response = await fetch('/api/draw-wheel/workshop', {
        method: command ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: command ? JSON.stringify(command) : undefined,
        cache: 'no-store', signal: AbortSignal.timeout(20000),
      })
      const body = await response.json()
      if (!response.ok) {
        // Do not retry domain errors or an unavailable migration.
        throw new WorkshopError(typeof body.error === 'string' ? body.error : '无法读取奖池。')
      }
      return body as WorkshopResponse
    } catch (error) {
      if (error instanceof WorkshopError || attempt === 1) throw error
    }
  }
  throw new Error('请求未能确认，请查看历史记录。')
}
class WorkshopError extends Error {}

export const workshopStore = createUserSessionStore<WorkshopSnapshot | null>('draw_workshop', {
  empty: null,
  async fetch(userId) { return (await fetchWorkshop(userId)).snapshot },
})

export async function changeWorkshop(userId: string, command: WorkshopCommand): Promise<WorkshopResponse> {
  const result = await fetchWorkshop(userId, command)
  // Do not repopulate a previous account's cache after a sign-out/user switch.
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user.id !== userId) throw new Error('登录状态已改变，请重新打开转盘。')
  workshopStore.patchSessionData(userId, () => result.snapshot)
  entriesStore.invalidate(userId)
  wheelStore.invalidate(userId)
  return result
}
