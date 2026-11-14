'use client'

import { useEffect, useRef } from 'react'
import { PlayerDock, usePlaybackProgram, usePlaylistPlayer, type PlaybackProgramStep } from '@rosie/player'
import { Button, Flex } from '@rosie/ui/themes'
import type { ExamAttemptView } from '../types/attempts'
import { examRequest } from '../client/examApi'
import { examMediaUrl } from './ExamMaterialBlocks'

type Props = {
  view: ExamAttemptView; userId: string; onFailure: () => void
  position: { current: (() => number) | null }
}

export function ExamAudioPlayer({ view, userId, onFailure, position: positionRef }: Props) {
  const ordinary = usePlaylistPlayer()
  const program = usePlaybackProgram(onFailure)
  const failure = useRef(onFailure)
  useEffect(() => {
    failure.current = onFailure
  }, [onFailure])
  const start = program.start
  const dispose = program.dispose
  const programPosition = program.positionMs
  const section = view.state.sections.listening
  const activeProgram = view.state.mode === 'mock' && view.state.currentSectionId === 'listening' && section?.status === 'active'
  const attemptId = view.id
  // A resume changes interruptedAt/status and starts a newly authorized program.
  useEffect(() => {
    if (!activeProgram) { dispose(); positionRef.current = null; return }
    let cancelled = false
    const controller = new AbortController()
    positionRef.current = programPosition
    void examRequest<{ steps: PlaybackProgramStep[]; positionMs: number }>(userId, `/api/exams/attempts/${attemptId}/program`, { signal: controller.signal })
      .then(value => { if (!cancelled) return start(value.steps, value.positionMs) })
      .catch(() => { if (!cancelled) failure.current() })
    return () => { cancelled = true; controller.abort(); dispose(); positionRef.current = null }
  }, [activeProgram, attemptId, userId, start, dispose, programPosition, positionRef])

  if (view.state.mode === 'mock') return activeProgram ? <PlayerDock appearance="quiet" placement="inline" program={program} /> : null
  const groupId = view.state.currentGroupId
  const group = view.groups.find(item => item.id === groupId)
  const inlineIds = new Set([
    ...(group?.instructions ?? []),
    ...view.materials.filter(item => group?.materialIds.includes(item.id)).flatMap(item => item.blocks),
    ...(group?.questions.flatMap(question => [...question.prompt, ...(question.answerType === 'matching' ? question.items.flatMap(item => item.prompt) : [])]) ?? []),
  ].flatMap(block => block.kind === 'audio' ? [block.mediaSlotId] : []))
  const audio = view.mediaSlots.filter(slot => !inlineIds.has(slot.id) && ['training_audio', 'exam_listening'].includes(slot.purpose)
    && (slot.target.kind === 'content_set' || slot.target.id === groupId))
  if (!audio.length) return null
  return <Flex direction="column" gap="3"><Flex gap="2" wrap="wrap">{audio.map(slot => <Button key={slot.id} size="3" variant="soft" onClick={() => ordinary.play([{
    url: examMediaUrl(view.id, slot.id), label: slot.sourceTrackLabel ?? '练习音频', mediaType: 'audio', source: null, refLink: null,
  }])}>播放 {slot.sourceTrackLabel ?? '音频'}</Button>)}</Flex><PlayerDock appearance="quiet" placement="inline" player={ordinary} showProgress /></Flex>
}
