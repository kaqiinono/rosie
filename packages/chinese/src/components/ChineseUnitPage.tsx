'use client'

import Link from 'next/link'
import type { ChineseLessonMeta, ChineseUnitEntry } from '../utils/g1b/types'
import type { ChineseLessonRow, LessonCharGroup } from '../types/chineseCharData'
import { getLessonGroup, findLessonRow } from '../utils/chinese-helpers'
import { chineseRoute } from '../utils/chinese-routes'
import { getLessonPassage } from '../utils/chinese-lesson-passage-helpers'
import { useChineseContext } from '../context/ChineseContext'
import LessonPassageView from './units/LessonPassageView'

function lessonKeyFor(unit: number, lesson: ChineseLessonMeta): string {
  if (lesson.kind === 'garden') return `u${unit}-garden`
  if (lesson.kind === 'happy_reading') return `u${unit}-happy-reading`
  return `u${unit}-l${lesson.lesson}`
}

function resolveLessonRow(
  lessons: ChineseLessonRow[],
  key: string,
  bookSlug: string,
): ChineseLessonRow | undefined {
  return findLessonRow(lessons, key, bookSlug)
}

type LessonCardProps = {
  unit: ChineseUnitEntry
  lesson: ChineseLessonMeta
  lessonGroups: LessonCharGroup[]
  lessons: ChineseLessonRow[]
}

function LessonCard({ unit, lesson, lessonGroups, lessons }: LessonCardProps) {
  const { bookSlug } = useChineseContext()
  const key = lessonKeyFor(unit.unit, lesson)
  const group = getLessonGroup(lessonGroups, key, bookSlug)
  const row = resolveLessonRow(lessons, key, bookSlug)
  const passage = getLessonPassage(key, bookSlug)
  const isGarden = lesson.kind === 'garden'
  const isHappyReading = lesson.kind === 'happy_reading'

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-extrabold text-slate-900">{lesson.title}</h3>
          {lesson.requiresRecite && (
            <span className="text-[10px] font-semibold text-violet-600">需背诵</span>
          )}
        </div>
        {!isHappyReading && (
          <div className="flex flex-wrap gap-1.5">
            {isGarden ? (
              <Link
                href={`${chineseRoute(bookSlug, 'garden')}?lesson=${key}`}
                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white no-underline"
              >
                识字加油站
              </Link>
            ) : (
              <>
                <Link
                  href={`${chineseRoute(bookSlug, 'chars')}?lesson=${key}`}
                  className="rounded-lg bg-sky-100 px-2.5 py-1 text-[10px] font-bold text-sky-800 no-underline"
                >
                  生字
                </Link>
                {passage?.paragraphs.length ? (
                  <Link
                    href={chineseRoute(bookSlug, 'reading', key)}
                    className="rounded-lg bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800 no-underline"
                  >
                    阅读
                  </Link>
                ) : null}
              </>
            )}
          </div>
        )}
      </header>

      {group && (group.recognize.length > 0 || group.write.length > 0) && (
        <section className="mt-3">
          {group.recognize.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-bold text-sky-700">会认（{group.recognize.length}）</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {group.recognize.map((ch, i) => (
                  <span
                    key={`r-${ch}-${i}`}
                    className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-center text-sm font-bold text-sky-900"
                  >
                    {ch}
                    <span className="block text-[9px] font-normal text-sky-600">
                      {group.recognizePinyin[i]}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {group.write.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-rose-700">会写（{group.write.length}）</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {group.write.map((ch, i) => (
                  <span
                    key={`w-${ch}-${i}`}
                    className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-center text-sm font-bold text-rose-900"
                  >
                    {ch}
                    <span className="block text-[9px] font-normal text-rose-600">
                      {group.writePinyin[i]}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {row && row.recallPhrases.length > 0 && (
        <section className="mt-3 rounded-xl bg-amber-50 px-3 py-2">
          <p className="text-[10px] font-bold text-amber-800">读一读，记一记</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900">
            {row.recallPhrases.join(' · ')}
          </p>
        </section>
      )}

      {!isGarden && !isHappyReading && (
        <section className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
            课文
          </p>
          <LessonPassageView lessonKey={key} group={group} />
          {passage?.paragraphs.length ? null : (
            <p className="mt-1 text-[10px] text-slate-400">
              生字表与词语练习已可用；正文录入中。
            </p>
          )}
        </section>
      )}

      {isGarden && group && group.recognize.length > 0 && (
        <p className="mt-3 text-xs text-emerald-700">
          园地扩展认读：{group.recognize.join(' ')}
        </p>
      )}
    </article>
  )
}

type Props = {
  unit: ChineseUnitEntry
  lessonGroups: LessonCharGroup[]
  lessons: ChineseLessonRow[]
  isLoading?: boolean
}

export default function ChineseUnitPage({ unit, lessonGroups, lessons, isLoading }: Props) {
  if (isLoading) {
    return <p className="p-6 text-center text-sm text-slate-500">加载中…</p>
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link href="/chinese" className="text-xs font-semibold text-amber-700 no-underline">
        ← 语文首页
      </Link>
      <header className="mt-3">
        <h1 className="text-xl font-extrabold text-slate-900">{unit.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {unit.unitType === 'literacy' ? '识字单元' : '阅读单元'} · {unit.lessons.length} 篇
        </p>
      </header>

      <div className="mt-6 space-y-4">
        {unit.lessons.map((lesson) => (
          <LessonCard
            key={`${unit.unit}-${lesson.lesson}-${lesson.title}`}
            unit={unit}
            lesson={lesson}
            lessonGroups={lessonGroups}
            lessons={lessons}
          />
        ))}
      </div>

      <Link
        href={`/chinese/accumulation?unit=${unit.unit}`}
        className="mt-8 block rounded-xl border border-teal-200 bg-teal-50 py-3 text-center text-sm font-bold text-teal-800 no-underline"
      >
        第 {unit.unit} 单元 · 日积月累 →
      </Link>
    </div>
  )
}
