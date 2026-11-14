'use client'

import { supabase } from '@rosie/core'
import { ExamRequestError } from './examApi'

export async function readExamRecordingBlob(userId: string, path: string): Promise<Blob> {
  const { data } = await supabase.auth.getSession()
  if (data.session?.user.id !== userId) throw new ExamRequestError('unauthorized', 401)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(path, { cache: 'no-store', redirect: 'error', signal: controller.signal,
      headers: { Authorization: `Bearer ${data.session.access_token}` } })
    if (!response.ok) throw new ExamRequestError('exam_recording_unavailable', response.status)
    const blob = await response.blob()
    if ((await supabase.auth.getSession()).data.session?.user.id !== userId) throw new ExamRequestError('unauthorized', 401)
    return blob
  } finally { clearTimeout(timeout) }
}
