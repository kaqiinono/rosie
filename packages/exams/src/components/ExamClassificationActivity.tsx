'use client'

import { useContext, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { JudgmentIconButton, LetterChoiceButton, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Heading, Text } from '@rosie/ui/themes'
import type { ExamActivity } from '../types/content'
import type { ExamAnswer } from '../types/attempts'
import type { ExamGroupRendererProps } from './ExamGroupRenderer'
import { ExamMaterialBlocks } from './ExamMaterialBlocks'
import { ExamAuthoringContext, ExamAuthoringRegion } from './ExamAuthoringRegion'
import { ExamReadingMaterial } from './ExamReadingMaterial'
import { exampleAnswerIsVisible } from './ExamAlignedQuestion'
import { ExamGapAnswer } from './ExamGapAnswer'
import { ExamTitleAudioContext } from './ExamInlineAudio'
import { ExamInstructionToolsContext } from './ExamTextHeading'
import { visibleExamPrompt } from './examPromptPresentation'

/** Printed options stay in the source language. Editor glosses such as （同意） are not part of the paper. */
function paperOptionLabel(label: string) {
  return label.replace(/（[^）]*）/g, '').replace(/[ \t]*\p{Script=Han}+[ \t]*/gu, ' ').replace(/\s{2,}/g, ' ').trim()
}

type Props = Pick<ExamGroupRendererProps, 'group' | 'materials' | 'answers' | 'onAnswer' | 'disabled' |
  'handwritingEnabled' | 'onHandwritingEditing' | 'solutions' | 'results' | 'renderQuestion' |
  'renderQuestionTools' | 'renderMaterial' | 'attemptId' | 'adminRevisionId' | 'renderImage'> & { activity: ExamActivity }

/** Both modes commit the original value/ink contract; only the active mode is saved. */
export function ExamClassificationActivity({ activity, group, materials, answers, onAnswer, disabled,
  handwritingEnabled, onHandwritingEditing, solutions, results, renderQuestion, renderQuestionTools, renderMaterial,
  attemptId, adminRevisionId, renderImage }: Props) {
  const authoring = useContext(ExamAuthoringContext)
  const titleAudio = useContext(ExamTitleAudioContext)
  const sharedInstructions = group.instructions.filter(block => activity.instructionIds.includes(block.id))
  const questions = group.questions.filter(question => activity.questionIds.includes(question.id))
  const scoredQuestions = questions.filter(question => question.scoring.kind !== 'example')
  const promptLabels = scoredQuestions.map(question => visibleExamPrompt(question.prompt, sharedInstructions).map(block => block.kind === 'text' ? block.text.trim() : '').join(' ').trim())
  const compact = scoredQuestions.length > 0 && scoredQuestions.every((question, index) =>
    question.prompt.every(block => block.kind === 'text' && !block.answerSlots?.length && !block.presentation && !block.sentences?.length)
    && promptLabels[index].length > 0 && promptLabels[index].length <= 24
    && promptLabels[index].split(/\s+/).length <= 3 && !promptLabels[index].includes('\n'))
  const measure = useRef<HTMLDivElement>(null)
  const [promptWidth, setPromptWidth] = useState<number>()
  const labelKey = JSON.stringify(promptLabels)
  useLayoutEffect(() => {
    if (!measure.current) return
    const labels = [...measure.current.children]
    const update = () => setPromptWidth(Math.ceil(Math.max(0, ...labels.map(label => label.getBoundingClientRect().width))))
    update()
    const observer = new ResizeObserver(update)
    labels.forEach(label => observer.observe(label))
    return () => observer.disconnect()
  }, [labelKey])
  const [requestedMode, setRequestedMode] = useState<boolean | null>(null)
  const [drawing, setDrawing] = useState<ReadonlySet<string>>(new Set())
  const backups = useRef<Record<string, Record<string, ExamAnswer>>>({})
  const hasInk = questions.some(question => {
    const answer = answers[question.id]
    return answer?.type === 'gap_fill' && Object.keys(answer.ink ?? {}).length > 0
  })
  const handwriting = requestedMode ?? hasInk
  const presentation = activity.choicePresentation
  const media = { attemptId, adminRevisionId, renderImage }
  const topicHeadings = sharedInstructions.filter(block => block.kind === 'text' && block.presentation?.role === 'heading')
  const activityDirections = sharedInstructions.filter(block => !(block.kind === 'text' && block.presentation?.role === 'heading'))
  const activityMaterials = materials.filter(material => activity.materialIds.includes(material.id))
  const numberedInstruction = activityDirections.some(block => block.kind === 'text' && block.presentation?.role === 'instruction' && block.presentation.number)
  if (!presentation) return null
  const toggle = () => {
    if (disabled || !handwritingEnabled || drawing.size) return
    const current = handwriting ? 'ink' : 'choice'
    const next = handwriting ? 'choice' : 'ink'
    backups.current[current] = Object.fromEntries(questions.flatMap(question => answers[question.id] ? [[question.id, answers[question.id]]] : []))
    setRequestedMode(!handwriting)
    for (const question of questions) {
      if (question.answerType !== 'gap_fill' || question.scoring.kind === 'example') continue
      onAnswer(question.id, backups.current[next]?.[question.id] ?? { type: 'gap_fill', values: {} })
    }
  }
  return <Flex direction="column" gap="4" className="relative @container">
    <div ref={measure} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 h-0 w-0 overflow-hidden text-base font-normal leading-relaxed" lang="en">
      {promptLabels.map((label, index) => <span key={index} className="block w-max whitespace-pre">{label}</span>)}
    </div>
    {topicHeadings.length > 0 && <ExamMaterialBlocks blocks={topicHeadings} {...media} />}
    <Flex direction="column" gap="3">
    <ExamInstructionToolsContext.Provider value={numberedInstruction && (scoredQuestions.length > 0 || !disabled) ? <>
      {scoredQuestions.length > 0 && <Badge variant="soft" radius="full" color="gray">{scoredQuestions.length} 题</Badge>}
      {!disabled && <Button size="1" variant={handwriting ? 'solid' : 'soft'} aria-pressed={handwriting}
        disabled={!handwritingEnabled || drawing.size > 0} onClick={toggle}>手写模式</Button>}
    </> : null}>
      <ExamMaterialBlocks blocks={activityDirections} {...media} />
    </ExamInstructionToolsContext.Provider>
    {!numberedInstruction && <Flex align="center" gap="3" wrap="wrap">
      {activity.title && <ExamAuthoringRegion target={{ kind: 'activity', groupId: group.id, activityId: activity.id, field: 'title' }}><Heading as="h4" size="3">{activity.title}</Heading></ExamAuthoringRegion>}
      {scoredQuestions.length > 0 && <Badge variant="soft" radius="full" color="gray">{scoredQuestions.length} 题</Badge>}
      {!disabled && <Button size="1" variant={handwriting ? 'solid' : 'soft'} aria-pressed={handwriting}
        disabled={!handwritingEnabled || drawing.size > 0} onClick={toggle}>手写模式</Button>}
    </Flex>}
    {activityMaterials.map(material => {
      const content = <ExamReadingMaterial material={material} {...media} />
      return <Flex key={material.id} direction="column" gap="2">
        <Text size="2" weight="bold" color="gray">{material.title || '共用图片'}</Text>
        {renderMaterial ? renderMaterial(material, content) : <StickerCard tone="paper" elevation="flat">{content}</StickerCard>}
      </Flex>
    })}
    <ExamAuthoringRegion target={{ kind: 'activity', groupId: group.id, activityId: activity.id, field: 'choices' }}><Text size="2" color="gray">{presentation.options.map(option => paperOptionLabel(option.label)).join(' · ')}</Text></ExamAuthoringRegion>
    <div className="grid min-w-0 items-stretch gap-3" style={{
      // Number + card padding = 3rem; space-2 covers the heading gap and gaps between choices.
      '--exam-choice-width': `calc(${(promptWidth ?? 96) + presentation.options.length * 32 + (authoring ? 32 : 0)}px + 3rem + var(--space-3) + ${presentation.options.length} * var(--space-2))`,
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, var(--exam-choice-width)), 1fr))',
    } as CSSProperties}>
      {[...questions.filter(question => question.scoring.kind === 'example'), ...scoredQuestions].map(question => {
        if (question.answerType !== 'gap_fill') return null
        const gap = question.gaps[0]
        const answer = answers[question.id]
        const stored = answer?.type === 'gap_fill' ? answer : undefined
        const number = question.location.questionNumber.split('-').at(-1)!
        const example = question.scoring.kind === 'example'
        const exampleText = question.exampleText?.trim() ?? ''
        const exampleChoice = example ? presentation.options.find(option => exampleText === option.value || exampleText.startsWith(`${option.value} · `)) : undefined
        const unmatchedText = !!stored?.values[gap.id] && !presentation.options.some(option => option.value === stored.values[gap.id])
        const showInk = disabled ? !!stored?.ink?.[gap.id] || unmatchedText : handwriting
        const solution = solutions?.find(item => item.questionId === question.id)
        const choices = <Flex gap="2" align="center" wrap="wrap" role="group" aria-label={example ? '例题完整选项' : `第 ${number} 题选项`}>
          {presentation.options.map(option => {
            const props = { selected: example ? exampleChoice?.value === option.value : stored?.values[gap.id] === option.value,
              label: `${example ? 'Example' : number} · ${paperOptionLabel(option.label)}`, disabled, demonstration: example,
              onClick: example ? undefined : () => onAnswer(question.id, { type: 'gap_fill', values: { [gap.id]: option.value } }) }
            return presentation.kind === 'judgment'
              ? <JudgmentIconButton key={option.value} appearance="quiet" answer={option.value === '✓' ? 'right' : 'wrong'} {...props} />
              : <LetterChoiceButton key={option.value} appearance="quiet" letter={option.value} {...props} />
          })}
        </Flex>
        const response = example ? <Flex direction="column" gap="2">
          {choices}
          {!exampleChoice && !exampleAnswerIsVisible(question) && <Text>{question.exampleText}</Text>}
        </Flex> : showInk ? <ExamGapAnswer
              key={`${question.id}:ink`} label={number} gapId={gap.id} maxWords={gap.maxWords ?? undefined} letter
              answer={stored} handwritingEnabled={handwritingEnabled} readOnly={!!disabled}
              onEditingChange={active => {
                setDrawing(previous => { const next = new Set(previous); if (active) next.add(question.id); else next.delete(question.id); return next })
                onHandwritingEditing?.(`${question.id}/${gap.id}`, active)
              }} onChange={next => onAnswer(question.id, next)} /> : choices
        const field = <Flex direction="column" gap="2" height="100%">
          <Flex direction="row" wrap="wrap" align="center" gap="3" flexGrow="1" minWidth="0">
            <Flex gap="3" align="start" minWidth="0" maxWidth="100%">
              <Badge size="2" radius="full" variant={example ? 'soft' : 'solid'} color={example ? 'amber' : undefined}>{example ? 'Example' : number}</Badge>
              <div className="min-w-0 break-words" style={compact && !example ? { width: promptWidth === undefined ? '12ch' : promptWidth, maxWidth: '100%' } : undefined}>
                <ExamMaterialBlocks blocks={visibleExamPrompt(question.prompt, sharedInstructions).filter(block => !(block.kind === 'audio' && titleAudio.includes(block.mediaSlotId)))} {...media} />
              </div>
            </Flex>
            {response && <div className="max-w-full shrink-0">{response}</div>}
          </Flex>
          {results?.[question.id]?.outcome === 'pending' && <Text color="amber">已提交，等待家长批改。</Text>}
          {solution?.answerType === 'gap_fill' && <Text size="2">参考答案：{solution.acceptedAnswerSets.map(set => set.map(item => item.value).join(' / ')).join('；')}</Text>}
          {solution?.explanations.map((explanation, index) => <Text key={index}>{explanation.text}</Text>)}
          {!example && renderQuestionTools?.(question)}
        </Flex>
        return <StickerCard key={question.id} as="article" aria-label={example ? '例题' : `第 ${number} 题`} variant={example ? 'quote' : 'soft'} tone={example ? 'white' : 'accent'} radius="md" size="sm"
          className={example ? 'col-span-full w-fit max-w-full justify-self-start min-w-0' : 'min-w-0'}>
          {renderQuestion ? renderQuestion(question, field, { compact: true }) : field}
        </StickerCard>
      })}
    </div>
    </Flex>
  </Flex>
}
