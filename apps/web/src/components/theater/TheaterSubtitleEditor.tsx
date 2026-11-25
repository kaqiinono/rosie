'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppDialog, StickerCard } from '@rosie/ui'
import { AlertDialog, Button, Flex, Text } from '@rosie/ui/themes'
import { requestTheater } from '@/lib/theater/client'
import { subtitleTimestamp, theaterSubtitleShortcut, theaterTime } from '@/lib/theater/subtitle-timeline'
import {
  theaterLanguageLabel, type SubtitleTracks, type TheaterCueShortcut, type TheaterLanguage,
  type TheaterSubtitleEdit, type TheaterSubtitleSplice,
  type TheaterSubtitleRevisionBatch, type TheaterSubtitleRevisionStatus, type TheaterSubtitles, type TheaterSubtitleSelection,
} from '@/lib/theater/types'
import TheaterCueEditDialog, { type SubtitleEditorPlayback } from './TheaterCueEditDialog'

export type SubtitleListEditing = {
  locked: boolean
  applyShortcut: (language: TheaterLanguage, index: number, action: TheaterCueShortcut) => void
}

type Props = {
  filmId: string
  userId: string
  tracks: SubtitleTracks
  selection: TheaterSubtitleSelection | null
  editor: NonNullable<TheaterSubtitles['editor']>
  playback: SubtitleEditorPlayback
  openInsert: () => void
  closeEditor: () => void
  onTracksChange: (subtitles: TheaterSubtitles) => void
  renderList: (editing: SubtitleListEditing) => ReactNode
}

type Operation = 'read' | 'save' | 'sync' | 'delete'
type Confirmation = { kind: 'sync' } | { kind: 'delete'; batchId: string }

export default function TheaterSubtitleEditor({
  filmId, userId, tracks, selection, editor, playback, openInsert, closeEditor, onTracksChange, renderList,
}: Props) {
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
    if (!signal.aborted) onTracksChange(result)
  }

  function save(edit: TheaterSubtitleEdit | TheaterSubtitleSplice, fromDialog: boolean) {
    void run('save', async signal => {
      await requestTheater(userId, revisionUrl, { method: 'PATCH', body: JSON.stringify({ version: editor.version, edits: [edit] }), signal })
      const results = await Promise.allSettled([refreshTracks(signal), readStatus(page, signal)])
      if (!signal.aborted) {
        if (fromDialog) closeEditor()
        setNotice('台词修订已保存。')
      }
      const failed = results.find(result => result.status === 'rejected')
      if (failed?.status === 'rejected') throw failed.reason
    })
  }

  function applyShortcut(language: TheaterLanguage, index: number, action: TheaterCueShortcut) {
    if (active.current || status?.syncStarted) return
    const track = tracks[language]
    const step = editor.precision[language]
    if (!track || !step) return
    const edit = theaterSubtitleShortcut(track, language, index, action, step, playback.position())
    if (!edit || edit.after.some(entry => !entry.text || entry.text.length > 1800)) {
      setNotice('')
      setError('无法直接完成这项操作。点击铅笔调整台词后再保存。')
      return
    }
    save(edit, false)
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
      <Button type="button" variant="soft" disabled={!Object.keys(editor.precision).length || busy !== null || !!status?.syncStarted}
        onClick={openInsert}>插入新句</Button>
      <Button type="button" variant="soft" disabled={!pending || busy !== null}
        loading={busy === 'sync'} onClick={() => setConfirm({ kind: 'sync' })}>同步到百度网盘</Button>
      <Button type="button" variant="ghost" disabled={!status || busy !== null}
        onClick={() => setHistoryOpen(true)}>修订记录{pending ? ' · ' + pending.changes.length + ' 条待同步' : ''}</Button>
    </Flex>
    {!selection && !historyOpen && <>
      {issue}
      {busy === 'save' && <Text role="status" size="2">正在保存台词…</Text>}
      {notice && <Text role="status" size="2">{notice}</Text>}
      {error && <Button type="button" variant="ghost" disabled={busy !== null}
        onClick={() => void run('read', async signal => {
          await Promise.all([readStatus(page, signal), refreshTracks(signal)])
        })}>刷新字幕及修订</Button>}
    </>}
    {renderList({ locked: busy !== null || !!status?.syncStarted, applyShortcut })}
    {selection && <TheaterCueEditDialog key={selection === 'insert' ? selection : selection.id}
      selection={selection} tracks={tracks} precision={editor.precision} playback={playback} saving={busy === 'save'}
      waiting={busy === 'read' || busy === 'delete'}
      locked={busy === 'sync' || !!status?.syncStarted} error={error} onSave={edit => save(edit, true)} onClose={closeEditor} />}
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
          {'kind' in change ? <>
            <Text size="2" weight="medium">{change.before.length === 0 ? '插入新句' : change.after.length === 0
              ? '删除句子' : change.after.length === 2 ? '拆分句子' : '合并句子'}</Text>
            {[change.before, change.after].map((entries, group) => entries.map((entry, offset) =>
              <Text key={group + ':' + offset} size="2" color={group === 0 ? 'gray' : undefined}
                className="whitespace-pre-wrap wrap-break-word">
                {group === 0 ? '原文 ' : '修订 '}{subtitleTimestamp(entry.startMs)} – {subtitleTimestamp(entry.endMs)}{'\n'}{entry.text}
              </Text>))}
          </> : <>
            <Text size="2" color="gray" className="whitespace-pre-wrap break-words">{'原文 ' + change.before}</Text>
            <Text size="2" className="whitespace-pre-wrap break-words">{'修订 ' + change.text}</Text>
          </>}
        </Flex>)}
        {onClear && <Flex><Button type="button" size="2" variant="soft" color="red"
          disabled={disabled} onClick={onClear}>清理记录</Button></Flex>}
      </Flex>
    </details>
  </StickerCard>
}
