'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, baiduResponseMessage, probeBaiduMedia } from '@rosie/core'
import PassageView from '@rosie/english/components/reading/PassageView'
import { findPassageByKey } from '@rosie/english/utils/reading-data'
import { AppDialog, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Text } from '@rosie/ui/themes'
import { PlayerDock, usePlaylistPlayer } from '@rosie/player'
import { resourceHref, type PracticeEntryRow, type PracticeResource } from '@rosie/tasks'

function ResourcePlayer({ resource, close, onMediaReady }: { resource: PracticeResource; close: () => void; onMediaReady?: (ref: RefObject<HTMLVideoElement | null> | undefined) => void }) {
  const player = usePlaylistPlayer()
  const { audioRef, stop, playWhenReady } = player
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [attempt, retry] = useState(0)
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
        element.pause(); element.currentTime = start
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
      const location = new URL(resource.url, window.location.origin)
      if (location.origin !== window.location.origin) { failed('媒体无法播放，请确认填写的是音视频直链。'); return }
      void probeBaiduMedia(resource.url, controller.signal)
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
    {busy && <Text size="2" role="status">正在准备播放…</Text>}
    {error && <Flex direction="column" gap="2"><Text role="alert" color="red">{error}</Text><Button variant="soft" onClick={() => {
      if (!authorized.current) { retry((n) => n + 1); return }
      setError(''); setBusy(true)
      // Call play directly in the click gesture after authorization, for browsers that block async autoplay.
      if (playTimeout.current) clearTimeout(playTimeout.current)
      playTimeout.current = setTimeout(() => { stop(); setBusy(false); setError('媒体加载超时，请重试。') }, 45000)
      void playWhenReady({ url: resourceHref(resource.url), label: resource.label, mediaType: resource.type === 'video' ? 'video' : 'audio', source: null, refLink: null })
        .catch(() => { if (playTimeout.current) clearTimeout(playTimeout.current); setBusy(false); setError('播放失败，请检查链接后重试。') })
    }}>重试播放</Button></Flex>}
    <PlayerDock player={player} appearance="quiet" placement="inline" density="compact" onClose={close} showProgress />
  </Flex>
}

export default function PracticeResources({ row }: { row: PracticeEntryRow }) {
  const router = useRouter()
  const [active, setActive] = useState<PracticeResource | null>(null)
  const [error, setError] = useState('')
  const resources = row.resources ?? []
  const passage = !row.values.sentenceId && row.values.key ? findPassageByKey(row.values.key) : undefined
  const [narrationRef, setNarrationRef] = useState<RefObject<HTMLVideoElement | null> | undefined>(undefined)
  const isNarration = active?.id === `audio:${passage?.key}:narration`
  return <Flex direction="column" gap="3">
    {row.values.contentType === 'chinese-course' && row.values.requiresRecite === 'true' && <Flex><Badge color="orange">需背诵</Badge></Flex>}
    {row.values.contentType === 'chinese-course' && row.values.requiresRecite === 'unknown' && <Text size="1" color="gray">背诵要求待补充</Text>}
    {passage && <PassageView passage={passage} lessonWords={[]} masteryMap={{}} mode="focus" narrationRef={isNarration ? narrationRef : undefined} />}
    {(passage ? [] : row.content ?? []).map((block, index) => <StickerCard key={index} size="sm" tone="paper">
      <Flex direction="column" gap="2">
        {block.title && <Text size="3" weight="bold">{block.title}</Text>}
        {row.values.contentType === 'chinese-course' && ['会认字', '会写字', '词语', '读一读，记一记'].includes(block.title) ?
          <Flex gap="2" wrap="wrap">{block.text.split('　').filter(Boolean).map((text, i) => <Badge key={`${text}:${i}`} size="3" color={block.title === '会写字' ? 'orange' : 'green'}>{text}</Badge>)}</Flex> :
          <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{block.text}</p>}
        {block.translation && <p className="whitespace-pre-wrap break-words text-sm text-text-secondary">{block.translation}</p>}
      </Flex>
    </StickerCard>)}
    <Flex gap="2" wrap="wrap">
      {resources.map((resource) => <Button key={resource.id} variant="soft" aria-label={`${resource.type === 'link' ? '打开' : '播放'}${resource.label}`} onClick={() => {
        setError('')
        try {
          const href = resourceHref(resource.url)
          if (resource.type === 'link') { setActive(null); router.push(href) }
          else setActive((current) => current?.id === resource.id ? null : resource)
        } catch { setError('资源链接无效，请在作业内容管理中修改。') }
      }}><span aria-hidden>{resource.type === 'audio' ? '🔊' : resource.type === 'video' ? '🎬' : '🔗'}</span>{resource.label}</Button>)}
    </Flex>
    {row.resourceStatus === 'error' && <Text size="2" color="gray">{row.resourceError || '部分资源尚未读取成功，可在作业内容管理中刷新关联资源。'}</Text>}
    {row.values.sentenceId && row.resourceStatus !== 'error' && !resources.some(resource => resource.type === 'audio') && <Text size="2" color="gray">此句尚未绑定单句音频。</Text>}
    {error && <Text role="alert" color="red">{error}</Text>}
    {active?.type === 'audio' && <ResourcePlayer key={active.id} resource={active} close={() => setActive(null)} onMediaReady={setNarrationRef} />}
    <AppDialog open={active?.type === 'video'} title={active?.label ?? '视频回放'} size="preview" onOpenChange={(open) => { if (!open) setActive(null) }}>
      {active?.type === 'video' && <ResourcePlayer key={active.id} resource={active} close={() => setActive(null)} onMediaReady={setNarrationRef} />}
    </AppDialog>
  </Flex>
}
