import { ReadingPassagePrintPage } from '@rosie/english'

export default async function ReadingPassagePrintRoute({
  params,
}: {
  params: Promise<{ key: string }>
}) {
  const { key } = await params
  return <ReadingPassagePrintPage passageKey={key} />
}
