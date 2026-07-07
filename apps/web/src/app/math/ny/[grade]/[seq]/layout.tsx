import DynamicLessonLayout from '@rosie/math/components/shared/dynamic-lesson/DynamicLessonLayout'

type Props = {
  children: React.ReactNode
  params: Promise<{ grade: string; seq: string }>
}

export default async function LessonSeqLayout({ children, params }: Props) {
  const { grade, seq } = await params
  return (
    <DynamicLessonLayout grade={Number(grade)} seq={Number(seq)}>
      {children}
    </DynamicLessonLayout>
  )
}
