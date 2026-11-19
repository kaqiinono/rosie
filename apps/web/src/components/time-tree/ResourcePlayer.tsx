'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { supabase, baiduResponseMessage, probeBaiduMedia } from '@rosie/core'
import { Button, Flex, Text } from '@rosie/ui/themes'
import { PlayerDock, usePlaylistPlayer } from '@rosie/player'
import { resourceHref, type PracticeResource } from '@rosie/tasks'

export function ResourcePlayer({ resource, close, onMediaReady, loop = false }: { resource: PracticeResource; close: () => void; onMediaReady?: (ref: RefObject<HTMLVideoElement | null> | undefined) => void; loop?: boolean }) {
  const player = usePlaylistPlayer()
  const { audioRef, stop, playWhenReady } = player
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [attempt, retry] = useState(0)
  useEffect(() => {
    const element = audioRef.current
    if (!element) return
    element.loop = loop
    return () => { element.loop = false }
  }, [audioRef, loop])
  useEffect(() => {
    onMediaReady?.(audioRef)
    return () => onMediaReady?.(undefined)
  }, [audioRef, onMediaReady])
  const authorized = useRef(false)
  const playTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    const element = audioRef.current
    if (!element) return
    let ready = false
    authorized.current = false
    const clearTimer = () => { if (playTimeout.current) clearTimeout(playTimeout.current); playTimeout.current = null }
    const failed = (message: string) => {
      if (controller.signal.aborted) return
      clearTimer(); stop(); setError(message); setBusy(false)
    }
    const start = resource.startSeconds ?? 0
    const end = resource.endSeconds
    const seekStart = () => {
      if (!Number.isFinite(element.duration)) return
      if (start >= element.duration || (end !== undefined && end > element.duration + 0.25)) {
        failed('音频片段时间与文件不一致，请更新资源链接。'); return
      }
      element.currentTime = start
      ready = true
    }
    const bound = () => {
      if (!ready) return
      if (end !== undefined && element.currentTime >= end) {
        if (!element.loop) element.pause()
        element.currentTime = start
      } else if (element.currentTime < start) element.currentTime = start
    }
    const onPlaying = () => { clearTimer(); setBusy(false) }
    const onWaiting = () => {
      if (element.paused) return
      setBusy(true); clearTimer()
      playTimeout.current = setTimeout(() => failed('媒体加载超时，请重试。'), 45000)
    }
    const onPause = () => { clearTimer(); setBusy(false) }
    const onError = () => {
      authorized.current = false
      const url = resourceHref(resource.url)
      const location = new URL(url, window.location.origin)
      if (location.origin !== window.location.origin) { failed('媒体无法播放，请确认填写的是音视频直链。'); return }
      void probeBaiduMedia(url, controller.signal)
        .then((message) => failed(message || '媒体无法播放，请检查资源链接或重试。'))
        .catch(() => failed('媒体无法播放，请检查网络后重试。'))
    }
    element.addEventListener('loadedmetadata', seekStart)
    element.addEventListener('timeupdate', bound)
    element.addEventListener('seeking', bound)
    element.addEventListener('playing', onPlaying)
    element.addEventListener('waiting', onWaiting)
    element.addEventListener('pause', onPause)
    element.addEventListener('error', onError)
    setBusy(true); setError('')
    void (async () => {
      try {
        const url = resourceHref(resource.url)
        const location = new URL(url, window.location.origin)
        if (location.origin === window.location.origin && /^\/api\/baidu\/(audio|video)\//.test(location.pathname)) {
          const { data } = await supabase.auth.getSession()
          if (controller.signal.aborted) return
          if (!data.session) throw new Error('登录已过期，请重新登录。')
          const family = location.pathname.startsWith('/api/baidu/audio/') ? 'audio' : 'video'
          const response = await fetch(`/api/baidu/${family}/session`, { method: 'POST', cache: 'no-store', credentials: 'same-origin',
            headers: { Authorization: `Bearer ${data.session.access_token}` },
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]) })
          // Audio session establishes the cookie even if its catalog scan fails. The exact stream may still work.
          if (!response.ok && !(family === 'audio' && response.status !== 401))
            throw new Error(await baiduResponseMessage(response, '暂时无法播放，请重试。'))
        }
        if (controller.signal.aborted) return
        authorized.current = true
        playTimeout.current = setTimeout(() => failed('媒体加载超时，请重试。'), 45000)
        await playWhenReady({ url, label: resource.label, mediaType: resource.type === 'video' ? 'video' : 'audio', source: null, refLink: null })
      } catch (cause) {
        failed(cause instanceof Error && cause.name === 'NotAllowedError' ? '浏览器需要再次点击，请点“重试播放”。' : cause instanceof Error ? cause.message : '播放失败，请重试。')
      }
    })()
    const auth = supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') { controller.abort(); stop(); setBusy(false); setError('请重新登录后播放。') } })
    return () => {
      controller.abort(); authorized.current = false; clearTimer(); auth.data.subscription.unsubscribe()
      element.removeEventListener('loadedmetadata', seekStart); element.removeEventListener('timeupdate', bound)
      element.removeEventListener('seeking', bound); element.removeEventListener('playing', onPlaying)
      element.removeEventListener('waiting', onWaiting); element.removeEventListener('pause', onPause); element.removeEventListener('error', onError)
      stop()
    }
  }, [resource, attempt, audioRef, stop, playWhenReady])
  return <Flex direction="column" gap="2">
    {error && <Flex direction="column" gap="2"><Text role="alert" color="red">{error}</Text><Button variant="soft" onClick={() => {
      if (!authorized.current) { retry((n) => n + 1); return }
      setError(''); setBusy(true)
      // Call play directly in the click gesture after authorization, for browsers that block async autoplay.
      if (playTimeout.current) clearTimeout(playTimeout.current)
      playTimeout.current = setTimeout(() => { stop(); setBusy(false); setError('媒体加载超时，请重试。') }, 45000)
      void playWhenReady({ url: resourceHref(resource.url), label: resource.label, mediaType: resource.type === 'video' ? 'video' : 'audio', source: null, refLink: null })
        .catch(() => { if (playTimeout.current) clearTimeout(playTimeout.current); setBusy(false); setError('播放失败，请检查链接后重试。') })
    }}>重试播放</Button></Flex>}
    <PlayerDock player={player} appearance="quiet" placement="inline" density="compact"
      playLoading={busy} fallbackLabel={resource.label} onClose={close} showProgress />
  </Flex>
}

