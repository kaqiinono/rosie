import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { KetPracticePage } from '@rosie/exams'

export const metadata: Metadata = {
  title: 'KET 专项练习',
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  if (Object.keys(params).some(key => !['revisionId', 'wordReviewBatchId'].includes(key))) notFound()
  const { revisionId, wordReviewBatchId } = params
  if (revisionId !== undefined && (typeof revisionId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/.test(revisionId))) notFound()
  if (wordReviewBatchId !== undefined && (typeof wordReviewBatchId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(wordReviewBatchId))) notFound()
  return <KetPracticePage key={`${revisionId ?? ''}:${wordReviewBatchId ?? ''}`} revisionId={revisionId} wordReviewBatchId={wordReviewBatchId} />
}
