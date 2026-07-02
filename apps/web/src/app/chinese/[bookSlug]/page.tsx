import { ChineseHomePage, isChineseBookSlug, type ChineseBookSlug } from '@rosie/chinese'
import { notFound } from 'next/navigation'

export default async function ChineseBookHomeRoute({
  params,
}: {
  params: Promise<{ bookSlug: string }>
}) {
  const { bookSlug } = await params
  if (!isChineseBookSlug(bookSlug)) notFound()
  return <ChineseHomePage bookSlug={bookSlug as ChineseBookSlug} />
}
