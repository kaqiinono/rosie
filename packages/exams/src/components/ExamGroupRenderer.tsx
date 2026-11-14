'use client'

import { useState, type ReactNode } from 'react'
import { MatchingBoard, StickerCard } from '@rosie/ui'
import { Flex, Grid, Heading, Text } from '@rosie/ui/themes'
import type { ExamActivity, ExamOption, Material, MaterialBlock, QuestionGroup } from '../types/content'
import type { Question, GapFillQuestion, MatchingQuestion } from '../types/questions'
import type { ExamAnswer, ExamQuestionResult } from '../types/attempts'
import type { Solution } from '../types/solutions'
import { ExamAudioScope, type ExamAudioOptions } from './ExamInlineAudio'
import { ExamActivityFrame } from './ExamActivityFrame'
import { useExamImageFocus } from './ExamImageFocusContext'
import { ExamRenderContext } from './ExamRenderContext'
import { ExamMaterialBlocks, examMediaUrl } from './ExamMaterialBlocks'
import { ExamQuestionFields } from './ExamQuestionFields'
import { ExamAuthoringRegion } from './ExamAuthoringRegion'
import { ExamReadingMaterial } from './ExamReadingMaterial'
import { ExamAlignedQuestion, exampleAnswerIsVisible } from './ExamAlignedQuestion'
import { ExamGapAnswer } from './ExamGapAnswer'
import { ExamClassificationActivity } from './ExamClassificationActivity'
import { visibleExamPrompt } from './examPromptPresentation'

export type ExamGroupRendererProps = {
  audio?: ExamAudioOptions
  group: QuestionGroup; materials: readonly Material[]; attemptId: string
  answers: Readonly<Record<string, ExamAnswer>>; onAnswer: (id: string, answer: ExamAnswer) => void
  disabled?: boolean; solutions?: readonly Solution[]; results?: Readonly<Record<string, ExamQuestionResult>>
  /** Keep student layout when media is resolved through an admin preview. */
  studentPresentation?: boolean
  handwritingEnabled?: boolean
  onHandwritingEditing?: (id: string, editing: boolean) => void
  annotations?: Readonly<Record<string, readonly string[]>>; onAnnotation?: (blockId: string, ids: string[]) => void
  adminRevisionId?: string; renderImage?: (slotId: string, alt: string, aspectRatio?: number, displayWidth?: number) => ReactNode
  /** Admin authoring may expose the material without a decorative panel. */
  renderMaterial?: (material: Material, content: ReactNode) => ReactNode
  renderOptionImage?: (option: ExamOption) => ReactNode
  /** Activity-owned layout; callers may add tools but must retain compact rows. */
  renderQuestion?: (question: Question, fields: ReactNode, layout: { compact: boolean }) => ReactNode
  questionToolsForHiddenOnly?: boolean
  renderQuestionTools?: (question: Question) => ReactNode
  renderSpeaking?: (question: Question) => ReactNode
}

function MatchActivity({ activity, group, answers, onAnswer, disabled, attemptId, adminRevisionId, renderImage, imageDisplayWidth, showExample }: Pick<ExamGroupRendererProps, 'group' | 'answers' | 'onAnswer' | 'disabled' | 'attemptId' | 'adminRevisionId' | 'renderImage'> & { activity: ExamActivity; imageDisplayWidth?: number; showExample: (question: Question) => boolean }) {
  const [imageFailed, setImageFailed] = useState(false)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const imageFocus = useExamImageFocus()
  const questions = group.questions.filter(q => activity.questionIds.includes(q.id))
  const first = questions.find(q => q.answerType === 'gap_fill' || q.answerType === 'matching')
  const pool = first && (first.answerType === 'gap_fill' || first.answerType === 'matching') ? group.optionPools.find(p => p.id === first.optionPoolId) : undefined
  if (!pool) return null
  const entries: { question: GapFillQuestion | MatchingQuestion; key: string; label: string; id: string; position?: { x: number; y: number } }[] = []
  for (const q of questions) {
    if (q.scoring.kind === 'example') continue
    const label = q.prompt.filter(b => b.kind === 'text').map(b => b.text).join(' ')
    const number = q.location.role === 'training' ? q.location.questionNumber.split('-').at(-1)! : q.location.questionNumber
    const position = activity.positions?.find(p => p.questionId === q.id)
    if (q.answerType === 'gap_fill') q.gaps.forEach((gap, index) => entries.push({ question: q, key: gap.id, label: label || gap.label, id: q.gaps.length > 1 ? `${number}.${index + 1}` : number, position }))
    if (q.answerType === 'matching') q.items.forEach((item, index) => entries.push({ question: q, key: item.id, label: item.prompt.filter(b => b.kind === 'text').map(b => b.text).join(' ') || label, id: q.items.length > 1 ? `${number}.${index + 1}` : number, position }))
  }
  const value: Record<string, string> = {}
  for (const entry of entries) {
    const answer = answers[entry.question.id]
    value[entry.id] = answer?.type === 'matching' ? answer.matches[entry.key] ?? '' : answer?.type === 'gap_fill' ? pool.options.find(o => o.label === answer.values[entry.key])?.id ?? '' : ''
  }
  const reserved = new Set(questions.filter(q => q.scoring.kind === 'example').map(q => q.exampleText))
  const options = pool.options.filter(o => pool.allowReuse || !reserved.has(o.label))
  const imageUrl = activity.imageSlotId ? examMediaUrl(attemptId, activity.imageSlotId, 'student', adminRevisionId) : null
  return <Flex direction="column" gap="3">
    {questions.filter(q => q.scoring.kind === 'example' && showExample(q)).map(q => {
      const prompt = q.prompt.length ? q.prompt : q.answerType === 'matching' ? q.items.flatMap(item => [...item.prompt]) : []
      return <Flex key={q.id} direction="column" gap="2">
        <Text weight="bold">Example</Text>
        <ExamMaterialBlocks blocks={visibleExamPrompt(prompt, group.instructions.filter(block => activity.instructionIds.includes(block.id)))} attemptId={attemptId} adminRevisionId={adminRevisionId} renderImage={renderImage} />
        {!exampleAnswerIsVisible(q, prompt) && <Text>{q.exampleText}</Text>}
      </Flex>
    })}
    {imageUrl && renderImage && <ExamMaterialBlocks blocks={[{ id: `${activity.id}-image`, kind: 'image', mediaSlotId: activity.imageSlotId!, alt: activity.title, displayWidth: imageDisplayWidth }]} attemptId={attemptId} adminRevisionId={adminRevisionId} renderImage={renderImage} />}
    {imageUrl && !renderImage && !imageSize && <Text role="status" color={imageFailed ? 'red' : 'gray'}>{imageFailed ? '题图暂时无法读取，请稍后重新打开题组。' : '正在读取题图…'}</Text>}
    {imageUrl && !renderImage && <img src={imageUrl} alt="" hidden onError={() => setImageFailed(true)} onLoad={e => setImageSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} />}
    <ExamAuthoringRegion target={{ kind: 'pool', groupId: group.id, poolId: pool.id }}><MatchingBoard layout="columns" items={entries.map(entry => ({ id: entry.id, label: entry.label, position: entry.position }))}
      options={options} value={value} allowReuse={pool.allowReuse} readOnly={disabled}
      illustration={!renderImage && imageUrl && imageSize && entries.every(entry => entry.position) ? { src: imageUrl, ...imageSize, alt: activity.title, displayWidth: imageFocus.expanded ? undefined : imageDisplayWidth, fit: 'responsive' } : undefined}
      onIllustrationPreview={imageFocus.open}
      onValueChange={next => {
        const changed = new Map<string, ExamAnswer>()
        for (const entry of entries) {
          if ((next[entry.id] ?? '') === (value[entry.id] ?? '')) continue
          const old = changed.get(entry.question.id) ?? answers[entry.question.id]
          changed.set(entry.question.id, entry.question.answerType === 'matching'
            ? { type: 'matching', matches: { ...(old?.type === 'matching' ? old.matches : {}), [entry.key]: next[entry.id] ?? '' } }
            : { type: 'gap_fill', values: { ...(old?.type === 'gap_fill' ? old.values : {}), [entry.key]: pool.options.find(o => o.id === next[entry.id])?.label ?? '' } })
        }
        changed.forEach((answer, id) => onAnswer(id, answer))
      }} /></ExamAuthoringRegion>
  </Flex>
}

/** One group composition for attempts, review and authoring. No solutions are inferred. */
export function ExamGroupRenderer({ audio, group, materials, attemptId, answers, onAnswer, disabled = false, studentPresentation = false, handwritingEnabled = false, onHandwritingEditing, solutions, results, annotations, onAnnotation, adminRevisionId, renderImage, renderOptionImage, renderMaterial, renderQuestion, renderQuestionTools, questionToolsForHiddenOnly = false, renderSpeaking }: ExamGroupRendererProps) {
  const [localMarks, setLocalMarks] = useState<Record<string, string[]>>({})
  const scopedMaterials = materials.filter(m => group.materialIds.includes(m.id))
  const sharedBlocks = [...group.instructions, ...scopedMaterials.flatMap(m => [...m.blocks])]
  const allBlocks = [...sharedBlocks, ...group.questions.flatMap(q => [...q.prompt])]
  const sharedSlots = sharedBlocks.flatMap(block => [...block.answerSlots ?? []])
  const inlineSlots = allBlocks.flatMap(block => [...block.answerSlots ?? []])
  const activities: readonly ExamActivity[] = group.activities ?? [{ id: group.id, title: '', instructionIds: group.instructions.map(b => b.id), materialIds: group.materialIds, questionIds: group.questions.map(q => q.id), layout: 'questions' }]
  const media = { attemptId, adminRevisionId, renderImage }
  // A board example belongs either to the board or the editable/review fields, never both.
  const boardOwnsExample = (question: Question) => !results
    && !solutions?.some(solution => solution.questionId === question.id)
    && (studentPresentation || (!adminRevisionId && !renderImage))
  return <ExamAudioScope attemptId={attemptId} adminRevisionId={adminRevisionId} options={audio}><ExamRenderContext.Provider value={{ group, answers, onAnswer, disabled, handwritingEnabled, onHandwritingEditing, inlineSlots, annotations: annotations ?? localMarks,
    onAnnotation: onAnnotation ?? ((id, ids) => setLocalMarks(previous => ({ ...previous, [id]: ids }))) }}>
    <Flex direction="column" gap="8">{activities.map(activity => <ExamActivityFrame key={`${group.id}:${activity.id}`} activity={activity} group={group} materials={scopedMaterials}>{activity.choicePresentation ? <ExamClassificationActivity activity={activity}
      group={group} materials={scopedMaterials} answers={answers} onAnswer={onAnswer} disabled={disabled}
      handwritingEnabled={handwritingEnabled} onHandwritingEditing={onHandwritingEditing}
      solutions={solutions} results={results} renderMaterial={renderMaterial} renderQuestion={renderQuestion} renderQuestionTools={questionToolsForHiddenOnly ? undefined : renderQuestionTools} {...media} /> : <Flex key={activity.id} direction="column" gap="4">
      {activity.title && !group.instructions.some(block => activity.instructionIds.includes(block.id) && block.kind === 'text' && block.presentation?.role === 'instruction') && <ExamAuthoringRegion target={{ kind: 'activity', groupId: group.id, activityId: activity.id, field: 'title' }}><Heading as="h3" size="5">{activity.title}</Heading></ExamAuthoringRegion>}
      <ExamMaterialBlocks blocks={group.instructions.filter(b => activity.instructionIds.includes(b.id))} {...media} />
      <Grid columns={{ initial: '1', lg: activity.layout === 'handwriting' && activity.materialIds.length > 0 ? '2' : '1' }} gap="4" align="start">
      {activity.materialIds.length > 0 && <Flex direction="column" gap="3">
      {scopedMaterials.filter(m => activity.materialIds.includes(m.id)).map(material => {
        const content = <Flex direction="column" gap="3">{!material.blocks.some(block => block.kind === 'text' && block.presentation?.role === 'heading' && block.text === material.title) && <ExamAuthoringRegion target={{ kind: 'material', groupId: group.id, materialId: material.id }}><Text weight="bold">{material.title}</Text></ExamAuthoringRegion>}<ExamReadingMaterial material={material} {...media} /></Flex>
        return renderMaterial ? <div key={material.id}>{renderMaterial(material, content)}</div>
          : <StickerCard key={material.id} tone="paper" elevation="flat">{content}</StickerCard>
      })}
      </Flex>}
      {activity.layout === 'handwriting' && <Flex direction="column" gap="3">
        {!!activity.wordBank?.length && <ExamAuthoringRegion target={{ kind: 'activity', groupId: group.id, activityId: activity.id, field: 'wordBank' }}><Flex gap="3" wrap="wrap" aria-label="word box">{activity.wordBank.map(word => <Text key={word} size="3" weight="regular" lang="en">{word}</Text>)}</Flex></ExamAuthoringRegion>}
        {activity.imageSlotId && !scopedMaterials.some(material => activity.materialIds.includes(material.id) && material.blocks.some(block => block.kind === 'image' && block.mediaSlotId === activity.imageSlotId)) && <ExamMaterialBlocks blocks={[{ id: `${activity.id}-illustration`, kind: 'image', mediaSlotId: activity.imageSlotId, alt: activity.title, displayWidth: activity.imageDisplayWidth ?? scopedMaterials.flatMap(material => material.blocks).find((block): block is Extract<MaterialBlock, { kind: 'image' }> => block.kind === 'image' && block.mediaSlotId === activity.imageSlotId)?.displayWidth }]} {...media} />}
        <Grid gap="3" align="stretch" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 20rem), 1fr))' }}>
          {group.questions.filter(question => activity.questionIds.includes(question.id)).map(question => {
            if (question.answerType !== 'gap_fill') return null
            const answer = answers[question.id]
            const number = question.location.questionNumber.split('-').at(-1)!
            const example = question.scoring.kind === 'example'
            const response = example ? (exampleAnswerIsVisible(question) ? null : <Text weight="bold">{question.exampleText}</Text>)
              : <Flex direction={activity.handwritingSize === 'word' ? 'column' : 'row'} gap="2" wrap="wrap">{question.gaps.map(gap => <ExamGapAnswer key={gap.id} label={question.gaps.length === 1 ? number : `${number} · ${gap.label}`} gapId={gap.id} maxWords={gap.maxWords ?? undefined}
                fullWidth={activity.handwritingSize === 'word'} letter={activity.handwritingSize === 'letter'} answer={answer?.type === 'gap_fill' ? answer : undefined}
                handwritingEnabled={handwritingEnabled} readOnly={disabled}
                onEditingChange={editing => onHandwritingEditing?.(`${question.id}/${gap.id}`, editing)}
                onChange={next => onAnswer(question.id, next)} />)}</Flex>
            const field = <Flex direction="column" gap="2" height="100%">
              <ExamAlignedQuestion number={example ? 'Example' : number} stacked={example || activity.handwritingSize === 'word'}
                prompt={<ExamMaterialBlocks blocks={visibleExamPrompt(question.prompt, group.instructions.filter(block => activity.instructionIds.includes(block.id)))} {...media} />} response={response} />
              {results?.[question.id]?.outcome === 'pending' && <Text color="amber">已提交，等待家长批改。</Text>}
              {solutions?.find(solution => solution.questionId === question.id)?.explanations.map((explanation, index) => <Text key={index}>{explanation.text}</Text>)}
              {!questionToolsForHiddenOnly && question.scoring.kind !== 'example' && renderQuestionTools?.(question)}
            </Flex>
            return <StickerCard key={question.id} asChild variant="soft" tone={example ? 'accent' : 'white'} elevation="flat" radius="md" size="sm"
              className={example ? 'col-span-full min-w-0' : 'min-w-0'}>
              {renderQuestion ? renderQuestion(question, field, { compact: true }) : field}
            </StickerCard>
          })}
        </Grid>
      </Flex>}
      </Grid>
      {(activity.layout === 'matching' || activity.layout === 'image_labels') && <MatchActivity key={`${group.id}:${activity.id}`} activity={activity} showExample={boardOwnsExample} imageDisplayWidth={activity.imageDisplayWidth ?? scopedMaterials.flatMap(material => material.blocks).find((block): block is Extract<MaterialBlock, { kind: 'image' }> => block.kind === 'image' && block.mediaSlotId === activity.imageSlotId)?.displayWidth} group={group} answers={answers} onAnswer={onAnswer} disabled={disabled} attemptId={attemptId} adminRevisionId={adminRevisionId} renderImage={renderImage} />}
      {group.questions.filter(q => activity.questionIds.includes(q.id)).map(question => {
        if (activity.layout === 'handwriting') return null
        const solution = solutions?.find(s => s.questionId === question.id)
        const isBoard = activity.layout === 'matching' || activity.layout === 'image_labels'
        const isInline = question.answerType === 'single_choice' ? sharedSlots.some(slot => slot.questionId === question.id)
          : question.answerType === 'gap_fill' && question.gaps.every(gap => sharedSlots.some(slot => slot.questionId === question.id && slot.gapId === gap.id))
        if ((isBoard || isInline) && boardOwnsExample(question)) {
          const audio = isBoard && question.scoring.kind === 'example' ? [] : question.prompt.filter(block => block.kind === 'audio')
          const tools = (questionToolsForHiddenOnly || question.scoring.kind !== 'example') ? renderQuestionTools?.(question) : null
          if (audio.length === 0 && !tools) return null
          return <div key={question.id}>
            {audio.length > 0 && <ExamMaterialBlocks blocks={audio} {...media} />}
            {tools}
          </div>
        }
        const fields = <ExamQuestionFields question={question} group={group} {...media} renderOptionImage={renderOptionImage}
          sharedInstructions={group.instructions.filter(block => activity.instructionIds.includes(block.id))}
          answer={answers[question.id]} onChange={answer => onAnswer(question.id, answer)} disabled={disabled || question.scoring.kind === 'example'}
          hideControls={isBoard} solution={solution} result={results?.[question.id]} speaking={renderSpeaking?.(question)} />
        return <div key={question.id}>{renderQuestion ? renderQuestion(question, fields, { compact: false })
          : <StickerCard variant="soft" tone={question.scoring.kind === 'example' ? 'accent' : 'white'} size="sm" elevation="flat" radius="md">{fields}</StickerCard>}</div>
      })}
    </Flex>}</ExamActivityFrame>)}</Flex>
  </ExamRenderContext.Provider></ExamAudioScope>
}
