'use client'

import type { WordEntry, WordMasteryMap } from '@/utils/type'
import type { MasteryLevel } from '@/utils/masteryUtils'
import { MASTERY_ICON } from '@/utils/masteryUtils'
import { getAllUnits, getAllStages } from '@/utils/english-helpers'

interface FilterBarProps {
  vocab: WordEntry[]
  selStage: string
  onSetStage: (stage: string) => void
  selUnits: Set<string>
  selLessons: Set<string>
  selWords: Set<string>
  filteredCount: number
  allFlipped?: boolean
  onToggleUnit: (unit: string) => void
  onToggleLesson: (lesson: string) => void
  onToggleWord: (word: string) => void
  onClearWords: () => void
  onFlipAll?: () => void
  onShuffleOrder?: () => void
  masteryFilter?: MasteryLevel | null
  onMasteryFilter?: (level: MasteryLevel | null) => void
  masteryMap?: WordMasteryMap
}

export default function FilterBar({
  vocab,
  selStage,
  onSetStage,
  selUnits,
  selLessons,
  selWords,
  filteredCount,
  allFlipped,
  onToggleUnit,
  onToggleLesson,
  onToggleWord,
  onClearWords,
  onFlipAll,
  onShuffleOrder,
  masteryFilter,
  onMasteryFilter,
}: FilterBarProps) {
  const stages = getAllStages(vocab)
  const units = getAllUnits(vocab, selStage)
  const lessonsByUnit = [...selUnits].sort().map((unit) => ({
    unit,
    lessons: [...new Set(vocab.filter((v) => v.unit === unit).map((v) => v.lesson))].sort(),
  }))
  const baseWords = vocab.filter((v) => {
    if (selUnits.size && !selUnits.has(v.unit)) return false
    if (selLessons.size && !selLessons.has(`${v.unit}::${v.lesson}`)) return false
    return true
  })

  return (
    <div className="border-b border-[var(--wm-border)] bg-[var(--wm-surface)] px-4 py-3">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-2.5">
        {stages.length > 0 && (
          <div className="flex flex-wrap items-start gap-2">
            <span className="min-w-[62px] pt-1.5 text-[.7rem] font-extrabold tracking-wider text-[var(--wm-text-dim)] uppercase">
              Stage
            </span>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {stages.map((s) => (
                <button
                  key={s}
                  onClick={() => onSetStage(s)}
                  className={`font-nunito cursor-pointer rounded-lg border-[1.5px] px-3 py-1.5 text-[0.875rem] font-bold whitespace-nowrap transition-all select-none ${
                    selStage === s
                      ? 'border-[#a855f7] bg-gradient-to-br from-[#a855f7] to-[#7c3aed] text-white shadow-[0_2px_8px_rgba(168,85,247,.3)]'
                      : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[#a855f7] hover:text-[var(--wm-text)]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-start gap-2">
          <span className="min-w-[62px] pt-1.5 text-[.7rem] font-extrabold tracking-wider text-[var(--wm-text-dim)] uppercase">
            Unit
          </span>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {units.map((u) => (
              <button
                key={u}
                onClick={() => onToggleUnit(u)}
                className={`font-nunito cursor-pointer rounded-lg border-[1.5px] px-3 py-1.5 text-[0.875rem] font-bold whitespace-nowrap transition-all select-none ${
                  selUnits.has(u)
                    ? 'border-[var(--wm-accent)] bg-gradient-to-br from-[var(--wm-accent)] to-[#c0392b] text-white shadow-[0_2px_8px_rgba(233,69,96,.3)]'
                    : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent4)] hover:text-[var(--wm-text)]'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-2">
          <span className="min-w-[62px] pt-1.5 text-[.7rem] font-extrabold tracking-wider text-[var(--wm-text-dim)] uppercase">
            Lesson
          </span>
          <div className="flex flex-1 flex-col gap-1.5">
            {lessonsByUnit.map(({ unit, lessons }) => (
              <div key={unit} className="flex flex-wrap items-center gap-1.5">
                {selUnits.size > 1 && (
                  <span className="min-w-[52px] text-[.65rem] font-bold text-[var(--wm-text-dim)]">
                    {unit}
                  </span>
                )}
                {lessons.map((l) => {
                  const compositeKey = `${unit}::${l}`
                  return (
                    <button
                      key={compositeKey}
                      onClick={() => onToggleLesson(compositeKey)}
                      className={`font-nunito cursor-pointer rounded-lg border-[1.5px] px-3 py-1.5 text-[0.875rem] font-bold whitespace-nowrap transition-all select-none ${
                        selLessons.has(compositeKey)
                          ? 'border-[var(--wm-accent4)] bg-gradient-to-br from-[var(--wm-accent4)] to-[#3b82f6] text-white shadow-[0_2px_8px_rgba(96,165,250,.3)]'
                          : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent4)] hover:text-[var(--wm-text)]'
                      }`}
                    >
                      {l}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-2">
          <span className="min-w-[62px] pt-1.5 text-[.7rem] font-extrabold tracking-wider text-[var(--wm-text-dim)] uppercase">
            单词
          </span>
          <div className="flex max-h-40 flex-1 flex-wrap gap-1.5 overflow-y-auto">
            {baseWords.map((v) => (
              <button
                key={v.word}
                onClick={() => onToggleWord(v.word)}
                className={`font-nunito cursor-pointer rounded-lg border-[1.5px] px-3 py-1.5 text-[0.875rem] font-bold whitespace-nowrap transition-all select-none ${
                  selWords.has(v.word)
                    ? 'border-[var(--wm-accent2)] bg-gradient-to-br from-[var(--wm-accent2)] to-[#e67e22] text-white shadow-[0_2px_8px_rgba(245,166,35,.3)]'
                    : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent4)] hover:text-[var(--wm-text)]'
                }`}
              >
                {v.word}
              </button>
            ))}
          </div>
        </div>

        {onMasteryFilter && (
          <div className="flex flex-wrap items-start gap-2">
            <span className="min-w-[62px] pt-1.5 text-[.7rem] font-extrabold tracking-wider text-[var(--wm-text-dim)] uppercase">
              掌握度
            </span>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {([null, 1, 2, 3] as (MasteryLevel | null)[]).map((lvl) => {
                const active = masteryFilter === lvl
                const label =
                  lvl === null
                    ? '全部'
                    : `${MASTERY_ICON[lvl]} ${['', '练习中', '加深中', '已掌握'][lvl]}`
                return (
                  <button
                    key={lvl ?? 'all'}
                    onClick={() => onMasteryFilter(lvl)}
                    className={`font-nunito cursor-pointer rounded-lg border-[1.5px] px-3 py-1.5 text-[0.875rem] font-bold whitespace-nowrap transition-all select-none ${
                      active
                        ? 'border-[#4ade80] bg-gradient-to-br from-[#4ade80] to-[#22c55e] text-white shadow-[0_2px_8px_rgba(74,222,128,.3)]'
                        : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent4)] hover:text-[var(--wm-text)]'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-2.5 py-1.5 text-[0.875rem] font-bold text-[var(--wm-text-dim)]">
            {filteredCount} 词
          </span>
          <button
            onClick={onClearWords}
            disabled={selWords.size === 0}
            className="font-nunito cursor-pointer rounded-lg border-[1.5px] border-[var(--wm-border)] bg-transparent px-3 py-1.5 text-[.75rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--wm-border)] disabled:hover:text-[var(--wm-text-dim)]"
          >
            清除单词筛选
          </button>
          {(onFlipAll || onShuffleOrder) && (
            <>
              <div className="h-[22px] w-px bg-[var(--wm-border)]" />
              {onShuffleOrder && (
                <button
                  type="button"
                  onClick={onShuffleOrder}
                  disabled={filteredCount === 0}
                  className="font-nunito flex cursor-pointer items-center gap-1.5 rounded-lg border-[1.5px] border-[var(--wm-border)] bg-[var(--wm-surface2)] px-3.5 py-1.5 text-[0.875rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[#a855f7] hover:text-[#a855f7] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  🔀 随机排序
                </button>
              )}
              {onFlipAll && (
                <button
                  onClick={onFlipAll}
                  className="font-nunito flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-gradient-to-br from-[var(--wm-accent4)] to-[#3b82f6] px-4 py-1.5 text-[0.875rem] font-bold text-white transition-all hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(96,165,250,.4)]"
                >
                  🔄 {allFlipped ? '全部翻回' : '全部翻面'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
