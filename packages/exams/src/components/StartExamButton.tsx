'use client'

import { useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@rosie/core'
import { Button, Flex, Text } from '@rosie/ui/themes'
import { examRequest, examErrorMessage, ExamRequestError } from '../client/examApi'
import type { ExamAttemptView } from '../types/attempts'
import { attemptListStore } from '../client/learningCatalog'

type Props = { revisionId: string; mode: 'practice' | 'mock'; groupId?: string; wordReviewBatchId?: string; secondaryAction?: ReactNode }
export function StartExamButton({ revisionId, mode, groupId, wordReviewBatchId, secondaryAction }: Props) {
  const { user } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const pending = useRef<string | null>(null)
  const lock = useRef(false)
  async function start() {
    if (!user || lock.current) return
    lock.current = true; setBusy(true); setError(null)
    pending.current ??= JSON.stringify({ requestId: crypto.randomUUID(), contentRevisionId: revisionId, mode, ...(groupId ? { groupId } : {}), ...(wordReviewBatchId ? { wordReviewBatchId } : {}) })
    try {
      const result = await examRequest<ExamAttemptView>(user.id, '/api/exams/attempts', { method: 'POST', body: pending.current })
      pending.current = null
      void attemptListStore.refreshInBackground(user.id).catch(() => undefined)
      router.push(`/exams/attempts/${result.id}`)
    } catch (failure) {
      setError(failure)
      if (failure instanceof ExamRequestError && failure.status >= 400 && failure.status < 500 && failure.status !== 429) pending.current = null
    } finally { lock.current = false; setBusy(false) }
  }
  return <Flex direction="column" gap="2" align="start">
    <Flex align="center" gap="2" wrap="nowrap">
      <Button size="3" loading={busy} onClick={() => void start()}>{pending.current ? '重试开始' : mode === 'mock' ? '开始模考' : '练习这个题组'}</Button>
      {secondaryAction}
    </Flex>
    {error ? <Text as="p" size="2" color="red" role="alert">{examErrorMessage(error)}</Text> : null}</Flex>
}
