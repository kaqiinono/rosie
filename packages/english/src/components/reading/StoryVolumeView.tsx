'use client'

import Link from 'next/link'
import clsx from 'clsx'
import { useAuth } from '@rosie/core'
import { useStoryReadingProgress } from '../../hooks/useStoryReadingProgress'
import { useStoryRecordings } from '../../hooks/useStoryRecordings'
import type { StorySeries, StoryVolume } from '../../utils/story-types'
import { storyContentKey } from '../../utils/story-types'

export default function StoryVolumeView({
  series,
  volume,
}: {
  series: StorySeries
  volume: StoryVolume
}) {
  const { user } = useAuth()
  const { progress, clearProgress } = useStoryReadingProgress(user, volume.slug)
  const { recordingsFor } = useStoryRecordings(user)
  const recordedClips = volume.chapters.reduce(
    (total, chapter) => total + recordingsFor(storyContentKey(volume, chapter), 'chapter').length,
    0,
  )
  const resumeChapter = progress
    ? volume.chapters.find((chapter) => chapter.key === progress.chapterKey)
    : undefined

  return (
    <main className="font-nunito relative z-[1] mx-auto max-w-5xl px-4 py-8 pb-24">
      <Link
        href={`/english/words/reading/story/${series.slug}`}
        className="text-sm font-bold text-amber-700"
      >
        ← 返回 {series.title}
      </Link>
      <header className="mt-4 rounded-3xl bg-gradient-to-br from-amber-100 via-orange-50 to-white p-6 ring-1 ring-amber-200">
        <p className="text-xs font-extrabold tracking-wider text-amber-600 uppercase">
          第 {volume.number} 辑
        </p>
        <h1 className="font-fredoka mt-1 text-3xl font-black text-slate-900">{volume.title}</h1>
        <p className="mt-3 text-slate-600">{volume.description}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/english/words/reading/story/${series.slug}/${volume.slug}/full`}
            className="rounded-full bg-amber-600 px-4 py-2 text-sm font-bold text-white no-underline"
          >
            阅读整辑
          </Link>
          {resumeChapter && (
            <Link
              href={`/english/words/reading/story/${series.slug}/${volume.slug}/${resumeChapter.key}`}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white no-underline"
            >
              继续阅读 · 第 {resumeChapter.number} 章
            </Link>
          )}
          {progress && (
            <button
              type="button"
              onClick={() => void clearProgress()}
              className="rounded-full bg-white px-3 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200"
            >
              清除标记
            </button>
          )}
        </div>
        <p className="mt-4 text-xs font-bold text-slate-500">
          已保存 {recordedClips} 个朗读片段
        </p>
      </header>
      <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {volume.chapters.map((chapter) => {
          const recordingCount = recordingsFor(storyContentKey(volume, chapter), 'chapter').length
          const isReading = chapter.key === resumeChapter?.key
          return (
            <li key={chapter.key} className="h-full">
              <Link
                href={`/english/words/reading/story/${series.slug}/${volume.slug}/${chapter.key}`}
                aria-current={isReading ? 'true' : undefined}
                className={clsx(
                  'flex h-full items-center gap-3 rounded-2xl p-4 no-underline ring-1 transition hover:shadow-sm',
                  isReading
                    ? 'bg-gradient-to-br from-emerald-50 via-white to-white ring-2 ring-emerald-400 hover:ring-emerald-500'
                    : 'bg-white ring-slate-200 hover:ring-amber-300',
                )}
              >
                <span
                  className={clsx(
                    'font-fredoka flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-black',
                    isReading ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-800',
                  )}
                >
                  {chapter.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-slate-900" title={chapter.title}>
                    {chapter.title}
                  </span>
                  {(isReading || recordingCount > 0) && (
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {isReading && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700">
                          📖 正在阅读
                        </span>
                      )}
                      {recordingCount > 0 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                          🎙 {recordingCount} 段录音
                        </span>
                      )}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </main>
  )
}
