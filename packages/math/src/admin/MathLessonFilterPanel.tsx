'use client'

import { GRADE_LABEL, lessonDisplayLabel } from '@rosie/math-kit/utils/lesson-grade'
import { Button } from '@rosie/ui/themes'
import { StickerCard } from '@rosie/ui'

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
      <StickerCard as="section" size="sm" elevation="sm" radius="md">
        <div className="mb-2 text-[12px] font-bold text-slate-500">年级（单选）</div>
        <div className="flex flex-wrap gap-1.5">
          {grades.map((grade) => (
            <Button
              key={grade}
              type="button"
              onClick={() => onSelectGrade(grade)}
              variant={selectedGrade === grade ? 'solid' : 'soft'}
              color="teal"
              size="1"
              radius="full"
            >
              {GRADE_LABEL[grade]}
            </Button>
          ))}
        </div>
      </StickerCard>

      <StickerCard as="section" size="sm" elevation="sm" radius="md">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[12px] font-bold text-slate-500">
            {GRADE_LABEL[selectedGrade]}讲次（可多选）
          </div>
          <Button type="button" onClick={onToggleAllLessons} variant="ghost" color="teal" size="1">
            {gradeLessonIds.every((id) => selectedLessonSet.has(id)) ? '全不选' : '全选'}
          </Button>
        </div>
        <div className="flex max-h-[22vh] flex-wrap gap-1 overflow-y-auto">
          {gradeLessonIds.map((id) => (
            <Button
              key={id}
              type="button"
              onClick={() => onToggleLesson(id)}
              variant={selectedLessonSet.has(id) ? 'solid' : 'soft'}
              color="teal"
              size="1"
              radius="full"
            >
              {lessonDisplayLabel(id, true)}
            </Button>
          ))}
        </div>
        {selectedCount === 0 && (
          <p className="mt-2 text-[10px] text-amber-600">请至少选择一个讲次</p>
        )}
      </StickerCard>

      <section className="shadow-sticker-sm rounded-2xl border border-teal-100 bg-teal-50/40 p-2.5">
        <div className="space-y-2">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold text-teal-800">📂 来源</span>
              {sourceBtns.length > 1 && (
                <Button
                  type="button"
                  onClick={() => onToggleAllFilters('source')}
                  variant="ghost"
                  color="teal"
                  size="1"
                >
                  {sourceBtns.every((b) => sourceFilter.has(b.key)) ? '全不选' : '全选'}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {sourceBtns.map((b) => (
                <Button
                  key={b.key}
                  type="button"
                  onClick={() => onToggleFilter('source', b.key)}
                  variant={sourceFilter.has(b.key) ? 'solid' : 'soft'}
                  color="teal"
                  size="1"
                  radius="full"
                >
                  {b.label}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold text-teal-800">🏷️ 题型</span>
              {typeBtns.length > 1 && (
                <Button
                  type="button"
                  onClick={() => onToggleAllFilters('type')}
                  variant="ghost"
                  color="teal"
                  size="1"
                >
                  {typeBtns.every((b) => typeFilter.has(b.key)) ? '全不选' : '全选'}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {typeBtns.map((b) => (
                <Button
                  key={b.key}
                  type="button"
                  onClick={() => onToggleFilter('type', b.key)}
                  variant={typeFilter.has(b.key) ? 'solid' : 'soft'}
                  color="teal"
                  size="1"
                  radius="full"
                >
                  {b.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </aside>
  )
}
