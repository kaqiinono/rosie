'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createUserSessionStore, useAuth } from '@rosie/core'
import { PlayerDock, usePlaylistPlayer } from '@rosie/player'
import { Button, Flex, Spinner, Text, TextField } from '@rosie/ui/themes'
import type { ExamAnswer, ExamAttemptView } from '../types/attempts'
import type { Question } from '../types/questions'
import type { TeacherNote } from '../types/solutions'
import type { ExamRecording } from '../types/assessment'
import { examRequest, examErrorMessage, ExamRequestError } from '../client/examApi'
import { readExamRecordingBlob } from '../client/examBlob'
import { ExamMaterialBlocks } from './ExamMaterialBlocks'

type Props = {
  attemptId: string; question: Question; answer?: ExamAnswer; disabled: boolean; version: string
  /** A genuinely closed scope; temporary request disabling must not discard script or stop recording. */
  scopeClosed?: boolean
  onChange: (answer: ExamAnswer) => void; onServerChange: () => void; onPendingChange?: (pending: boolean) => void; ownerId?: string
}
type RecordingReceipt = { recording: ExamRecording }
type UploadOperation = { body: string; row: ExamRecording | null; blob: Blob; mimeType: string; rejected: boolean }
type Work = 'microphone' | 'upload' | 'abandon' | 'script' | null

const recordingStores = new Map<string, ReturnType<typeof createUserSessionStore<ExamRecording[]>>>()
function recordingsStore(attemptId: string) {
  let store = recordingStores.get(attemptId)
  if (!store) {
    store = createUserSessionStore<ExamRecording[]>(`exam-recordings:${attemptId}`, {
      empty: [], fetch: async userId => (await examRequest<{ recordings: ExamRecording[] }>(userId, `/api/exams/attempts/${attemptId}/recordings`)).recordings,
    })
    recordingStores.set(attemptId, store)
  }
  return store
}
// Several speaking tasks can share the parent's boolean callback. One task must
// never clear another task's local blob or pending permission/upload operation.
type PendingEntry = { value: boolean; notify: (value: boolean) => void }
const pendingScopes = new Map<string, Map<symbol, PendingEntry>>()
function publishPending(scope: string) {
  const entries = pendingScopes.get(scope)
  if (!entries) return
  const value = [...entries.values()].some(entry => entry.value)
  entries.forEach(entry => entry.notify(value))
}
function rejectedPreparation(error: unknown) {
  // These responses come from a rolled-back prepare transaction. A matching
  // previously committed request is returned before its version/scope checks.
  return error instanceof ExamRequestError && ['exam_conflict', 'exam_recording_closed', 'exam_recording_limit', 'exam_expired', 'exam_not_found', 'exam_invalid_request', 'exam_invalid_recording'].includes(error.code)
}

export function ExamSpeakingRecorder(props: Props) {
  const { user } = useAuth()
  return user ? <SpeakingRecorder key={`${user.id}:${props.ownerId ?? 'self'}:${props.attemptId}:${props.question.id}`} {...props} userId={user.id} /> : null
}

function SpeakingRecorder({ attemptId, question, answer, disabled, scopeClosed = disabled, version, onChange, onServerChange, onPendingChange, ownerId, userId }: Props & { userId: string }) {
  const { user } = useAuth()
  const store = useMemo(() => recordingsStore(attemptId), [attemptId])
  // Own read-only review can load its list. Admin playback has an explicit owner
  // and uses only the authorized answer IDs; the list API has no admin override.
  const list = store.useSessionData(ownerId ? null : user)
  const [ready, setReady] = useState(false)
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'stopping'>('idle')
  const [blob, setBlob] = useState<Blob | null>(null)
  const [work, setWork] = useState<Work>(null)
  const [error, setError] = useState<unknown>(null)
  const [message, setMessage] = useState('')
  const [pin, setPin] = useState('')
  const [script, setScript] = useState<{ notes: TeacherNote[]; expiresAt: string } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loadingPlayback, setLoadingPlayback] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [scopePending, setScopePending] = useState(false)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const operation = useRef<UploadOperation | null>(null)
  const abandonBodies = useRef(new Map<string, string>())
  const workRef = useRef<Work>(null)
  const recordingRef = useRef<'idle' | 'recording' | 'stopping'>('idle')
  const blobRef = useRef<Blob | null>(null)
  const alive = useRef(true)
  const generation = useRef(0)
  const playbackLock = useRef(false)
  const refreshLock = useRef(false)
  const player = usePlaylistPlayer()
  const playerRef = useRef(player)
  playerRef.current = player
  const playbackUrl = useRef<string | null>(null)
  const latest = useRef({ disabled, version, answer, onChange, onServerChange, onPendingChange, rows: list.data, listLoading: list.isLoading, listError: list.error })
  latest.current = { disabled, version, answer, onChange, onServerChange, onPendingChange, rows: list.data, listLoading: list.isLoading, listError: list.error }
  const path = `/api/exams/attempts/${attemptId}/recordings`
  const pendingKey = `${userId}:${attemptId}`
  const pendingToken = useRef(Symbol('speaking-recorder'))
  const current = (token: number) => alive.current && token === generation.current
  const localMediaPending = () => recordingRef.current !== 'idle' || !!blobRef.current || !!operation.current
  const mediaPending = () => localMediaPending() || latest.current.rows.some(row => row.status === 'uploading')
  const otherTaskPending = () => [...(pendingScopes.get(pendingKey)?.entries() ?? [])].some(([token, entry]) => token !== pendingToken.current && entry.value)
  const pendingValue = () => !ownerId && (mediaPending() || !!workRef.current || refreshLock.current || latest.current.listLoading || !!latest.current.listError)
  function notifyPending() {
    const entry = pendingScopes.get(pendingKey)?.get(pendingToken.current)
    if (entry) { entry.value = pendingValue(); publishPending(pendingKey) }
  }
  function begin(next: Exclude<Work, null>) {
    if (!alive.current || workRef.current || ownerId) return false
    workRef.current = next; setWork(next); setError(null); notifyPending(); return true
  }
  function finish(token: number) {
    if (!current(token)) return
    workRef.current = null; setWork(null); notifyPending()
  }
  function releaseMicrophone() {
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
    if (alive.current) setReady(false)
  }
  function patch(row: ExamRecording) {
    store.patchSessionData(userId, rows => [...rows.filter(item => item.id !== row.id), row].sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
    latest.current.rows = store.getSessionData(userId) ?? []
    notifyPending()
  }
  function clearLocal() {
    operation.current = null; blobRef.current = null
    setActiveId(null); setBlob(null); notifyPending()
  }
  function deselect(id: string | null) {
    const previous = latest.current.answer
    const ids = previous?.type === 'speaking' ? previous.recordingIds.filter(value => value !== id) : []
    if (!latest.current.disabled) latest.current.onChange({ type: 'speaking', recordingIds: ids, abandoned: ids.length === 0 })
  }

  useEffect(() => {
    alive.current = true
    const scope = pendingScopes.get(pendingKey) ?? new Map<symbol, PendingEntry>()
    scope.set(pendingToken.current, { value: pendingValue(), notify: value => {
      if (!alive.current) return
      setScopePending(value); latest.current.onPendingChange?.(value)
    } })
    pendingScopes.set(pendingKey, scope); publishPending(pendingKey)
    return () => {
      alive.current = false; generation.current += 1
      const active = recorder.current
      if (active) {
        active.ondataavailable = null; active.onstop = null; active.onerror = null
        if (active.state !== 'inactive') active.stop()
      }
      stream.current?.getTracks().forEach(track => track.stop())
      playerRef.current.stop()
      if (playbackUrl.current) URL.revokeObjectURL(playbackUrl.current)
      scope.delete(pendingToken.current)
      if (scope.size) publishPending(pendingKey)
      else pendingScopes.delete(pendingKey)
    }
    // This component is keyed by user, owner, attempt and question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { notifyPending() }, [list.data, list.isLoading, list.error, work, blob, recordingState, refreshing, onPendingChange])
  useEffect(() => {
    if (!script) return
    const timer = setTimeout(() => setScript(null), Math.max(0, Date.parse(script.expiresAt) - Date.now()))
    return () => clearTimeout(timer)
  }, [script])
  useEffect(() => {
    if (!scopeClosed) return
    // Never discard the final dataavailable event when permission becomes read-only.
    if (recordingRef.current === 'recording') stopRecording()
    else if (recordingRef.current === 'idle') releaseMicrophone()
    setPin(''); setScript(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeClosed])

  async function refreshStored() {
    if (ownerId || refreshLock.current || workRef.current || localMediaPending()) return
    const token = generation.current
    refreshLock.current = true; setRefreshing(true); setError(null); notifyPending()
    try { await store.refreshInBackground(userId) }
    catch (failure) { if (current(token)) setError(failure) }
    finally { if (current(token)) { refreshLock.current = false; setRefreshing(false); notifyPending() } }
  }
  async function microphone() {
    if (latest.current.disabled || mediaPending() || otherTaskPending() || playbackLock.current || !begin('microphone')) return
    const token = generation.current
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('录音不可用')
      playerRef.current.stop(); releaseMicrophone()
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!current(token) || latest.current.disabled) { acquired.getTracks().forEach(track => track.stop()); return }
      stream.current = acquired; setReady(true); setMessage('麦克风已就绪，可以开始录音。')
    } catch { if (current(token)) setMessage('无法使用麦克风。请允许麦克风权限，或更换支持录音的浏览器。') }
    finally { finish(token) }
  }
  async function prepare(value: UploadOperation, token: number) {
    if (value.row) return value.row
    try {
      const result = await examRequest<RecordingReceipt>(userId, path, { method: 'POST', body: value.body })
      if (!current(token)) return null
      value.row = result.recording; value.rejected = false; setActiveId(result.recording.id); patch(result.recording)
      return result.recording
    } catch (failure) {
      if (current(token) && rejectedPreparation(failure)) value.rejected = true
      throw failure
    }
  }
  async function upload(value: Blob) {
    if (latest.current.disabled || recordingRef.current !== 'idle' || !value.size || !begin('upload')) return
    const token = generation.current
    try {
      if (!operation.current) {
        const expectedVersion = latest.current.version
        const mimeType = value.type.split(';')[0]
        const digest = await crypto.subtle.digest('SHA-256', await value.arrayBuffer())
        if (!current(token)) return
        const sha256 = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
        operation.current = { body: JSON.stringify({ requestId: crypto.randomUUID(), expectedVersion, questionId: question.id, mimeType, sizeBytes: value.size, sha256 }), row: null, blob: value, mimeType, rejected: false }
      }
      const active = operation.current
      // Rebase only a definitively rejected preparation, never an unknown response.
      if (active.rejected && !active.row) {
        const previous = JSON.parse(active.body) as Record<string, unknown>
        if (previous.expectedVersion !== latest.current.version) {
          active.body = JSON.stringify({ ...previous, requestId: crypto.randomUUID(), expectedVersion: latest.current.version }); active.rejected = false
        }
      }
      const row = await prepare(active, token)
      if (!row || !current(token)) return
      if (row.status === 'abandoned') { clearLocal(); setMessage('服务器已放弃本段，请重新录音。'); return }
      if (latest.current.disabled && row.status !== 'complete') { setMessage('当前已暂停作答，录音仍保留。恢复后可重试，或明确放弃本段。'); return }
      const saved = row.status === 'complete' ? row : (await examRequest<RecordingReceipt>(userId, `${path}/${row.id}`, {
        method: 'PUT', body: active.blob, headers: { 'Content-Type': active.mimeType },
      })).recording
      if (!current(token)) return
      active.row = saved; patch(saved)
      if (saved.status !== 'complete') throw new ExamRequestError('exam_recording_incomplete', 409)
      clearLocal()
      if (!latest.current.disabled) latest.current.onChange({ type: 'speaking', recordingIds: [saved.id], abandoned: false })
      setMessage(latest.current.disabled ? '录音已保存，可在已保存录音中回放；恢复作答后可使用。' : '录音已保存；作答进度保存后即可提交。')
    } catch (failure) { if (current(token)) { setError(failure); setMessage('录音仍保留。请重试保存，或明确放弃本段。') } }
    finally { finish(token) }
  }
  function stopRecording() {
    if (recordingRef.current !== 'recording') return
    recordingRef.current = 'stopping'; setRecordingState('stopping'); setMessage('正在结束录音…'); notifyPending()
    if (recorder.current?.state !== 'inactive') recorder.current?.stop()
  }
  function start() {
    if (latest.current.disabled || workRef.current || playbackLock.current || mediaPending() || otherTaskPending() || !stream.current?.getAudioTracks().some(track => track.readyState === 'live')) return
    const token = generation.current
    try {
      playerRef.current.stop()
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type))
      const next = mimeType ? new MediaRecorder(stream.current, { mimeType }) : new MediaRecorder(stream.current)
      const pieces: BlobPart[] = []
      next.ondataavailable = event => { if (current(token) && event.data.size) pieces.push(event.data) }
      next.onstop = () => {
        if (!current(token)) return
        const recorded = new Blob(pieces, { type: next.mimeType })
        recorder.current = null; recordingRef.current = 'idle'; setRecordingState('idle'); releaseMicrophone()
        blobRef.current = recorded; setBlob(recorded); notifyPending()
        if (!recorded.size) setMessage('本段没有录到声音，请放弃该段后重录。')
        else if (latest.current.disabled) setMessage('录音已停止并保留，恢复作答后可重试保存，或明确放弃本段。')
        else void upload(recorded)
      }
      next.onerror = () => { if (current(token)) { setMessage('录音中断，正在保留已有片段。'); stopRecording() } }
      recorder.current = next; next.start(1000)
      recordingRef.current = 'recording'; setRecordingState('recording'); setMessage('正在录音…'); notifyPending()
    } catch (failure) { recorder.current = null; recordingRef.current = 'idle'; setRecordingState('idle'); releaseMicrophone(); setError(failure); notifyPending() }
  }
  async function abandon(local: boolean, id?: string) {
    if (recordingRef.current !== 'idle' || !begin('abandon')) return
    const token = generation.current
    try {
      let row: ExamRecording | null = id ? latest.current.rows.find(item => item.id === id) ?? null : null
      const active = local ? operation.current : null
      if (active) {
        // A missing prepare response is not proof that no server row exists.
        try { row = await prepare(active, token) }
        catch (failure) { if (!rejectedPreparation(failure)) throw failure }
        if (!current(token)) return
      }
      const recordingId = row?.id ?? id ?? null
      if (recordingId && row?.status !== 'complete' && row?.status !== 'abandoned') {
        let body = abandonBodies.current.get(recordingId)
        if (!body) { body = JSON.stringify({ requestId: crypto.randomUUID() }); abandonBodies.current.set(recordingId, body) }
        try {
          row = (await examRequest<RecordingReceipt>(userId, `${path}/${recordingId}/abandon`, { method: 'POST', body })).recording
        } catch (failure) {
          // Upload may have committed just before this abandon. Reconcile its
          // immutable completed status; never claim that the server deleted it.
          if (!(failure instanceof ExamRequestError) || failure.code !== 'exam_recording_closed') throw failure
          await store.refreshInBackground(userId)
          row = store.getSessionData(userId)?.find(item => item.id === recordingId) ?? null
          if (!row || row.status === 'uploading') throw failure
        }
        if (!current(token)) return
      }
      if (row) patch(row)
      if (local) { clearLocal(); deselect(recordingId) }
      else if (recordingId && row?.questionId === question.id) deselect(recordingId)
      if (recordingId) abandonBodies.current.delete(recordingId)
      setMessage(row?.status === 'complete' ? '本段已经保存到服务器，已取消用于本题，可在下方重新选择。' : '已明确放弃本段；其他未完成录音仍需单独处理。')
    } catch (failure) { if (current(token)) setError(failure) }
    finally { finish(token) }
  }
  async function play(id: string) {
    if (playbackLock.current || recordingRef.current !== 'idle' || workRef.current) return
    const token = generation.current
    playbackLock.current = true; setLoadingPlayback(id); setError(null)
    try {
      const audio = await readExamRecordingBlob(userId, `${path}/${id}${ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : ''}`)
      if (!current(token)) return
      playerRef.current.stop()
      if (playbackUrl.current) URL.revokeObjectURL(playbackUrl.current)
      playbackUrl.current = URL.createObjectURL(audio)
      const started = await playerRef.current.playWhenReady({ url: playbackUrl.current, label: ownerId ? '口语录音' : '我的口语录音', mediaType: 'audio', source: null, refLink: null })
      if (current(token) && !started) setMessage('播放已取消，可重新回放。')
    } catch (failure) { if (current(token)) { playerRef.current.stop(); setError(failure) } }
    finally { if (current(token)) { playbackLock.current = false; setLoadingPlayback(null) } }
  }
  async function showScript() {
    if (latest.current.disabled || mediaPending() || otherTaskPending() || latest.current.listLoading || latest.current.listError || refreshLock.current || playbackLock.current || !/^\d{6}$/.test(pin) || !begin('script')) return
    const token = generation.current
    try {
      const result = await examRequest<{ attempt: ExamAttemptView; notes: TeacherNote[]; expiresAt: string }>(userId, `/api/exams/attempts/${attemptId}/speaking-script`, {
        method: 'POST', body: JSON.stringify({ requestId: crypto.randomUUID(), expectedVersion: latest.current.version, pin }),
      })
      if (!current(token) || latest.current.disabled) return
      setPin(''); setScript({ notes: result.notes, expiresAt: result.expiresAt })
      if (!mediaPending()) latest.current.onServerChange()
    } catch (failure) { if (current(token)) setError(failure) }
    finally { finish(token) }
  }

  const stored = list.data.filter(item => item.questionId === question.id)
  const busy = work !== null
  const anyPending = recordingState !== 'idle' || !!blob || !!operation.current || list.data.some(item => item.status === 'uploading')
  const playbackDisabled = busy || recordingState !== 'idle' || loadingPlayback !== null
  const listUncertain = !ownerId && (list.isLoading || !!list.error || refreshing)
  const selectedIds = answer?.type === 'speaking' ? answer.recordingIds : []
  return <Flex direction="column" gap="3">
    {!ownerId && (list.isLoading || refreshing) && <Flex gap="2" align="center" role="status"><Spinner /><Text size="2">读取录音保存状态…</Text></Flex>}
    {!ownerId && list.error != null && <Flex direction="column" gap="2"><Text color="red" role="alert">暂时无法确认录音保存状态，请重新读取。</Text><Flex><Button size="3" variant="soft" disabled={busy || !!blob || recordingState !== 'idle'} loading={refreshing} onClick={() => void refreshStored()}>重新读取录音状态</Button></Flex></Flex>}
    {!ownerId && !disabled && <Flex gap="2" wrap="wrap"><Button size="3" variant="soft" loading={work === 'microphone'} disabled={busy || scopePending || anyPending || listUncertain || !!loadingPlayback} onClick={() => void microphone()}>检查麦克风</Button>
      <Button size="3" disabled={!ready || busy || scopePending || anyPending || listUncertain || !!loadingPlayback} onClick={start}>开始录音</Button></Flex>}
    {recordingState !== 'idle' && <Flex><Button size="3" loading={recordingState === 'stopping'} onClick={stopRecording}>停止并保存录音</Button></Flex>}
    {blob && !ownerId && <Flex gap="2" wrap="wrap"><Button size="3" loading={work === 'upload'} disabled={busy || disabled || !blob.size} onClick={() => void upload(blob)}>重试保存录音</Button><Button size="3" variant="soft" color="red" loading={work === 'abandon'} disabled={busy} onClick={() => void abandon(true)}>放弃本段</Button></Flex>}
    <Text as="p" role="status">{message}</Text>
    {error ? <Text as="p" color="red" role="alert">{examErrorMessage(error)}</Text> : null}
    {selectedIds.map(id => <Flex key={id}><Button size="3" variant="soft" loading={loadingPlayback === id} disabled={playbackDisabled} onClick={() => void play(id)}>回放已保存录音</Button></Flex>)}
    {!ownerId && list.data.filter(item => item.status === 'uploading' && item.id !== activeId).map(item => <Flex key={item.id} direction="column" gap="2">
      <Text as="p" size="2">{item.questionId === question.id ? '本题' : '同一份试卷的其他题目'}有一段上传未完成的录音。此浏览器已没有原录音数据时，可以明确放弃后重录。</Text>
      <Flex><Button size="3" variant="soft" color="red" loading={work === 'abandon'} disabled={busy || recordingState !== 'idle' || !!blob} onClick={() => void abandon(false, item.id)}>放弃这段未完成上传</Button></Flex>
    </Flex>)}
    {!ownerId && stored.filter(item => item.status === 'complete' && !selectedIds.includes(item.id)).map(item => <Flex key={item.id} gap="2" wrap="wrap">
      <Button size="3" variant="soft" loading={loadingPlayback === item.id} disabled={playbackDisabled} onClick={() => void play(item.id)}>试听此前保存的录音</Button>
      {!disabled && <Button size="3" variant="soft" disabled={busy || scopePending || anyPending || listUncertain} onClick={() => latest.current.onChange({ type: 'speaking', recordingIds: [item.id], abandoned: false })}>使用这一段</Button>}
    </Flex>)}
    <PlayerDock appearance="quiet" placement="inline" player={player} showProgress />
    {!ownerId && !disabled && <Flex direction="column" gap="2">
      <Text as="p" size="2">家长验证后，可查看当前 Part 的考官提问脚本。请先保存或明确放弃所有未完成录音。</Text>
      <TextField.Root aria-label="家长 PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={6} disabled={busy || scopePending || anyPending || listUncertain} value={pin} onChange={event => setPin(event.target.value)} />
      <Flex><Button size="3" variant="soft" loading={work === 'script'} disabled={busy || scopePending || anyPending || listUncertain || !!loadingPlayback || !/^\d{6}$/.test(pin)} onClick={() => void showScript()}>查看当前 Part 脚本</Button></Flex>
    </Flex>}
    {script?.notes.map(note => <ExamMaterialBlocks key={note.id} attemptId={attemptId} blocks={note.blocks} audience="parent" />)}
  </Flex>
}
