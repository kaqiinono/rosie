import { notFound } from 'next/navigation'
import { findStorySeries, storySeries, StorySeriesView, StoryShelf, warriorsCollection } from '@rosie/english'

export default async function StorySeriesPage({
  params,
}: {
  params: Promise<{ seriesSlug: string }>
}) {
  const { seriesSlug } = await params
  if (seriesSlug === warriorsCollection.entry.slug) {
    return <StoryShelf entries={warriorsCollection.seasons} collectionTitle={warriorsCollection.entry.title} />
  }

  const series = findStorySeries(storySeries, seriesSlug)
  if (!series) notFound()
  const collection = warriorsCollection.seasons.some(({ slug }) => slug === seriesSlug)
    ? warriorsCollection.entry
    : undefined
  return <StorySeriesView series={series} collection={collection} />
}
