'use client'

import { useLessonSummaryImageUrl } from '@rosie/math/hooks/useLessonSummaryImageUrl'

type Props = {
  lessonId: string
  className?: string
}

/** Renders the uploaded lesson summary image on a讲次 homepage (hidden when none). */
export default function LessonSummaryImage({ lessonId, className }: Props) {
  const url = useLessonSummaryImageUrl(lessonId)
  if (!url) return null

  return (
    <section
      className={`mb-4 overflow-hidden rounded-[14px] border border-teal-100 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.07)] ${className ?? ''}`}
    >
      <div className="border-b border-teal-50 bg-teal-50/60 px-4 py-2 text-[13px] font-bold text-teal-900">
        📋 本讲内容总结
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="本讲内容总结"
        className="block w-full bg-white object-contain"
      />
    </section>
  )
}
