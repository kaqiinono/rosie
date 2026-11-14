import { ExamWordReviewScreen } from '@/components/exams/ExamWordReviewScreen'

export default async function ExamWordReviewRoute({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params
  return <ExamWordReviewScreen batchId={batchId} />
}
