'use client'

import { useState } from 'react'
import { useAuth } from '@rosie/core'
import { changePool, entriesStore, poolLabels, type PoolEntry, type PoolKind } from './drawPools'

function PoolEditor({ userId, kind, entries }: { userId: string; kind: PoolKind; entries: PoolEntry[] }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const label = poolLabels[kind]

  async function save(removeId?: string) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (removeId) {
        await changePool(kind, 'delete', { p_id: removeId })
        entriesStore.patchSessionData(userId, rows => rows.filter(row => row.id !== removeId))
      } else {
        const entry = await changePool(kind, 'add', { p_name: name.trim() })
        if (entry) entriesStore.patchSessionData(userId, rows => [...rows, entry])
        setName('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试。')
    } finally { setBusy(false) }
  }

  return <section className="rounded-3xl border border-border-light bg-surface p-5 shadow-sm">
    <h2 className="text-lg font-black">{label}池</h2>
    <p className="mt-1 text-sm text-text-secondary">{kind === 'reward' ? '接受后，这项奖励会从池中移除。' : '每轮随机抽遍所有惩罚，接受后保留。'}</p>
    <form className="my-4 flex gap-2" onSubmit={event => { event.preventDefault(); void save() }}>
      <input aria-label={label + '名称'} placeholder={label + '名称'} maxLength={100} value={name} disabled={busy}
        onChange={event => setName(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-border-light px-3 py-2" />
      <button disabled={busy || !name.trim()} className="rounded-xl bg-indigo-600 px-4 font-bold text-white disabled:opacity-50">添加</button>
    </form>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {entries.length === 0 && <p className="text-sm text-text-muted">还没有{label}</p>}
    <ul className="divide-y divide-border-light">{entries.map(entry => <li key={entry.id} className="flex items-center justify-between gap-4 py-2">
      <span className="break-all">{entry.name}</span>
      <button disabled={busy} aria-label={'删除' + entry.name} className="shrink-0 p-2 text-sm text-rose-700" onClick={() => void save(entry.id)}>删除</button>
    </li>)}</ul>
  </section>
}

export function DrawPoolManager() {
  const { user } = useAuth()
  const { data, isLoading, error } = entriesStore.useSessionData(user)
  if (!user || isLoading) return <p>正在读取奖惩池…</p>
  if (error) return <button onClick={() => { entriesStore.invalidate(user.id); void entriesStore.ensureLoaded(user.id) }}>读取失败，点击重试</button>
  return <div className="grid items-start gap-4 sm:grid-cols-2">
    {(['reward', 'penalty'] as const).map(kind => <PoolEditor key={user.id + kind} kind={kind} userId={user.id} entries={data.filter(row => row.kind === kind)} />)}
  </div>
}
