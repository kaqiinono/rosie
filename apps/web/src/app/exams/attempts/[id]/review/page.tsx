import { ExamAttemptReviewScreen } from '@/components/exams/ExamAttemptReviewScreen'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ExamAttemptReviewScreen id={(await params).id} />
}
