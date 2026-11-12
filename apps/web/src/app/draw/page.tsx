'use client'

import { useCallback, useRef, useState } from 'react'
import { useAuth } from '@rosie/core'
import { changePool, entriesStore, poolLabels, wheelStore, type PoolKind } from '@rosie/rewards'
import { AppDialog, LoadingOverlay, PageShell, StickerCard } from '@rosie/ui'
import { Button, TextField } from '@rosie/ui/themes'
import DrawWheel from './DrawWheel'

export default function DrawPage() {
  const { user } = useAuth()
  return (
    <PageShell title="抽一抽" icon="🎡" width="narrow">
      {user ? <Pools key={user.id} user={user} /> : <Waiting />}
    </PageShell>
  )
}

function Waiting() {
  return <div className="grid min-h-[calc(100dvh-8rem)] place-items-center"><LoadingOverlay visible placement="content" /></div>
}

type SignedInUser = NonNullable<ReturnType<typeof useAuth>['user']>

function Pools({ user }: { user: SignedInUser }) {
  const { data, isLoading, error: loadError } = wheelStore.useSessionData(user)
  const [kind, setKind] = useState<PoolKind>('reward')
  const [action, setAction] = useState<'draw' | 'add' | 'accept' | 'reload' | null>(null)
  const [spin, setSpin] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const lock = useRef(false)
  const stop = useCallback(() => { setSpin(null); lock.current = false }, [])
  const rows = data.filter(entry => entry.kind === kind)
  const pending = rows.find(entry => entry.pending_ticket)
  const busy = !!action || !!spin
  const label = poolLabels[kind]

  function showAdd() {
    setError('')
    setName('')
    setAdding(true)
  }

  async function run(operation: 'draw' | 'add' | 'accept' | 'reload') {
    if (lock.current) return
    lock.current = true
    setAction(operation)
    setError('')
    let animating = false
    try {
      if (operation === 'reload') {
        await wheelStore.refreshInBackground(user.id)
        return
      }
      if (operation === 'add' && !name.trim()) return
      if (operation === 'accept' && !pending?.pending_ticket) return
      const result = await changePool(kind, operation, operation === 'add'
        ? { p_name: name.trim() } : operation === 'accept' ? { p_id: pending?.pending_ticket ?? undefined } : {})
      if (operation === 'add' || operation === 'accept') entriesStore.invalidate(user.id)
      if (operation === 'add') setAdding(false)
      await wheelStore.refreshInBackground(user.id)
      if (operation === 'draw') {
        if (!result) setError('当前没有可抽取的条目。')
        else if (wheelStore.getSessionData(user.id)?.some(entry => entry.pending_ticket === result.ticket)) {
          animating = true
          setSpin(result.ticket)
        } else setError('奖池已更新，请再转一次。')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作未完成，请重试。')
      if (operation !== 'reload') {
        await wheelStore.refreshInBackground(user.id).catch(() => undefined)
      }
    } finally {
      setAction(null)
      if (!animating) lock.current = false
    }
  }

  if (isLoading) return <Waiting />
  if (loadError) return (
    <div role="alert" className="space-y-3 text-center">
      <p>暂时读不到奖惩池。</p>
      <Button loading={action === 'reload'} onClick={() => void run('reload')}>重新读取</Button>
    </div>
  )

  return (
    <StickerCard as="section" className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="选择转盘" className="flex items-center gap-2">
          {(['reward', 'penalty'] as const).map(pool => (
            <Button key={pool} size="3" color={pool === 'reward' ? 'amber' : 'violet'}
              variant={kind === pool ? 'solid' : 'soft'} aria-pressed={kind === pool} disabled={busy}
              onClick={() => { setKind(pool); setError('') }}>
              {pool === 'reward' ? '🎁 奖励' : '⚡ 惩罚'}
            </Button>
          ))}
        </div>
        <Button color={kind === 'reward' ? 'amber' : 'violet'} variant="soft" disabled={busy} onClick={showAdd}>＋ 添加{label}</Button>
      </div>
      <div className="mt-5 space-y-4">
        <DrawWheel kind={kind} entries={rows} busy={busy} spinningTicket={spin} onStop={stop}
          onAction={() => rows.length ? void run('draw') : showAdd()} />
        {action === 'draw' && <p role="status" className="text-center">正在抽取…</p>}
        {pending && !spin && action !== 'draw' && (
          <StickerCard tone={kind === 'reward' ? 'warning' : 'paper'} size="sm" elevation="flat" className="space-y-2 text-center">
            <p className="text-sm">抽中的{label}</p>
            <p aria-live="polite" className="text-xl font-bold break-all">{pending.name}</p>
            <Button color={kind === 'reward' ? 'amber' : 'violet'} loading={action === 'accept'} disabled={busy}
              onClick={() => void run('accept')}>{kind === 'reward' ? '领取奖励' : '接受惩罚'}</Button>
          </StickerCard>
        )}
        {error && !adding && <p role="alert" className="text-center text-rose-700">{error}</p>}
      </div>
      <AppDialog open={adding} title={'添加' + label} closeDisabled={busy} onOpenChange={next => {
        if (!busy) { setAdding(next); setError('') }
      }}>
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); void run('add') }}>
          <label className="grid gap-2">
            {label}名称
            <TextField.Root value={name} maxLength={100} required disabled={busy} onChange={event => setName(event.target.value)} />
          </label>
          {error && <p role="alert" className="text-rose-700">{error}</p>}
          <Button type="submit" loading={action === 'add'} disabled={busy || !name.trim()}>添加到转盘</Button>
        </form>
      </AppDialog>
    </StickerCard>
  )
}
