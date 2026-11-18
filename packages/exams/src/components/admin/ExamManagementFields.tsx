'use client'

import { useEffect } from 'react'
import { FormSelect, StickerCard } from '@rosie/ui'
import { Flex, Heading, Text } from '@rosie/ui/themes'
import type { ExamDraftInput } from '../../validation/contracts'
import { DraftFields, DraftText } from './DraftFields'
import { ExamSharedFields, sharedTargets } from './ExamSharedFields'

export const questionEditorId = (id: string) => `exam-question-editor-${id}`

export function focusQuestionEditor(id: string) {
  const element = document.getElementById(questionEditorId(id))
  element?.scrollIntoView({ block: 'start' })
  element?.focus({ preventScroll: true })
}

export function ExamManagementFields({ draft, selectedQuestionId, disabled, onChange }: {
  draft: ExamDraftInput; selectedQuestionId?: string; disabled: boolean; onChange: (draft: ExamDraftInput) => void
}) {
  useEffect(() => { if (selectedQuestionId) focusQuestionEditor(selectedQuestionId) }, [selectedQuestionId])
  return <fieldset disabled={disabled} className="min-w-0"><Flex direction="column" gap="5">
    <DraftText label={draft.contentSet.kind === 'training_unit' ? '训练名称' : '试卷名称'}
      value={draft.contentSet.title} onChange={title => onChange({ ...draft, contentSet: { ...draft.contentSet, title } })} />
    <label className="flex flex-col gap-2"><Text size="2">内容用途</Text><FormSelect size="3" value={draft.contentSet.purpose}
      options={[{ value: 'training', label: '日常训练' }, { value: 'reserved', label: '保留测评' }]}
      onValueChange={value => onChange({ ...draft, contentSet: { ...draft.contentSet, purpose: value as 'training' | 'reserved' } })} /></label>
    {draft.content.groups.map(group => <section key={group.id}><Flex direction="column" gap="4">
      <Heading as="h2" size="4">{group.sectionId} · Part {group.partNumber}</Heading>
      <Text size="2" color="gray">共用内容独立调整；下方各小题表单只修改对应小题。</Text>
      {sharedTargets(draft, group).map(target => <StickerCard key={target.key} tone="paper" elevation="flat" size="sm">
        <Flex direction="column" gap="3"><Text weight="bold">{target.label}</Text>
          <ExamSharedFields draft={draft} group={group} target={target} onChange={onChange} />
        </Flex>
      </StickerCard>)}
      {group.questions.map(question => <section key={question.id} id={questionEditorId(question.id)} tabIndex={-1}
        aria-label={`编辑 ${question.displayLabel ?? question.location.questionNumber}`} className="scroll-mt-24">
        <StickerCard tone={selectedQuestionId === question.id ? 'info' : 'paper'} elevation="flat" size="sm">
          <Flex direction="column" gap="3">
            <Text weight="bold">{question.displayLabel ?? `第 ${question.location.questionNumber} 题`}{selectedQuestionId === question.id ? ' · 当前选中' : ''}</Text>
            <DraftFields draft={draft} onChange={onChange} selectedQuestionId={question.id} questionOnly />
          </Flex>
        </StickerCard>
      </section>)}
    </Flex></section>)}
  </Flex></fieldset>
}
