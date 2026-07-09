'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, type WordEntry } from '@rosie/core'
import { useWordsContext } from '../../WordsContext'
import { useAdaptiveWordPlan } from '../../hooks/useAdaptiveWordPlan'
import { getAllStages, wordKey } from '../../utils/english-helpers'
import type { AdaptivePlanScope } from '../../utils/adaptivePlanTypes'
import { cmpLesson, lessonKey } from './english-weekly-plan-shared'

type Props = {
  vocab: WordEntry[]
}

type LessonOption = {
  unit: string
  lesson: string
  stage: string
}

function buildTitle(stages: string[], lessons: LessonOption[], wordCount: number): string {
  if (lessons.length > 0) {
    const lessonLabel =
      lessons.length <= 2
        ? lessons.map((lesson) => `${lesson.unit} · ${lesson.lesson}`).join('、')
        : `${lessons[0]?.unit ?? ''} 等 ${lessons.length} 课`
    return `自适应挑战：${lessonLabel}`
  }
  if (stages.length > 0) return `自适应挑战：${stages.join('、')}`
  return `自适应挑战：${wordCount} 词`
}

export default function AdaptivePlanEditor({ vocab }: Props) {
  const router = useRouter()
  const { user } = useAuth()
  const { masteryMap } = useWordsContext()
  const { createPlan, isLoading } = useAdaptiveWordPlan(user)

  const [title, setTitle] = useState('')
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set())
  const [selectedLessonKeys, setSelectedLessonKeys] = useState<Set<string>>(new Set())
  const [showLessonPicker, setShowLessonPicker] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showMasteredDialog, setShowMasteredDialog] = useState(false)
  const [forceChallenge, setForceChallenge] = useState(false)
  const [newWordsPerDay, setNewWordsPerDay] = useState(5)

  const allStages = useMemo(() => getAllStages(vocab), [vocab])

  const orderedLessons = useMemo(() => {
    const seen = new Map<string, LessonOption>()
    for (const entry of vocab) {
      const key = lessonKey(entry)
      if (!seen.has(key)) {
        seen.set(key, { unit: entry.unit, lesson: entry.lesson, stage: entry.stage ?? '' })
      }
    }
    return [...seen.values()].sort(cmpLesson)
  }, [vocab])

  const pickerLessons = useMemo(() => {
    if (selectedStages.size === 0) return orderedLessons
    return orderedLessons.filter((lesson) => selectedStages.has(lesson.stage))
  }, [orderedLessons, selectedStages])

  const selectedLessons = useMemo(
    () => orderedLessons.filter((lesson) => selectedLessonKeys.has(lessonKey(lesson))),
    [orderedLessons, selectedLessonKeys],
  )

  const selectedWords = useMemo(() => {
    if (selectedLessonKeys.size > 0) {
      return vocab.filter((entry) => selectedLessonKeys.has(lessonKey(entry)))
    }
    if (selectedStages.size > 0) {
      return vocab.filter((entry) => entry.stage && selectedStages.has(entry.stage))
    }
    return []
  }, [vocab, selectedLessonKeys, selectedStages])

  const wordKeys = useMemo(
    () => [...new Set(selectedWords.map((entry) => wordKey(entry)))],
    [selectedWords],
  )

  const defaultTitle = useMemo(
    () => buildTitle([...selectedStages], selectedLessons, wordKeys.length),
    [selectedStages, selectedLessons, wordKeys.length],
  )

  const planScope = useMemo<AdaptivePlanScope>(() => ({
    ...((selectedStages.size > 0) ? { stages: [...selectedStages] } : {}),
    ...((selectedLessonKeys.size > 0) ? { lessonKeys: [...selectedLessonKeys] } : {}),
  }), [selectedStages, selectedLessonKeys])

  const canSubmit = wordKeys.length > 0 && !isSubmitting && !isLoading

  const handleCreate = async (withForceChallenge: boolean) => {
    if (!canSubmit && !withForceChallenge) return
    if (wordKeys.length === 0) return

    setIsSubmitting(true)
    setCreateError(null)
    try {
      const result = await createPlan({
        title: title.trim() || defaultTitle,
        scope: planScope,
        wordKeys,
        masteryMap,
        forceChallenge: withForceChallenge,
        newWordsPerDay,
      })

      if (!result.ok && result.reason === 'all_mastered') {
        setShowMasteredDialog(true)
        return
      }

      router.push('/admin/plans/english')
    } catch (err) {
      console.error('[adaptive_word_plan] create failed', err)
      setCreateError(
        err instanceof Error
          ? err.message
          : '创建失败。请确认已在 Supabase 执行 docs/sql/adaptive-word-plans.sql',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void handleCreate(false)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--wm-text-dim)]">
        加载中…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[640px] px-4 py-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-[20px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-7"
      >
        <div className="font-fredoka mb-5 bg-gradient-to-br from-[#8b5cf6] to-[#3b82f6] bg-clip-text text-2xl text-transparent">
          创建自适应计划
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
            计划名称
          </label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={defaultTitle}
            className="w-full rounded-[10px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-3 py-2 text-[.88rem] font-bold text-[var(--wm-text)] outline-none focus:border-[var(--wm-accent)]"
          />
        </div>

        {allStages.length > 0 && (
          <div className="mb-4">
            <div className="mb-1.5 text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
              选择词库（可多选）
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allStages.map((stage) => {
                const isSelected = selectedStages.has(stage)
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() =>
                      setSelectedStages((prev) => {
                        const next = new Set(prev)
                        if (next.has(stage)) next.delete(stage)
                        else next.add(stage)
                        return next
                      })
                    }
                    className={`cursor-pointer rounded-full border-[1.5px] px-3 py-1 text-[.78rem] font-bold transition-all ${
                      isSelected
                        ? 'border-[#8b5cf6] bg-[rgba(139,92,246,.15)] text-[#c4b5fd]'
                        : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]'
                    }`}
                  >
                    {stage}
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 text-[.65rem] text-[var(--wm-text-dim)]">
              只选词库时，会把该词库全部单词加入计划；再选课程时，以课程范围为准。
            </p>
          </div>
        )}

        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowLessonPicker((value) => !value)}
            className="font-nunito cursor-pointer rounded-full border-[1.5px] border-[var(--wm-border)] bg-transparent px-4 py-1.5 text-[0.875rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]"
          >
            选择课程{selectedLessonKeys.size > 0 ? ` (${selectedLessonKeys.size})` : ''}{' '}
            {showLessonPicker ? '▴' : '▾'}
          </button>
        </div>

        {showLessonPicker && (
          <div className="mb-4 max-h-[280px] overflow-hidden overflow-y-auto rounded-xl border border-[var(--wm-border)]">
            {pickerLessons.length === 0 && (
              <div className="px-4 py-3 text-[.8rem] text-[var(--wm-text-dim)]">
                该词库下暂无课程
              </div>
            )}
            {pickerLessons.map((lesson) => {
              const key = lessonKey(lesson)
              const isSelected = selectedLessonKeys.has(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setSelectedLessonKeys((prev) => {
                      const next = new Set(prev)
                      if (next.has(key)) next.delete(key)
                      else next.add(key)
                      return next
                    })
                  }
                  className={`flex w-full cursor-pointer items-center gap-2.5 border-b border-[var(--wm-border)] px-4 py-2.5 text-left text-[1rem] font-bold transition-all last:border-0 ${
                    isSelected
                      ? 'bg-[rgba(139,92,246,.12)] text-[#c4b5fd]'
                      : 'bg-[var(--wm-surface2)] text-[var(--wm-text)] hover:bg-[var(--wm-surface)]'
                  }`}
                >
                  <span
                    className={`inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[4px] border text-[.6rem] font-black ${
                      isSelected
                        ? 'border-[#8b5cf6] bg-[rgba(139,92,246,.3)] text-[#c4b5fd]'
                        : 'border-[var(--wm-border)] bg-transparent'
                    }`}
                  >
                    {isSelected && '✓'}
                  </span>
                  <span className="min-w-0 flex-1">
                    {lesson.unit} · {lesson.lesson}
                  </span>
                  {lesson.stage && (
                    <span className="rounded-full border border-[var(--wm-border)] px-2 py-0.5 text-[.6rem] text-[var(--wm-text-dim)]">
                      {lesson.stage}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <div className="mb-5">
          <div className="mb-1.5 text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
            每日新词数量
          </div>
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNewWordsPerDay(n)}
                className={`h-8 min-w-8 cursor-pointer rounded-full border-[1.5px] px-2 text-[.8rem] font-extrabold transition-all ${
                  newWordsPerDay === n
                    ? 'border-[#8b5cf6] bg-[rgba(139,92,246,.15)] text-[#c4b5fd]'
                    : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[.65rem] text-[var(--wm-text-dim)]">
            每天最多新拉入 {newWordsPerDay} 个词；题型按熟悉度自动递进（认读 → 双向选择 → 默写），无需手动选题型。
          </p>
          {wordKeys.length > 0 && (
            <p className="mt-1 text-[.65rem] text-[#c4b5fd]">
              约 {Math.ceil(wordKeys.length / Math.max(1, newWordsPerDay))} 天可全部引入（不含复习巩固天数）
            </p>
          )}
        </div>

        <div className="mb-5 rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-4 py-3">
          <div className="mb-2 text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
            预览
          </div>
          <div className="text-[1.15rem] font-extrabold text-[#c4b5fd]">{wordKeys.length} 个单词</div>
          <div className="mt-1 text-[.72rem] text-[var(--wm-text-dim)]">
            {selectedLessonKeys.size > 0
              ? `已选 ${selectedLessonKeys.size} 个课程 · 每日新词 ${newWordsPerDay}`
              : selectedStages.size > 0
                ? `已选 ${selectedStages.size} 个词库 · 每日新词 ${newWordsPerDay}`
                : '请选择词库或课程后创建计划'}
          </div>
        </div>

        <div className="mt-2 flex gap-2.5 border-t border-[var(--wm-border)] pt-5">
          <button
            type="button"
            onClick={() => router.push('/admin/plans/english')}
            className="font-nunito flex-1 cursor-pointer rounded-[10px] border-[1.5px] border-[var(--wm-border)] bg-transparent py-2.5 text-[.85rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="font-nunito flex-[2] cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#7c3aed] to-[#2563eb] py-2.5 text-[.88rem] font-extrabold text-white shadow-[0_3px_12px_rgba(124,58,237,.35)] transition-all hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(124,58,237,.5)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? '创建中…' : '创建计划'}
          </button>
        </div>
        {createError && (
          <p className="mt-3 text-[.78rem] font-bold leading-relaxed text-[#f87171]">{createError}</p>
        )}
      </form>

      {showMasteredDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(2,6,23,.72)] px-4">
          <div className="w-full max-w-[420px] rounded-[20px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-6 shadow-[0_20px_60px_rgba(0,0,0,.35)]">
            <div className="mb-2 text-[1.1rem] font-extrabold text-[var(--wm-text)]">
              这些单词都已掌握
            </div>
            <p className="mb-4 text-[.82rem] leading-relaxed text-[var(--wm-text-dim)]">
              当前范围内没有需要重新学习的单词。如果想把已掌握单词也加入挑战，请勾选强制挑战后继续。
            </p>
            <label className="mb-5 flex cursor-pointer items-center gap-2 text-[.85rem] font-bold text-[#c4b5fd]">
              <input
                type="checkbox"
                checked={forceChallenge}
                onChange={(event) => setForceChallenge(event.target.checked)}
                className="h-4 w-4 accent-[#8b5cf6]"
              />
              强制挑战
            </label>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowMasteredDialog(false)
                  setForceChallenge(false)
                }}
                className="font-nunito flex-1 cursor-pointer rounded-[10px] border-[1.5px] border-[var(--wm-border)] bg-transparent py-2.5 text-[.85rem] font-bold text-[var(--wm-text-dim)]"
              >
                返回调整
              </button>
              <button
                type="button"
                disabled={!forceChallenge || isSubmitting}
                onClick={() => { void handleCreate(true) }}
                className="font-nunito flex-[1.4] cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#7c3aed] to-[#2563eb] py-2.5 text-[.88rem] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                继续创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
