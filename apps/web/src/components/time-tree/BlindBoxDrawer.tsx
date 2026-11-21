'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@rosie/core'
import { AppDialog, Gift, LoadingOverlay, StickerCard } from '@rosie/ui'
import { Button, Flex, Text } from '@rosie/ui/themes'
import { blindBoxChances } from '@/lib/time-tree/rewards'
import type { BoxWheelItem, TreeData } from '@/lib/time-tree/types'
import type { TreeController } from './useTimeTree'

const CHANNEL = 'rosie-draw-v1'
type Prize = NonNullable<TreeData['prize']>
type WheelPayload = {
  entries: BoxWheelItem[]
  preferences: { soundOn?: boolean; voiceOn?: boolean; noRepeatMode?: boolean }
}

async function readWheel(owner: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session || session.user.id !== owner) throw new Error('请重新登录。')
  const response = await fetch('/api/time-tree?box=wheel', {
    headers: { Authorization: 'Bearer ' + session.access_token },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error('奖励转盘暂时无法读取。')
  const { entries, preferences } = await response.json() as WheelPayload
  return {
    revision: 0,
    entries,
    history: [],
    preferences: {
      mode: 'reward', mysteryMode: false,
      soundOn: preferences.soundOn ?? true,
      voiceOn: preferences.voiceOn ?? false,
      noRepeatMode: preferences.noRepeatMode ?? false,
    },
  }
}

function BoxWheel({ owner, draw, onSpinEnd }: { owner: string; draw: () => Promise<Prize>; onSpinEnd: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const handlers = useRef({ draw, onSpinEnd })
  const [ready, setReady] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [error, setError] = useState('')
  const [generation, setGeneration] = useState(0)
  useEffect(() => { handlers.current = { draw, onSpinEnd } }, [draw, onSpinEnd])

  useEffect(() => {
    let mounted = true
    let working = false
    let ticket: string | undefined
    let spinTimer = 0
    let snapshot: Awaited<ReturnType<typeof readWheel>> | undefined
    const origin = window.location.origin
    function reply(id: string, value?: unknown, failure?: string) {
      if (mounted) frame.current?.contentWindow?.postMessage({ channel: CHANNEL, type: 'response', id, value, error: failure }, origin)
    }
    function finishSpin() {
      ticket = undefined
      window.clearTimeout(spinTimer)
      handlers.current.onSpinEnd()
    }
    async function receive(event: MessageEvent<unknown>) {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow || !event.data || typeof event.data !== 'object') return
      const message = event.data as Record<string, unknown>
      if (message.channel !== CHANNEL) return
      if (message.type === 'ready') {
        window.clearTimeout(timer)
        setReady(true)
        setError('')
        return
      }
      if (message.type === 'fatal') {
        window.clearTimeout(timer)
        setError(typeof message.error === 'string' ? message.error : '转盘载入失败。')
        if (ticket) finishSpin()
        return
      }
      if (message.type === 'spin-finished' && ticket && message.ticket === ticket) {
        finishSpin()
        return
      }
      if (message.type !== 'request' || typeof message.id !== 'string' || !message.command || typeof message.command !== 'object') return
      const { action } = message.command as Record<string, unknown>
      if (action !== 'read' && action !== 'draw') return
      const id = message.id
      if (working || ticket) { reply(id, undefined, '本次抽奖尚未结束。'); return }
      working = true
      try {
        if (action === 'read') {
          snapshot = await readWheel(owner)
          if (mounted) setEmpty(snapshot.entries.length === 0)
          reply(id, { snapshot })
        } else if (snapshot?.entries.length) {
          const prize = await handlers.current.draw()
          if (!mounted) return
          if (!prize.wheel) throw new Error('奖品已保存，请在盲盒中领取。')
          ticket = prize.ticket
          spinTimer = window.setTimeout(finishSpin, 12_000)
          reply(id, { snapshot, result: { ...prize.wheel, id: ticket, mode: 'reward', text: prize.name } })
        } else {
          reply(id, undefined, '奖励池暂时没有可抽奖品。')
        }
      } catch (cause) {
        reply(id, undefined, cause instanceof Error ? cause.message : '转盘暂时不可用。')
      } finally { working = false }
    }
    window.addEventListener('message', receive)
    const timer = window.setTimeout(() => setError('转盘载入超时，请重试。'), 20_000)
    return () => {
      mounted = false
      window.clearTimeout(timer)
      window.clearTimeout(spinTimer)
      window.removeEventListener('message', receive)
    }
  }, [owner, generation])

  function retry() {
    setReady(false)
    setEmpty(false)
    setError('')
    setGeneration(current => current + 1)
  }

  const hasFrameSpace = !empty && !error
  const showFrame = ready && hasFrameSpace
  return (
    <div className={hasFrameSpace ? 'relative h-[min(55dvh,440px)]' : 'relative'}>
      <iframe key={generation} ref={frame} title="盲盒奖励转盘" src="/draw-wheel/index.html?mode=tree&v=3" allow="autoplay"
        className={hasFrameSpace ? `block h-full w-full border-0 ${ready ? '' : 'invisible'}` : 'invisible pointer-events-none absolute size-px'}
        aria-hidden={!showFrame} tabIndex={showFrame ? 0 : -1} />
      {!ready && hasFrameSpace && <LoadingOverlay visible placement="content" />}
      {(error || empty) && (
        <Flex direction="column" gap="3" align="center" py="3">
          <Text role={error ? 'alert' : 'status'}>{error || '奖励池暂时没有可抽奖品。'}</Text>
          <Flex gap="2" wrap="wrap" justify="center">
            {empty && <Button asChild variant="soft"><Link href="/setting/draw-pools">去奖惩管理</Link></Button>}
            <Button variant="soft" onClick={retry}>重新读取</Button>
          </Flex>
        </Flex>
      )}
    </div>
  )
}

export default function BlindBoxDrawer({ api, close }: { api: TreeController; close: () => void }) {
  const [spinning, setSpinning] = useState(false)
  const [received, setReceived] = useState(false)
  const tree = api.tree!
  const chances = blindBoxChances(tree)
  const prize = tree.prize

  async function draw() {
    if (prize) throw new Error('请先领取上一次抽中的奖励。')
    if (chances.total === 0) throw new Error('现在没有可用的抽奖机会。')
    setReceived(false)
    setSpinning(true)
    try {
      const next = await api.run(chances.ordinary ? { kind: 'openBox' } : { kind: 'openTomatoBox', tomatoPrice: chances.price }, api.revision)
      if (!next) throw new Error('抽奖暂时无法确认，请查看盲盒后重试。')
      if (!next.prize) throw new Error('奖励池暂时没有可抽奖品，本次未扣除机会。')
      if (!next.prize.wheel) setSpinning(false)
      return next.prize
    } catch (cause) {
      setSpinning(false)
      throw cause
    }
  }

  return (
    <AppDialog open title="盲盒" presentation="bottom-drawer" compactBottomDrawer closeDisabled={api.busy}
      onOpenChange={open => { if (!open) close() }}>
      <Flex direction="column" gap="3" pb="2">
        {prize && !spinning ? (
          <StickerCard tone="accent" size="md" className="text-center">
            <Flex direction="column" gap="3" align="center">
              <Text size="5" weight="bold">
                {prize.wheel?.emoji ?? <Gift aria-hidden="true" size={20} className="inline-block align-middle" />} {prize.name}
              </Text>
              <Button loading={api.busy} onClick={async () => {
                if (await api.run({ kind: 'acceptBox', id: prize.ticket })) setReceived(true)
              }}>收下奖励</Button>
            </Flex>
          </StickerCard>
        ) : chances.total > 0 || spinning ? (
          <>
            <Text align="center" size="2" color="gray">
              {spinning ? '正在抽奖…' : `还能抽 ${chances.total} 次 · ${chances.ordinary ? '本次使用普通机会' : `本次消耗 ${chances.price} 颗番茄`}`}
            </Text>
            {api.user && <BoxWheel owner={api.user.id} draw={draw} onSpinEnd={() => setSpinning(false)} />}
          </>
        ) : (
          <Text size="2" color="gray">摘下彩虹果可获得普通机会，也可用 {chances.price} 颗番茄抽一次。</Text>
        )}
        {received && <Text align="center" size="2" role="status">已收下奖励</Text>}
        {api.message && <Text role="alert" color="red">{api.message}</Text>}
      </Flex>
    </AppDialog>
  )
}
