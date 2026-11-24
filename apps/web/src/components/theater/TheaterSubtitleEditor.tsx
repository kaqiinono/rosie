'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { AppDialog, StickerCard } from '@rosie/ui'
import { AlertDialog, Button, Flex, Text, TextArea } from '@rosie/ui/themes'
import { requestTheater } from '@/lib/theater/client'
import { theaterTime } from '@/lib/theater/subtitle-timeline'
import {
  theaterLanguageLabel, theaterSubtitleLanguages,
  type SubtitleTracks, type TheaterCue, type TheaterSubtitleEdit,
  type TheaterSubtitleRevisionBatch, type TheaterSubtitleRevisionStatus, type TheaterSubtitles,
} from '@/lib/theater/types'

type Props = {
  filmId: string
  userId: string
  tracks: SubtitleTracks
  cue: TheaterCue | null
  closeEditor: () => void
  onTracksChange: (tracks: SubtitleTracks) => void
}

type Operation = 'read' | 'save' | 'sync' | 'delete'
type Confirmation = { kind: 'sync' } | { kind: 'delete'; batchId: string }

export default function TheaterSubtitleEditor({ filmId, userId, tracks, cue, closeEditor, onTracksChange }: Props) {
  const baseUrl = '/api/theater/' + filmId
  const revisionUrl = baseUrl + '/subtitle-revisions'
  const [status, setStatus] = useState<TheaterSubtitleRevisionStatus | null>(null)
  const [busy, setBusy] = useState<Operation | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [confirm, setConfirm] = useState<Confirmation | null>(null)
  const [page, setPage] = useState(0)
  const active = useRef<AbortController | null>(null)

  const run = useCallback(async (operation: Operation, work: (signal: AbortSignal) => Promise<void>) => {
    if (active.current) return
    const controller = new AbortController()
    const { signal } = controller
    active.current = controller
    setBusy(operation)
    setError('')
    setNotice('')
    try {
      await work(signal)
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : '操作未完成，请重试。')
    } finally {
      if (active.current === controller) {
        active.current = null
        setBusy(null)
      }
    }
  }, [])

  const readStatus = useCallback(async (nextPage: number, signal: AbortSignal) => {
    const result = await requestTheater<TheaterSubtitleRevisionStatus>(userId, revisionUrl + '?page=' + nextPage, { signal })
    if (!signal.aborted) {
      setStatus(result)
      setPage(nextPage)
    }
  }, [revisionUrl, userId])

  useEffect(() => {
    void run('read', signal => readStatus(0, signal))
    return () => {
      active.current?.abort()
      active.current = null
    }
  }, [readStatus, run])

  async function refreshTracks(signal: AbortSignal) {
    const result = await requestTheater<TheaterSubtitles>(userId, baseUrl + '/subtitles', { signal })
    if (!signal.aborted) onTracksChange(result.tracks)
  }

  function save(edits: TheaterSubtitleEdit[]) {
    void run('save', async signal => {
      await requestTheater(userId, revisionUrl, { method: 'PATCH', body: JSON.stringify(edits), signal })
      if (signal.aborted) return
      closeEditor()
      setNotice('台词修订已保存。')
      await Promise.all([readStatus(page, signal), refreshTracks(signal)])
    })
  }

  function proceed(action: Confirmation) {
    void run(action.kind, async signal => {
      try {
        await requestTheater(userId, action.kind === 'sync' ? revisionUrl : revisionUrl + '?batchId=' + action.batchId,
          { method: action.kind === 'sync' ? 'POST' : 'DELETE', signal })
      } catch (cause) {
        if (!signal.aborted) await readStatus(page, signal).catch(() => {})
        throw cause
      }
      if (signal.aborted) return
      if (action.kind === 'sync') {
        setNotice('本片台词已同步到百度网盘。')
        await Promise.all([readStatus(0, signal), refreshTracks(signal)])
      } else {
        setNotice('此批已同步修订记录已清理。')
        await readStatus(0, signal)
      }
    })
  }

  const pending = status?.pending
  const issue = error && <Text size="2" role="alert" color="red">{error}</Text>

  return <>
    <Flex gap="2" align="center" wrap="wrap">
      <Button type="button" variant="soft" disabled={!pending || busy !== null}
        loading={busy === 'sync'} onClick={() => setConfirm({ kind: 'sync' })}>同步到百度网盘</Button>
      <Button type="button" variant="ghost" disabled={!status || busy !== null}
        onClick={() => setHistoryOpen(true)}>修订记录{pending ? ' · ' + pending.changes.length + ' 条待同步' : ''}</Button>
    </Flex>
    {!cue && !historyOpen && <>
      {issue}
      {notice && <Text role="status" size="2">{notice}</Text>}
      {error && <Button type="button" variant="ghost" disabled={busy !== null}
        onClick={() => void run('read', async signal => {
          await Promise.all([readStatus(page, signal), refreshTracks(signal)])
        })}>刷新字幕及修订</Button>}
    </>}
    {cue && <CueEditDialog key={cue.id} cue={cue} tracks={tracks} saving={busy === 'save'}
      locked={busy === 'sync' || !!status?.syncStarted} error={error} onSave={save} onClose={closeEditor} />}
    <AppDialog open={historyOpen} onOpenChange={setHistoryOpen} title="台词修订记录" size="form">
      <Flex direction="column" gap="3">
        {issue}
        {notice && <Text role="status" size="2">{notice}</Text>}
        {pending && <RevisionBatch batch={pending} />}
        {status && !pending && !status.history.length && <Text size="2" color="gray">本片暂无修订记录。</Text>}
        {status?.history.map(batch => <RevisionBatch key={batch.id} batch={batch}
          onClear={() => setConfirm({ kind: 'delete', batchId: batch.id })} disabled={busy !== null} />)}
        {(page > 0 || status?.hasMore) && <Flex gap="2" align="center">
          <Button type="button" variant="soft" disabled={page === 0 || busy !== null}
            onClick={() => void run('read', signal => readStatus(page - 1, signal))}>上一页</Button>
          <Text size="2">第 {page + 1} 页</Text>
          <Button type="button" variant="soft" disabled={!status?.hasMore || busy !== null}
            onClick={() => void run('read', signal => readStatus(page + 1, signal))}>下一页</Button>
        </Flex>}
      </Flex>
    </AppDialog>
    <AlertDialog.Root open={confirm !== null} onOpenChange={open => { if (!open) setConfirm(null) }}>
      <AlertDialog.Content maxWidth="28rem">
        <AlertDialog.Title>{confirm?.kind === 'sync' ? '同步台词到百度网盘？' : '清理此批修订记录？'}</AlertDialog.Title>
        <AlertDialog.Description>{confirm?.kind === 'sync'
          ? '本片已保存的修订将一次性更新到网盘里的对应字幕文件。'
          : '清理后将无法回查本批次的修改前后内容。'}</AlertDialog.Description>
        <Flex justify="end" gap="2" mt="4">
          <AlertDialog.Cancel><Button variant="soft" color="gray">取消</Button></AlertDialog.Cancel>
          <AlertDialog.Action><Button color={confirm?.kind === 'delete' ? 'red' : undefined}
            onClick={() => { if (confirm) proceed(confirm) }}>{confirm?.kind === 'sync' ? '确认同步' : '确认清理'}</Button></AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  </>
}

function CueEditDialog({ cue, tracks, saving, locked, error, onClose, onSave }: {
  cue: TheaterCue
  tracks: SubtitleTracks
  saving: boolean
  locked: boolean
  error: string
  onClose: () => void
  onSave: (edits: TheaterSubtitleEdit[]) => void
}) {
  const [edits, setEdits] = useState(() => theaterSubtitleLanguages.flatMap(language =>
    (cue.sourceCues?.[language] ?? []).flatMap(index => {
      const entry = tracks[language]?.[index]
      return entry ? [{ language, index, before: entry.text, text: entry.text, startMs: entry.startMs }] : []
    })))
  const changed = edits.filter(edit => edit.text.trim() !== edit.before)
  function submit(event: FormEvent) {
    event.preventDefault()
    if (saving || locked || !changed.length || changed.some(edit => !edit.text.trim())) return
    onSave(changed.map(({ language, index, before, text }) => ({ language, index, before, text: text.trim() })))
  }

  return <AppDialog open closeDisabled={saving} onOpenChange={open => { if (!open) onClose() }}
    title="编辑台词" description={'播放位置 ' + theaterTime(cue.startMs)} size="form">
    <form onSubmit={submit}>
      <Flex direction="column" gap="3">
        {edits.map((edit, offset) => <Flex direction="column" gap="1" key={edit.language + ':' + edit.index}>
          <Text as="label" size="2" weight="medium" htmlFor={'theater-edit-' + offset}>
            {theaterLanguageLabel[edit.language]} · {theaterTime(edit.startMs)}
          </Text>
          <TextArea id={'theater-edit-' + offset} value={edit.text} disabled={saving || locked} maxLength={1800}
            onChange={event => {
              const text = event.target.value
              setEdits(current => current.map((entry, index) => index === offset ? { ...entry, text } : entry))
            }} />
        </Flex>)}
        {locked && <Text size="2" color="gray">请先完成当前批次的网盘同步，再继续编辑。</Text>}
        {error && <Text size="2" color="red" role="alert">{error}</Text>}
        <Flex justify="end" gap="2">
          <Button type="button" variant="soft" color="gray" disabled={saving} onClick={onClose}>取消</Button>
          <Button type="submit" loading={saving}
            disabled={locked || saving || !changed.length || changed.some(edit => !edit.text.trim())}>保存修订</Button>
        </Flex>
      </Flex>
    </form>
  </AppDialog>
}

function RevisionBatch({ batch, onClear, disabled }: {
  batch: TheaterSubtitleRevisionBatch
  onClear?: () => void
  disabled?: boolean
}) {
  return <StickerCard size="sm" elevation="flat" tone="paper">
    <details>
      <summary>
        <Text size="2" weight="medium">
          {batch.synced_at ? '已同步 · ' + new Date(batch.synced_at).toLocaleString('zh-CN') : '待同步'} · {batch.changes.length} 条
        </Text>
      </summary>
      <Flex direction="column" gap="2" mt="2">
        {batch.changes.map((change, index) => <Flex key={index} direction="column" gap="1">
          <Text size="2" weight="medium">{theaterLanguageLabel[change.language]} · {theaterTime(change.startMs)}</Text>
          <Text size="2" color="gray" className="whitespace-pre-wrap break-words">{'原文 ' + change.before}</Text>
          <Text size="2" className="whitespace-pre-wrap break-words">{'修订 ' + change.text}</Text>
        </Flex>)}
        {onClear && <Flex><Button type="button" size="2" variant="soft" color="red"
          disabled={disabled} onClick={onClear}>清理记录</Button></Flex>}
      </Flex>
    </details>
  </StickerCard>
}
