'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { PlayerDock, usePlaylistPlayer } from '@rosie/player'
import { Button, Flex, IconButton, Text } from '@rosie/ui/themes'
import type { MediaSlot } from '../types/content'
import { examRequest } from '../client/examApi'

export type ExamAudioOptions = {
  slots?: readonly MediaSlot[]
  boundSlotIds?: readonly string[]
  loading?: boolean
  error?: boolean
  disabledReason?: string
  bindingHref?: (slotId: string) => string | null
}

const AudioContext = createContext<((slotId: string) => ReactNode) | null>(null)
export const ExamSharedAudioContext = createContext<readonly string[]>([])
/** Slots drawn once, at the right of the activity instruction. */
export const ExamTitleAudioContext = createContext<readonly string[]>([])
const AudioTransportContext = createContext<ReactNode>(null)

export function ExamAudioIcons({ slotIds }: { slotIds: readonly string[] }) {
  const render = useContext(AudioContext)
  if (!slotIds.length || !render) return null
  return <Flex gap="2" align="center">{slotIds.map(slotId => <div key={slotId}>{render(slotId)}</div>)}</Flex>
}

export function ExamAudioTransport() {
  return useContext(AudioTransportContext)
}

export function ExamSharedAudio() {
  const slots = useContext(ExamSharedAudioContext)
  return <ExamAudioIcons slotIds={slots} />
}

export function ExamInlineAudio({ slotId }: { slotId: string }) {
  const render = useContext(AudioContext)
  const shared = useContext(ExamSharedAudioContext)
  if (shared.includes(slotId)) return null
  return render?.(slotId) ?? <Text size="2" color="gray">🎧 音频暂不可播放</Text>
}

export function ExamAudioScope({ children, attemptId, adminRevisionId, options = {} }: {
  children: ReactNode; attemptId: string; adminRevisionId?: string; options?: ExamAudioOptions
}) {
  const { user } = useAuth()
  const player = usePlaylistPlayer()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const pending = useRef<AbortController | null>(null)
  const stop = player.stop
  const audioRef = player.audioRef
  useEffect(() => {
    const media = audioRef.current
    if (!media) return
    const failed = () => {
      if (!media.getAttribute('src')) return
      setError('音频播放中断，请检查网络后重新点击耳机。')
      stop()
    }
    media.addEventListener('error', failed)
    return () => media.removeEventListener('error', failed)
  }, [audioRef, stop])
  useEffect(() => () => { pending.current?.abort(); stop() }, [attemptId, adminRevisionId, user?.id, stop])
  useEffect(() => {
    if (options.disabledReason) {
      pending.current?.abort(); pending.current = null; setBusy(null); stop()
    }
  }, [options.disabledReason, stop])

  async function play(slot: MediaSlot) {
    if (!user || pending.current || options.disabledReason) return
    if (selected === slot.id && player.current && (player.isPlaying || player.isPaused)) {
      player.togglePause()
      return
    }
    const controller = new AbortController()
    pending.current = controller; setBusy(slot.id); setSelected(slot.id); setError('')
    try {
      await examRequest(user.id, '/api/exams/media/session', { method: 'POST', signal: controller.signal })
      if (controller.signal.aborted) return
      const params = new URLSearchParams(adminRevisionId
        ? { revisionId: adminRevisionId, slotId: slot.id }
        : { attemptId, slotId: slot.id, audience: slot.audience })
      await player.playWhenReady({ url: `/api/exams/media?${params}`, label: slot.sourceTrackLabel ?? '题目音频', mediaType: 'audio', source: null, refLink: null })
    } catch {
      if (!controller.signal.aborted) { stop(); setError('音频暂时无法播放，请检查资源绑定或稍后重试。') }
    } finally {
      if (pending.current === controller) { pending.current = null; if (!controller.signal.aborted) setBusy(null) }
    }
  }

  return <AudioContext.Provider value={slotId => {
    const slot = options.slots?.find(item => item.id === slotId)
    const missing = options.boundSlotIds !== undefined && !options.boundSlotIds.includes(slotId)
    const reason = options.disabledReason || (options.loading ? '正在读取音频…' : options.error ? '音频状态读取失败' : !slot ? '音频未配置' : missing ? '尚未绑定音频' : '')
    const href = options.bindingHref?.(slotId)
    const playing = selected === slotId && player.isPlaying && !player.isPaused
    const paused = selected === slotId && !!player.current && player.isPaused
    const label = [playing ? '暂停' : paused ? '继续' : '播放', `音轨 ${slot?.sourceTrackLabel ?? '音频'}`, reason].filter(Boolean).join('，')
    return <Flex align="center" gap="2">
      <IconButton size="3" variant="soft" color={reason ? 'gray' : undefined} loading={busy === slotId || options.loading}
        disabled={!!reason || !user || busy !== null} aria-label={label} aria-pressed={playing} onClick={() => slot && void play(slot)}>
        <span aria-hidden="true">🎧</span>
      </IconButton>
      {href && <Button size="1" variant="soft" asChild><Link href={href}>绑定音频</Link></Button>}
      {selected === slotId && error && <Text size="2" color="red" role="alert">{error}</Text>}
    </Flex>
  }}>
    <AudioTransportContext.Provider value={player.current ? <Flex gap="3" align="center" wrap="wrap" aria-label="当前音频">
      <Text size="2">{player.current.label}</Text>
      <Button variant="soft" disabled={!!options.disabledReason || busy !== null} onClick={player.togglePause}>{player.isPlaying && !player.isPaused ? '暂停音频' : '继续音频'}</Button>
      {error && <Text color="red" role="alert">{error}</Text>}
    </Flex> : options.disabledReason ? <Text size="2" color="gray">{options.disabledReason}</Text> : null}>
      {children}
    </AudioTransportContext.Provider>
    <PlayerDock player={player} appearance="quiet" placement="inline" showProgress />
  </AudioContext.Provider>
}
