'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase, useAuth, useImmersive } from '@rosie/core'

export default function TomatoPage() {
  const { user } = useAuth()
  return user && <Timer key={user.id} userId={user.id} />
}

function Timer({ userId }: { userId: string }) {
  const { setIsImmersive } = useImmersive()
  const frame = useRef<HTMLIFrameElement>(null)
  const [initial, setInitial] = useState<{ state: unknown } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setIsImmersive(true)
    let mounted = true
    let revision = 0
    let pending: Record<string, unknown> | null = null
    let writing = false
    const table = () => supabase.from('tomato_timer_sessions')
    async function load() {
      const { data, error } = await table().select('revision,state').eq('user_id', userId).maybeSingle()
      if (!mounted) return
      if (error) { setError('番茄计时记录读取失败，请刷新重试。'); return }
      revision = data?.revision ?? 0
      setInitial({ state: data?.state ?? {} })
    }
    async function save() {
      if (writing) return
      writing = true
      try {
        while (pending) {
          const state = pending
          pending = null
          const next = revision + 1
          const query = revision
            ? table().update({ revision: next, state }).eq('user_id', userId).eq('revision', revision)
            : table().insert({ user_id: userId, revision: next, state })
          const { error } = await query.select('revision').single()
          if (error) throw error
          revision = next
        }
      } catch {
        if (mounted) setError('记录保存失败。可在设置中导出备份，然后刷新页面。')
      } finally {
        writing = false
      }
    }
    function receive(event: MessageEvent) {
      if (!frame.current || event.source !== frame.current.contentWindow || event.origin !== 'null') return
      const msg = event.data
      if (msg?.type === 'tomato:save' && msg.state && typeof msg.state === 'object') {
        pending = msg.state
        void save()
      } else if (msg?.type === 'tomato:permission') {
        const reply = (enabled: boolean) => frame.current?.contentWindow?.postMessage({ type: 'tomato:permission-result', enabled }, '*')
        if ('Notification' in window) void Notification.requestPermission().then(p => reply(p === 'granted'), () => reply(false))
        else reply(false)
      } else if (msg?.type === 'tomato:notify' && 'Notification' in window && Notification.permission === 'granted') {
        try { new Notification(String(msg.title), { body: String(msg.body) }) } catch { /* Platform lacks desktop notifications. */ }
      }
    }
    window.addEventListener('message', receive)
    void load()
    return () => {
      mounted = false
      setIsImmersive(false)
      window.removeEventListener('message', receive)
    }
  }, [userId, setIsImmersive])

  return <main className="flex h-dvh flex-col">
    {error && <p role="alert">{error}</p>}
    {initial && <iframe ref={frame} src="/tomato-timer/index.html" title="番茄计时"
      sandbox="allow-scripts allow-forms allow-downloads" allow="autoplay; fullscreen" allowFullScreen
      onLoad={() => frame.current?.contentWindow?.postMessage({ type: 'tomato:init', state: initial.state }, '*')}
      className="block min-h-0 w-full flex-1 border-0" />}
  </main>
}
