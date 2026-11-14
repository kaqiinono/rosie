import { ExamAttemptPage } from '@rosie/exams'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ExamAttemptPage id={(await params).id} />
}
