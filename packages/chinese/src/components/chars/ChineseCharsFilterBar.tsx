'use client'

import type { ReactNode } from 'react'
import type { ChineseLessonRow } from '../../types/chineseCharData'
import type { CharQuizType } from '../../utils/chinese-chars-session-helpers'
import { ALL_CHAR_QUIZ_TYPES } from '../../utils/chinese-chars-session-helpers'
import type { UnitOption } from '../../utils/chinese-chars-session-helpers'
import { getLessonDisplayInfo } from '../../utils/chinese-lesson-display'

const QUIZ_TYPE_LABEL: Record<CharQuizType, string> = {
  recognize: '认字',
  stroke: '笔顺',
  phrase: '词语检测',
  passage: '阅读题',
  'pinyin-write': '看拼写字',
}

interface ChineseCharsFilterBarProps {
  units: UnitOption[]
  lessons: ChineseLessonRow[]
  selUnits: Set<number>
  selLessons: Set<string>
  selDisplayType: 'library' | 'cards' | 'all'
  quizTypes: Set<CharQuizType>
  contentCount: number
  onToggleUnit: (unit: number) => void
  onToggleLesson: (lessonKey: string) => void
  onSelectDisplayType: (type: 'library' | 'cards' | 'all') => void
  onToggleQuizType: (type: CharQuizType) => void
  onStartPractice: () => void
  onPrintAll: () => void
  cardPreviewEnabled: boolean
  onToggleCardPreview: () => void
  canStart: boolean
  canPrint: boolean
}

function PreviewToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 select-none">
      <span className="text-[11px] font-extrabold tracking-wide text-amber-900/50">卡片预览</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
          enabled
            ? 'border-emerald-500 bg-emerald-500'
            : 'border-amber-200/80 bg-amber-100/60'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </label>
  )
}

function FilterLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 shrink-0 items-center rounded-md bg-amber-900/[0.06] px-2 text-[11px] font-extrabold tracking-wide text-amber-900/50">
      {children}
    </span>
  )
}

function PillButton({
  active,
  onClick,
  activeClass,
  children,
}: {
  active: boolean
  onClick: () => void
  activeClass: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-lg border-[1.5px] px-2.5 py-1 text-[13px] font-bold whitespace-nowrap transition-all select-none ${
        active
          ? activeClass
          : 'border-amber-200/70 bg-white/80 text-amber-900/55 hover:border-amber-300 hover:text-amber-900'
      }`}
    >
      {children}
    </button>
  )
}

export default function ChineseCharsFilterBar({
  units,
  lessons,
  selUnits,
  selLessons,
  selDisplayType,
  quizTypes,
  contentCount,
  onToggleUnit,
  onToggleLesson,
  onSelectDisplayType,
  onToggleQuizType,
  onStartPractice,
  onPrintAll,
  cardPreviewEnabled,
  onToggleCardPreview,
  canStart,
  canPrint,
}: ChineseCharsFilterBarProps) {
  const lessonsByUnit = [...selUnits].sort((a, b) => a - b).map((unit) => ({
    unit,
    title: units.find((u) => u.unit === unit)?.title ?? `第${unit}单元`,
    lessons: lessons.filter((l) => l.unit === unit),
  }))

  const visibleLessons =
    selUnits.size > 0
      ? lessonsByUnit
      : units.map((u) => ({
          unit: u.unit,
          title: u.title,
          lessons: lessons.filter((l) => l.unit === u.unit),
        }))

  return (
    <div className="cn-filter-bar px-4 py-3">
      <div className="mx-auto max-w-[1280px] rounded-2xl border border-amber-200/60 bg-white/70 p-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterLabel>单元</FilterLabel>
            {units.map((u) => (
              <PillButton
                key={u.unit}
                active={selUnits.has(u.unit)}
                onClick={() => onToggleUnit(u.unit)}
                activeClass="border-orange-500 bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-[0_2px_8px_rgba(234,88,12,.28)]"
              >
                {u.title}
              </PillButton>
            ))}
          </div>

          <div className="flex flex-wrap items-start gap-1.5">
            <FilterLabel>课文</FilterLabel>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {visibleLessons.map(({ unit, title, lessons: unitLessons }) => (
                <div key={unit} className="flex flex-wrap items-center gap-1.5">
                  {visibleLessons.length > 1 && (
                    <span className="min-w-[64px] text-[10px] font-bold text-amber-900/40">
                      {title}
                    </span>
                  )}
                  {unitLessons.map((l) => (
                    <PillButton
                      key={l.lessonKey}
                      active={selLessons.has(l.lessonKey)}
                      onClick={() => onToggleLesson(l.lessonKey)}
                      activeClass="border-indigo-400 bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_2px_8px_rgba(99,102,241,.28)]"
                    >
                      {getLessonDisplayInfo(l, unitLessons).label}
                    </PillButton>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex flex-col gap-2 border-t border-amber-900/[0.06] pt-2.5">
          <div className="flex w-full flex-wrap items-center gap-1.5">
            <FilterLabel>题型</FilterLabel>
            {ALL_CHAR_QUIZ_TYPES.map((type) => (
              <PillButton
                key={type}
                active={quizTypes.has(type)}
                onClick={() => onToggleQuizType(type)}
                activeClass="border-emerald-500 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_2px_8px_rgba(16,185,129,.25)]"
              >
                {QUIZ_TYPE_LABEL[type]}
              </PillButton>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterLabel>展示</FilterLabel>
              <PillButton
                active={selDisplayType === 'cards'}
                onClick={() => onSelectDisplayType('cards')}
                activeClass="border-amber-500 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-[0_2px_8px_rgba(245,158,11,.28)]"
              >
                生字卡
              </PillButton>
              <PillButton
                active={selDisplayType === 'library'}
                onClick={() => onSelectDisplayType('library')}
                activeClass="border-indigo-500 bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_2px_8px_rgba(99,102,241,.28)]"
              >
                生字库
              </PillButton>
              <PillButton
                active={selDisplayType === 'all'}
                onClick={() => onSelectDisplayType('all')}
                activeClass="border-emerald-500 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_2px_8px_rgba(16,185,129,.25)]"
              >
                全部
              </PillButton>
            </div>

            <PreviewToggle enabled={cardPreviewEnabled} onToggle={onToggleCardPreview} />

            <div className="ml-auto flex items-center gap-2">
            <span className="rounded-lg border border-amber-200/70 bg-white/80 px-2.5 py-1 text-[13px] font-bold text-amber-900/55">
              {contentCount} 项内容
            </span>
            <button
              type="button"
              disabled={!canStart}
              onClick={onStartPractice}
              className="cn-start-btn cursor-pointer rounded-xl border-0 px-5 py-1.5 text-[13px] font-extrabold text-white transition hover:-translate-y-px disabled:translate-y-0"
            >
              开始练习
            </button>
            <button
              type="button"
              disabled={!canPrint}
              onClick={onPrintAll}
              className="cursor-pointer rounded-xl border-[1.5px] border-amber-300/80 bg-white/90 px-4 py-1.5 text-[13px] font-extrabold text-amber-900/70 transition hover:border-amber-400 hover:text-amber-900 disabled:cursor-not-allowed disabled:opacity-45"
            >
              打印
            </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
