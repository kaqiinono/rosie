'use client'

import { useContext } from 'react'
import { InlineChoiceField } from '@rosie/ui'
import { ExamGapAnswer } from './ExamGapAnswer'
import type { AnswerSlot } from '../types/content'
import { ExamRenderContext } from './ExamRenderContext'

export function ExamInlineAnswer({ slot }: { slot: AnswerSlot }) {
  const context = useContext(ExamRenderContext)
  const question = context?.group.questions.find(q => q.id === slot.questionId)
  if (!context || !question) return null
  const answer = context.answers[question.id]
  const label = question.location.questionNumber
  if (question.scoring.kind === 'example') return <strong>{question.exampleText ?? '例题'}</strong>
  if (question.answerType === 'single_choice') return <InlineChoiceField label={label} options={question.options}
    value={answer?.type === 'single_choice' ? answer.optionId : ''} readOnly={context.disabled}
    onValueChange={optionId => context.onAnswer(question.id, { type: 'single_choice', optionId })} />
  if (question.answerType !== 'gap_fill') return null
  const gap = question.gaps.find(item => item.id === slot.gapId)
  if (!gap) return null
  const value = answer?.type === 'gap_fill' ? answer.values[gap.id] ?? '' : ''
  const change = (next: string) => context.onAnswer(question.id, { type: 'gap_fill', values: { ...(answer?.type === 'gap_fill' ? answer.values : {}), [gap.id]: next } })
  const pool = context.group.optionPools.find(item => item.id === question.optionPoolId)
  if (pool) {
    const occupied = new Set<string>()
    if (!pool.allowReuse) for (const other of context.group.questions) {
      if (other.answerType !== 'gap_fill' || other.optionPoolId !== pool.id) continue
      if (other.scoring.kind === 'example' && other.exampleText) occupied.add(other.exampleText)
      const stored = context.answers[other.id]
      if (stored?.type === 'gap_fill') for (const [id, text] of Object.entries(stored.values)) {
        if (other.id !== question.id || id !== gap.id) occupied.add(text)
      }
    }
    const options = pool.options.map(option => ({ ...option, disabled: occupied.has(option.label) }))
    return <InlineChoiceField label={question.gaps.length > 1 ? `${label} · ${gap.label}` : label} options={options}
      sentenceOptions={question.classification.questionTypeId === 'gapped_text'}
      value={pool.options.find(option => option.label === value)?.id ?? ''} readOnly={context.disabled}
      onValueChange={id => change(pool.options.find(option => option.id === id)?.label ?? '')} />
  }
  return <ExamGapAnswer label={question.gaps.length > 1 ? `${label} · ${gap.label}` : label} gapId={gap.id} maxWords={gap.maxWords ?? undefined}
    answer={answer?.type === 'gap_fill' ? answer : undefined} readOnly={context.disabled}
    letter={context.group.activities?.find(activity => activity.questionIds.includes(question.id))?.handwritingSize === 'letter'}
    handwritingEnabled={context.handwritingEnabled} inlineTarget={context.handwritingOutlet}
    onEditingChange={editing => context.onHandwritingEditing?.(`${question.id}/${gap.id}`, editing)}
    onChange={next => context.onAnswer(question.id, next)} />
}
