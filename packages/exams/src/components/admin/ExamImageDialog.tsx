'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@rosie/core'
import { AppDialog, ImageCropper, LoadingOverlay, StickerCard } from '@rosie/ui'
import { Button, Flex, Text } from '@rosie/ui/themes'
import { imageRequest, imageTaskError, imageWorkspaceStore, useExamImageBlob } from '../../client/imageTasks'
import type { ExamMediaSaveReceipt } from '../../types/media'
import type { ExamImageCropCommand } from '../../types/imageTasks'

export function ExamImageDialog({ userId, revisionId, slotId, initialEditing = false, onClose, onSaved }: {
  userId: string; revisionId: string; slotId: string | null; initialEditing?: boolean; onClose: () => void; onSaved: (revisionId: string) => void
}) {
  const store = useMemo(() => imageWorkspaceStore(revisionId), [revisionId])
  const { user } = useAuth()
  const { data, isLoading, error: workspaceError } = store.useSessionData(user)
  const task = data?.tasks.find(item => item.slot.id === slotId)
  const params = task ? new URLSearchParams({ revisionId, slotId: task.slot.id }).toString() : ''
  const source = useExamImageBlob(userId, task?.sourceAvailable ? `/api/admin/exams/images/source?${params}` : null)
  const current = useExamImageBlob(userId, task?.binding ? `/api/exams/media?${params}` : null, data?.bindingRevisionId ?? '')
  const [editing, setEditing] = useState(false)
  const [cropDirty, setCropDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<{ command: ExamImageCropCommand; blob: Blob } | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState('')
  useEffect(() => { if (slotId) void store.refreshInBackground(userId).catch(setError) }, [slotId, store, userId])
  useEffect(() => { setEditing(initialEditing); setCropDirty(false); setPending(null); setError(null); setNotice('') }, [slotId, initialEditing])

  async function submit(operation: NonNullable<typeof pending>) {
    if (busy) return
    setBusy(true); setPending(operation); setError(null)
    try {
      const response = await imageRequest(userId, '/api/admin/exams/images/crop', { method: 'POST', body: operation.blob,
        headers: { 'Content-Type': 'image/png', 'X-Exam-Crop': JSON.stringify(operation.command) } })
      const receipt = await response.json() as ExamMediaSaveReceipt
      setPending(null); setEditing(false); setCropDirty(false); setNotice('图片已保存并绑定。')
      onSaved(receipt.revisionId)
      if (receipt.revisionId === revisionId) {
        try { await store.refreshInBackground(userId) } catch (refreshFailure) { setError(refreshFailure) }
      }
    } catch (failure) { setError(failure) }
    finally { setBusy(false) }
  }

  return <AppDialog open={!!slotId} size="preview" title="原书插图对照与裁切" closeDisabled={busy || !!pending || cropDirty}
    onOpenChange={open => { if (!open) onClose() }}>
    <Flex direction="column" gap="3">
      <LoadingOverlay visible={isLoading} placement="content" appearance="quiet" />
      {(workspaceError || error) != null && <Text color="red" role="alert">{imageTaskError(error ?? workspaceError)}</Text>}
      {task && <>
        <Text weight="bold">{task.label} · 原书 PDF {task.source?.pdfPage ?? '未标页'}</Text>
        <div className="grid gap-4 lg:grid-cols-2">
          <StickerCard size="sm"><Flex direction="column" gap="3"><Text weight="bold">原书页</Text>
            {source.loading && <Text>正在读取原书页…</Text>}
            {!task.sourceAvailable && <Text color="amber">此图片位置尚未准备原书页，需先准备来源页才能裁切。</Text>}
            {source.error != null && <Text color="red">{imageTaskError(source.error)}</Text>}
            {source.url && (editing || !task.binding) && <ImageCropper imageUrl={source.url} initialRegion={task.savedRegion ?? task.source?.region}
              saving={busy} disabled={!!pending} confirmLabel={task.binding ? '保存重裁并替换图片' : '裁切并插图'} onDirtyChange={setCropDirty}
              onConfirm={(blob, region) => {
                if (blob.size > 4 * 1024 * 1024) { setError(new Error('exam_image_too_large')); return }
                if (!data || !task.sourceSha256) return
                void submit({ blob, command: { requestId: crypto.randomUUID(), revisionId, slotId: task.slot.id,
                  expectedVersion: data.version, expectedBindingRevisionId: data.bindingRevisionId, sourceSha256: task.sourceSha256, region } })
              }} />}
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-only authenticated source blob */}
            {source.url && task.binding && !editing && <img src={source.url} alt={`原书 PDF 第 ${task.source?.pdfPage} 页`} className="h-auto w-full" />}
          </Flex></StickerCard>
          <StickerCard size="sm"><Flex direction="column" gap="3"><Text weight="bold">当前电子插图</Text>
            {current.loading && <Text>正在读取成品…</Text>}
            {/* eslint-disable-next-line @next/next/no-img-element -- authenticated finished-image blob */}
            {current.url ? <img src={current.url} alt={task.label} className="h-auto max-w-full" /> : <Text>尚无已保存的图片</Text>}
            {task.binding && !editing && <Button variant="soft" disabled={!source.url || busy} onClick={() => setEditing(true)}>图片有误，重新裁切</Button>}
          </Flex></StickerCard>
        </div>
        {pending && <Flex gap="2"><Button variant="soft" loading={busy} onClick={() => void submit(pending)}>重试原提交</Button>
          {!busy && <Button variant="soft" color="gray" onClick={() => { setPending(null); void store.refreshInBackground(userId).catch(setError) }}>重新读取并放弃本次裁切</Button>}</Flex>}
        {cropDirty && !pending && <Button variant="soft" color="gray" onClick={() => { setCropDirty(false); setEditing(false); onClose() }}>放弃未保存的选区</Button>}
        {notice && <Text role="status">{notice}</Text>}
      </>}
    </Flex>
  </AppDialog>
}
