'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useWeeklyPlan } from '@/hooks/useWeeklyPlan'
import { useReadingPassageMedia } from '@/hooks/useReadingPassageMedia'
import { useWordsContext } from '@/contexts/WordsContext'
import ReadingAudioButton from '@/components/english/reading/ReadingAudioButton'
import ReadingAudioUploadButton from '@/components/english/reading/ReadingAudioUploadButton'
import { readingPassages } from '@/utils/reading-data'
import { wordKey } from '@/utils/english-helpers'
import { getWordMasteryLevel } from '@/utils/masteryUtils'

export default function ReadingIndexPage() {
  const { user } = useAuth()
  const { weeklyPlan, isLoading } = useWeeklyPlan(user)
  const { vocab, masteryMap } = useWordsContext()
  const { getUrlForPassage, hasAudio, uploadPassageAudio } = useReadingPassageMedia(user)
  const [loopingPassageKey, setLoopingPassageKey] = useState<string | null>(null)

  const focusKey = weeklyPlan?.focusLessonKey ?? null

  const cards = useMemo(() => {
    return readingPassages.map((p) => {
      const lessonWords = vocab.filter((w) => w.unit === p.unit && w.lesson === p.lesson)
      const mastered = lessonWords.reduce((n, w) => {
        const info = masteryMap[wordKey(w)]
        return n + (info && getWordMasteryLevel(info.correct) >= 3 ? 1 : 0)
      }, 0)
      const isFocus = focusKey === `${p.unit}::${p.lesson}`
      return {
        passage: p,
        wordCount: lessonWords.length,
        masteredCount: mastered,
        glossaryCount: p.glossary?.length ?? 0,
        paragraphCount: p.paragraphs.length,
        isFocus,
      }
    })
  }, [vocab, masteryMap, focusKey])

  return (
    <main className="font-nunito relative z-[1] mx-auto max-w-3xl px-4 pt-6 pb-32" style={{ colorScheme: 'light' }}>
      <div aria-hidden className="fixed inset-0 -z-10 bg-[var(--wm-bg)]" />

      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="font-fredoka text-xl font-bold text-[var(--wm-text)] sm:text-2xl">
          📚 阅读课文
        </h1>
        {isLoading && (
          <span className="text-[11px] text-[var(--wm-text-dim)]">载入本周计划…</span>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-gray-200">
          <div className="mb-2 text-4xl">📭</div>
          <div className="font-bold text-gray-800">还没有课文</div>
          <div className="mt-1 text-[12px] text-gray-500">敬请期待新课文上线。</div>
        </div>
      ) : (
        <ul className="space-y-3">
          {cards.map(({ passage: p, wordCount, masteredCount, glossaryCount, paragraphCount, isFocus }) => (
            <li
              key={p.key}
              className="rounded-2xl bg-white p-4 ring-1 ring-gray-200 transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(245,158,11,.18)] hover:ring-orange-300 sm:p-5"
            >
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <Link
                  href={`/english/words/reading/${p.key}`}
                  className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700 no-underline ring-1 ring-orange-200 transition hover:bg-orange-100"
                >
                  📖 {p.unit} · {p.lesson}
                </Link>
                {isFocus && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-sky-300">
                    ⭐ 本周精读
                  </span>
                )}
              </div>
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/english/words/reading/${p.key}`}
                  className="group min-w-0 flex-1 no-underline"
                >
                  <h2 className="font-fredoka text-lg font-bold text-gray-900 group-hover:text-orange-700 sm:text-xl">
                    {p.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-gray-600">
                    <span>📄 {paragraphCount} 段</span>
                    {wordCount > 0 && (
                      <span>
                        📝 本课词 <span className="font-bold text-emerald-700">{masteredCount}</span>
                        <span className="text-gray-400"> / {wordCount} 已掌握</span>
                      </span>
                    )}
                    {glossaryCount > 0 && <span>📒 {glossaryCount} 难点词</span>}
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-1.5">
                  <ReadingAudioUploadButton
                    passageKey={p.key}
                    hasAudio={hasAudio(p.key)}
                    onUpload={uploadPassageAudio}
                    size="sm"
                  />
                  <ReadingAudioButton
                    src={getUrlForPassage(p.key)}
                    mode="loop"
                    passageKey={p.key}
                    activeKey={loopingPassageKey}
                    onActivate={setLoopingPassageKey}
                    size="sm"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
