'use client'

import { AnswerChoiceGroup, MatchingBoard } from '@rosie/ui'
import { Checkbox, Flex, Text, TextArea } from '@rosie/ui/themes'
import type { Question, QuestionGroup, Solution, ExamAnswer, ExamQuestionResult } from '../index'
import { ExamMaterialBlocks, examMediaUrl } from './ExamMaterialBlocks'
import { useContext, type ReactNode } from 'react'
import { ExamAuthoringRegion } from './ExamAuthoringRegion'
import { ExamRenderContext } from './ExamRenderContext'
import { ExamInlineAnswer } from './ExamInlineAnswer'
import { ExamOptionImage } from './ExamOptionImage'
import { ExamGapAnswer } from './ExamGapAnswer'
import type { ExamOption, MaterialBlock } from '../types/content'
import { useExamImageFocus } from './ExamImageFocusContext'
import { ExamTitleAudioContext } from './ExamInlineAudio'
import { visibleExamPrompt } from './examPromptPresentation'
import { exampleAnswerIsVisible } from './ExamAlignedQuestion'

type Props = {
  question: Question; group: QuestionGroup; attemptId: string; answer?: ExamAnswer; disabled?: boolean
  onChange: (answer: ExamAnswer) => void; result?: ExamQuestionResult; solution?: Solution
  speaking?: ReactNode
  hideControls?: boolean
  /** Instructions already displayed above this activity; never changes the stored prompt. */
  sharedInstructions?: readonly MaterialBlock[]
  renderOptionImage?: (option: ExamOption) => ReactNode
  adminRevisionId?: string
  renderImage?: (slotId: string, alt: string, aspectRatio?: number, displayWidth?: number) => ReactNode
}

export function ExamQuestionFields({ question, group, attemptId, answer, disabled = false, onChange, result, solution, speaking, adminRevisionId, renderImage, renderOptionImage, hideControls = false, sharedInstructions = [] }: Props) {
  const context = useContext(ExamRenderContext)
  const titleAudio = useContext(ExamTitleAudioContext)
  const imageFocus = useExamImageFocus()
  const inlined = (gapId?: string) => context?.inlineSlots.some(slot => slot.questionId === question.id && slot.gapId === gapId) ?? false
  const pool = (question.answerType === 'matching' || question.answerType === 'gap_fill') && question.optionPoolId
    ? group.optionPools.find(item => item.id === question.optionPoolId) : null
  const sourcePrompt = question.prompt.length || question.answerType !== 'matching'
    ? question.prompt : question.items.flatMap(item => [...item.prompt])
  const prompt = visibleExamPrompt(sourcePrompt, sharedInstructions).filter(block => !(block.kind === 'audio' && titleAudio.includes(block.mediaSlotId)))
  return <Flex direction="column" gap="4">
    {prompt.length > 0 && <ExamMaterialBlocks blocks={prompt} attemptId={attemptId} adminRevisionId={adminRevisionId} renderImage={renderImage} />}
    {question.scoring.kind === 'example' ? (!exampleAnswerIsVisible(question, sourcePrompt) && <Text>{question.exampleText ?? '例题答案见原题材料'}</Text>) : <>
    {!hideControls && !inlined() && question.answerType === 'single_choice' && <ExamAuthoringRegion target={{ kind: 'options', groupId: group.id, questionId: question.id }}><AnswerChoiceGroup
      label={`第 ${question.location.questionNumber} 题选项`} optionLang="en"
      layout={question.options.some(option => option.imageSlotId) ? 'images' : 'list'} reserveFeedbackSpace={false}
      onOptionPreview={imageFocus.open ? (id, event) => imageFocus.open?.(event, question.options.find(option => option.id === id)?.imageSlotId) : undefined}
      options={question.options.map(option => ({ id: option.id, label: option.label, imageMaxWidth: imageFocus.expanded ? undefined : option.displayWidth, content: option.imageSlotId
        ? <div data-exam-image-slot={option.imageSlotId}>{renderOptionImage ? renderOptionImage(option) : <ExamOptionImage src={examMediaUrl(attemptId, option.imageSlotId, 'student', adminRevisionId)} alt={option.label} region={option.imageRegion} displayWidth={option.displayWidth} />}</div> : undefined }))}
      value={answer?.type === 'single_choice' ? answer.optionId : ''} onValueChange={optionId => onChange({ type: 'single_choice', optionId })}
      readOnly={disabled} feedback={solution?.answerType === 'single_choice' && result && ['correct', 'incorrect', 'unanswered'].includes(result.outcome)
        ? { status: result.outcome === 'correct' ? 'correct' : 'incorrect', correctOptionId: solution.correctOptionId, message: result.outcome === 'correct' ? '答对了' : '查看依据，再想一想' } : undefined} /></ExamAuthoringRegion>}
    {question.answerType === 'single_choice' && inlined() && solution?.answerType === 'single_choice' && <Text>正确选项：{solution.correctOptionId} · {question.options.find(option => option.id === solution.correctOptionId)?.label}</Text>}
    {!hideControls && question.answerType === 'multiple_choice' && <ExamAuthoringRegion target={{ kind: 'options', groupId: group.id, questionId: question.id }}><Flex direction="column" gap="3">
      <Text>请选择 {question.selectionCount} 项（已选 {answer?.type === 'multiple_choice' ? answer.optionIds.length : 0} 项）</Text>
      {question.options.map(option => {
        const selected = answer?.type === 'multiple_choice' ? answer.optionIds : []
        const checked = selected.includes(option.id)
        return <Text as="label" key={option.id} size="3" weight="regular"><Flex gap="3" align="center">
          <Checkbox size="3" checked={checked} disabled={disabled || (!checked && selected.length >= question.selectionCount)}
            onCheckedChange={next => onChange({ type: 'multiple_choice', optionIds: next === true ? [...selected, option.id] : selected.filter(id => id !== option.id) })} />
          {option.label}
        </Flex></Text>
      })}
    </Flex></ExamAuthoringRegion>}
    {!hideControls && question.answerType === 'gap_fill' && question.gaps.filter(gap => !inlined(gap.id)).map(gap => <Flex key={gap.id} direction="column" gap="2">
      <Text>{gap.label}{gap.maxWords ? `（最多 ${gap.maxWords} 词）` : ''}</Text>
      {context ? <div><ExamInlineAnswer slot={{ start: 0, end: 1, questionId: question.id, gapId: gap.id }} /></div>
        : <ExamGapAnswer label={`${question.location.questionNumber} · ${gap.label}`} gapId={gap.id} maxWords={gap.maxWords ?? undefined}
          answer={answer?.type === 'gap_fill' ? answer : undefined} readOnly={disabled} onChange={onChange} />}
    </Flex>)}
    {!hideControls && question.answerType === 'matching' && pool && <MatchingBoard layout="columns"
      items={question.items.map(item => ({ id: item.id, label: item.prompt.filter(block => block.kind === 'text').map(block => block.text).join(' ') || item.id }))}
      options={pool.options} value={answer?.type === 'matching' ? answer.matches : {}} allowReuse={pool.allowReuse} readOnly={disabled}
      onValueChange={matches => onChange({ type: 'matching', matches })} />}
    </>}
    {question.answerType === 'writing' && !hideControls && <>
      <TextArea size="3" rows={9} resize="vertical" aria-label="写作答案" readOnly={disabled} value={answer?.type === 'writing' ? answer.text : ''} onChange={event => onChange({ type: 'writing', text: event.target.value })} />
      <Text size="2" color="gray">{answer?.type === 'writing' && answer.text.trim() ? answer.text.trim().split(/\s+/).length : 0} 词{question.targetWords ? ` · 目标约 ${question.targetWords} 词` : question.minimumWords ? ` · 要求至少 ${question.minimumWords} 词` : ''}</Text>
    </>}
    {question.answerType === 'self_check' && question.checklist.map(item => <Text key={item.id} as="label"><Flex gap="2" align="center"><Checkbox disabled={disabled} checked={answer?.type === 'self_check' && answer.checkedIds.includes(item.id)} onCheckedChange={checked => {
      const previous = answer?.type === 'self_check' ? answer.checkedIds : []
      onChange({ type: 'self_check', checkedIds: checked === true ? [...new Set([...previous, item.id])] : previous.filter(id => id !== item.id) })
    }} />{item.label}</Flex></Text>)}
    {question.answerType === 'speaking' && speaking}
    {result?.outcome === 'pending' && <Text color="amber">已提交，等待家长批改。</Text>}
    {solution && solution.explanations.map((explanation, index) => <Text key={index} as="p" size="3">{explanation.text}</Text>)}
  </Flex>
}
