'use client'

import { useEffect, useRef, useState } from 'react'
import { AUTH_DEVICE_SIGN_OUT, supabase, useAuth } from '@rosie/core'
import {
  getOfflineOwner, OFFLINE_CHANGED, prepareOfflineShell, readOfflineState, setOfflineOwner, updateOfflineState,
  type OfflineState,
} from '@/lib/offline/store'
import type { PrepareInput } from '@/lib/offline/prepare'

const inFlight = new Map<string, Promise<void>>()

function prepare(owner: string, input: PrepareInput) {
  const current = inFlight.get(owner)
  if (current) return current
  const operation = (async () => {
    const [{ prepareOfflinePack }, existing] = await Promise.all([
      import('@/lib/offline/prepare'),
      readOfflineState(owner),
      prepareOfflineShell(),
    ])
    const pack = await prepareOfflinePack(owner, input, existing?.pack)
    if (!pack.calc && !pack.english && !pack.math?.questions.length && !pack.tree) {
      throw new Error('暂时无法下载练习内容，请联网后重试。')
    }
    await updateOfflineState(owner, (state) => ({
      ...state,
      pack: state.pack?.english && state.english?.roundId === state.pack.english.id &&
        state.english.answers.length < state.pack.english.questions.length
        ? { ...pack, english: state.pack.english }
        : pack,
    }))
  })().finally(() => inFlight.delete(owner))
  inFlight.set(owner, operation)
  return operation
}

export function useOfflinePreparation(input: PrepareInput, ready: boolean) {
  const { user } = useAuth()
  const owner = user?.id
  const [state, setState] = useState<OfflineState>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const signature = JSON.stringify([input.day, input.cards, input.math.map((row) => row.assignmentId ?? row.key)])

  useEffect(() => {
    if (!owner) return
    let active = true
    const read = () => void readOfflineState(owner).then((value) => {
      if (active) setState(value)
    }).catch(() => undefined)
    read()
    window.addEventListener(OFFLINE_CHANGED, read)
    return () => {
      active = false
      window.removeEventListener(OFFLINE_CHANGED, read)
    }
  }, [owner])

  async function download(manual: boolean) {
    if (!owner || !ready || (!manual && getOfflineOwner() !== owner)) return
    if (!navigator.onLine) {
      if (manual) setError('恢复联网后可同步。')
      return
    }
    setBusy(true)
    setError('')
    let cancelled = false
    const cancel = () => { cancelled = true }
    window.addEventListener(AUTH_DEVICE_SIGN_OUT, cancel)
    try {
      await prepare(owner, input)
      if (manual && !cancelled) {
        const { data } = await supabase.auth.getSession()
        if (!cancelled && data.session?.user.id === owner) {
          setOfflineOwner(owner)
          const { syncOfflineQueue } = await import('@/lib/offline/sync')
          const message = await syncOfflineQueue(owner)
          if (!cancelled && message) setError(message)
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '下载失败，请重试。')
    } finally {
      window.removeEventListener(AUTH_DEVICE_SIGN_OUT, cancel)
      setBusy(false)
    }
  }

  const refresh = useRef(download)
  useEffect(() => { refresh.current = download })
  useEffect(() => {
    if (!owner || !ready) return
    const onOnline = () => { void refresh.current(false) }
    const delay = window.setTimeout(onOnline, 1_200)
    window.addEventListener('online', onOnline)
    return () => {
      window.clearTimeout(delay)
      window.removeEventListener('online', onOnline)
    }
  }, [owner, ready, signature])

  const pack = state?.pack
  const images = new Set(pack?.math?.questions.flatMap((item) =>
    item.solutionImage ? [...item.images, item.solutionImage] : item.images))
  const mediaBytes = [...images].reduce((total, blob) => total + blob.size, 0)
  const saved = owner && getOfflineOwner() === owner && pack ? [
    pack.day === input.day ? '本机已下载' : `${pack.day} 已下载`,
    new Date(pack.savedAt).toLocaleTimeString('zh-CN', {
      timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false,
    }) + ' 更新',
    pack.english ? '英语 1 轮' :
      input.cards.some((card) => card.key === 'english' && card.href) ? '英语需联网' : '',
    pack.math ? `数学 ${pack.math.questions.length} 题` : '',
    pack.math?.unavailable ? `${pack.math.unavailable} 题需联网` : '',
    pack.tree ? '生命树' : '生命树未下载',
    mediaBytes > 0 ? `题图 ${(mediaBytes / 1024 ** 2).toFixed(1)} MB` : '',
    state?.queue.length ? `${state.queue.length} 项待同步` : '',
  ].filter(Boolean).join(' · ') : ''

  return { busy, canSync: Boolean(owner) && ready && !busy, sync: () => void download(true), saved, error }
}
