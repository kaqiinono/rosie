'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  GrammarExerciseGroup,
  GrammarExerciseItem,
  GrammarFigure,
  GrammarPageImage,
} from '../types'
import { grammarPageImageUrl } from '../types'
import { FigureCard } from './FigureCard'
import { Button, IconButton, TextField } from '@rosie/ui/themes'

const BLANK = '______'

type ItemStatus = 'idle' | 'correct' | 'wrong'

interface ExerciseExample {
  cue: string
  answer: string
  suffix: string
}

interface ExerciseResponse {
  prompt: string
  response: string
}

/** 有标准答案的填空 + `==>` 表示前面作答、后面是供参考的固定回应。 */
function exerciseResponse(item: GrammarExerciseItem): ExerciseResponse | null {
  const start = item.prompt.indexOf('==>')
  if (start < 0 || item.prompt.includes('<==', start + 3) || item.answer.trim() === '') return null
  const prompt = item.prompt.slice(0, start).trimEnd()
  const response = item.prompt.slice(start + 3).trim()
  return /_+/.test(prompt) && response ? { prompt, response } : null
}

function exerciseExample(item: GrammarExerciseItem): ExerciseExample | null {
  if (exerciseResponse(item)) return null
  const start = item.prompt.indexOf('==>')
  if (start < 0) return null
  const end = item.prompt.indexOf('<==', start + 3)
  const cue = item.prompt
    .slice(0, start)
    .replace(new RegExp(`^\\s*${item.number}\\s+`), '')
    .trim()
  const answer = item.prompt.slice(start + 3, end < 0 ? undefined : end).trim()
  const suffix = end < 0 ? '' : item.prompt.slice(end + 3).trim()
  return cue && answer ? { cue, answer, suffix } : null
}

/**
 * OCR 偶尔会把选择题的一处横线识别成多段不同长度的下划线。
 * 选择题只需要一个作答位，因此合并全部下划线；普通填空题仍保留原有多空结构。
 */
function promptParts(item: GrammarExerciseItem): string[] {
  if (item.type !== 'multiple_choice') return item.prompt.replace(/_+/g, BLANK).split(BLANK)

  let foundBlank = false
  const prompt = item.prompt
    .replace(/_+/g, () => {
      if (foundBlank) return ''
      foundBlank = true
      return BLANK
    })
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')

  return prompt.split(BLANK)
}

/** 归一化用户输入与标准答案：小写、去首尾空白、统一撇号、折叠空格 */
function normalize(s: string): string {
  return s
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/[.!?]+$/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/** 把答案拆成与空格数量匹配的期望片段（支持 ', ' / '; ' / ' / ' / '. ' / 换行 / 空格分词） */
function parseExpected(item: GrammarExerciseItem, blankCount: number): string[] {
  const answer = item.answer.trim()
  if (!answer) return []
  if (blankCount === 1 && answer.includes('\n')) {
    return answer
      .split(/\r?\n/)
      .map((part) => part.trim())
      .filter((part) => part !== '')
  }
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
  return exerciseExample(item) == null && item.answer.trim() !== ''
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
  const accepted = choiceAnswerParts(item.answer)
  const normalizedValue = normalize(value)
  if (accepted.includes(normalizedValue)) return true

  const labeledChoice = /^([A-Z])(?:[.)]|\s+)\s*(.+)$/i.exec(value.trim())
  return labeledChoice
    ? accepted.includes(normalize(labeledChoice[1])) ||
        accepted.includes(normalize(labeledChoice[2]))
    : false
}

function choicePresentation(choice: string, index: number): { label: string; text: string } {
  const fallbackLabel = String.fromCharCode(65 + index)
  const match = new RegExp(`^${fallbackLabel}(?:[.)]|\\s+)\\s*(.+)$`, 'i').exec(choice.trim())
  return match ? { label: fallbackLabel, text: match[1] } : { label: fallbackLabel, text: choice }
}

/** 组内所有题的选项列表完全相同时，返回共享选项（只渲染一次）；否则返回 null */
function sharedOptions(items: GrammarExerciseItem[]): string[] | null {
  const first = items[0]?.options
  if (!first || first.length === 0) return null
  if (
    !items.every(
      (it) =>
        it.options &&
        it.options.length === first.length &&
        it.options.every((o, i) => o === first[i]),
    )
  ) {
    return null
  }
  return first
}

function ReferenceOptions({ options }: { options: string[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2 pl-7">
      {options.map((option, index) => (
        <span
          key={index}
          className="bg-surface-dim text-text-secondary rounded-lg px-3 py-1.5 text-sm"
        >
          {option}
        </span>
      ))}
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

function sentenceCues(item: GrammarExerciseItem): string[] {
  const prompt = item.prompt.replace(new RegExp(`^\\s*${item.number}\\s+`), '')
  const parenthesized = /\((.+)\)/.exec(prompt)?.[1]
  if (!parenthesized) return []
  return parenthesized
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
}

interface SentenceBuilderProps {
  item: GrammarExerciseItem
  status: ItemStatus
  openEnded: boolean
  onChange: (value: string) => void
  onCheck: () => void
}

function SentenceBuilder({ item, status, openEnded, onChange, onCheck }: SentenceBuilderProps) {
  const cues = useMemo(() => sentenceCues(item), [item])
  const [order, setOrder] = useState<number[]>([])
  const [dragging, setDragging] = useState<number | null>(null)

  const commit = (next: number[]) => {
    setOrder(next)
    onChange(next.map((index) => cues[index]).join(' '))
  }

  const append = (index: number) => {
    if (!order.includes(index)) commit([...order, index])
  }

  const remove = (index: number) => commit(order.filter((entry) => entry !== index))

  const insertAt = (index: number, target: number) => {
    const without = order.filter((entry) => entry !== index)
    const previousPosition = order.indexOf(index)
    const adjustedTarget = previousPosition >= 0 && previousPosition < target ? target - 1 : target
    without.splice(Math.max(0, Math.min(adjustedTarget, without.length)), 0, index)
    commit(without)
    setDragging(null)
  }

  const unused = cues
    .map((cue, index) => ({ cue, index }))
    .filter(({ index }) => !order.includes(index))

  return (
    <div className="mt-4 space-y-3 sm:ml-7">
      <div>
        <p className="text-text-secondary mb-2 text-sm font-bold">点击词组加入句子</p>
        <div className="bg-surface-dim/70 flex min-h-12 flex-wrap gap-2 rounded-xl p-2">
          {unused.map(({ cue, index }) => (
            <Button
              key={index}
              type="button"
              draggable
              onDragStart={() => setDragging(index)}
              onDragEnd={() => setDragging(null)}
              onClick={() => append(index)}
              variant="outline"
              color="gray"
              size="3"
            >
              {cue}
            </Button>
          ))}
          {unused.length === 0 && (
            <span className="text-text-muted px-2 py-2 text-sm">所有词组已加入</span>
          )}
        </div>
      </div>

      <div>
        <p className="text-text-secondary mb-2 text-sm font-bold">你的句子</p>
        <div
          className={`flex min-h-16 flex-wrap items-center rounded-xl p-2 transition-colors ${
            status === 'correct'
              ? 'bg-app-green-light'
              : status === 'wrong'
                ? 'bg-app-red-light'
                : 'bg-app-purple-light/35'
          }`}
        >
          {Array.from({ length: order.length + 1 }, (_, slot) => (
            <span key={slot} className="contents">
              <span
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragging != null) insertAt(dragging, slot)
                }}
                className={`mx-0.5 h-10 rounded-full transition-[width,background-color] ${
                  dragging == null ? 'w-1' : 'bg-app-blue/25 w-3'
                }`}
                aria-hidden="true"
              />
              {slot < order.length && (
                <Button
                  type="button"
                  draggable
                  onDragStart={() => setDragging(order[slot])}
                  onDragEnd={() => setDragging(null)}
                  onClick={() => remove(order[slot])}
                  aria-label={`移除词组 ${cues[order[slot]]}`}
                  variant="outline"
                  color="gray"
                  size="3"
                >
                  {cues[order[slot]]}
                </Button>
              )}
            </span>
          ))}
          {order.length === 0 && (
            <span className="text-text-muted px-2 text-base">按顺序点击上方词组</span>
          )}
        </div>
        <p className="text-text-muted mt-1.5 text-xs">
          点击答案区中的词组可撤回；拖动词组可插入任意位置。
        </p>
      </div>

      {!openEnded && status === 'idle' && (
        <Button
          type="button"
          disabled={order.length !== cues.length}
          onClick={onCheck}
          variant="solid"
          color="blue"
          size="3"
        >
          检查答案
        </Button>
      )}
    </div>
  )
}

/** 二选一/多选题的单选卡片（multiple_choice）：选项来自 options 数组或题干 A / B 斜杠对 */
function ChoiceChips({
  item,
  selectedValue,
  status,
  onPick,
}: {
  item: GrammarExerciseItem
  selectedValue: string
  status: ItemStatus
  onPick: (v: string) => void
}) {
  let choices: string[] = item.options && item.options.length > 0 ? [...item.options] : []
  if (choices.length === 0) {
    const m = /([\w'’.\-]+(?: [\w'’.\-]+)?) \/ ([\w'’.\-]+(?: [\w'’.\-]+)?)/.exec(item.prompt)
    if (m) choices = [m[1], m[2]]
  }
  if (choices.length === 0) return null
  const judged = status === 'correct' || status === 'wrong'
  return (
    <div
      className="mt-4 grid gap-2 sm:grid-cols-2 sm:pl-9"
      role="radiogroup"
      aria-label={`第 ${item.number} 题选项`}
    >
      {choices.map((c, i) => {
        const presentation = choicePresentation(c, i)
        const isSelected = normalize(selectedValue) === normalize(c)
        const isAnswer = judged && isChoiceCorrect(item, c)
        return (
          // native-ok: 选项为多块内容（序号 + 文本 + ✓/× 标记）且按判分结果着色的 radio 卡片，Radix Button 的居中 inline-flex 会挤压
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={judged}
            onClick={() => onPick(c)}
            className={`focus-visible:ring-app-blue flex min-h-14 items-center gap-3 rounded-xl px-4 py-3 text-left text-base leading-relaxed font-semibold transition-[color,background-color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
              isAnswer
                ? 'bg-app-green-light text-app-green-dark shadow-sticker-sm'
                : isSelected && status === 'wrong'
                  ? 'bg-app-red-light text-app-red shadow-sticker-sm'
                  : judged
                    ? 'bg-surface-dim/70 text-text-muted'
                    : 'bg-surface-dim text-text-primary hover:bg-app-blue-light hover:text-app-blue-dark cursor-pointer active:scale-[0.99]'
            }`}
          >
            <span
              className={`w-6 shrink-0 text-center text-sm font-black ${
                isAnswer
                  ? 'text-app-green-dark'
                  : isSelected && status === 'wrong'
                    ? 'text-app-red'
                    : 'text-app-blue'
              }`}
            >
              {presentation.label}
            </span>
            <span className="min-w-0 leading-snug">{presentation.text}</span>
            {isAnswer && (
              <span className="ml-auto shrink-0 font-black" aria-hidden="true">
                ✓
              </span>
            )}
            {isSelected && status === 'wrong' && (
              <span className="ml-auto shrink-0 font-black" aria-hidden="true">
                ×
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function ItemCard({ item, values, status, onChange, onCheck, onPick, hideOptions }: ItemCardProps) {
  const response = exerciseResponse(item)
  const displayItem = response ? { ...item, prompt: response.prompt } : item
  const example = exerciseExample(item)
  const openEnded = !isGraded(item)
  const parts = promptParts(displayItem)
  const blankCount = parts.length - 1
  const isChoice = item.type === 'multiple_choice' && isGraded(item)
  const isFillBlank = item.type === 'fill_blank'
  const isSentenceCompletion = item.type === 'sentence_completion'
  const usesUnderlineBlank = isFillBlank || isSentenceCompletion
  const blankInputColumns = isSentenceCompletion ? 18 : 6
  const isWritingQuestion = item.type === 'short_answer' || item.type === 'sentence_completion'
  const needsWholeAnswer =
    item.type !== 'multiple_choice' && item.type !== 'matching' && blankCount === 0
  const cues = sentenceCues(displayItem)
  const usesSentenceBuilder = needsWholeAnswer && cues.length > 1
  const displayedParts = needsWholeAnswer
    ? [displayItem.prompt.replace(new RegExp(`^\\s*${item.number}\\s+`), '')]
    : parts
  const selectedChoice = values[0] ?? ''
  const selectedChoiceIndex =
    item.options?.findIndex((option) => normalize(option) === normalize(selectedChoice)) ?? -1
  const selectedChoiceText = selectedChoice
    ? choicePresentation(selectedChoice, Math.max(selectedChoiceIndex, 0)).text
    : ''

  if (example) {
    return (
      <div
        className="bg-app-purple-light/35 rounded-xl p-3 sm:p-4"
        role="note"
        aria-label={`第 ${item.number} 题参考示例`}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="text-app-purple text-sm font-black">{item.number}</span>
          <span className="bg-app-purple rounded-md px-2 py-0.5 text-[11px] font-black text-white">
            示例
          </span>
        </div>
        <div className="text-text-primary flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base leading-relaxed sm:text-[17px]">
          <span className="font-semibold">{example.cue}</span>
          <span className="border-app-purple/35 text-app-purple-dark border-b border-dashed px-2 pb-0.5 font-medium italic">
            {example.answer}
          </span>
          {example.suffix && <span className="font-semibold">{example.suffix}</span>}
        </div>
      </div>
    )
  }

  const inputClass = (idx: number) => {
    if (usesUnderlineBlank) {
      const base =
        'inline-block min-w-[6ch] max-w-full border-0 border-b-2 bg-transparent px-1 py-0.5 text-center text-base font-semibold text-text-primary outline-none transition-colors'
      if (status === 'idle') return `${base} border-border-light focus:border-app-blue`
      const expected = parseExpected(item, blankCount)
      const value = normalize(values[idx] ?? '')
      const correct =
        value !== '' &&
        (value === normalize(expected[idx] ?? expected[0] ?? '') ||
          expected.some((answer) => normalize(answer) === value))
      return correct
        ? `${base} border-app-green text-app-green-dark`
        : `${base} border-app-red text-app-red`
    }
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
      className={
        isChoice
          ? `border-border-light/70 border-b px-1 py-5 last:border-b-0 sm:px-2 ${
              status === 'correct'
                ? 'bg-app-green-light/20'
                : status === 'wrong'
                  ? 'animate-wiggle bg-app-red-light/20'
                  : 'bg-transparent'
            }`
          : isWritingQuestion
            ? `border-border-light/70 border-b px-1 py-5 last:border-b-0 sm:px-2 ${
                status === 'correct'
                  ? 'bg-app-green-light/20'
                  : status === 'wrong'
                    ? 'animate-wiggle bg-app-red-light/20'
                    : 'bg-transparent'
              }`
            : `rounded-xl p-3 ring-1 transition-shadow ${
                status === 'correct'
                  ? 'bg-app-green-light/40 ring-app-green/40'
                  : status === 'wrong'
                    ? 'animate-wiggle bg-app-red-light/30 ring-app-red/30'
                    : 'bg-surface ring-border-light'
              }`
      }
    >
      <div
        className={`text-text-primary flex flex-wrap items-center gap-y-2 leading-relaxed ${isChoice || isWritingQuestion ? 'text-[17px] sm:text-lg' : 'text-[15px]'}`}
      >
        <span
          className={
            isChoice || isWritingQuestion
              ? 'text-app-purple mr-2 inline-flex w-7 shrink-0 items-center justify-center text-sm font-black'
              : 'bg-surface-dim text-text-muted ring-border-light mr-1.5 inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-1'
          }
        >
          {item.number}
        </span>
        {displayedParts.map((part, i) => {
          const hasBlank = i < blankCount
          const spaceBeforeBlank = usesUnderlineBlank && /\s$/.test(part)
          const spaceAfterBlank = usesUnderlineBlank && /^\s/.test(displayedParts[i + 1] ?? '')
          const blankSpacing = `${spaceBeforeBlank ? 'ml-[0.3em]' : ''} ${spaceAfterBlank ? 'mr-[0.3em]' : ''}`
          let visiblePart = part
          if (usesUnderlineBlank && i > 0) visiblePart = visiblePart.replace(/^\s+/, '')
          if (usesUnderlineBlank && hasBlank) visiblePart = visiblePart.replace(/\s+$/, '')

          return (
            <span key={i} className="contents">
              {visiblePart}
              {i < blankCount &&
                (openEnded ? (
                  // native-ok: 嵌在句子中的行内填空输入框，需按文本宽度（size）与下划线样式贴合句子排版
                  <input
                    className={
                      usesUnderlineBlank
                        ? `border-border-light text-text-primary focus:border-app-purple inline-block max-w-full min-w-[6ch] border-0 border-b-2 bg-transparent px-1 py-0.5 text-center text-base font-medium outline-none ${blankSpacing}`
                        : 'border-border-light bg-surface-dim text-text-primary focus:border-app-purple mx-1 inline-block w-40 rounded-lg border-2 border-dashed px-2 py-0.5 text-[15px] font-medium outline-none'
                    }
                    size={
                      usesUnderlineBlank
                        ? Math.max(blankInputColumns, Array.from(values[i] ?? '').length + 1)
                        : undefined
                    }
                    value={values[i] ?? ''}
                    onChange={(e) => onChange(i, e.target.value)}
                    placeholder={usesUnderlineBlank ? undefined : '自由作答'}
                    aria-label={`第 ${item.number} 题第 ${i + 1} 个空`}
                  />
                ) : isChoice ? (
                  <span
                    className={`mx-2 inline-flex min-h-9 min-w-24 items-center justify-center rounded-md px-3 py-1 text-center text-base font-bold ${
                      status === 'correct'
                        ? 'bg-app-green-light text-app-green-dark'
                        : status === 'wrong'
                          ? 'bg-app-red-light text-app-red'
                          : 'bg-app-blue-light/70 text-app-blue-dark'
                    }`}
                  >
                    {selectedChoiceText || '请选择'}
                  </span>
                ) : (
                  // native-ok: 嵌在句子中的行内填空输入框，需按文本宽度（size）与下划线样式贴合句子排版
                  <input
                    className={`${inputClass(i)} ${usesUnderlineBlank ? blankSpacing : ''}`}
                    size={
                      usesUnderlineBlank
                        ? Math.max(blankInputColumns, Array.from(values[i] ?? '').length + 1)
                        : undefined
                    }
                    value={values[i] ?? ''}
                    onChange={(e) => onChange(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onCheck()
                    }}
                    aria-label={`第 ${item.number} 题第 ${i + 1} 个空`}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                ))}
            </span>
          )
        })}
        {response && (
          <span
            role="note"
            aria-label="固定回答"
            className="border-app-blue/40 bg-app-blue-light/45 text-text-primary ml-3 inline-flex rounded-r-lg border-l-2 px-3 py-1.5 font-medium"
          >
            {response.response}
          </span>
        )}
        {!openEnded && !isChoice && !needsWholeAnswer && status === 'idle' && (
          <Button
            onClick={onCheck}
            variant="solid"
            color="blue"
            size="1"
            className="ml-1.5 shrink-0"
          >
            检查
          </Button>
        )}
        {status === 'correct' && (
          <span className="text-app-green-dark ml-1.5 text-sm font-bold">✔ 正确</span>
        )}
        {openEnded && <span className="text-text-muted ml-2 text-xs font-medium">自由作答</span>}
      </div>
      {usesSentenceBuilder && (
        <SentenceBuilder
          item={item}
          status={status}
          openEnded={openEnded}
          onChange={(value) => onChange(0, value)}
          onCheck={onCheck}
        />
      )}
      {needsWholeAnswer && !usesSentenceBuilder && (
        <div
          className={`mt-3 flex flex-col gap-2 sm:flex-row sm:items-center ${isWritingQuestion ? 'sm:ml-9' : 'sm:ml-7'}`}
        >
          <TextField.Root
            size="3"
            variant={status === 'correct' || status === 'wrong' ? 'soft' : 'surface'}
            color={status === 'correct' ? 'green' : status === 'wrong' ? 'red' : undefined}
            aria-label={`第 ${item.number} 题完整答案`}
            value={values[0] ?? ''}
            onChange={(event) => onChange(0, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !openEnded) onCheck()
            }}
            placeholder={openEnded ? '输入你的答案' : '写出完整句子'}
            autoComplete="off"
            autoCapitalize="sentences"
            spellCheck={false}
            className="min-w-0 flex-1"
          />
          {!openEnded && status === 'idle' && (
            <Button
              type="button"
              disabled={!values[0]?.trim()}
              onClick={onCheck}
              variant="solid"
              color="blue"
              size="3"
              className="shrink-0"
            >
              检查答案
            </Button>
          )}
        </div>
      )}
      {/* 选择/匹配类题目的选项列表（未共享渲染时才展示；multiple_choice 用 chips 展示） */}
      {isChoice && (
        <ChoiceChips item={item} selectedValue={selectedChoice} status={status} onPick={onPick} />
      )}
      {!hideOptions && item.options && item.options.length > 0 && !isChoice && (
        <ReferenceOptions options={item.options} />
      )}
      {status === 'wrong' && item.answer && (
        <div className="text-text-secondary mt-1.5 pl-7 text-[13px]">
          参考答案：<span className="text-text-primary font-semibold">{item.answer}</span>
        </div>
      )}
      {status !== 'idle' && item.explanation && (
        <div className="bg-app-blue-light/55 text-app-blue-dark mt-2 rounded-lg px-3 py-2 text-[13px] leading-relaxed sm:ml-7">
          💡 {item.explanation}
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
  onEditGroup?: (groupIdx: number) => void
  onPreviewFigure: (figure: GrammarFigure) => void
  onRemoveFigure?: (groupIdx: number) => void
}

type MatchingSelection =
  | { side: 'left'; itemNumber: number }
  | { side: 'right'; option: string }
  | null

interface MatchingLine {
  itemNumber: number
  path: string
}

interface MatchingBoardProps {
  items: GrammarExerciseItem[]
  options: string[]
  matches: Record<number, string>
  statuses: Record<number, ItemStatus>
  onMatch: (item: GrammarExerciseItem, option: string) => void
}

function MatchingBoard({ items, options, matches, statuses, onMatch }: MatchingBoardProps) {
  const [selection, setSelection] = useState<MatchingSelection>(null)
  const [lines, setLines] = useState<MatchingLine[]>([])
  const boardRef = useRef<HTMLDivElement>(null)
  const leftRefs = useRef(new Map<number, HTMLButtonElement>())
  const rightRefs = useRef(new Map<string, HTMLButtonElement>())

  const updateLines = useCallback(() => {
    const board = boardRef.current
    if (!board) return
    const boardRect = board.getBoundingClientRect()
    const nextLines = items.flatMap((item) => {
      const option = matches[item.number]
      const left = leftRefs.current.get(item.number)
      const right = option ? rightRefs.current.get(option) : undefined
      if (!left || !right) return []
      const leftRect = left.getBoundingClientRect()
      const rightRect = right.getBoundingClientRect()
      const startX = leftRect.right - boardRect.left
      const startY = leftRect.top + leftRect.height / 2 - boardRect.top
      const endX = rightRect.left - boardRect.left
      const endY = rightRect.top + rightRect.height / 2 - boardRect.top
      const curve = Math.max((endX - startX) * 0.45, 12)
      return [
        {
          itemNumber: item.number,
          path: `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`,
        },
      ]
    })
    setLines(nextLines)
  }, [items, matches])

  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    const observer = new ResizeObserver(updateLines)
    observer.observe(board)
    leftRefs.current.forEach((element) => observer.observe(element))
    rightRefs.current.forEach((element) => observer.observe(element))
    const frame = requestAnimationFrame(updateLines)
    window.addEventListener('resize', updateLines)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateLines)
      observer.disconnect()
    }
  }, [options, updateLines])

  const connect = (itemNumber: number, option: string) => {
    const item = items.find((candidate) => candidate.number === itemNumber)
    if (item) onMatch(item, option)
    setSelection(null)
  }

  const selectLeft = (itemNumber: number) => {
    if (selection?.side === 'right') {
      connect(itemNumber, selection.option)
      return
    }
    setSelection(
      selection?.side === 'left' && selection.itemNumber === itemNumber
        ? null
        : { side: 'left', itemNumber },
    )
  }

  const selectRight = (option: string) => {
    if (selection?.side === 'left') {
      connect(selection.itemNumber, option)
      return
    }
    setSelection(
      selection?.side === 'right' && selection.option === option ? null : { side: 'right', option },
    )
  }

  const matchedItemForOption = (option: string) =>
    items.find((item) => normalize(matches[item.number] ?? '') === normalize(option))

  return (
    <div>
      <p className="text-text-secondary mb-4 text-sm font-semibold">
        点击任意一侧，再点击另一侧完成连线；已连接的项目可以重新匹配。
      </p>
      <div
        ref={boardRef}
        className="relative grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-10 sm:gap-x-20"
      >
        <svg
          className="pointer-events-none absolute inset-0 z-0 size-full overflow-visible"
          aria-hidden="true"
        >
          {lines.map((line) => {
            const status = statuses[line.itemNumber]
            return (
              <path
                key={line.itemNumber}
                d={line.path}
                fill="none"
                stroke={
                  status === 'correct'
                    ? 'var(--color-app-green)'
                    : status === 'wrong'
                      ? 'var(--color-app-red)'
                      : 'var(--color-app-purple)'
                }
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.75"
              />
            )
          })}
        </svg>

        <div className="relative z-10 min-w-0 space-y-3">
          <p className="text-app-purple-dark text-sm font-black">问题</p>
          {items.map((item) => {
            const selected = selection?.side === 'left' && selection.itemNumber === item.number
            const matched = Boolean(matches[item.number])
            const status = statuses[item.number]
            return (
              // native-ok: 连线匹配题的左侧格子，需 ref 定位以绘制 SVG 连线，且为多状态着色的块状单元
              <button
                key={item.number}
                ref={(element) => {
                  if (element) leftRefs.current.set(item.number, element)
                  else leftRefs.current.delete(item.number)
                }}
                type="button"
                aria-pressed={selected}
                onClick={() => selectLeft(item.number)}
                className={`focus-visible:ring-app-blue flex min-h-14 w-full items-center gap-2 rounded-xl p-2 text-left text-base leading-relaxed font-semibold transition-[background-color,color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.99] ${
                  selected
                    ? 'bg-app-blue-light text-app-blue-dark shadow-sticker-sm'
                    : status === 'correct'
                      ? 'bg-app-green-light text-app-green-dark'
                      : status === 'wrong'
                        ? 'bg-app-red-light text-app-red'
                        : matched
                          ? 'bg-app-purple-light/60 text-app-purple-dark'
                          : 'bg-surface-dim text-text-primary hover:bg-app-blue-light/60'
                }`}
              >
                <span className="text-app-purple w-6 shrink-0 text-center text-sm font-black">
                  {item.number}
                </span>
                <span className="min-w-0">{item.prompt}</span>
              </button>
            )
          })}
        </div>

        <div className="relative z-10 min-w-0 space-y-3">
          <p className="text-app-purple-dark text-sm font-black">答案</p>
          {options.map((option, index) => {
            const presentation = choicePresentation(option, index)
            const matchedItem = matchedItemForOption(option)
            const selected = selection?.side === 'right' && selection.option === option
            const status = matchedItem ? statuses[matchedItem.number] : 'idle'
            return (
              // native-ok: 连线匹配题的右侧格子，需 ref 定位以绘制 SVG 连线，且为多状态着色的块状单元
              <button
                key={option}
                ref={(element) => {
                  if (element) rightRefs.current.set(option, element)
                  else rightRefs.current.delete(option)
                }}
                type="button"
                aria-pressed={selected}
                onClick={() => selectRight(option)}
                className={`focus-visible:ring-app-blue flex min-h-14 w-full items-center gap-2 rounded-xl p-2 text-left text-base leading-relaxed font-semibold transition-[background-color,color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.99] ${
                  selected
                    ? 'bg-app-blue-light text-app-blue-dark shadow-sticker-sm'
                    : status === 'correct'
                      ? 'bg-app-green-light text-app-green-dark'
                      : status === 'wrong'
                        ? 'bg-app-red-light text-app-red'
                        : matchedItem
                          ? 'bg-app-purple-light/60 text-app-purple-dark'
                          : 'bg-surface-dim text-text-primary hover:bg-app-blue-light/60'
                }`}
              >
                <span className="text-app-purple w-6 shrink-0 text-center text-sm font-black">
                  {presentation.label}
                </span>
                <span className="min-w-0">{presentation.text}</span>
              </button>
            )
          })}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {selection?.side === 'left'
          ? `已选择第 ${selection.itemNumber} 题，请选择右侧答案`
          : selection?.side === 'right'
            ? '已选择右侧答案，请选择左侧问题'
            : ''}
      </p>
    </div>
  )
}

function ExerciseGroup({
  group,
  groupIdx,
  isAdmin,
  figureSourceUrl,
  onGroupResult,
  onPageClick,
  onStartCrop,
  onEditGroup,
  onPreviewFigure,
  onRemoveFigure,
}: ExerciseGroupProps) {
  const [inputs, setInputs] = useState<Record<string, string[]>>({})
  const [statuses, setStatuses] = useState<Record<number, ItemStatus>>({})
  const [resetVersion, setResetVersion] = useState(0)

  const itemKey = (n: number) => `g${groupIdx}-${n}`
  const graded = useMemo(() => group.items.filter(isGraded), [group.items])
  const shared = useMemo(() => sharedOptions(group.items), [group.items])
  const isMatchingGroup =
    group.items.length > 0 && group.items.every((item) => item.type === 'matching')
  const matchingOptions = isMatchingGroup ? (shared ?? group.items[0]?.options ?? []) : []
  const correctCount = graded.filter((it) => statuses[it.number] === 'correct').length
  const allJudged =
    graded.length > 0 &&
    graded.every((it) => statuses[it.number] === 'correct' || statuses[it.number] === 'wrong')

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
        v === normalize(expected[i] ?? expected[0] ?? '') ||
        expected.some((e) => normalize(e) === v),
    )
    setStatuses((prev) => ({ ...prev, [item.number]: ok ? 'correct' : 'wrong' }))
  }

  const handleReset = () => {
    setInputs({})
    setStatuses({})
    setResetVersion((version) => version + 1)
    reportedRef.current = ''
  }

  const handlePick = (item: GrammarExerciseItem, value: string) => {
    const blankCount = promptParts(item).length - 1
    const slots = Math.max(blankCount, 1)
    setInputs((prev) => ({
      ...prev,
      [itemKey(item.number)]: Array.from({ length: slots }, (_, i) => (i === 0 ? value : '')),
    }))
    const ok = isChoiceCorrect(item, value)
    setStatuses((prev) => ({ ...prev, [item.number]: ok ? 'correct' : 'wrong' }))
  }

  const handleMatch = (item: GrammarExerciseItem, option: string) => {
    const itemStatus: ItemStatus = isChoiceCorrect(item, option) ? 'correct' : 'wrong'
    const previousOwner = group.items.find(
      (candidate) =>
        candidate.number !== item.number &&
        normalize(inputs[itemKey(candidate.number)]?.[0] ?? '') === normalize(option),
    )
    setInputs((prev) => {
      const next = { ...prev, [itemKey(item.number)]: [option] }
      if (previousOwner) delete next[itemKey(previousOwner.number)]
      return next
    })
    setStatuses((prev) => {
      const next = { ...prev, [item.number]: itemStatus }
      if (previousOwner) delete next[previousOwner.number]
      return next
    })
  }

  return (
    <section className="bg-surface shadow-sticker-sm ring-border-light rounded-2xl p-4 ring-1 sm:p-5">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center justify-center rounded-lg bg-pink-600 px-2.5 py-1 text-sm font-black text-white">
          {group.section}
        </span>
        <p className="text-text-primary min-w-0 flex-1 text-sm font-semibold">
          {group.instruction}
        </p>
        {typeof group.bookPage === 'number' && (
          <Button
            type="button"
            onClick={() => onPageClick?.(group.bookPage!)}
            variant="outline"
            color={onPageClick ? 'blue' : 'gray'}
            size="1"
            className="shrink-0"
          >
            p.{group.bookPage}
          </Button>
        )}
        {isAdmin &&
          onStartCrop &&
          !group.figure &&
          figureSourceUrl &&
          typeof group.bookPage === 'number' && (
            <Button
              type="button"
              onClick={() => onStartCrop?.(groupIdx)}
              variant="outline"
              color="purple"
              size="1"
              className="shrink-0"
            >
              ＋ 插图
            </Button>
          )}
        {graded.length > 0 && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
              correctCount === graded.length && allJudged
                ? 'bg-app-green-light text-app-green-dark'
                : 'bg-surface-dim text-text-muted ring-border-light ring-1'
            }`}
          >
            {correctCount}/{graded.length}
          </span>
        )}
        {isAdmin && onEditGroup && (
          <IconButton
            type="button"
            onClick={() => onEditGroup(groupIdx)}
            aria-label={`编辑练习组 ${group.section}`}
            title="编辑本组"
            variant="ghost"
            color="purple"
            size="2"
            className="shrink-0"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.2 5.2 18.8 8.8M4 20l4.4-1 10.8-10.8a2.55 2.55 0 0 0-3.6-3.6L4.8 15.4 4 20Z"
              />
            </svg>
          </IconButton>
        )}
      </header>
      {group.figure && (
        <FigureCard
          figure={group.figure}
          isAdmin={isAdmin}
          onPreview={onPreviewFigure}
          onRecrop={
            figureSourceUrl && isAdmin && onStartCrop ? () => onStartCrop(groupIdx) : undefined
          }
          onRemove={isAdmin && onRemoveFigure ? () => onRemoveFigure(groupIdx) : undefined}
        />
      )}
      {shared && !isMatchingGroup && <ReferenceOptions options={shared} />}
      {isMatchingGroup && matchingOptions.length > 0 ? (
        <MatchingBoard
          key={resetVersion}
          items={group.items}
          options={matchingOptions}
          matches={Object.fromEntries(
            group.items.map((item) => [item.number, inputs[itemKey(item.number)]?.[0] ?? '']),
          )}
          statuses={statuses}
          onMatch={handleMatch}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {group.items.map((item) => (
            <ItemCard
              key={`${item.number}-${resetVersion}`}
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
                setStatuses((prev) =>
                  prev[item.number] ? { ...prev, [item.number]: 'idle' } : prev,
                )
              }}
              onCheck={() => handleCheck(item)}
              onPick={(value) => handlePick(item, value)}
            />
          ))}
        </div>
      )}
      {Object.keys(statuses).length > 0 && (
        <Button onClick={handleReset} variant="ghost" color="gray" size="1" className="mt-3">
          重做本组
        </Button>
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
  onEditGroup?: (groupIdx: number) => void
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
  onEditGroup,
  onPreviewFigure,
  onRemoveFigure,
}: ExerciseViewProps) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group, i) => {
        const src =
          typeof group.bookPage === 'number'
            ? pageImages.find((img) => img.page === group.bookPage)
            : undefined
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
            onEditGroup={onEditGroup}
            onPreviewFigure={onPreviewFigure}
            onRemoveFigure={onRemoveFigure}
          />
        )
      })}
    </div>
  )
}
