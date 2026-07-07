'use client'

import clsx from 'clsx'
import { GRADE_LABEL, lessonDisplayLabel } from '@rosie/math/utils/lesson-grade'

const FILTER_BTN_BASE =
  'rounded-full border px-2 py-0.5 text-[10px] font-semibold transition active:scale-95'
const FILTER_BTN_ON = 'border-teal-600 bg-teal-600 text-white'
const FILTER_BTN_OFF = 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100'

type Props = {
  grades: number[]
  selectedGrade: number
  gradeLessonIds: string[]
  selectedLessonSet: ReadonlySet<string>
  sourceBtns: { key: string; label: string }[]
  typeBtns: { key: string; label: string }[]
  sourceFilter: ReadonlySet<string>
  typeFilter: ReadonlySet<string>
  onSelectGrade: (grade: number) => void
  onToggleLesson: (id: string) => void
  onToggleAllLessons: () => void
  onToggleFilter: (axis: 'source' | 'type', value: string) => void
  onToggleAllFilters: (axis: 'source' | 'type') => void
}

export default function MathLessonFilterPanel({
  grades,
  selectedGrade,
  gradeLessonIds,
  selectedLessonSet,
  sourceBtns,
  typeBtns,
  sourceFilter,
  typeFilter,
  onSelectGrade,
  onToggleLesson,
  onToggleAllLessons,
  onToggleFilter,
  onToggleAllFilters,
}: Props) {
  const selectedCount = selectedLessonSet.size

  return (
    <aside className="space-y-3">
      <section className="rounded-2xl border border-teal-100 bg-white/90 p-3 shadow-sm">
        <div className="mb-2 text-[12px] font-bold text-slate-500">年级（单选）</div>
        <div className="flex flex-wrap gap-1.5">
          {grades.map((grade) => (
            <button
              key={grade}
              type="button"
              onClick={() => onSelectGrade(grade)}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-[11px] font-semibold transition',
                selectedGrade === grade
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-teal-50 text-teal-800 hover:bg-teal-100',
              )}
            >
              {GRADE_LABEL[grade]}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-teal-100 bg-white/90 p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[12px] font-bold text-slate-500">
            {GRADE_LABEL[selectedGrade]}讲次（可多选）
          </div>
          <button
            type="button"
            onClick={onToggleAllLessons}
            className="text-[10px] font-semibold text-teal-600 hover:text-teal-800"
          >
            {gradeLessonIds.every((id) => selectedLessonSet.has(id)) ? '全不选' : '全选'}
          </button>
        </div>
        <div className="flex max-h-[22vh] flex-wrap gap-1 overflow-y-auto">
          {gradeLessonIds.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onToggleLesson(id)}
              className={clsx(
                'rounded-lg px-2 py-1 text-[11px] font-semibold transition',
                selectedLessonSet.has(id)
                  ? 'bg-teal-600 text-white'
                  : 'bg-teal-50 text-teal-800 hover:bg-teal-100',
              )}
            >
              {lessonDisplayLabel(id, true)}
            </button>
          ))}
        </div>
        {selectedCount === 0 && (
          <p className="mt-2 text-[10px] text-amber-600">请至少选择一个讲次</p>
        )}
      </section>

      <section className="rounded-2xl border border-teal-100 bg-teal-50/40 p-2.5 shadow-sm">
        <div className="space-y-2">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold text-teal-800">📂 来源</span>
              {sourceBtns.length > 1 && (
                <button
                  type="button"
                  onClick={() => onToggleAllFilters('source')}
                  className="text-[10px] text-teal-600 hover:text-teal-800"
                >
                  {sourceBtns.every((b) => sourceFilter.has(b.key)) ? '全不选' : '全选'}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {sourceBtns.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => onToggleFilter('source', b.key)}
                  className={clsx(
                    FILTER_BTN_BASE,
                    sourceFilter.has(b.key) ? FILTER_BTN_ON : FILTER_BTN_OFF,
                  )}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold text-teal-800">🏷️ 题型</span>
              {typeBtns.length > 1 && (
                <button
                  type="button"
                  onClick={() => onToggleAllFilters('type')}
                  className="text-[10px] text-teal-600 hover:text-teal-800"
                >
                  {typeBtns.every((b) => typeFilter.has(b.key)) ? '全不选' : '全选'}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {typeBtns.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => onToggleFilter('type', b.key)}
                  className={clsx(
                    FILTER_BTN_BASE,
                    typeFilter.has(b.key) ? FILTER_BTN_ON : FILTER_BTN_OFF,
                  )}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </aside>
  )
}
