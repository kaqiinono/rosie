'use client'

import type { CalcQuestion, CalcSettings, MathPlanProblem, QuizType, WordEntry } from '@rosie/core'
import type { TodayPlanCardModel } from '@/components/today/TodayPlanOverview'

export const OFFLINE_OWNER_KEY = 'rosie-offline-owner-v1'
export const OFFLINE_CHANGED = 'rosie:offline-changed'

export type OfflineMathQuestion = {
  assignment?: MathPlanProblem
  id: string
  section: string
  title: string
  text: string
  questions: { label: string; answer: number }[]
  images: Blob[]
  analysis: string[]
  solutionImage?: Blob
}

export type OfflineEnglishRound = {
  id: string
  planId: string
  day: string
  name: string
  questions: { id: string; prompt: string; word: WordEntry; type: QuizType; answer: string; choices?: string[] }[]
}

export type OfflineTreeTask = {
  id: string
  name: string
  notes: string
  minutes: number
  planned: string
  start: string | null
  completed: boolean
  canComplete: boolean
  proof?: string
}

export type OfflinePack = {
  day: string
  savedAt: string
  cards: TodayPlanCardModel[]
  calc?: CalcSettings
  english?: OfflineEnglishRound
  math?: { planId: string; questions: OfflineMathQuestion[]; unavailable: number }
  tree?: { revision: number; tasks: OfflineTreeTask[] }
}

export type CalcDraft = {
  id: string
  startedAt: string
  settings: CalcSettings
  questions: CalcQuestion[]
  answers: { value: string; ms: number }[]
}

export type OfflineOperation =
  | { kind: 'calc'; id: string; finishedAt: string; draft: CalcDraft }
  | { kind: 'math'; id: string; day: string; planId: string; questionId: string; section: string; assignment?: MathPlanProblem; answer: string; correct: boolean }
  | { kind: 'english'; id: string; day: string; round: OfflineEnglishRound; answers: string[] }
  | { kind: 'tree'; id: string; stepId: string; day: string; revision: number; start: string; end: string; proof: string }

export type OfflineState = {
  pack?: OfflinePack
  queue: OfflineOperation[]
  calc?: CalcDraft
  english?: { roundId: string; answers: string[] }
  math?: { day: string; completed: string[] }
  tasks: Record<string, { startedAt: string; end?: string }>
}

let database: Promise<IDBDatabase> | undefined
let syncStatus = ''

function openDatabase() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('rosie-offline-v1', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('accounts')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).catch((error: unknown) => {
    database = undefined
    throw error
  })
  return database
}

export function getOfflineOwner(): string | null {
  try {
    return localStorage.getItem(OFFLINE_OWNER_KEY)
  } catch {
    return null
  }
}

export function setOfflineOwner(owner: string | null) {
  try {
    if (owner) localStorage.setItem(OFFLINE_OWNER_KEY, owner)
    else localStorage.removeItem(OFFLINE_OWNER_KEY)
  } catch {
    return
  }
  syncStatus = ''
  window.dispatchEvent(new Event(OFFLINE_CHANGED))
}

export function getOfflineSyncStatus() {
  return syncStatus
}

export function setOfflineSyncStatus(message: string) {
  if (syncStatus === message) return
  syncStatus = message
  window.dispatchEvent(new Event(OFFLINE_CHANGED))
}

export async function readOfflineState(owner: string): Promise<OfflineState | undefined> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction('accounts').objectStore('accounts').get(owner)
    request.onsuccess = () => resolve(request.result as OfflineState | undefined)
    request.onerror = () => reject(request.error)
  })
}

export async function updateOfflineState(
  owner: string,
  update: (state: OfflineState) => OfflineState,
): Promise<OfflineState> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('accounts', 'readwrite')
    const store = tx.objectStore('accounts')
    const request = store.get(owner)
    let next: OfflineState
    let failure: unknown
    request.onsuccess = () => {
      try {
        next = update(request.result ?? { queue: [], tasks: {} })
        store.put(next, owner)
      } catch (error) {
        failure = error
        tx.abort()
      }
    }
    tx.oncomplete = () => {
      resolve(next)
      window.dispatchEvent(new Event(OFFLINE_CHANGED))
    }
    tx.onabort = () => reject(failure ?? tx.error)
  })
}

export async function prepareOfflineShell() {
  if (!('serviceWorker' in navigator)) throw new Error('此浏览器无法准备离线学习。')
  const worker = await Promise.race([
    navigator.serviceWorker.ready.then((registration) => registration.active),
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 8_000)),
  ])
  if (!worker) throw new Error('离线入口尚未加载，请刷新后重试。')
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel()
    const timeout = window.setTimeout(() => {
      channel.port1.close()
      reject(new Error('离线入口下载超时，请重试。'))
    }, 30_000)
    channel.port1.onmessage = ({ data }) => {
      window.clearTimeout(timeout)
      channel.port1.close()
      if (data?.ok === true) resolve()
      else reject(new Error('离线入口下载失败，请重试。'))
    }
    worker.postMessage({ type: 'ROSIE_PREPARE_OFFLINE' }, [channel.port2])
  })
}
