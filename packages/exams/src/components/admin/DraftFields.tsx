'use client'

import { useId, useState, type ReactNode } from 'react'
import { ImageSizeControl } from './ImageSizeControl'
import { FormSelect, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Text, TextArea, TextField } from '@rosie/ui/themes'
import type { ExamDraftInput } from '../../validation/contracts'
import type { MaterialBlock, QuestionClassification, SourceReference } from '../../types/content'
import type { Explanation, Solution } from '../../types/solutions'

export function DraftText({ label, value, onChange, multiline = false, error }: {
  label: string; value: string; onChange: (value: string) => void; multiline?: boolean; error?: string
}) {
  const errorId = useId()
  return <label className="flex min-w-0 flex-col gap-2"><Text size="2" weight="medium">{label}</Text>
    {multiline ? <TextArea size="3" rows={5} resize="vertical" value={value} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} onChange={event => onChange(event.target.value)} />
      : <TextField.Root size="3" value={value} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} onChange={event => onChange(event.target.value)} />}
    {error && <Text id={errorId} size="2" color="red">{error}</Text>}
  </label>
}

export function SourceReferences({ sources }: { sources: readonly SourceReference[] }) {
  return <Flex gap="2" wrap="wrap">{sources.map((source, index) => <Badge key={index} variant="soft" radius="full" color="gray">
    PDF {source.pdfPage} · 印刷 {source.printedPage ?? '未标页码'} · {source.role}{source.region ? ' · 指定区域' : ''}
  </Badge>)}</Flex>
}

export function BlocksEditor({ blocks, onChange, renderImageSize }: { blocks: readonly MaterialBlock[]; onChange: (blocks: readonly MaterialBlock[]) => void; renderImageSize?: (block: Extract<MaterialBlock, { kind: 'image' }>, onChange: (block: MaterialBlock) => void) => ReactNode }) {
  return <Flex direction="column" gap="3">{blocks.map((block, index) => {
    const replace = (next: MaterialBlock) => onChange(blocks.map((value, position) => position === index ? next : value))
    switch (block.kind) {
      case 'text': return <Flex key={block.id} direction="column" gap="2">
        {block.presentation?.role === 'heading' && <DraftText label="栏目类别（如 VOCABULARY）" value={block.presentation.prefix ?? ''}
          onChange={prefix => replace({ ...block, presentation: { ...block.presentation, role: 'heading', prefix: prefix.trim() || undefined } })} />}
        {block.presentation?.role === 'instruction' && <DraftText label="活动编号" value={block.presentation.number}
          onChange={number => replace({ ...block, presentation: { ...block.presentation, role: 'instruction', number } })} />}
        <DraftText label={block.presentation?.role === 'heading' ? '标题' : block.presentation?.role === 'instruction' ? '活动指令' : '文字'} multiline={!block.presentation || block.presentation.role === 'instruction'} value={block.text} onChange={text => replace({ ...block, text })} />
      </Flex>
      case 'email': return <Flex key={block.id} direction="column" gap="2">
        <DraftText label="发件人" value={block.from} onChange={from => replace({ ...block, from })} />
        <DraftText label="收件人" value={block.to} onChange={to => replace({ ...block, to })} />
        <DraftText label="主题" value={block.subject} onChange={subject => replace({ ...block, subject })} />
        <DraftText label="邮件正文（每行一段）" multiline value={block.body.join('\n')} onChange={text => replace({ ...block, body: text.split('\n') })} />
        {block.notes?.map((note, index) => <DraftText key={index} label={`第 ${note.paragraph + 1} 段旁注`} value={note.text}
          onChange={text => replace({ ...block, notes: block.notes?.map((item, at) => at === index ? { ...item, text } : item) })} />)}
      </Flex>
      case 'table': return <Flex key={block.id} direction="column" gap="2">
        {block.headers.map((header, column) => <DraftText key={`h${column}`} label={`第 ${column + 1} 列标题`} value={header}
          onChange={text => replace({ ...block, headers: block.headers.map((value, i) => i === column ? text : value) })} />)}
        {block.rows.map((row, r) => <Flex key={r} direction="column" gap="2">{row.map((cell, c) => <DraftText key={c} label={`第 ${r + 1} 行 · ${block.headers[c] || c + 1}`} value={cell}
          onChange={text => replace({ ...block, rows: block.rows.map((value, i) => i === r ? value.map((entry, j) => j === c ? text : entry) : value) })} />)}</Flex>)}
      </Flex>
      case 'image': return <Flex key={block.id} direction="column" gap="2"><Text size="2">题图槽位：{block.mediaSlotId}</Text>
        <DraftText label="图片替代文字" value={block.alt} onChange={alt => replace({ ...block, alt })} />
        <DraftText label="图片说明" value={block.caption ?? ''} onChange={caption => replace({ ...block, caption })} />
        {renderImageSize ? renderImageSize(block, replace) : <ImageSizeControl value={block.displayWidth} onChange={displayWidth => replace({ ...block, displayWidth })} />}</Flex>
      case 'audio': return <Text key={block.id} size="2">音频槽位：{block.mediaSlotId}（在资源同步页绑定）</Text>
    }
  })}</Flex>
}

function ExplanationFields({ values, onChange }: { values: readonly Explanation[]; onChange: (values: readonly Explanation[]) => void }) {
  return <Flex direction="column" gap="3">
    {values.map((value, index) => <Flex key={index} direction="column" gap="2">
      <SourceReferences sources={value.provenance.sources} />
      <DraftText label={`解析 ${index + 1} · ${value.provenance.origin === 'source' ? '原书' : '补充或翻译'}`} multiline value={value.text}
        onChange={text => onChange(values.map((entry, i) => i === index ? { ...entry, text,
          provenance: { ...entry.provenance, origin: 'supplement', authorship: 'human', review: { status: 'pending' } } } : entry))} />
    </Flex>)}
    <Flex><Button size="3" variant="soft" onClick={() => onChange([...values, { text: '', provenance: { origin: 'supplement', authorship: 'human', sources: [], review: { status: 'pending' } } }])}>添加补充解析</Button></Flex>
  </Flex>
}

function SolutionFields({ solution, onChange }: { solution: Solution; onChange: (value: Solution) => void }) {
  return <Flex direction="column" gap="4">
    <SourceReferences sources={solution.provenance.sources} />
    {solution.answerType === 'single_choice' && <DraftText label="正确选项 ID" value={solution.correctOptionId} onChange={correctOptionId => onChange({ ...solution, correctOptionId })} />}
    {solution.answerType === 'multiple_choice' && solution.acceptedOptionSets.map((set, index) => <DraftText key={index} label={`允许选项组合 ${index + 1}（逗号分隔，不计顺序）`} value={set.join(', ')} onChange={text => onChange({ ...solution, acceptedOptionSets: solution.acceptedOptionSets.map((entry, i) => i === index ? text.split(',').map(id => id.trim()).filter(Boolean) : entry) })} />)}
    {solution.answerType === 'gap_fill' && solution.acceptedAnswerSets.map((set, alternative) => <StickerCard key={alternative} tone="paper" elevation="flat">
      <Text as="p" size="2" weight="bold">允许答案组合 {alternative + 1}</Text>
      <Flex direction="column" gap="2">{set.map((answer, position) => <DraftText key={answer.gapId} label={answer.gapId} value={answer.value}
        onChange={value => onChange({ ...solution, acceptedAnswerSets: solution.acceptedAnswerSets.map((items, i) => i === alternative ? items.map((entry, j) => j === position ? { ...entry, value } : entry) : items) })} />)}</Flex>
    </StickerCard>)}
    {solution.answerType === 'matching' && solution.acceptedMatches.map((set, alternative) => <StickerCard key={alternative} tone="paper" elevation="flat">
      <Text as="p" size="2" weight="bold">允许配对组合 {alternative + 1}</Text>
      <Flex direction="column" gap="2">{set.map((answer, position) => <DraftText key={answer.itemId} label={answer.itemId} value={answer.optionId}
        onChange={optionId => onChange({ ...solution, acceptedMatches: solution.acceptedMatches.map((items, i) => i === alternative ? items.map((entry, j) => j === position ? { ...entry, optionId } : entry) : items) })} />)}</Flex>
    </StickerCard>)}
    <ExplanationFields values={solution.explanations} onChange={explanations => onChange({ ...solution, explanations })} />
    {solution.answerType === 'writing' && <>
      {solution.samples.map((sample, index) => <DraftText key={sample.id} label={`范文 ${index + 1}`} multiline value={sample.text}
        onChange={text => onChange({ ...solution, samples: solution.samples.map((value, i) => i === index ? { ...value, text, provenance: { ...value.provenance, origin: 'supplement', authorship: 'human', review: { status: 'pending' } }, originalScore: null, originalComments: [] } : value) })} />)}
      <Text weight="bold">写作任务指导</Text><ExplanationFields values={solution.taskGuidance} onChange={taskGuidance => onChange({ ...solution, taskGuidance })} />
    </>}
    {solution.answerType === 'speaking' && <ExplanationFields values={solution.reviewGuidance} onChange={reviewGuidance => onChange({ ...solution, reviewGuidance })} />}
    {solution.answerType === 'self_check' && <ExplanationFields values={solution.guidance} onChange={guidance => onChange({ ...solution, guidance })} />}
  </Flex>
}

export function DraftFields({ draft, onChange, selectedQuestionId, onSelectQuestion, questionOnly = false }: { draft: ExamDraftInput; onChange: (draft: ExamDraftInput) => void; selectedQuestionId?: string; onSelectQuestion?: (id: string) => void; questionOnly?: boolean }) {
  const [localGroupId, setLocalGroupId] = useState(draft.content.groups[0]?.id ?? '')
  const [localQuestionId, setLocalQuestionId] = useState('')
  const groupId = selectedQuestionId ? draft.content.groups.find(item => item.questions.some(question => question.id === selectedQuestionId))?.id ?? localGroupId : localGroupId
  const questionId = selectedQuestionId ?? localQuestionId
  const group = draft.content.groups.find(item => item.id === groupId) ?? draft.content.groups[0]
  const question = group?.questions.find(item => item.id === questionId) ?? group?.questions[0]
  const solution = draft.solutions.solutions.find(item => item.questionId === question?.id)
  const updateGroup = (next: NonNullable<typeof group>) => onChange({ ...draft, content: { ...draft.content,
    groups: draft.content.groups.map(item => item.id === next.id ? next : item) } })
  const updateQuestion = (next: NonNullable<typeof question>) => { if (group) updateGroup({ ...group, questions: group.questions.map(item => item.id === next.id ? next : item) }) }
  const updateClassification = (value: QuestionClassification) => { if (question) updateQuestion({ ...question, classification: { ...value, review: { status: 'pending' } } }) }

  return <Flex direction="column" gap="5">
    {!questionOnly && <>
    <DraftText label="内容名称" value={draft.contentSet.title} onChange={title => onChange({ ...draft, contentSet: { ...draft.contentSet, title } })} />
    <label className="flex flex-col gap-2"><Text size="2">内容用途</Text><FormSelect size="3" value={draft.contentSet.purpose}
      options={[{ value: 'training', label: '日常训练' }, { value: 'reserved', label: '保留测评' }]}
      onValueChange={value => onChange({ ...draft, contentSet: { ...draft.contentSet, purpose: value as 'training' | 'reserved' } })} /></label>
    {!onSelectQuestion && <label className="flex flex-col gap-2"><Text size="2">完整题组</Text><FormSelect size="3" value={group?.id ?? ''}
      options={draft.content.groups.map((item, index) => ({ value: item.id, label: `${index + 1}. ${item.sectionId} · Part ${item.partNumber} · ${item.questions.length} 题` }))}
      onValueChange={value => { setLocalGroupId(value); setLocalQuestionId('') }} /></label>}
    {group && <>
      <SourceReferences sources={group.provenance.sources} />
      <Text weight="bold">题组说明</Text><BlocksEditor blocks={group.instructions} onChange={instructions => updateGroup({ ...group, instructions })} />
      {draft.content.materials.filter(item => group.materialIds.includes(item.id)).map(material => <StickerCard key={material.id} as="section" tone="paper" elevation="flat" size="lg">
        <Flex direction="column" gap="3"><Text weight="bold">{material.title}</Text><SourceReferences sources={material.provenance.sources} />
          <BlocksEditor blocks={material.blocks} onChange={blocks => onChange({ ...draft, content: { ...draft.content, materials: draft.content.materials.map(item => item.id === material.id ? { ...item, blocks } : item) } })} />
        </Flex></StickerCard>)}
      {!onSelectQuestion && <label className="flex flex-col gap-2"><Text size="2">题目</Text><FormSelect size="3" value={question?.id ?? ''}
        options={group.questions.map(item => ({ value: item.id, label: `${item.displayLabel ?? item.location.questionNumber} · ${item.answerType}` }))} onValueChange={setLocalQuestionId} /></label>}
    </>}
    </>}
    {question && <>
      <SourceReferences sources={question.provenance.sources} />
      <BlocksEditor blocks={question.prompt} onChange={prompt => updateQuestion({ ...question, prompt })} />
      {(question.answerType === 'single_choice' || question.answerType === 'multiple_choice') && question.options.map((option, index) => <Flex key={option.id} direction="column" gap="2"><DraftText key={option.id} label={`选项 ${option.id}`} value={option.label}
        onChange={label => updateQuestion({ ...question, options: question.options.map((value, i) => i === index ? { ...value, label } : value) })} />
        {option.imageSlotId && <ImageSizeControl value={option.displayWidth} onChange={displayWidth => updateQuestion({ ...question, options: question.options.map((value, i) => i === index ? { ...value, displayWidth } : value) })} />}
      </Flex>)}
      {question.answerType === 'matching' && question.items.map(item => <BlocksEditor key={item.id} blocks={item.prompt}
        onChange={prompt => updateQuestion({ ...question, items: question.items.map(value => value.id === item.id ? { ...value, prompt } : value) })} />)}
      <DraftText label="题型标记" value={question.classification.questionTypeId} onChange={questionTypeId => updateClassification({ ...question.classification, questionTypeId })} />
      <DraftText label="主要技能" value={question.classification.primarySkillId} onChange={primarySkillId => updateClassification({ ...question.classification, primarySkillId })} />
      <DraftText label="考点（逗号分隔）" value={question.classification.knowledgePointIds.join(', ')} onChange={value => updateClassification({ ...question.classification, knowledgePointIds: value.split(/[,，]/).map(item => item.trim()).filter(Boolean) })} />
      <Text weight="bold">答案与解析</Text>
      {solution ? <SolutionFields solution={solution} onChange={next => onChange({ ...draft, solutions: { ...draft.solutions, solutions: draft.solutions.solutions.map(item => item.id === next.id ? next : item) } })} />
        : <Text color="amber">本题缺少答案或指导。请在内容包编辑中补充，不能直接批准发布。</Text>}
    </>}
  </Flex>
}
