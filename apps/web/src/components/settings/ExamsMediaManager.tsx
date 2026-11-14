'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ExamMediaEditor, ExamMediaSaveReceipt, ExamMediaSaveRequest, MediaSlot } from '@rosie/exams'
import { AppDialog, LoadingOverlay, StickerCard } from '@rosie/ui'
import { Badge, Box, Button, Checkbox, Flex, Grid, Heading, Text, TextField } from '@rosie/ui/themes'
import type { SyncDirectoryList } from '@/app/api/baidu/sync/directories/route'
import type { ExamDraftListItem, ExamPage } from '@/lib/exams/contracts'
import { DirectoryChooser, type SyncChosenDirectory } from './SyncDirectoryChooser'
import { SyncPending, SyncSelect, useSyncConfirmation } from './SyncControls'
import { examSyncRequest, useExamSyncQuery } from './ExamSyncRequest'
import ExamMediaFiles from './ExamMediaFiles'

type Props = { userId: string; paths: SyncDirectoryList }
type Pick = ExamMediaSaveRequest['picks'][number]
type Update = NonNullable<ExamMediaSaveRequest['updates']>[number]
const purposes: Record<MediaSlot['purpose'], string> = {
  exam_listening: '正式听力', training_audio: '训练音频', question_image: '学生题图',
  speaking_example: '口语示范', solution_image: '解析图片', examiner_audio: '考官音频',
  examiner_image: '考官图卡', source_page: '私有来源页',
}

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

function accepts(slot: MediaSlot, path: string) {
  if (['exam_listening', 'training_audio', 'speaking_example', 'examiner_audio'].includes(slot.purpose)) return /\.(mp3|m4a|aac|wav|ogg)$/i.test(path)
  return /\.(png|jpe?g|webp|gif)$/i.test(path) || (slot.purpose === 'source_page' && /\.pdf$/i.test(path))
}

function Editor({ initial, userId, paths, replace, reload, initialPart, initialSlot }: Props & {
  initial: ExamMediaEditor; initialPart: string; initialSlot: string; replace: (editor: ExamMediaEditor) => void; reload: () => void
}) {
  const [saved, setSaved] = useState(initial)
  const [partKey, setPartKey] = useState(() => initialPart || (initial.parts[0] ? `${initial.parts[0].sectionId}:${initial.parts[0].partNumber}` : ''))
  const part = saved.parts.find(item => `${item.sectionId}:${item.partNumber}` === partKey)
  const assigned = new Set(saved.parts.flatMap(item => [...item.slotIds]))
  const visibleSlots = saved.slots.filter(slot => partKey ? part?.slotIds.includes(slot.id) : !assigned.has(slot.id))
  const scopeLabel = part?.label ?? (partKey ? '指定 Part 不存在，请重新选择' : '整套共享资源')
  const [main, setMain] = useState<SyncChosenDirectory | null>(null)
  const [choosing, setChoosing] = useState(true)
  const [mainDirty, setMainDirty] = useState(false)
  const [target, setTarget] = useState(initialSlot || visibleSlots[0]?.id || '')
  const [picks, setPicks] = useState<Record<string, Pick>>({})
  const [updates, setUpdates] = useState<Record<string, Update>>({})
  const [removed, setRemoved] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [operation, setOperation] = useState('')
  const [preview, setPreview] = useState<{ slot: MediaSlot; name: string } | null>(null)
  const pending = useRef<AbortController | null>(null)
  const retry = useRef<{ key: string; requestId: string } | null>(null)
  const { confirm, dialog } = useSyncConfirmation()
  useEffect(() => () => pending.current?.abort(), [])
  const busy = Boolean(operation)
  const dirty = mainDirty || Object.keys(picks).length > 0 || Object.keys(updates).length > 0 || removed.length > 0
  const active = visibleSlots.find(slot => slot.id === target)
  const url = '/api/baidu/sync/exams?' + new URLSearchParams({ revisionId: saved.revisionId })
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
    if (!main || pending.current || (partKey && !part)) return
    const payload = {
      revisionId: saved.revisionId, scope: part ? { sectionId: part.sectionId, partNumber: part.partNumber } : null, expectedVersion: saved.version, expectedBindingRevisionId: saved.bindingRevisionId,
      accountGeneration: paths.generation, directoryId: main.directory_id, mainPath: main.path,
      picks: Object.values(picks), updates: Object.values(updates), removeSlotIds: removed,
    }
    const key = JSON.stringify(payload)
    if (retry.current?.key !== key) retry.current = { key, requestId: crypto.randomUUID() }
    const controller = new AbortController()
    pending.current = controller
    setOperation('save'); setMessage('')
    try {
      await examSyncRequest<ExamMediaSaveReceipt>(userId, '/api/baidu/sync/exams', { method: 'PUT', body: { ...payload, requestId: retry.current.requestId }, signal: controller.signal })
      const next = await examSyncRequest<ExamMediaEditor>(userId, url, { signal: controller.signal })
      if (!controller.signal.aborted) {
        setSaved(next); replace(next); setPicks({}); setUpdates({}); setRemoved([]); setMainDirty(false); retry.current = null; setPreview(null)
        setMessage('资源绑定已保存；内容版本已更新，请回管理页重新审核。')
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
      if (!controller.signal.aborted) setPreview({ slot, name: slot.binding.name })
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : '预览暂不可用。')
    } finally { if (pending.current === controller) { pending.current = null; if (!controller.signal.aborted) setOperation('') } }
  }
  const previewUrl = preview ? '/api/exams/media?' + new URLSearchParams({ revisionId: saved.revisionId, slotId: preview.slot.id }) : ''
  return <Flex direction="column" gap="3" data-sync-dirty={dirty} data-sync-saving={busy}>
    <SyncSelect label="绑定范围" value={partKey} disabled={busy} empty="整套共享资源" options={saved.parts.map(item => ({ value: `${item.sectionId}:${item.partNumber}`, label: item.label }))}
      onValueChange={value => {
        if (busy) return
        const select = () => {
          setPartKey(value); setPicks({}); setUpdates({}); setRemoved([]); setPreview(null); retry.current = null
          const next = saved.parts.find(item => `${item.sectionId}:${item.partNumber}` === value)
          setTarget(saved.slots.find(slot => value ? next?.slotIds.includes(slot.id) : !assigned.has(slot.id))?.id ?? '')
          setMessage('')
        }
        if (Object.keys(picks).length || Object.keys(updates).length || removed.length) confirm('切换 Part 会放弃尚未保存的资源修改，是否继续？', select)
        else select()
      }} />
    <Heading as="h3" size="4">{scopeLabel}</Heading>
    {initialSlot && !active && <Text size="2" color="gray">请选择当前 Part 中要绑定的音轨或图片。</Text>}
    <StickerCard tone="info" elevation="flat">
      <Text as="p" size="2">先保存待核对绑定，再试听或查看已保存文件，核对后勾选审核。来源页仅管理员可见。不同可见范围请预先裁剪成独立文件；播放片段不等于安全裁剪。</Text>
    </StickerCard>
    <StickerCard elevation="flat">
      <Flex direction="column" gap="2">
        <Heading as="h3" size="3">本套资源主目录</Heading>
        {main && <Text size="2" className="break-all">{main.path}</Text>}
        {choosing ? <DirectoryChooser userId={userId} paths={paths} initial={main} disabled={busy}
          choose={value => { setMain(value); setMainDirty(true); setChoosing(false) }} cancel={main ? () => setChoosing(false) : undefined} />
          : <Button variant="soft" disabled={busy} onClick={() => setChoosing(true)}>更换主目录</Button>}
        <Text size="2" color="gray">保存前请选择包含本套已绑定文件的授权目录。</Text>
      </Flex>
    </StickerCard>
    <Grid columns={{ initial: '1', sm: '2' }} gap="3" align="start">
      <StickerCard elevation="flat">
        <Flex direction="column" gap="3">
          <Heading as="h3" size="3">资源槽位</Heading>
          {!visibleSlots.length && <Text size="2" color="gray">当前范围没有资源槽位，请选择其他 Part 或整套共享资源。</Text>}
          {visibleSlots.map(slot => {
            const removedSlot = removed.includes(slot.id)
            const pick = picks[slot.id]
            const change = updates[slot.id]
            const name = pick?.path.split('/').pop() ?? slot.binding?.name
            const reviewed = pick?.reviewed ?? change?.reviewed ?? slot.binding?.reviewed ?? false
            const duration = pick ? pick.durationMs ?? null : change ? change.durationMs : slot.binding?.durationMs ?? null
            return <StickerCard key={slot.id} tone="paper" elevation="flat" radius="md" size="sm">
              <Flex direction="column" gap="2">
                <Flex gap="2" wrap="wrap"><Badge>{scopeLabel}</Badge><Badge>{purposes[slot.purpose]}</Badge>{slot.required && <Badge color="amber">必需</Badge>}</Flex>
                <Text size="2" weight="bold" className="break-all">{slot.sourceTrackLabel ?? slot.id}</Text>
                <Text size="2" color="gray">{removedSlot ? '保存后解绑' : name ?? '尚未绑定'}</Text>
                {slot.segment && <Text size="2" color="gray">片段：{slot.segment.startMs / 1000}–{slot.segment.endMs / 1000} 秒</Text>}
                <Flex gap="2" wrap="wrap">
                  <Button size="1" variant={target === slot.id ? 'solid' : 'soft'} disabled={busy} aria-pressed={target === slot.id} onClick={() => setTarget(slot.id)}>选择文件</Button>
                  <Button size="1" variant="soft" disabled={busy || !slot.binding || Boolean(pick) || removedSlot} onClick={() => void showPreview(slot)}>预览已保存文件</Button>
                  <Button size="1" variant="soft" color="gray" disabled={busy || (!slot.binding && !pick)} onClick={() => {
                    setPicks(current => { const next = { ...current }; delete next[slot.id]; return next })
                    setUpdates(current => { const next = { ...current }; delete next[slot.id]; return next })
                    setRemoved(current => current.includes(slot.id) ? current : [...current, slot.id])
                  }}>解绑</Button>
                </Flex>
                {!removedSlot && (slot.binding || pick) && <>
                  <Text as="label" size="2"><Flex gap="2" align="center"><Checkbox checked={reviewed} disabled={busy || Boolean(pick)} onCheckedChange={value => update(slot.id, { reviewed: value === true })} />已核对文件内容与可见范围</Flex></Text>
                  {slot.purpose === 'exam_listening' && <Flex direction="column" gap="1">
                    <Text as="label" size="2" htmlFor={`exam-duration-${slot.id}`}>整轨时长（秒；按实际音频填写）</Text>
                    <TextField.Root id={`exam-duration-${slot.id}`} type="number" min="0.001" step="0.001" value={duration === null ? '' : duration / 1000}
                      disabled={busy} onChange={event => {
                        const milliseconds = event.target.value === '' ? null : Math.round(Number(event.target.value) * 1000)
                        if (milliseconds === null || (Number.isFinite(milliseconds) && milliseconds > 0)) update(slot.id, { durationMs: milliseconds })
                      }} />
                  </Flex>}
                </>}
              </Flex>
            </StickerCard>
          })}
        </Flex>
      </StickerCard>
      <StickerCard elevation="flat">
        <Flex direction="column" gap="2">
          <Heading as="h3" size="3">目录文件</Heading>
          {active && <Text size="2">正在选择：{active.sourceTrackLabel ?? active.id}</Text>}
          {main ? <ExamMediaFiles key={JSON.stringify(main)} userId={userId} generation={paths.generation} main={main} disabled={busy || !active}
            choose={file => {
              if (!active || !accepts(active, file.name)) { setMessage('文件类型不适合当前槽位，请选择对应音频、图片或来源 PDF。'); return }
              setPicks(current => ({ ...current, [active.id]: { slotId: active.id, fileId: file.id, path: file.path, reviewed: false, durationMs: null } }))
              setUpdates(current => { const next = { ...current }; delete next[active.id]; return next })
              setRemoved(current => current.filter(id => id !== active.id)); setMessage('请先保存，再预览核对新文件。')
            }} /> : <Text size="2" color="gray">选择主目录后浏览文件。</Text>}
        </Flex>
      </StickerCard>
    </Grid>
    <Flex gap="2" wrap="wrap">
      <Button loading={operation === 'save'} disabled={busy || !dirty || !main || (!!partKey && !part)} onClick={() => void save()}>{part ? `保存 ${part.label} 资源` : '保存整套共享资源'}</Button>
      <Button variant="soft" disabled={busy} onClick={() => { if (dirty) confirm('放弃尚未保存的资源修改并重新读取？', reload); else reload() }}>重新读取</Button>
    </Flex>
    {message && <Text size="2" role="status" aria-live="polite">{message}</Text>}
    <AppDialog open={Boolean(preview)} onOpenChange={open => { if (!open) setPreview(null) }} title="资源对照" description={preview?.name} size="preview">
      {preview && (/\.(mp3|m4a|aac|wav|ogg)$/i.test(preview.name)
        ? <audio controls preload="metadata" src={previewUrl} className="w-full" onError={() => setMessage('预览失败，请检查共享授权、文件位置和绑定。')} />
        : <iframe title="已保存的私有资源" src={previewUrl} className="h-[65vh] w-full" />)}
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
    <Flex gap="2"><Badge>KET for Schools</Badge><Button size="1" variant="soft" loading={catalog.refreshing} onClick={() => void catalog.refresh().catch(() => undefined)}>刷新草稿目录</Button></Flex>
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
