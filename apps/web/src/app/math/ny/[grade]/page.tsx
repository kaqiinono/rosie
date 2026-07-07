import GradeLessonList from '@rosie/math/components/GradeLessonList'
import { gradesInOrder } from '@rosie/math/utils/lesson-grade'
import { notFound } from 'next/navigation'

type Props = {
  params: Promise<{ grade: string }>
}

export default async function GradePage({ params }: Props) {
  const { grade: gradeStr } = await params
  const grade = Number(gradeStr)
  if (!Number.isFinite(grade) || !gradesInOrder().includes(grade)) notFound()
  return <GradeLessonList grade={grade} />
}
