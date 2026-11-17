'use client'

import { useMemo } from 'react'
import { useAuth } from '@rosie/core'
import { Flex, Text } from '@rosie/ui/themes'
import { imageWorkspaceStore, useExamImageBlob } from '../../client/imageTasks'
import { SourcePageViewer } from './SourcePageViewer'

export function ExamSourcePage({ userId, revisionId, title, page, showTitle = true }: {
  userId: string; revisionId: string; title: string; page: number; showTitle?: boolean
}) {
  const { user } = useAuth()
  const store = useMemo(() => imageWorkspaceStore(revisionId), [revisionId])
  const { data } = store.useSessionData(user)
  const task = data?.tasks.find(item => item.sourceAvailable && item.source?.pdfPage === page)
  const params = task ? new URLSearchParams({ revisionId, slotId: task.slot.id }).toString() : ''
  const source = useExamImageBlob(userId, task ? `/api/admin/exams/images/source?${params}` : null)
  if (!task) return <SourcePageViewer title={title} initialPage={page} />
  return <Flex direction="column" gap="3">
    {showTitle && <Text weight="bold">原书 PDF 第 {page} 页</Text>}
    {source.loading && <Text>正在读取原书页…</Text>}
    {source.error != null && <Text color="red">原书页暂不可用，请重新打开或使用本机 PDF 对照。</Text>}
    {/* eslint-disable-next-line @next/next/no-img-element -- admin-only authenticated source blob */}
    {source.url && <img src={source.url} alt={`原书 PDF 第 ${page} 页`} className="h-auto w-full" />}
    {source.error != null && <SourcePageViewer title={title} initialPage={page} />}
  </Flex>
}
