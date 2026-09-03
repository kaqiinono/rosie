import { notFound } from 'next/navigation'
import { findStorySeries, storySeries, StorySeriesView } from '@rosie/english'

export default async function StorySeriesPage({
  params,
}: {
  params: Promise<{ seriesSlug: string }>
}) {
  const { seriesSlug } = await params
  const series = findStorySeries(storySeries, seriesSlug)
  if (!series) notFound()
  return <StorySeriesView series={series} />
}
