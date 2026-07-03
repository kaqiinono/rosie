'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { todayStr } from '@rosie/core'
import {
  useChineseContext,
  CharFlashCard,
  buildChineseRoadmap,
  getLessonDisplayInfo,
  masteryKey,
} from '@rosie/chinese'
import type { CharTrack } from '../utils/chinese-helpers'

interface LessonChar {
  char: string
  pinyin: string
  charKey: string
  track: CharTrack
  done: boolean
}

export default function ChineseDailyPage() {
  const router = useRouter()
  const {
    lessons,
    lessonGroups,
    getCharProfile,
    masteryMap,
    isCharDataReady,
    isCharDataLoading,
    unresolvedWrong,
    bookSlug,
    charKeyForBook,
  } = useChineseContext()
  const today = todayStr()
  const [flipped, setFlipped] = useState(false)
  const [previewIdx, setPreviewIdx] = useState(0)

  const roadmap = useMemo(
    () => (isCharDataReady ? buildChineseRoadmap(lessons, lessonGroups, masteryMap, bookSlug) : null),
    [isCharDataReady, lessons, lessonGroups, masteryMap, bookSlug],
  )
  const currentNode = roadmap?.nodes.find((n) => n.state === 'current') ?? null

  const lessonRow = currentNode
    ? lessons.find((l) => l.lessonKey === currentNode.lessonKey)
    : undefined
  const display = lessonRow
    ? getLessonDisplayInfo(lessonRow, lessons.filter((l) => l.unit === lessonRow.unit))
    : null

  const lessonChars = useMemo<LessonChar[]>(() => {
    const group = currentNode?.group
    if (!group) return []
    const out: LessonChar[] = []
    const push = (ch: string, pinyin: string, track: CharTrack) => {
      const key = charKeyForBook(ch)
      out.push({
        char: ch,
        pinyin: pinyin || getCharProfile(key)?.pinyin || '',
        charKey: key,
        track,
        done: (masteryMap[masteryKey(key, track)]?.correct ?? 0) > 0,
      })
    }
    group.recognize.forEach((ch, i) => push(ch, group.recognizePinyin[i] ?? '', 'recognize'))
    group.write.forEach((ch, i) => push(ch, group.writePinyin[i] ?? '', 'write'))
    return out
  }, [currentNode, getCharProfile, masteryMap, charKeyForBook])

  const preview = lessonChars[previewIdx] ?? lessonChars[0]
  const previewProfile = preview ? getCharProfile(preview.charKey) : undefined

  if (isCharDataLoading && !isCharDataReady) {
    return <p className="p-6 text-center text-sm text-slate-500">加载中…</p>
  }

  if (!isCharDataReady) {
    return (
      <p className="p-6 text-center text-sm text-slate-500">
        字库未就绪。请在 Supabase 执行 chinese-char-entries.sql，再按 docs/sql/chinese-g1b/README.md 灌库。
      </p>
    )
  }

  if (!currentNode) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-4xl">🎉</p>
        <p className="mt-3 text-lg font-extrabold text-slate-900">全部课程已通关！</p>
        <p className="mt-1 text-sm text-slate-500">可以回到路线图复习任意一课。</p>
        <Link
          href="/chinese/weekly"
          className="mt-6 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white no-underline hover:bg-emerald-700"
        >
          查看学习路线 →
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-xl font-extrabold text-slate-900">今日语文</h1>
        <p className="mt-1 text-sm text-slate-500">{today}</p>
      </header>

      <section className="rounded-2xl border border-amber-200 bg-white/85 p-5 shadow-sm">
        <p className="text-xs font-semibold tracking-wide text-amber-700">
          第{currentNode.unit}单元 · {display?.label ?? currentNode.lessonTitle}
        </p>
        <h2 className="mt-1 text-lg font-extrabold text-slate-900">{currentNode.lessonTitle}</h2>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-amber-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
              style={{
                width: `${
                  currentNode.status.total > 0
                    ? Math.round((currentNode.status.correct / currentNode.status.total) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
          <span className="text-xs font-bold text-slate-500">
            {currentNode.status.correct}/{currentNode.status.total}
          </span>
        </div>

        {lessonChars.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {lessonChars.map((item) => (
              <li
                key={`${item.charKey}-${item.track}`}
                className={`relative rounded-lg border px-3 py-1.5 text-lg font-bold ${
                  item.done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-white text-slate-800'
                }`}
                title={item.pinyin}
              >
                {item.char}
                {item.track === 'write' && (
                  <span className="ml-1 text-[10px] font-semibold text-rose-500">写</span>
                )}
                {item.done && (
                  <span className="absolute -right-1 -top-1 text-xs text-emerald-500">✓</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() =>
            router.push(`/chinese/chars/practice?lessons=${currentNode.lessonKey}`)
          }
          className="mt-5 block w-full rounded-xl bg-amber-600 py-3 text-center text-sm font-bold text-white transition hover:bg-amber-700"
        >
          开始练习本课
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-400">
          本课生字全部答对后，将自动解锁下一课
        </p>
      </section>

      {preview && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-slate-500">本课生字预览</h2>
          <CharFlashCard
            data={{
              char: preview.char,
              pinyin: preview.pinyin,
              unit: currentNode.unit,
              unitLessonNo: display?.unitLessonNo ?? undefined,
              bookLessonNo: display?.bookLessonNo ?? undefined,
              lessonTitle: currentNode.lessonTitle,
              radical: previewProfile?.radical,
              radicalName: previewProfile?.radicalName,
              structure: previewProfile?.structure,
              phrases: previewProfile?.phrases,
              strokeCount: previewProfile?.strokeCount,
            }}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
          />
          {lessonChars.length > 1 && (
            <div className="mt-3 flex justify-center gap-2">
              <button
                type="button"
                disabled={previewIdx === 0}
                onClick={() => {
                  setPreviewIdx((i) => i - 1)
                  setFlipped(false)
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold disabled:opacity-40"
              >
                上一字
              </button>
              <span className="self-center text-xs text-slate-400">
                {previewIdx + 1} / {lessonChars.length}
              </span>
              <button
                type="button"
                disabled={previewIdx >= lessonChars.length - 1}
                onClick={() => {
                  setPreviewIdx((i) => i + 1)
                  setFlipped(false)
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold disabled:opacity-40"
              >
                下一字
              </button>
            </div>
          )}
        </section>
      )}

      <Link
        href="/chinese/weekly"
        className="text-center text-xs font-semibold text-amber-700 no-underline"
      >
        查看学习路线 →
      </Link>

      {unresolvedWrong.length > 0 && (
        <Link
          href="/chinese/wrong"
          className="text-center text-xs font-semibold text-rose-600 no-underline"
        >
          错题本（{unresolvedWrong.length}）→
        </Link>
      )}
    </div>
  )
}
