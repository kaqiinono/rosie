import { notFound } from 'next/navigation'
import TheaterPlayer from '@/components/theater/TheaterPlayer'
import { validTheaterId } from '@/lib/theater/types'

export default async function Page({ params }: { params: Promise<{ filmId: string }> }) {
  const { filmId } = await params
  if (!validTheaterId(filmId)) notFound()
  return <TheaterPlayer filmId={filmId} />
}
