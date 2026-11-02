'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { changePool, entriesStore, poolLabels, type DrawResult, type PoolKind } from './drawPools'
import './draw-card.css'

export function DrawCard({ userId }: { userId: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const request = useRef(0)
  const accepting = useRef(false)
  const [kind, setKind] = useState<PoolKind>('reward')
  const [result, setResult] = useState<DrawResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const reward = kind === 'reward'

  async function draw(selected: PoolKind) {
    const sequence = ++request.current
    setKind(selected)
    setResult(null)
    setError('')
    setBusy(true)
    if (!dialog.current?.open) dialog.current?.showModal()
    try {
      const next = await changePool(selected, 'draw')
      if (sequence === request.current) setResult(next)
    } catch {
      if (sequence === request.current) setError('抽取失败，请重试。')
    } finally {
      if (sequence === request.current) setBusy(false)
    }
  }

  async function accept() {
    if (!result || accepting.current) return
    accepting.current = true
    setBusy(true)
    setError('')
    try {
      await changePool(kind, 'accept', { p_id: result.ticket })
      if (reward) entriesStore.invalidate(userId)
      dialog.current?.close()
    } catch (err) {
      setError(err instanceof Error ? err.message : '接受失败，请重试。')
    } finally {
      accepting.current = false
      setBusy(false)
    }
  }

  return <section className="w-full max-w-[1040px] rounded-3xl bg-linear-to-br from-indigo-950 via-violet-950 to-slate-900 p-5 text-white shadow-lg sm:p-6">
    <h2 className="text-xl font-black">✦ 幸运抽奖</h2>
    <div className="mt-4 grid grid-cols-2 gap-3">
      <button onClick={() => void draw('reward')} className="rounded-2xl bg-linear-to-r from-amber-200 to-yellow-400 py-3 font-black text-amber-950">✦ 抽奖励</button>
      <button onClick={() => void draw('penalty')} className="rounded-2xl bg-linear-to-r from-violet-300 to-fuchsia-300 py-3 font-black text-violet-950">ϟ 抽惩罚</button>
    </div>
    <dialog ref={dialog} aria-labelledby="draw-title" onCancel={event => { if (accepting.current) event.preventDefault() }}
      className="fixed inset-0 m-auto w-[min(90vw,23rem)] rounded-3xl border border-white/25 bg-slate-950 p-6 text-center text-white shadow-2xl backdrop:bg-indigo-950/70 backdrop:backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <h3 id="draw-title" className="font-bold">{poolLabels[kind]}抽取</h3>
        <button aria-label="关闭" disabled={busy && !!result} onClick={() => dialog.current?.close()} className="size-10 rounded-full bg-white/10 text-xl">×</button>
      </div>
      <div aria-live="polite">
        {result ? <div className={'rosie-draw-reveal my-5 rounded-2xl border p-6 ' + (reward
          ? 'border-amber-300/60 bg-linear-to-br from-amber-200 via-yellow-100 to-amber-300 text-amber-950'
          : 'border-violet-300/60 bg-linear-to-br from-indigo-300 via-violet-100 to-purple-300 text-violet-950')}>
          <div aria-hidden className="text-5xl">{reward ? '🌟' : '⚡'}</div>
          <p className="mt-4 text-xs font-bold tracking-widest">{reward ? '星光奖励' : '闪电惩罚'}</p>
          <p className="mt-2 break-all text-2xl font-black">{result.name}</p>
        </div> : <p className="py-8">{busy ? '正在抽取…' : error || (poolLabels[kind] + '池还是空的')}</p>}
      </div>
      {result && error && <p role="alert" className="mb-3 text-rose-200">{error}</p>}
      {result ? <button disabled={busy} onClick={() => void accept()} className="w-full rounded-xl bg-white py-3 font-black text-indigo-950 disabled:opacity-60">{busy ? '接受中…' : '接受'}</button>
        : !busy && (error ? <button onClick={() => void draw(kind)}>重新抽取</button> : <Link className="text-amber-200 underline" href="/setting/draw-pools">去奖惩管理添加</Link>)}
    </dialog>
  </section>
}
