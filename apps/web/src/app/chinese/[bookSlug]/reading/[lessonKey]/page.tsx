import { use } from 'react'
import { ChineseReadingPassagePage } from '@rosie/chinese'

export default function ChineseBookReadingPassageRoute({
  params,
}: {
  params: Promise<{ lessonKey: string }>
}) {
  const { lessonKey } = use(params)
  return <ChineseReadingPassagePage lessonKey={lessonKey} />
}
