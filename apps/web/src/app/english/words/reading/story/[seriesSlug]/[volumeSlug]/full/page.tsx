import { notFound } from 'next/navigation'
import { findStorySeries, findStoryVolume, storySeries, StoryFullVolumeView } from '@rosie/english'

export default async function StoryFullPage({
  params,
}: {
  params: Promise<{ seriesSlug: string; volumeSlug: string }>
}) {
  const { seriesSlug, volumeSlug } = await params
  const series = findStorySeries(storySeries, seriesSlug)
  if (!series) notFound()
  const volume = findStoryVolume(series, volumeSlug)
  if (!volume) notFound()
  return <StoryFullVolumeView series={series} volume={volume} />
}
