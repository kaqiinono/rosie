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

  return (
    <section className="shadow-sticker-accent w-full max-w-[1040px] rounded-3xl border-2 border-[var(--accent-7)] bg-[var(--accent-3)] p-5 text-[var(--gray-12)] sm:p-6">
      <h2 className="text-xl font-black">✦ 幸运抽奖</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {/* native-ok: 该包不能依赖 @rosie/ui */}
        <button
          onClick={() => void draw('reward')}
          className="ease-spring rounded-full border-2 border-amber-500 bg-amber-300 py-3 font-black text-amber-950 shadow-[0_4px_0_var(--amber-10)] transition duration-200 hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_0_0_var(--amber-10)] motion-reduce:transition-none"
        >
          ✦ 抽奖励
        </button>
        {/* native-ok: 该包不能依赖 @rosie/ui */}
        <button
          onClick={() => void draw('penalty')}
          className="ease-spring rounded-full border-2 border-violet-400 bg-violet-200 py-3 font-black text-violet-950 shadow-[0_4px_0_var(--violet-9)] transition duration-200 hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_0_0_var(--violet-9)] motion-reduce:transition-none"
        >
          ϟ 抽惩罚
        </button>
      </div>
      <dialog
        ref={dialog}
        aria-labelledby="draw-title"
        onCancel={(event) => {
          if (accepting.current) event.preventDefault()
        }}
        className="border-kid-line bg-kid-paper shadow-sticker-lg fixed inset-0 m-auto w-[min(90vw,23rem)] rounded-[28px] border-[3px] p-6 text-center text-[var(--gray-12)] backdrop:bg-amber-950/40"
      >
        <div className="flex items-center justify-between">
          <h3 id="draw-title" className="font-bold">
            {poolLabels[kind]}抽取
          </h3>
          {/* native-ok: 该包不能依赖 @rosie/ui */}
          <button
            aria-label="关闭"
            disabled={busy && !!result}
            onClick={() => dialog.current?.close()}
            className="size-10 rounded-full bg-[var(--gray-4)] text-xl"
          >
            ×
          </button>
        </div>
        <div aria-live="polite">
          {result ? (
            <div
              className={
                'rosie-draw-reveal my-5 rounded-3xl border-2 p-6 ' +
                (reward
                  ? 'border-amber-400 bg-amber-200 text-amber-950'
                  : 'border-violet-400 bg-violet-200 text-violet-950')
              }
            >
              <div aria-hidden className="text-5xl">
                {reward ? '🌟' : '⚡'}
              </div>
              <p className="mt-4 text-xs font-bold tracking-widest">
                {reward ? '星光奖励' : '闪电惩罚'}
              </p>
              <p className="mt-2 text-2xl font-black break-all">{result.name}</p>
            </div>
          ) : (
            <p className="py-8">{busy ? '正在抽取…' : error || poolLabels[kind] + '池还是空的'}</p>
          )}
        </div>
        {result && error && (
          <p role="alert" className="mb-3 text-rose-600">
            {error}
          </p>
        )}
        {result ? (
          <button // native-ok: 该包不能依赖 @rosie/ui
            disabled={busy}
            onClick={() => void accept()}
            className="w-full rounded-full border-2 border-amber-500 bg-amber-300 py-3 font-black text-amber-950 shadow-[0_4px_0_var(--amber-10)] disabled:opacity-60"
          >
            {busy ? '接受中…' : '接受'}
          </button>
        ) : (
          !busy &&
          (error ? (
            <button /* native-ok: 该包不能依赖 @rosie/ui */ onClick={() => void draw(kind)}>
              重新抽取
            </button>
          ) : (
            <Link className="text-[var(--accent-11)] underline" href="/setting/draw-pools">
              去奖惩管理添加
            </Link>
          ))
        )}
      </dialog>
    </section>
  )
}
