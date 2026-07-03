import { use } from 'react'
import { ChineseReadingPassagePage } from '@rosie/chinese'

export default function ChineseReadingPassageRoute({
  params,
}: {
  params: Promise<{ lessonKey: string }>
}) {
  const { lessonKey } = use(params)
  return <ChineseReadingPassagePage lessonKey={lessonKey} />
}
