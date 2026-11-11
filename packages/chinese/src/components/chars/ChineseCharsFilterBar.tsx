'use client'

import type { ComponentProps, ReactNode } from 'react'
import type { ChineseLessonRow } from '../../types/chineseCharData'
import type { CharQuizType } from '../../utils/chinese-chars-session-helpers'
import { ALL_CHAR_QUIZ_TYPES } from '../../utils/chinese-chars-session-helpers'
import type { UnitOption } from '../../utils/chinese-chars-session-helpers'
import { getLessonDisplayInfo } from '../../utils/chinese-lesson-display'
import { Button, Switch } from '@rosie/ui/themes'

const QUIZ_TYPE_LABEL: Record<CharQuizType, string> = {
  recognize: '认字',
  stroke: '笔顺',
  phrase: '词语检测',
  blank: '填空题',
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
  hasTeacherWords: boolean
  teacherOnly: boolean
  onToggleTeacherOnly: () => void
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

function PreviewToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 select-none">
      <span className="text-[11px] font-extrabold tracking-wide text-amber-900/50">卡片预览</span>
      <Switch checked={enabled} onCheckedChange={onToggle} color="jade" size="1" />
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

type PillColor = ComponentProps<typeof Button>['color']

function PillButton({
  active,
  disabled,
  onClick,
  color,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  color: PillColor
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      disabled={disabled}
      onClick={onClick}
      variant={active ? 'solid' : 'soft'}
      color={color}
      size="2"
      radius="full"
    >
      {children}
    </Button>
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
  hasTeacherWords,
  teacherOnly,
  onToggleTeacherOnly,
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
  const lessonsByUnit = [...selUnits]
    .sort((a, b) => a - b)
    .map((unit) => ({
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
    <div className="cn-filter-bar px-4 py-3 sm:px-6 lg:px-8">
      <div className="shadow-sticker-sm mx-auto max-w-[1280px] rounded-3xl border border-amber-200/60 bg-white p-3 sm:p-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterLabel>单元</FilterLabel>
            {units.map((u) => (
              <PillButton
                key={u.unit}
                active={selUnits.has(u.unit)}
                onClick={() => onToggleUnit(u.unit)}
                color="amber"
              >
                {u.title}
              </PillButton>
            ))}
          </div>

          <div className="flex flex-wrap items-start gap-2">
            <FilterLabel>课文</FilterLabel>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {visibleLessons.map(({ unit, title, lessons: unitLessons }) => (
                <div key={unit} className="flex flex-wrap items-center gap-2">
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
                      color="violet"
                    >
                      {getLessonDisplayInfo(l, unitLessons).label}
                    </PillButton>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-amber-900/[0.06] pt-4">
          <div className="flex w-full flex-wrap items-center gap-2">
            <FilterLabel>题型</FilterLabel>
            {ALL_CHAR_QUIZ_TYPES.map((type) => {
              const disabled = type === 'blank' && quizTypes.has('passage')
              return (
                <PillButton
                  key={type}
                  active={quizTypes.has(type)}
                  disabled={disabled}
                  onClick={() => onToggleQuizType(type)}
                  color="jade"
                >
                  {QUIZ_TYPE_LABEL[type]}
                </PillButton>
              )
            })}
            {quizTypes.has('passage') && (
              <span className="text-[10px] font-bold text-amber-900/40">填空已含在阅读题中</span>
            )}
            {hasTeacherWords && (
              <>
                <FilterLabel>词库</FilterLabel>
                <PillButton active={teacherOnly} onClick={onToggleTeacherOnly} color="purple">
                  老师词语 📝
                </PillButton>
                {teacherOnly && (
                  <span className="text-[10px] font-bold text-amber-900/40">
                    看拼写字 / 词语卡 / 打印仅用老师词语表（建议题型只选「看拼写字」）
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <FilterLabel>展示</FilterLabel>
              <PillButton
                active={selDisplayType === 'cards'}
                onClick={() => onSelectDisplayType('cards')}
                color="orange"
              >
                生字卡
              </PillButton>
              <PillButton
                active={selDisplayType === 'library'}
                onClick={() => onSelectDisplayType('library')}
                color="violet"
              >
                生字库
              </PillButton>
              <PillButton
                active={selDisplayType === 'all'}
                onClick={() => onSelectDisplayType('all')}
                color="jade"
              >
                全部
              </PillButton>
            </div>

            <PreviewToggle enabled={cardPreviewEnabled} onToggle={onToggleCardPreview} />

            <div className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 sm:ml-auto sm:flex sm:w-auto">
              <span className="inline-flex min-h-11 items-center rounded-lg border border-amber-200/70 bg-white px-2.5 py-1 text-[13px] font-bold whitespace-nowrap text-amber-900/55">
                {contentCount} 项内容
              </span>
              <Button
                type="button"
                disabled={!canStart}
                onClick={onStartPractice}
                variant="solid"
                color="orange"
                size="3"
              >
                开始练习
              </Button>
              <Button
                type="button"
                disabled={!canPrint}
                onClick={onPrintAll}
                variant="outline"
                color="gray"
                size="3"
              >
                打印
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
