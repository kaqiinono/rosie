'use client'

import { useRef, useState } from 'react'
import { PlayerDock, usePlaylistPlayer } from '@rosie/player'
import { Button, Flex, Text } from '@rosie/ui/themes'
import type { MediaSlot } from '../types/content'
import { examMediaUrl } from './ExamMaterialBlocks'

/** The media endpoint independently rechecks the submitted scope for each file. */
export function ExamReviewMedia({ attemptId, slots }: { attemptId: string; slots: readonly MediaSlot<'student' | 'review'>[] }) {
  const player = usePlaylistPlayer()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const audio = slots.filter(slot => ['exam_listening', 'training_audio', 'speaking_example'].includes(slot.purpose))
  if (!audio.length) return null
  return <Flex direction="column" gap="3"><Flex gap="2" wrap="wrap">{audio.map(slot => <Button key={slot.id} size="3" variant="soft" loading={busy === slot.id} disabled={busy !== null && busy !== slot.id} onClick={async () => {
    if (lock.current) return
    lock.current = true; setBusy(slot.id); setError('')
    try {
      await player.playWhenReady({ url: examMediaUrl(attemptId, slot.id, slot.audience), label: slot.sourceTrackLabel ?? '复盘音频', mediaType: 'audio', source: null, refLink: null })
    } catch { setError('暂时无法播放这段音频，请确认登录和网络后重试。') }
    finally { lock.current = false; setBusy(null) }
  }}>回听 {slot.sourceTrackLabel ?? '音频'}</Button>)}</Flex>
    {error && <Text color="red" role="alert">{error}</Text>}<PlayerDock appearance="quiet" placement="inline" player={player} showProgress />
  </Flex>
}
