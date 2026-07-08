import { DynamicLessonProblemPage } from '@rosie/math/components/shared/dynamic-lesson/DynamicLessonPages'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <DynamicLessonProblemPage key={id} problemId={id} section="supplement" />
}
