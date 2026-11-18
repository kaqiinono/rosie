'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ExamMediaEditor, ExamMediaSaveReceipt, ExamMediaSaveRequest } from '@rosie/exams'
import { AppDialog, LoadingOverlay, StickerCard } from '@rosie/ui'
import { Badge, Box, Button, Checkbox, Flex, Grid, Heading, Text, TextField } from '@rosie/ui/themes'
import type { SyncDirectoryList } from '@/app/api/baidu/sync/directories/route'
import type { ExamDraftListItem, ExamPage } from '@/lib/exams/contracts'
import { examListeningParts, isExamAudioFile, matchExamListeningAudio } from '@/lib/exams/listeningMedia'
import { directoryPrefix, type LessonAudioPick } from '@/lib/english-audio-types'
import { DirectoryChooser, type SyncChosenDirectory } from './SyncDirectoryChooser'
import { SyncPending, SyncSelect, useSyncConfirmation } from './SyncControls'
import { examSyncRequest, useExamSyncQuery } from './ExamSyncRequest'
import { EnglishFileList, useEnglishFileInventory } from './EnglishAudioFiles'

type Props = { userId: string; paths: SyncDirectoryList }
type Pick = ExamMediaSaveRequest['picks'][number]
type Update = NonNullable<ExamMediaSaveRequest['updates']>[number]

function subscribeExamMediaLocation() {
  return () => undefined
}

function examMediaLocationSearch() {
  return window.location.search
}

function emptyExamMediaLocationSearch() {
  return ''
}

function readExamMediaLocation(search: string) {
  const params = new URLSearchParams(search)
  const revisionId = params.get('revisionId') ?? ''
  const sectionId = params.get('sectionId')
  const partNumber = params.get('partNumber')
  return {
    revisionId,
    part: sectionId && partNumber ? `${sectionId}:${partNumber}` : '',
    slot: params.get('slotId') ?? '',
  }
}

function Editor({ initial, userId, paths, replace, reload, initialPart, initialSlot }: Props & {
  initial: ExamMediaEditor; initialPart: string; initialSlot: string; replace: (editor: ExamMediaEditor) => void; reload: () => void
}) {
  const [saved, setSaved] = useState(initial)
  const parts = examListeningParts(saved.parts, saved.slots)
  const slots = [...new Map(parts.flatMap(part => part.slots.map(slot => [slot.id, slot] as const))).values()]
  const [main, setMain] = useState<SyncChosenDirectory | null>(() => {
    const directory = initial.mainDirectory
    return directory && directory.generation === paths.generation && paths.directories.some(root => root.id === directory.directory_id)
      ? directory : null
  })
  const [choosing, setChoosing] = useState(!main)
  const [target, setTarget] = useState(() => slots.find(slot => slot.id === initialSlot)?.id
    ?? parts.find(part => initialPart === `${part.sectionId}:${part.partNumber}`)?.slots[0]?.id ?? '')
  const [picks, setPicks] = useState<Record<string, Pick>>({})
  const [updates, setUpdates] = useState<Record<string, Update>>({})
  const [removed, setRemoved] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [matchMessage, setMatchMessage] = useState('')
  const [operation, setOperation] = useState('')
  const [preview, setPreview] = useState<{ slotId: string; name: string } | null>(null)
  const pending = useRef<AbortController | null>(null)
  const fileHeading = useRef<HTMLHeadingElement>(null)
  const retry = useRef<{ key: string; requestId: string } | null>(null)
  const { confirm, dialog } = useSyncConfirmation()
  const inventory = useEnglishFileInventory(userId, paths.generation, slots.length ? main : null)
  useEffect(() => () => pending.current?.abort(), [])
  const busy = Boolean(operation)
  const dirty = Object.keys(picks).length > 0 || Object.keys(updates).length > 0 || removed.length > 0
  const unmatched = slots.filter(slot => !slot.binding && !picks[slot.id])
  const active = slots.find(slot => slot.id === target) ?? unmatched[0]
  const invalidPick = main && Object.values(picks).some(pick => !pick.path.startsWith(directoryPrefix(main.path)))
  const url = '/api/baidu/sync/exams?' + new URLSearchParams({ revisionId: saved.revisionId })
  function autoMatch() {
    if (!inventory.ready || busy) return
    const additions = matchExamListeningAudio(parts, saved.testNumber, inventory.files, picks, removed)
    const count = Object.keys(additions).length
    setPicks(current => ({ ...current, ...additions }))
    setTarget('')
    setMatchMessage(count ? `已匹配 ${count} 条，剩余 ${unmatched.length - count} 条可手动选择。` : '没有可唯一匹配的音轨，请手动选择。')
  }
  function bindFile(file: LessonAudioPick) {
    if (!active || busy || !isExamAudioFile(file.path)) return
    setPicks(current => ({ ...current, [active.id]: { slotId: active.id, fileId: file.file_id, path: file.path, reviewed: false, durationMs: null } }))
    setUpdates(current => { const next = { ...current }; delete next[active.id]; return next })
    setRemoved(current => current.filter(id => id !== active.id))
    setTarget('')
    setMatchMessage('')
    setMessage('')
  }
  function update(slotId: string, patch: Partial<Update>) {
    const slot = saved.slots.find(item => item.id === slotId)
    if (!slot) return
    if (picks[slotId]) setPicks(current => ({ ...current, [slotId]: { ...current[slotId], ...patch } }))
    else setUpdates(current => ({
      ...current,
      [slotId]: {
        ...current[slotId],
        ...patch,
        slotId,
        reviewed: patch.reviewed ?? current[slotId]?.reviewed ?? slot.binding?.reviewed ?? false,
        durationMs: patch.durationMs !== undefined ? patch.durationMs : (current[slotId]?.durationMs ?? slot.binding?.durationMs ?? null),
      },
    }))
  }
  async function save() {
    if (!main || pending.current || !dirty || invalidPick) return
    const payload: Omit<ExamMediaSaveRequest, 'requestId'> = {
      revisionId: saved.revisionId, scope: 'listening', expectedVersion: saved.version, expectedBindingRevisionId: saved.bindingRevisionId,
      accountGeneration: paths.generation, directoryId: main.directory_id, mainPath: main.path,
      picks: Object.values(picks), updates: Object.values(updates), removeSlotIds: removed,
    }
    const key = JSON.stringify(payload)
    if (retry.current?.key !== key) retry.current = { key, requestId: crypto.randomUUID() }
    const controller = new AbortController()
    pending.current = controller
    setOperation('save'); setMessage(''); setMatchMessage('')
    try {
      await examSyncRequest<ExamMediaSaveReceipt>(userId, '/api/baidu/sync/exams', { method: 'PUT', body: { ...payload, requestId: retry.current.requestId }, signal: controller.signal })
      const next = await examSyncRequest<ExamMediaEditor>(userId, url, { signal: controller.signal })
      if (!controller.signal.aborted) {
        setSaved(next); replace(next); setPicks({}); setUpdates({}); setRemoved([]); retry.current = null; setPreview(null)
        setMessage('听力绑定已保存。请试听新音轨并保存核对结果，再审核内容版本。')
      }
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : '保存失败，请重试。')
    } finally {
      if (pending.current === controller) { pending.current = null; if (!controller.signal.aborted) setOperation('') }
    }
  }
  async function showPreview(slot: ExamMediaEditor['slots'][number]) {
    if (!slot.binding || pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setOperation('preview'); setMessage('')
    try {
      await examSyncRequest(userId, '/api/exams/media/session', { method: 'POST', signal: controller.signal })
      if (!controller.signal.aborted) setPreview({ slotId: slot.id, name: slot.binding.name })
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : '预览暂不可用。')
    } finally { if (pending.current === controller) { pending.current = null; if (!controller.signal.aborted) setOperation('') } }
  }
  const previewUrl = preview ? '/api/exams/media?' + new URLSearchParams({ revisionId: saved.revisionId, slotId: preview.slotId }) : ''
  if (!parts.length) return <Text size="2" color="gray">此草稿没有需要绑定的听力音轨。</Text>
  return <Flex direction="column" gap="3" data-sync-dirty={dirty} data-sync-saving={busy}>
    <StickerCard elevation="flat">
      <Flex direction="column" gap="2">
        <Heading as="h3" size="3">本套资源主目录</Heading>
        {main && <Text size="2" className="break-all">{main.path}</Text>}
        {choosing ? <DirectoryChooser userId={userId} paths={paths} initial={main} disabled={busy}
          choose={value => { setMain(value); setChoosing(false); setMatchMessage(''); setMessage('') }} cancel={main ? () => setChoosing(false) : undefined} />
          : <Button variant="soft" disabled={busy} onClick={() => setChoosing(true)}>更换主目录</Button>}
        <Text size="2" color="gray">保存前请选择包含本套已绑定文件的授权目录。</Text>
      </Flex>
    </StickerCard>
    <Grid columns={{ initial: '1', sm: '2' }} gap="3" align="start">
      <StickerCard elevation="flat">
        <Flex direction="column" gap="3">
          <Flex align="center" justify="between" gap="2" wrap="wrap">
            <Heading as="h3" size="3">听力音轨</Heading>
            <Flex align="center" gap="2" wrap="wrap">
              <Text size="2" color="gray">{unmatched.length} 条待匹配</Text>
              <Button size="2" variant="soft" disabled={busy || !main || !inventory.ready || !unmatched.length} onClick={autoMatch}>批量匹配</Button>
            </Flex>
          </Flex>
          {matchMessage && <Text size="2" role="status">{matchMessage}</Text>}
          {parts.map(part => <Flex key={part.partNumber} direction="column" gap="2">
            <Heading as="h4" size="3">{part.label}</Heading>
            {part.slots.map(slot => {
              const removedSlot = removed.includes(slot.id)
              const pick = picks[slot.id]
              const change = updates[slot.id]
              const name = pick?.path.split('/').pop() ?? slot.binding?.name
              const reviewed = pick?.reviewed ?? change?.reviewed ?? slot.binding?.reviewed ?? false
              const duration = pick ? pick.durationMs ?? null : change ? change.durationMs : slot.binding?.durationMs ?? null
              return <StickerCard key={slot.id} tone="paper" elevation="flat" radius="md" size="sm">
                <Flex direction="column" gap="2">
                  <Flex gap="2" wrap="wrap">
                    <Text size="2" weight="bold" className="break-all">{slot.sourceTrackLabel ?? '音轨'}</Text>
                    {slot.required && <Badge color="amber">必需</Badge>}
                  </Flex>
                  <Text size="2" color="gray" className="break-all">{removedSlot ? '保存后解绑' : pick ? `待保存 · ${name}` : name ?? '尚未绑定'}</Text>
                  {slot.segment && <Text size="2" color="gray">片段：{slot.segment.startMs / 1000}–{slot.segment.endMs / 1000} 秒</Text>}
                  <Flex gap="2" wrap="wrap">
                    <Button size="1" variant={active?.id === slot.id ? 'solid' : 'soft'} disabled={busy || !main}
                      aria-label={`${name ? '换绑' : '选文件'} · ${part.label} · ${slot.sourceTrackLabel ?? '音轨'}`}
                      aria-pressed={active?.id === slot.id} onClick={() => { setTarget(slot.id); fileHeading.current?.focus() }}>
                      {name ? '换绑' : '选文件'}
                    </Button>
                    <Button size="1" variant="soft" disabled={busy || !slot.binding || Boolean(pick) || removedSlot} onClick={() => void showPreview(slot)}>试听</Button>
                    {(slot.binding || pick) && <Button size="1" variant="soft" color="gray" disabled={busy} onClick={() => {
                      setMatchMessage('')
                      setPicks(current => { const next = { ...current }; delete next[slot.id]; return next })
                      setUpdates(current => { const next = { ...current }; delete next[slot.id]; return next })
                      setRemoved(current => removedSlot ? current.filter(id => id !== slot.id) : slot.binding ? [...current, slot.id] : current)
                    }}>{removedSlot ? '撤销解绑' : slot.binding ? '解绑' : '撤销匹配'}</Button>}
                  </Flex>
                  {!removedSlot && (slot.binding || pick) && <>
                    <Text as="label" size="2"><Flex gap="2" align="center"><Checkbox checked={reviewed} disabled={busy || Boolean(pick)} onCheckedChange={value => update(slot.id, { reviewed: value === true })} />已核对文件内容与可见范围</Flex></Text>
                    {slot.purpose === 'exam_listening' && <Flex direction="column" gap="1">
                      <Text as="label" size="2" htmlFor={`exam-duration-${part.partNumber}-${slot.id}`}>整轨时长（秒）</Text>
                      <TextField.Root id={`exam-duration-${part.partNumber}-${slot.id}`} type="number" min="0.001" max="86400" step="0.001" value={duration === null ? '' : duration / 1000}
                        disabled={busy} onChange={event => {
                          const milliseconds = event.target.value === '' ? null : Math.round(Number(event.target.value) * 1000)
                          if (milliseconds === null || (Number.isSafeInteger(milliseconds) && milliseconds > 0 && milliseconds <= 86_400_000)) update(slot.id, { durationMs: milliseconds })
                        }} />
                    </Flex>}
                  </>}
                </Flex>
              </StickerCard>
            })}
          </Flex>)}
        </Flex>
      </StickerCard>
      <StickerCard elevation="flat">
        <Flex direction="column" gap="2">
          <Heading ref={fileHeading} as="h3" size="3" tabIndex={-1}>网盘音频</Heading>
          {main ? <>
            {active && <Text size="2" role="status">正在匹配 · {parts.find(part => part.slotIds.includes(active.id))?.label} · {active.sourceTrackLabel ?? '音轨'}</Text>}
            <EnglishFileList key={JSON.stringify(main)} main={main}
              inventory={{ ...inventory, files: inventory.files.filter(file => file.fileId && isExamAudioFile(file.name)) }}
              disabled={busy || !active} choose={bindFile} />
          </> : <Text size="2" color="gray">选择授权主目录后读取音频。</Text>}
        </Flex>
      </StickerCard>
    </Grid>
    {invalidPick && <Text size="2" color="red" role="alert">有待保存音轨位于主目录外，请重新匹配或撤销。</Text>}
    <Flex gap="2" wrap="wrap">
      <Button loading={operation === 'save'} disabled={busy || !dirty || !main || Boolean(invalidPick)} onClick={() => void save()}>保存本卷听力绑定</Button>
      <Button variant="soft" disabled={busy} onClick={() => { if (dirty) confirm('放弃尚未保存的资源修改并重新读取？', reload); else reload() }}>重新读取</Button>
    </Flex>
    {message && !preview && <Text size="2" role="status">{message}</Text>}
    <AppDialog open={Boolean(preview)} onOpenChange={open => { if (!open) { setPreview(null); setMessage('') } }} title="试听音轨" description={preview?.name} size="preview">
      {preview && <audio controls preload="metadata" src={previewUrl} className="w-full" onError={() => setMessage('试听失败，请检查共享授权、文件位置和绑定。')} />}
      {message && <Text size="2" color="red" role="alert">{message}</Text>}
    </AppDialog>
    {dialog}
  </Flex>
}

export default function ExamsMediaManager({ userId, paths }: Props) {
  const [page, setPage] = useState(1)
  const [source, setSource] = useState('')
  const locationSearch = useSyncExternalStore(subscribeExamMediaLocation, examMediaLocationSearch, emptyExamMediaLocationSearch)
  const location = readExamMediaLocation(locationSearch)
  const [selectedOverride, setSelected] = useState<string | null>(null)
  const selected = selectedOverride ?? location.revisionId
  const [reloadKey, setReloadKey] = useState(0)
  const section = useRef<HTMLDivElement>(null)
  const { confirm, dialog } = useSyncConfirmation()
  const catalog = useExamSyncQuery<ExamPage<ExamDraftListItem>>(userId, `/api/baidu/sync/exams?page=${page}&pageSize=100`)
  const editor = useExamSyncQuery<ExamMediaEditor>(userId, selected ? '/api/baidu/sync/exams?' + new URLSearchParams({ revisionId: selected }) : '')
  const items = catalog.data?.items ?? []
  const sources = [...new Map(items.map(item => [item.source.id, item.source.title])).entries()]
  function change(action: () => void) {
    if (section.current?.querySelector('[data-sync-saving="true"]')) return
    if (section.current?.querySelector('[data-sync-dirty="true"]')) confirm('放弃此版本尚未保存的资源修改？', action)
    else action()
  }
  return <Flex ref={section} direction="column" gap="3" role="region" aria-label="考试资源同步">
    <Heading as="h2" size="4">考试资源同步</Heading>
    {catalog.loading && <Box className="relative min-h-48"><LoadingOverlay visible placement="content" /></Box>}
    {catalog.error && <Text size="2" color="red" role="alert">{catalog.error}</Text>}
    <Flex gap="2"><Button size="1" variant="soft" loading={catalog.refreshing} onClick={() => void catalog.refresh().catch(() => undefined)}>刷新草稿目录</Button></Flex>
    {catalog.data && <>
      {!items.length && <Text size="2" color="gray">暂无可绑定资源的草稿，请先在考试管理创建或导入内容。</Text>}
      <Grid columns={{ initial: '1', sm: '2' }} gap="2">
        <SyncSelect label="来源" value={source} empty="全部来源" options={sources.map(([value, label]) => ({ value, label }))} onValueChange={value => change(() => { setSource(value); setSelected('') })} />
        <SyncSelect label="试卷 / 训练单元 · 草稿版本" value={selected} empty="选择草稿" options={items.filter(item => !source || item.source.id === source).map(item => ({ value: item.revisionId, label: `${item.title} · v${item.revision}` }))}
          onValueChange={value => change(() => setSelected(value))} />
      </Grid>
      {(page > 1 || catalog.data.hasMore) && <Flex gap="2">
        <Button size="1" variant="soft" disabled={page === 1} onClick={() => change(() => setPage(value => value - 1))}>上一页</Button>
        <Button size="1" variant="soft" disabled={!catalog.data.hasMore} onClick={() => change(() => setPage(value => value + 1))}>下一页</Button>
      </Flex>}
    </>}
    {editor.loading && <SyncPending>正在读取本套资源…</SyncPending>}
    {editor.error && <Text size="2" color="red" role="alert">{editor.error}</Text>}
    {editor.data && <Editor key={`${selected}:${reloadKey}`} initial={editor.data} initialPart={location.revisionId === selected ? location.part : ''} initialSlot={location.revisionId === selected ? location.slot : ''} userId={userId} paths={paths} replace={editor.replace}
      reload={() => { void editor.refresh().then(() => setReloadKey(value => value + 1)).catch(() => undefined) }} />}
    {dialog}
  </Flex>
}
