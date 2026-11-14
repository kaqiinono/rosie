'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@rosie/core'
import { AppDialog, FormSelect, ImageCropper, LoadingOverlay, PageShell, StickerCard, type ImageCropRegion } from '@rosie/ui'
import { Badge, Button, Flex, Text } from '@rosie/ui/themes'
import type { ExamImageCropCommand, ExamImageTask, ExamImageWorkspace } from '../types/imageTasks'
import type { ExamMediaSaveReceipt } from '../types/media'
import { imageCatalogStore, imageRequest, imageTaskError, imageWorkspaceStore, useExamImageBlob } from '../client/imageTasks'
import { ImageQuestionPreview } from '../components/admin/ImageQuestionPreview'

export function AdminExamImagesPage() {
  const { user } = useAuth()
  return user ? <ImagePage key={user.id} user={user} /> : null
}

function ImagePage({ user }: { user: NonNullable<ReturnType<typeof useAuth>['user']> }) {
  const router = useRouter()
  const catalog = imageCatalogStore.useSessionData(user)
  const [revision, setRevision] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [leave, setLeave] = useState<(() => void) | null>(null)
  const [refreshError, setRefreshError] = useState<unknown>(null)
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => { setRevision(new URLSearchParams(window.location.search).get('revisionId') ?? '') }, [])
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
  const select = revision || catalog.data.items[0]?.revisionId || ''
  const guard = (action: () => void) => { if (busy) return; if (dirty) setLeave(() => action); else action() }
  return <PageShell title="图片任务" subtitle="先自动准备图片，审查时只重裁需要调整的部分" width="full" tone="paper"
    onBack={() => guard(() => router.push('/admin/exams'))}>
    <Flex direction="column" gap="4">
      <Flex gap="3" align="end" wrap="wrap">
        <label className="min-w-0 flex-1"><Text as="p" size="2">试卷 / 训练包</Text><FormSelect value={select} disabled={busy || catalog.isLoading}
          options={catalog.data.items.map(item => ({ value: item.revisionId, label: item.title }))}
          onValueChange={value => guard(() => { setDirty(false); setRevision(value); window.history.replaceState(null, '', `?revisionId=${encodeURIComponent(value)}`) })} /></label>
        <Button variant="soft" loading={refreshing} disabled={busy} onClick={() => guard(() => {
          setRefreshing(true); setRefreshError(null)
          void imageCatalogStore.refreshInBackground(user.id).catch(setRefreshError).finally(() => setRefreshing(false))
        })}>刷新试卷列表</Button>
      </Flex>
      {(catalog.error || refreshError) != null && <Text color="red" role="alert">{imageTaskError(catalog.error ?? refreshError)}</Text>}
      <div className="relative min-h-[calc(100dvh-14rem)]">
        <LoadingOverlay visible={catalog.isLoading} placement="content" appearance="quiet" />
        {!catalog.isLoading && !catalog.error && !catalog.data.items.length && <StickerCard>没有可处理的草稿，请先导入试卷。</StickerCard>}
        {!catalog.isLoading && select && <Workspace key={select} user={user} revisionId={select} setDirty={setDirty} setBusy={setBusy} />}
      </div>
    </Flex>
    <AppDialog open={!!leave} title="离开当前裁切？" onOpenChange={open => { if (!open) setLeave(null) }}>
      <Flex direction="column" gap="3"><Text>当前选区或提交结果尚未确认。离开会丢弃本页裁图；已成功保存的绑定会保留。</Text>
        <Flex gap="2"><Button variant="soft" onClick={() => setLeave(null)}>继续编辑</Button><Button onClick={() => { const action = leave; setLeave(null); setDirty(false); action?.() }}>离开</Button></Flex>
      </Flex>
    </AppDialog>
  </PageShell>
}

function Workspace({ user, revisionId, setDirty, setBusy }: {
  user: NonNullable<ReturnType<typeof useAuth>['user']>; revisionId: string
  setDirty: (value: boolean) => void; setBusy: (value: boolean) => void
}) {
  const store = useMemo(() => imageWorkspaceStore(revisionId), [revisionId])
  const { data, isLoading, error } = store.useSessionData(user)
  const [selected, setSelected] = useState('')
  const [filter, setFilter] = useState('todo')
  const [requiredOnly, setRequiredOnly] = useState(false)
  const [dirty, localDirty] = useState(false)
  const [busy, localBusy] = useState(false)
  const [leave, setLeave] = useState<(() => void) | null>(null)
  const [reload, setReload] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<unknown>(null)
  const [deleteTask, setDeleteTask] = useState<ExamImageTask | null>(null)
  const [message, setMessage] = useState('')
  const onDirty = useCallback((value: boolean) => { localDirty(value); setDirty(value) }, [setDirty])
  const onBusy = useCallback((value: boolean) => { localBusy(value); setBusy(value) }, [setBusy])
  useEffect(() => () => { setDirty(false); setBusy(false) }, [setDirty, setBusy])
  const tasks = data?.tasks ?? []
  const live = tasks.filter(task => !task.retired)
  const completed = live.filter(task => task.binding).length
  const filtered = tasks.filter(task => (!requiredOnly || task.slot.required) && (filter === 'retired' ? task.retired
    : !task.retired && (filter === 'all'
      || (filter === 'todo' && task.review?.status !== 'approved')
      || (filter === 'pending' && (!task.review || task.review.status === 'pending'))
      || (filter === 'flagged' && task.review?.status === 'flagged')
      || (filter === 'approved' && task.review?.status === 'approved')
      || (filter === 'done' && !!task.binding) || (filter === 'missing' && !task.binding))))
  const active = filtered.find(task => task.slot.id === selected) ?? filtered[0]
  useEffect(() => { if (!selected && active) setSelected(active.slot.id) }, [selected, active])
  const guard = (action: () => void) => { if (busy) return; if (dirty) setLeave(() => action); else action() }
  const refresh = () => {
    setRefreshing(true); onBusy(true); setRefreshError(null)
    void store.refreshInBackground(user.id).then(() => { onDirty(false); setReload(value => value + 1) }).catch(setRefreshError).finally(() => { setRefreshing(false); onBusy(false) })
  }
  async function saved(receipt: ExamMediaSaveReceipt, slotId: string, region: ImageCropRegion) {
    store.patchSessionData(user.id, previous => previous ? { ...previous, version: receipt.version, bindingRevisionId: receipt.bindingRevisionId,
      tasks: previous.tasks.map(task => task.slot.id === slotId ? { ...task, savedRegion: region, binding: { name: '已保存裁图', reviewed: true },
        review: { status: 'pending', version: task.review?.version ?? null, imageKey: null } } : task) } : previous)
    onDirty(false)
    try { await store.refreshInBackground(user.id) } catch (failure) { setRefreshError(failure) }
  }
  async function retire(task: ExamImageTask, retired: boolean) {
    if (!data || busy) return
    onBusy(true); setMessage(''); setRefreshError(null)
    try {
      const response = await imageRequest(user.id, '/api/admin/exams/images/task', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revisionId, slotId: task.slot.id, expectedVersion: data.version, retired }) })
      const result = await response.json() as { state: string }
      store.patchSessionData(user.id, previous => previous ? { ...previous, tasks: previous.tasks.map(item => item.slot.id === task.slot.id
        ? { ...item, retired, sourceAvailable: !retired && item.sourceAvailable } : item) } : previous)
      onDirty(false); setDeleteTask(null); setSelected('')
      setMessage(!retired ? '任务已恢复。' : result.state === 'retained'
        ? '任务已删除，成品题图和绑定保留。原页仍被其他任务共用，待最后一个任务删除时清理。'
        : result.state === 'cleanup_pending' ? '任务已删除，成品题图和绑定保留。原页清理未完成，请点击“清理临时资源”重试。'
        : '任务及其无其他引用的原页已删除；电子题、成品题图和绑定均保留。')
      await store.refreshInBackground(user.id)
    } catch (failure) { setRefreshError(failure) }
    finally { onBusy(false) }
  }
  async function cleanup() {
    if (busy) return
    onBusy(true); setMessage(''); setRefreshError(null)
    try {
      const response = await imageRequest(user.id, '/api/admin/exams/images/cleanup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revisionId }) })
      const result = await response.json() as { sources: { deleted: number; pending: number }; crops: { deleted: number; retained: number; pending: number; failed: number } }
      setMessage(`已清理原页 ${result.sources.deleted}、无引用临时裁图 ${result.crops.deleted}；保留被引用裁图 ${result.crops.retained}。待处理 ${result.sources.pending + result.crops.pending + result.crops.failed}，可再次清理。`)
    } catch (failure) { setRefreshError(failure) }
    finally { onBusy(false) }
  }
  return <>
    <LoadingOverlay visible={isLoading} placement="content" appearance="quiet" />
    {(error || refreshError) && <Flex gap="3" direction="column"><Text color="red" role="alert">{imageTaskError(error ?? refreshError)}</Text>
      <Button variant="soft" loading={refreshing} disabled={busy} onClick={() => guard(refresh)}>重新读取</Button></Flex>}
    {!isLoading && data && <Flex direction="column" gap="4">
      <Flex gap="3" wrap="wrap" align="center">
        <Badge color="green">已准备图片 {completed} / {live.length}</Badge>
        <Badge color="green">审核通过 {live.filter(task => task.review?.status === 'approved').length}</Badge>
        <Badge color="red">有问题 {live.filter(task => task.review?.status === 'flagged').length}</Badge>
        <Badge color="amber">未审核 {live.filter(task => !task.review || task.review.status === 'pending').length}</Badge>
        <Badge>已删除任务 {tasks.length - live.length}</Badge>
        <Badge color="amber">必需图待补 {tasks.filter(task => task.slot.required && !task.binding).length}</Badge>
        <Button size="2" variant="soft" loading={refreshing} disabled={busy} onClick={() => guard(refresh)}>重新读取任务</Button>
        <Button size="2" variant="soft" disabled={busy} onClick={() => void cleanup()}>清理临时资源</Button>
      </Flex>
      {message && <Text role="status" size="2">{message}</Text>}
      <div className="grid items-start gap-4 xl:grid-cols-[240px_minmax(0,1.15fr)_minmax(0,1fr)]">
        <StickerCard as="aside" size="sm"><Flex direction="column" gap="3">
          <FormSelect ariaLabel="任务状态" value={filter} disabled={busy} options={[
            { value: 'todo', label: '待复核 · 未审核和有问题' }, { value: 'pending', label: '未审核' },
            { value: 'flagged', label: '有问题' }, { value: 'approved', label: '审核通过' },
            { value: 'missing', label: '尚未准备图片' }, { value: 'done', label: '已准备图片' },
            { value: 'all', label: '全部任务' }, { value: 'retired', label: '已删除任务' }]}
            onValueChange={value => guard(() => { onDirty(false); setSelected(''); setFilter(value) })} />
          <Button size="2" variant={requiredOnly ? 'solid' : 'soft'} aria-pressed={requiredOnly} disabled={busy}
            onClick={() => guard(() => { onDirty(false); setSelected(''); setRequiredOnly(value => !value) })}>只看必需图</Button>
          <div className="max-h-[60dvh] overflow-y-auto"><Flex direction="column" gap="3">
            {filtered.map(task => <StickerCard key={task.slot.id} size="sm" tone={active?.slot.id === task.slot.id ? 'info'
              : task.review?.status === 'approved' ? 'success' : task.review?.status === 'flagged' ? 'danger' : 'paper'} elevation="flat">
              <Flex direction="column" gap="2"><Text size="2" weight="bold">{task.label}</Text>
                <Text size="1">Part {task.group?.partNumber ?? '—'} · {task.questionNumbers.length > 6 ? `共享题组（${task.questionNumbers.length}项）` : `题号 ${task.questionNumbers.join('、')}`}</Text>
                <Flex gap="2" wrap="wrap"><Badge>{task.slot.required ? '必需' : '可选'}</Badge><Badge color={task.binding ? 'green' : 'amber'}>{task.binding ? '已准备' : '缺图'}</Badge>
                  <Badge color={task.review?.status === 'approved' ? 'green' : task.review?.status === 'flagged' ? 'red' : 'amber'}>
                    {task.review?.status === 'approved' ? '✓ 审核通过' : task.review?.status === 'flagged' ? '有问题' : '未审核'}
                  </Badge>
                </Flex>
                <Text size="1" color="gray">PDF {task.source?.pdfPage ?? '未标页'} · 印刷 {task.source?.printedPage ?? '无'}</Text>
                <Button size="2" variant="soft" disabled={busy} aria-pressed={active?.slot.id === task.slot.id}
                  onClick={() => guard(() => { onDirty(false); setSelected(task.slot.id) })}>打开任务</Button>
                {task.retired ? <Button size="2" variant="soft" disabled={busy} onClick={() => guard(() => void retire(task, false))}>恢复任务</Button>
                  : <Button size="2" variant="soft" color="red" disabled={busy} onClick={() => guard(() => setDeleteTask(task))}>删除任务与原页</Button>}
              </Flex>
            </StickerCard>)}
            {!filtered.length && <Text size="2">当前筛选下没有任务。</Text>}
          </Flex></div>
        </Flex></StickerCard>
        {active ? <TaskEditor key={`${active.slot.id}:${reload}`} userId={user.id} workspace={data} task={active} locked={busy} onDirty={onDirty} onBusy={onBusy} saved={saved}
          next={() => guard(() => {
            onDirty(false)
            const position = filtered.findIndex(task => task.slot.id === active.slot.id)
            setSelected((filtered[position + 1] ?? filtered[0])?.slot.id ?? active.slot.id)
          })} />
          : <StickerCard>当前筛选下没有待复核任务。可切换“审核通过”或“全部任务”查看图片。</StickerCard>}
      </div>
    </Flex>}
    <AppDialog open={!!leave} title="放弃当前未保存的裁切？" onOpenChange={open => { if (!open) setLeave(null) }}>
      <Flex direction="column" gap="3"><Text>若上次提交结果未知，建议先重试原操作，再切换任务。</Text>
        <Flex gap="2"><Button variant="soft" onClick={() => setLeave(null)}>继续编辑</Button><Button onClick={() => { const action = leave; setLeave(null); onDirty(false); action?.() }}>放弃并继续</Button></Flex>
      </Flex>
    </AppDialog>
    <AppDialog open={!!deleteTask} title="删除裁切任务与原始页面？" closeDisabled={busy} onOpenChange={open => { if (!open) setDeleteTask(null) }}>
      <Flex direction="column" gap="3"><Text>电子题、已提交的题图及图片绑定保留。原书页若还有其他任务共用则暂时保留；最后一个任务删除后清理原页。</Text>
        {!deleteTask?.binding && <Text color="amber">此任务尚无成品题图。删除后仍会缺图，必需图片未补齐时无法发布。</Text>}
        <Text size="2">原页清理后，若要再次裁图，需要重新准备原页。</Text>
        <Flex gap="2"><Button variant="soft" disabled={busy} onClick={() => setDeleteTask(null)}>取消</Button>
          <Button color="red" loading={busy} onClick={() => { if (deleteTask) void retire(deleteTask, true) }}>删除任务并清理原页</Button></Flex>
      </Flex>
    </AppDialog>
  </>
}

function TaskEditor({ userId, workspace, task, locked, onDirty, onBusy, saved, next }: {
  userId: string; workspace: ExamImageWorkspace; task: ExamImageTask; onDirty: (value: boolean) => void; onBusy: (value: boolean) => void
  locked: boolean
  saved: (receipt: ExamMediaSaveReceipt, slotId: string, region: ImageCropRegion) => Promise<void>; next: () => void
}) {
  const params = new URLSearchParams({ revisionId: workspace.revisionId, slotId: task.slot.id }).toString()
  const source = useExamImageBlob(userId, task.sourceAvailable ? `/api/admin/exams/images/source?${params}` : null)
  const current = useExamImageBlob(userId, task.binding ? `/api/exams/media?${params}` : null, workspace.bindingRevisionId ?? '')
  const [preview, setPreview] = useState<Blob | null>(null)
  const [editing, setEditing] = useState(!task.binding)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const mounted = useRef(true)
  const [pending, setPending] = useState<{ command: ExamImageCropCommand; blob: Blob } | null>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!preview) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(preview); setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [preview])
  async function submit(operation: NonNullable<typeof pending>) {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true); onBusy(true); setError(null); setNotice(''); setPending(operation); onDirty(true)
    try {
      const response = await imageRequest(userId, '/api/admin/exams/images/crop', { method: 'POST', body: operation.blob,
        headers: { 'Content-Type': 'image/png', 'X-Exam-Crop': JSON.stringify(operation.command) } })
      const receipt = await response.json() as ExamMediaSaveReceipt & { cleanup?: { failed?: number; pending?: number } }
      if (!mounted.current) return
      setPending(null); setNotice(receipt.cleanup?.failed || receipt.cleanup?.pending
        ? '图片已上传并绑定；部分旧临时裁图尚待清理，可点击“清理临时资源”重试。'
        : '图片已上传并绑定。整卷内容仍需审核后发布。')
      await saved(receipt, task.slot.id, operation.command.region)
      setEditing(false); setPreview(null); onDirty(false)
    } catch (failure) { if (mounted.current) setError(failure) }
    finally { busyRef.current = false; if (mounted.current) { setBusy(false); onBusy(false) } }
  }
  return <>
    <StickerCard as="section" size="md"><Flex direction="column" gap="3">
      <Text size="4" weight="bold">{editing ? '调整选区' : '原书对照'}</Text><Text>{task.label}</Text>
      <Text size="2">PDF 第 {task.source?.pdfPage ?? '—'} 页 · 印刷第 {task.source?.printedPage ?? '—'} 页</Text>
      <Text size="2">Part {task.group?.partNumber ?? '—'} · {task.questionNumbers.length > 10 ? `共享题组，共${task.questionNumbers.length}项，详见右侧题号` : `题号 ${task.questionNumbers.join('、')}`}</Text>
      {!task.binding && !task.source?.region && !task.savedRegion && <Text color="amber" size="2">此图没有参考框，未自动裁切。请按人物名称或题号在原页中框选。</Text>}
      {task.binding && !editing && <Flex direction="column" gap="2">
        <Text size="2">图片已上传并绑定，右侧展示当前成品。没有问题可直接查看下一张，无需再次提交。</Text>
        {!task.retired && <Button variant="soft" disabled={locked || !source.url} onClick={() => setEditing(true)}>图片有误，重新裁切</Button>}
      </Flex>}
      <div className="relative min-h-64">
        <LoadingOverlay visible={source.loading} placement="content" appearance="quiet" />
        {!task.sourceAvailable && <Text role="alert">{task.retired ? '裁切任务已删除。右侧仍可查看电子题与已绑定题图。' : '尚未准备此题原书页。'}</Text>}
        {source.error != null && <Text role="alert" color="red">{imageTaskError(source.error)}</Text>}
        {source.url && !editing && <img src={source.url} alt={`原书 PDF 第 ${task.source?.pdfPage ?? '未知'} 页`} className="h-auto w-full" />}
        {source.url && editing && <ImageCropper imageUrl={source.url} initialRegion={task.savedRegion ?? task.source?.region} saving={busy} disabled={!!pending || locked}
          confirmLabel={task.binding ? '保存重裁并替换图片' : '裁切并上传图片'} onDirtyChange={onDirty} onPreview={setPreview}
          onConfirm={(blob, region) => {
            if (blob.size > 4 * 1024 * 1024) { setError(new Error('exam_image_too_large')); return }
            if (!task.sourceSha256) return
            void submit({ blob, command: { requestId: crypto.randomUUID(), revisionId: workspace.revisionId, slotId: task.slot.id,
              expectedVersion: workspace.version, expectedBindingRevisionId: workspace.bindingRevisionId, sourceSha256: task.sourceSha256, region } })
          }} />}
      </div>
      {error != null && <Text color="red" role="alert">{imageTaskError(error)}</Text>}
      {pending && <Button loading={busy} disabled={locked} variant="soft" onClick={() => void submit(pending)}>重试原提交</Button>}
      {editing && task.binding && !pending && <Button variant="soft" color="gray" disabled={busy || locked} onClick={() => { setEditing(false); setPreview(null); onDirty(false) }}>取消重裁，保留现有图片</Button>}
      <Text size="2" role="status">{notice}</Text>
      <Button variant="soft" disabled={busy || locked} onClick={next}>下一张图片</Button>
      {editing && <Text size="1" color="gray">提交后自动上传并更新绑定；只替换此题图片，历史作答引用保留。</Text>}
    </Flex></StickerCard>
    <StickerCard as="section" size="md"><Flex direction="column" gap="3">
      <Text size="4" weight="bold">电子题预览</Text>
      {current.loading && <Text size="2">正在读取已绑定图片…</Text>}
      {current.error != null && <Text size="2" color="red">已绑定图片暂不可用，可重新裁切。</Text>}
      <ImageQuestionPreview task={task} previewUrl={editing ? previewUrl ?? current.url : current.url} />
    </Flex></StickerCard>
  </>
}
