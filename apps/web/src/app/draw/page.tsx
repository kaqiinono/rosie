'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useImmersive } from '@rosie/core'
import { changeWorkshop, workshopStore, type WorkshopCommand } from '@rosie/rewards'
import { AppDialog, LoadingOverlay } from '@rosie/ui'
import { Button } from '@rosie/ui/themes'

type Confirmation = { id: string; title: string; description: string }
const CHANNEL = 'rosie-draw-v1'

export default function DrawPage() {
  const { user } = useAuth()
  return user ? <Workshop key={user.id} user={user} /> : <div className="relative h-dvh"><LoadingOverlay visible placement="content" /></div>
}

function Workshop({ user }: { user: NonNullable<ReturnType<typeof useAuth>['user']> }) {
  const router = useRouter()
  const { setIsImmersive } = useImmersive()
  const { error } = workshopStore.useSessionData(user)
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [frameError, setFrameError] = useState('')
  const [generation, setGeneration] = useState(0)
  const [retrying, setRetrying] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const confirmationRef = useRef<Confirmation | null>(null)

  useEffect(() => {
    setIsImmersive(true)
    return () => setIsImmersive(false)
  }, [setIsImmersive])

  useEffect(() => {
    let mounted = true
    let working = false
    const reply = (id: string, value?: unknown, message?: string) => {
      if (!mounted) return
      frame.current?.contentWindow?.postMessage({ channel: CHANNEL, type: 'response', id, value, error: message }, window.location.origin)
    }
    const onMessage = async (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return
      const data = event.data
      if (!data || typeof data !== 'object') return
      const message = data as Record<string, unknown>
      if (message.channel !== CHANNEL) return
      if (message.type === 'ready') { window.clearTimeout(timer); setReady(true); setFrameError(''); return }
      if (message.type === 'fatal') { setReady(false); setFrameError(typeof message.error === 'string' ? message.error : '转盘载入失败。'); return }
      if (message.type === 'home') { router.push('/'); return }
      if (typeof message.id !== 'string') return
      const id = message.id
      if (message.type === 'confirm') {
        if (confirmationRef.current) { reply(id, false); return }
        const options: Record<string, { title: string; description: string }> = {
          delete: { title: '删除这个条目？', description: `「${typeof message.name === 'string' ? message.name.slice(0, 100) : ''}」将从共享奖池删除，历史记录保留。` },
          reset: { title: '恢复默认列表？', description: '当前类型的自定义条目将被替换为 demo 默认列表；历史记录保留。生命树已预留的条目会阻止此操作。' },
          clearHistory: { title: '清空战绩记录？', description: '当前账号的奖励和惩罚记录都会从小本本清空，不能在页面恢复。奖池条目不受影响。' },
        }
        const option = typeof message.action === 'string' ? options[message.action] : undefined
        if (!option) { reply(id, false); return }
        const next = { id, ...option }
        confirmationRef.current = next
        setConfirmation(next)
        return
      }
      if (message.type !== 'request' || !message.command || typeof message.command !== 'object') return
      if (working) { reply(id, undefined, '上一项操作尚未完成。'); return }
      working = true
      try {
        const command = message.command as Record<string, unknown>
        if (command.action === 'read') {
          if (command.refresh === true) await workshopStore.refreshInBackground(user.id)
          else await workshopStore.ensureLoaded(user.id)
          const snapshot = workshopStore.getSessionData(user.id)
          if (!snapshot) throw new Error('奖池暂时不可用。')
          reply(id, { snapshot, result: null })
        } else {
          const result = await changeWorkshop(user.id, command as unknown as WorkshopCommand)
          reply(id, result)
        }
      } catch (cause) {
        reply(id, undefined, cause instanceof Error ? cause.message : '请求失败，请重新读取。')
      } finally { working = false }
    }
    window.addEventListener('message', onMessage)
    const timer = window.setTimeout(() => {
      if (mounted) setFrameError(current => current || '转盘载入超时，请重试。')
    }, 55000)
    return () => {
      mounted = false
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
    }
  }, [user.id, router, generation])

  function answer(accepted: boolean) {
    const pending = confirmationRef.current
    if (!pending) return
    frame.current?.contentWindow?.postMessage({ channel: CHANNEL, type: 'response', id: pending.id, value: accepted }, window.location.origin)
    confirmationRef.current = null
    setConfirmation(null)
  }

  async function retry() {
    if (retrying) return
    setRetrying(true)
    try {
      await workshopStore.refreshInBackground(user.id)
      setFrameError('')
      setReady(false)
      setGeneration(value => value + 1)
    } catch (cause) {
      setFrameError(cause instanceof Error ? cause.message : '读取失败，请重试。')
    } finally { setRetrying(false) }
  }

  const problem = !ready ? frameError || (error instanceof Error ? error.message : '') : ''
  return (
    <main className="relative h-dvh overflow-hidden">
      <iframe
        key={generation}
        ref={frame}
        title="星愿奇趣大转盘"
        src="/draw-wheel/index.html?v=2"
        className="block h-full w-full border-0"
        style={{ visibility: ready ? 'visible' : 'hidden' }}
        allow="autoplay"
      />
      {!ready && !problem && <LoadingOverlay visible placement="content" />}
      {problem && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-kid-paper px-6 text-center">
          <p>{problem}</p>
          <div className="flex gap-3">
            <Button variant="soft" onClick={() => router.push('/')}>返回首页</Button>
            <Button loading={retrying} onClick={() => void retry()}>重新读取</Button>
          </div>
        </div>
      )}
      <AppDialog open={!!confirmation} onOpenChange={open => { if (!open) answer(false) }} title={confirmation?.title ?? '确认操作'} description={confirmation?.description}>
        <div className="flex justify-end gap-3">
          <Button variant="soft" onClick={() => answer(false)}>取消</Button>
          <Button color="red" onClick={() => answer(true)}>确认</Button>
        </div>
      </AppDialog>
    </main>
  )
}
