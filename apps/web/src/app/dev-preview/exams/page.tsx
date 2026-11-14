import ExamTypePreview from '@/components/exams-preview/ExamTypePreview'
import { EXAM_DEMOS } from '@/components/exams-preview/exam-demos'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '考一考答题预览 · Rosie',
}

export default async function ExamAnswerPreviewPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams
  const initialDemo = EXAM_DEMOS.find(([id]) => id === type)?.[0]
  return <ExamTypePreview initialDemo={initialDemo} />
}
