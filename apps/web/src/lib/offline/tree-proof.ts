import { createHmac, timingSafeEqual } from 'node:crypto'
import { dayOf, type WorkStep } from '@/lib/time-tree/types'

export function canCompleteOffline(step: WorkStep, day: string) {
  return step.planned === day && step.subject !== 'life' && !step.cycleTarget && !step.skipped && !step.end && !step.flowers &&
    !step.practiceBindingKey && !step.practiceEntryName && !step.practice && step.minutes > 0
}

export function signTreeOfflineWork(owner: string, id: string, revision: number, day: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Missing server signing key')
  return createHmac('sha256', key).update(JSON.stringify(['rosie-offline-tree-v1', owner, id, revision, day])).digest('hex')
}

export function verifyTreeOfflineWork(
  owner: string,
  id: string,
  revision: number,
  day: string,
  proof: unknown,
  start: string,
  end: string,
  now: string,
) {
  if (typeof proof !== 'string' || !/^[\da-f]{64}$/.test(proof)) return false
  const [began, ended, current] = [start, end, now].map(Date.parse)
  if (!Number.isFinite(began) || !Number.isFinite(ended) || ended < began ||
    ended > current || dayOf(start) !== day || dayOf(end) !== day) return false
  return timingSafeEqual(Buffer.from(proof, 'hex'), Buffer.from(signTreeOfflineWork(owner, id, revision, day), 'hex'))
}
