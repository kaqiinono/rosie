import { notFound } from 'next/navigation'
import { isChineseBookSlug } from '@rosie/chinese'

export default async function ChineseBookLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ bookSlug: string }>
}) {
  const { bookSlug } = await params
  if (!isChineseBookSlug(bookSlug)) notFound()
  return children
}
