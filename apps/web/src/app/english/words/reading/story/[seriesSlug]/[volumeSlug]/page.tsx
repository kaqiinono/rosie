import { notFound } from 'next/navigation'
import { findStorySeries, findStoryVolume, storySeries, StoryVolumeView } from '@rosie/english'

export default async function StoryVolumePage({
  params,
}: {
  params: Promise<{ seriesSlug: string; volumeSlug: string }>
}) {
  const { seriesSlug, volumeSlug } = await params
  const series = findStorySeries(storySeries, seriesSlug)
  if (!series) notFound()
  const volume = findStoryVolume(series, volumeSlug)
  if (!volume) notFound()
  return <StoryVolumeView series={series} volume={volume} />
}
