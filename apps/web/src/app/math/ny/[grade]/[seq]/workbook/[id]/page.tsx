import { DynamicLessonProblemPage } from '@rosie/math/components/shared/dynamic-lesson/DynamicLessonPages'

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <DynamicLessonProblemPage params={params} section="workbook" />
}
