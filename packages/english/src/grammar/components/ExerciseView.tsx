'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { GrammarExerciseGroup, GrammarExerciseItem, GrammarFigure, GrammarPageImage } from '../types'
import { grammarPageImageUrl } from '../types'
import { FigureCard } from './FigureCard'

const BLANK = '______'

type ItemStatus = 'idle' | 'correct' | 'wrong'

/** 归一化用户输入与标准答案：小写、去首尾空白、统一撇号、折叠空格 */
function normalize(s: string): string {
  return s
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/** 把答案拆成与空格数量匹配的期望片段（支持 ', ' / '; ' / ' / ' / '. ' / 换行 / 空格分词） */
function parseExpected(item: GrammarExerciseItem, blankCount: number): string[] {
  const answer = item.answer.trim()
  if (!answer) return []
  if (blankCount >= 2) {
    if (answer.includes(', ')) {
      const parts = answer.split(', ')
      if (parts.length === blankCount) return parts
    }
    if (answer.includes('; ')) {
      const parts = answer.split('; ')
      if (parts.length === blankCount) return parts
    }
    if (answer.includes(' / ')) {
      const parts = answer.split(' / ')
      if (parts.length === blankCount) return parts
    }
    if (answer.includes('. ')) {
      const parts = answer.split('. ').map((p) => (p.endsWith('.') ? p : `${p}.`))
      if (parts.length === blankCount) return parts
    }
    if (answer.includes('\n')) {
      const parts = answer
        .split('\n')
        .map((p) => p.trim())
        .filter((p) => p !== '')
      if (parts.length === blankCount) return parts
    }
    // 兜底：答案按空格分词后段数 = 空格数（如 3 空答案 "was too tired"）
    const words = answer.split(' ').filter((w) => w !== '')
    if (words.length === blankCount) return words
  }
  return [answer]
}

function isGraded(item: GrammarExerciseItem): boolean {
  return item.answer.trim() !== ''
}

/** 选择题答案拆分：多选答案形如 "A, B"（学习指导），单元素时退化为整串比较 */
function choiceAnswerParts(answer: string): string[] {
  const parts = answer
    .split(/[,，]\s*/)
    .map((p) => normalize(p))
    .filter((p) => p !== '')
  return parts.length > 0 ? parts : [normalize(answer)]
}

/** 选择题点选判分：答案按逗号拆分后任一片段命中即对（兼容多选 "A, B"） */
function isChoiceCorrect(item: GrammarExerciseItem, value: string): boolean {
  const v = normalize(value)
  return choiceAnswerParts(item.answer).includes(v)
}

/** 组内所有题的选项列表完全相同时，返回共享选项（只渲染一次）；否则返回 null */
function sharedOptions(items: GrammarExerciseItem[]): string[] | null {
  const first = items[0]?.options
  if (!first || first.length === 0) return null
  if (!items.every((it) => it.options && it.options.length === first.length && it.options.every((o, i) => o === first[i]))) {
    return null
  }
  return first
}

/** 选项列表展示（matching / multiple_choice） */
function OptionsChips({ options, answer, judged }: { options: string[]; answer: string; judged: boolean }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
      {options.map((opt, i) => {
        const letter = /^[A-Z]/.exec(opt)?.[0]
        const isAnswer = judged && letter != null && normalize(answer) === normalize(letter)
        return (
          <span
            key={i}
            className={`rounded-lg px-2.5 py-1 text-[13px] ring-1 ${
              isAnswer
                ? 'bg-app-green-light font-bold text-app-green-dark ring-app-green/40'
                : 'bg-surface-dim text-text-secondary ring-border-light'
            }`}
          >
            {opt}
          </span>
        )
      })}
    </div>
  )
}

interface ItemCardProps {
  item: GrammarExerciseItem
  values: string[]
  status: ItemStatus
  /** 组内选项已共享渲染时，题卡内不再重复展示 */
  hideOptions?: boolean
  onChange: (blankIdx: number, value: string) => void
  onCheck: () => void
  /** multiple_choice 点选备选答案（写入第一个空并立即判分） */
  onPick: (value: string) => void
}

/** 二选一/多选题的点选 chips（multiple_choice）：选项来自 options 数组或题干 A / B 斜杠对 */
function ChoiceChips({ item, status, onPick }: { item: GrammarExerciseItem; status: ItemStatus; onPick: (v: string) => void }) {
  let choices: string[] = item.options && item.options.length > 0 ? [...item.options] : []
  if (choices.length === 0) {
    const m = /([\w'’.\-]+(?: [\w'’.\-]+)?) \/ ([\w'’.\-]+(?: [\w'’.\-]+)?)/.exec(item.prompt)
    if (m) choices = [m[1], m[2]]
  }
  if (choices.length === 0) return null
  const judged = status === 'correct' || status === 'wrong'
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5 pl-7">
      {choices.map((c, i) => {
        const isAnswer = judged && isChoiceCorrect(item, c)
        return (
          <button
            key={i}
            type="button"
            disabled={judged}
            onClick={() => onPick(c)}
            className={`rounded-full px-3 py-1 text-[13px] font-semibold ring-1 transition-all ${
              isAnswer
                ? 'bg-app-green-light text-app-green-dark ring-app-green/40'
                : judged
                  ? 'bg-surface-dim text-text-muted ring-border-light'
                  : 'bg-surface text-text-secondary ring-border-light hover:bg-app-blue-light hover:text-app-blue-dark hover:ring-app-blue/40 active:scale-95'
            }`}
          >
            {c}
          </button>
        )
      })}
    </div>
  )
}

function ItemCard({ item, values, status, onChange, onCheck, onPick, hideOptions }: ItemCardProps) {
  const openEnded = !isGraded(item)
  const parts = item.prompt.split(BLANK)
  const blankCount = parts.length - 1
  const isChoice = item.type === 'multiple_choice' && isGraded(item)

  const inputClass = (idx: number) => {
    const base =
      'mx-1 inline-block min-w-20 rounded-lg border-2 bg-surface-dim px-2 py-0.5 text-center text-[15px] font-semibold text-text-primary outline-none transition-colors'
    if (status === 'idle') return `${base} border-border-light focus:border-app-blue`
    const expected = parseExpected(item, blankCount)
    const v = normalize(values[idx] ?? '')
    const ok =
      v !== '' &&
      (v === normalize(expected[idx] ?? expected[0] ?? '') ||
        expected.some((e) => normalize(e) === v))
    return ok
      ? `${base} border-app-green bg-app-green-light text-app-green-dark`
      : `${base} border-app-red bg-app-red-light text-app-red`
  }

  return (
    <div
      className={`rounded-xl p-3 ring-1 transition-shadow ${
        status === 'correct'
          ? 'bg-app-green-light/40 ring-app-green/40'
          : status === 'wrong'
            ? 'animate-wiggle bg-app-red-light/30 ring-app-red/30'
            : 'bg-surface ring-border-light'
      }`}
    >
      <div className="flex flex-wrap items-center gap-y-1.5 text-[15px] leading-relaxed text-text-primary">
        <span className="mr-1.5 inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-surface-dim text-[11px] font-bold text-text-muted ring-1 ring-border-light">
          {item.number}
        </span>
        {parts.map((part, i) => (
          <span key={i} className="contents">
            {part}
            {i < blankCount &&
              (openEnded ? (
                <input
                  className="mx-1 inline-block w-40 rounded-lg border-2 border-dashed border-border-light bg-surface-dim px-2 py-0.5 text-[15px] font-medium text-text-primary outline-none focus:border-app-purple"
                  value={values[i] ?? ''}
                  onChange={(e) => onChange(i, e.target.value)}
                  placeholder="自由作答"
                />
              ) : isChoice ? (
                <span
                  className={`mx-1 inline-block min-w-20 rounded-lg border-2 px-2 py-0.5 text-center text-[15px] font-semibold ${
                    status === 'correct'
                      ? 'border-app-green bg-app-green-light text-app-green-dark'
                      : status === 'wrong'
                        ? 'border-app-red bg-app-red-light text-app-red'
                        : 'border-dashed border-border-light bg-surface-dim text-text-muted'
                  }`}
                >
                  {values[i] || '○'}
                </span>
              ) : (
                <input
                  className={inputClass(i)}
                  value={values[i] ?? ''}
                  onChange={(e) => onChange(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onCheck()
                  }}
                  placeholder="?"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              ))}
          </span>
        ))}
        {!openEnded && !isChoice && status === 'idle' && (
          <button
            onClick={onCheck}
            className="ml-1.5 shrink-0 rounded-full bg-app-blue px-3 py-0.5 text-xs font-bold text-white transition-transform active:scale-95"
          >
            检查
          </button>
        )}
        {status === 'correct' && <span className="ml-1.5 text-sm font-bold text-app-green-dark">✔ 正确</span>}
        {openEnded && (
          <span className="ml-1.5 rounded-full bg-app-purple-light px-2 py-0.5 text-[11px] font-bold text-app-purple-dark">
            开放题
          </span>
        )}
      </div>
      {/* 选择/匹配类题目的选项列表（未共享渲染时才展示；multiple_choice 用 chips 展示） */}
      {!hideOptions && item.options && item.options.length > 0 && !isChoice && (
        <OptionsChips options={item.options} answer={item.answer} judged={status !== 'idle'} />
      )}
      {isChoice && <ChoiceChips item={item} status={status} onPick={onPick} />}
      {status === 'wrong' && item.answer && (
        <div className="mt-1.5 pl-7 text-[13px] text-text-secondary">
          参考答案：<span className="font-semibold text-text-primary">{item.answer}</span>
        </div>
      )}
    </div>
  )
}

interface ExerciseGroupProps {
  group: GrammarExerciseGroup
  groupIdx: number
  isAdmin: boolean
  /** 该组 bookPage 对应的原书页图 URL（无则 undefined，隐藏「＋ 插图」入口） */
  figureSourceUrl?: string
  /** 组内全部可判分题判定完成后上报（重做后结果变化会再次上报） */
  onGroupResult: (groupIdx: number, correct: number, total: number) => void
  onPageClick?: (page: number) => void
  onStartCrop?: (groupIdx: number) => void
  onPreviewFigure: (figure: GrammarFigure) => void
  onRemoveFigure?: (groupIdx: number) => void
}

function ExerciseGroup({
  group,
  groupIdx,
  isAdmin,
  figureSourceUrl,
  onGroupResult,
  onPageClick,
  onStartCrop,
  onPreviewFigure,
  onRemoveFigure,
}: ExerciseGroupProps) {
  const [inputs, setInputs] = useState<Record<string, string[]>>({})
  const [statuses, setStatuses] = useState<Record<number, ItemStatus>>({})

  const itemKey = (n: number) => `g${groupIdx}-${n}`
  const graded = useMemo(() => group.items.filter(isGraded), [group.items])
  const shared = useMemo(() => sharedOptions(group.items), [group.items])
  const correctCount = graded.filter((it) => statuses[it.number] === 'correct').length
  const allJudged = graded.length > 0 && graded.every((it) => statuses[it.number] === 'correct' || statuses[it.number] === 'wrong')

  // 组级完成上报：全部可判分题判定后触发；结果变化（重做）时再次触发
  const reportedRef = useRef('')
  useEffect(() => {
    if (!allJudged) return
    const sig = `${correctCount}/${graded.length}`
    if (reportedRef.current === sig) return
    reportedRef.current = sig
    onGroupResult(groupIdx, correctCount, graded.length)
  }, [allJudged, correctCount, graded.length, groupIdx, onGroupResult])

  const handleCheck = (item: GrammarExerciseItem) => {
    const blankCount = item.prompt.split(BLANK).length - 1
    const values = inputs[itemKey(item.number)] ?? []
    if (values.every((v) => !v || !v.trim())) return
    const expected = parseExpected(item, blankCount)
    const normValues = values.map((v) => normalize(v ?? ''))
    const ok = normValues.every(
      (v, i) =>
        v === normalize(expected[i] ?? expected[0] ?? '') || expected.some((e) => normalize(e) === v),
    )
    setStatuses((prev) => ({ ...prev, [item.number]: ok ? 'correct' : 'wrong' }))
  }

  const handleReset = () => {
    setInputs({})
    setStatuses({})
    reportedRef.current = ''
  }

  const handlePick = (item: GrammarExerciseItem, value: string) => {
    const blankCount = item.prompt.split(BLANK).length - 1
    const slots = Math.max(blankCount, 1)
    setInputs((prev) => ({ ...prev, [itemKey(item.number)]: Array.from({ length: slots }, (_, i) => (i === 0 ? value : '')) }))
    const ok = isChoiceCorrect(item, value)
    setStatuses((prev) => ({ ...prev, [item.number]: ok ? 'correct' : 'wrong' }))
  }

  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-border-light sm:p-5">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-app-purple to-pink-500 px-2.5 py-1 text-sm font-black text-white">
          {group.section}
        </span>
        <p className="min-w-0 flex-1 text-sm font-semibold text-text-primary">{group.instruction}</p>
        {typeof group.bookPage === 'number' && (
          <button
            type="button"
            onClick={() => onPageClick?.(group.bookPage!)}
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 transition-colors ${
              onPageClick
                ? 'cursor-pointer bg-surface-dim text-app-blue ring-border-light hover:bg-app-blue-light hover:text-app-blue-dark'
                : 'bg-surface-dim text-text-muted ring-border-light'
            }`}
          >
            p.{group.bookPage}
          </button>
        )}
        {isAdmin && !group.figure && figureSourceUrl && typeof group.bookPage === 'number' && (
          <button
            type="button"
            onClick={() => onStartCrop?.(groupIdx)}
            className="shrink-0 rounded-full bg-surface-dim px-2 py-0.5 text-[10px] font-bold text-app-purple ring-1 ring-border-light transition-colors hover:bg-app-purple-light hover:text-app-purple-dark"
          >
            ＋ 插图
          </button>
        )}
        {graded.length > 0 && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
              correctCount === graded.length && allJudged
                ? 'bg-app-green-light text-app-green-dark'
                : 'bg-surface-dim text-text-muted ring-1 ring-border-light'
            }`}
          >
            {correctCount}/{graded.length}
          </span>
        )}
      </header>
      {group.figure && (
        <FigureCard
          figure={group.figure}
          isAdmin={isAdmin}
          onPreview={onPreviewFigure}
          onRecrop={figureSourceUrl && isAdmin ? () => onStartCrop?.(groupIdx) : undefined}
          onRemove={isAdmin ? () => onRemoveFigure?.(groupIdx) : undefined}
        />
      )}
      {/* 组内共享选项（matching 题选项逐题重复时只展示一次） */}
      {shared && <OptionsChips options={shared} answer="" judged={false} />}
      <div className="flex flex-col gap-2">
        {group.items.map((item) => (
          <ItemCard
            key={item.number}
            item={item}
            values={inputs[itemKey(item.number)] ?? []}
            status={isGraded(item) ? (statuses[item.number] ?? 'idle') : 'idle'}
            hideOptions={shared != null}
            onChange={(blankIdx, value) => {
              setInputs((prev) => {
                const next = [...(prev[itemKey(item.number)] ?? [])]
                next[blankIdx] = value
                return { ...prev, [itemKey(item.number)]: next }
              })
              setStatuses((prev) => (prev[item.number] ? { ...prev, [item.number]: 'idle' } : prev))
            }}
            onCheck={() => handleCheck(item)}
            onPick={(value) => handlePick(item, value)}
          />
        ))}
      </div>
      {correctCount > 0 && (
        <button
          onClick={handleReset}
          className="mt-3 text-xs font-semibold text-text-muted underline-offset-2 hover:underline"
        >
          重做本组
        </button>
      )}
    </section>
  )
}

export interface ExerciseViewProps {
  groups: GrammarExerciseGroup[]
  isAdmin: boolean
  pageImages: GrammarPageImage[]
  onGroupResult: (groupIdx: number, correct: number, total: number) => void
  onPageClick?: (page: number) => void
  onStartCrop?: (groupIdx: number) => void
  onPreviewFigure: (figure: GrammarFigure) => void
  onRemoveFigure?: (groupIdx: number) => void
}

export function ExerciseView({
  groups,
  isAdmin,
  pageImages,
  onGroupResult,
  onPageClick,
  onStartCrop,
  onPreviewFigure,
  onRemoveFigure,
}: ExerciseViewProps) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group, i) => {
        const src =
          typeof group.bookPage === 'number' ? pageImages.find((img) => img.page === group.bookPage) : undefined
        return (
          <ExerciseGroup
            key={`${group.section}-${i}`}
            group={group}
            groupIdx={i}
            isAdmin={isAdmin}
            figureSourceUrl={src ? grammarPageImageUrl(src.path) : undefined}
            onGroupResult={onGroupResult}
            onPageClick={onPageClick}
            onStartCrop={onStartCrop}
            onPreviewFigure={onPreviewFigure}
            onRemoveFigure={onRemoveFigure}
          />
        )
      })}
    </div>
  )
}
