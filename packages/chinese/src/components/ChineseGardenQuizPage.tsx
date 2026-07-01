'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  CharQuizRunner,
  buildGardenQuizItems,
  getGardenLessonGroups,
  useChineseContext,
} from '@rosie/chinese'

export default function ChineseGardenQuizPage() {
  const searchParams = useSearchParams()
  const lessonParam = searchParams.get('lesson')
  const { lessonGroups, charByKey, recordBatch, isCharDataReady } = useChineseContext()

  const gardenGroups = useMemo(() => getGardenLessonGroups(lessonGroups), [lessonGroups])
  const defaultKey = gardenGroups[0]?.lessonKey ?? 'u1-garden'
  const [lessonKey, setLessonKey] = useState('')
  const resolvedKey = (lessonParam ?? lessonKey) || defaultKey

  const items = useMemo(
    () =>
      isCharDataReady ? buildGardenQuizItems(lessonGroups, charByKey, resolvedKey) : [],
    [lessonGroups, charByKey, resolvedKey, isCharDataReady],
  )

  const pinyinPool = useMemo(() => [...new Set(items.map((i) => i.pinyin))], [items])

  const group = gardenGroups.find((g) => g.lessonKey === resolvedKey)

  if (!isCharDataReady) {
    return <p className="p-6 text-center text-sm text-slate-500">字库未就绪</p>
  }

  if (gardenGroups.length === 0) {
    return <p className="p-6 text-center text-sm text-slate-500">暂无园地课文数据</p>
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <header className="text-center">
        <h1 className="text-xl font-extrabold text-slate-900">识字加油站</h1>
        <p className="mt-1 text-sm text-slate-500">语文园地 · 扩展认读生字</p>
      </header>

      <label className="mt-4 block text-xs font-bold text-slate-500">
        选择园地
        <select
          value={resolvedKey}
          onChange={(e) => setLessonKey(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
        >
          {gardenGroups.map((g) => (
            <option key={g.lessonKey} value={g.lessonKey}>
              第{g.unit}单元 · {g.lessonTitle}
            </option>
          ))}
        </select>
      </label>

      {group && group.recognize.length > 0 && (
        <p className="mt-3 text-center text-xs text-emerald-700">
          本园 {group.recognize.length} 个扩展认读字：{group.recognize.join(' ')}
        </p>
      )}

      <div className="mt-6">
        {items.length === 0 ? (
          <p className="text-center text-sm text-slate-500">本园地暂无认读字测验</p>
        ) : (
          <CharQuizRunner
            items={items}
            pinyinPool={pinyinPool}
            onComplete={(results) => {
              recordBatch(
                results.map((r) => ({
                  charKey: r.charKey,
                  track: 'recognize' as const,
                  correct: r.correct,
                })),
              )
            }}
          />
        )}
      </div>

      <Link
        href="/chinese/accumulation"
        className="mt-8 block text-center text-xs font-semibold text-teal-700 no-underline"
      >
        ← 日积月累
      </Link>
    </div>
  )
}
