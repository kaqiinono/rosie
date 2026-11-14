'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { LoadingOverlay, PageShell, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Text } from '@rosie/ui/themes'
import type { ExamAttemptReview, ExamAttemptView } from '../types/attempts'
import type { Solution } from '../types/solutions'
import { examRequest, examErrorMessage } from '../client/examApi'
import { ExamGroupRenderer } from '../components/ExamGroupRenderer'
import { ExamMaterialBlocks } from '../components/ExamMaterialBlocks'
import { ExamReviewMedia } from '../components/ExamReviewMedia'
import { ExamQuestionReflection } from '../components/ExamQuestionReflection'

export type VocabularyRenderer = (props: { attemptId: string; links: ExamAttemptReview['vocabularyLinks'] }) => ReactNode
export type GradingRenderer = (props: { attemptId: string; view: ExamAttemptView; onSaved: () => void }) => ReactNode

function SolutionDetails({ solution }: { solution: Solution }) {
  return <Flex direction="column" gap="3">
    {solution.answerType === 'multiple_choice' && <Text as="p">正确选项：{solution.acceptedOptionSets.map(set => set.join('、')).join(' / ')}</Text>}
    {solution.answerType === 'gap_fill' && <Text as="p">允许的答案组合：{solution.acceptedAnswerSets.map(set => set.map(answer => `${answer.gapId}: ${answer.value}`).join('；')).join(' / ')}</Text>}
    {solution.answerType === 'matching' && <Text as="p">正确配对：{solution.acceptedMatches.map(set => set.map(answer => `${answer.itemId} → ${answer.optionId}`).join('；')).join(' / ')}</Text>}
    {solution.evidence.map((evidence, index) => <Text key={index} as="p" size="3">依据：{evidence.quote}</Text>)}
    {solution.distractors.map(item => <Text key={item.optionId} as="p" size="3">{item.optionId}：{item.explanation.text}</Text>)}
    {solution.answerType === 'writing' && <>
      {solution.taskGuidance.map((item, index) => <Text key={index} as="p">{item.text}</Text>)}
      {solution.samples.map(sample => <StickerCard key={sample.id} tone="paper" elevation="flat"><Flex direction="column" gap="3">
        <Badge variant="soft" radius="full">{sample.provenance.origin === 'source' ? '原书范文' : '补充范文'}</Badge><Text as="p" className="whitespace-pre-wrap" lang="en">{sample.text}</Text>
        <Text size="2">{sample.originalScore ? `原书评分 ${sample.originalScore.score} / ${sample.originalScore.maximum}` : '原书未提供该范文分数'}</Text>
        {sample.originalComments.map((comment, index) => <Text key={`original:${index}`} as="p">原书点评：{comment.text}</Text>)}
        {sample.supplementaryComments.map((comment, index) => <Text key={`supplement:${index}`} as="p">补充点评：{comment.text}</Text>)}
      </Flex></StickerCard>)}
    </>}
    {solution.answerType === 'speaking' && solution.reviewGuidance.map((item, index) => <Text key={index} as="p">{item.text}</Text>)}
    {solution.answerType === 'self_check' && solution.guidance.map((item, index) => <Text key={index} as="p">{item.text}</Text>)}
    <Text size="2" color="gray">{solution.explanations.some(item => item.provenance.origin === 'supplement') ? '含补充解析；原答案与补充说明分别保留来源。' : '按已发布版本的解答复盘。'}</Text>
  </Flex>
}

function Review({ id, userId, renderVocabulary, renderGrading }: { id: string; userId: string; renderVocabulary?: VocabularyRenderer; renderGrading?: GradingRenderer }) {
  const [data, setData] = useState<{ view: ExamAttemptView; review: ExamAttemptReview } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [transcriptsOpen, setTranscriptsOpen] = useState(false)
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null)
    try {
      const [view, review] = await Promise.all([
        examRequest<ExamAttemptView>(userId, `/api/exams/attempts/${id}`, { signal }),
        examRequest<ExamAttemptReview>(userId, `/api/exams/attempts/${id}/review`, { signal }),
        examRequest(userId, '/api/exams/media/session', { method: 'POST', signal }),
      ])
      if (!signal?.aborted) setData({ view, review })
    } catch (failure) { if (!signal?.aborted) setError(failure) }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [id, userId])
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort() }, [load])
  const submittedGroups = data?.view.groups.filter(group => data.view.state.sections[group.sectionId]?.status === 'submitted') ?? []
  return <PageShell title="作答复盘" tone="paper" width="narrow" backHref="/exams/ket"><Flex direction="column" gap="5">
    <Flex gap="3" wrap="wrap"><Button size="3" variant="soft" asChild><Link href={`/exams/attempts/${id}`}>返回本次学习</Link></Button><Button size="3" variant="soft" disabled={loading} onClick={() => void load()}>刷新批改结果</Button></Flex>
    <div className="relative flex min-h-[calc(100dvh-16rem)] flex-col gap-5"><LoadingOverlay appearance="quiet" visible={loading} placement="content" />
      {!loading && error != null && <StickerCard tone="danger" elevation="flat"><Text role="alert">{examErrorMessage(error)}</Text></StickerCard>}
      {!loading && !error && data && <>
        {!submittedGroups.length && <StickerCard><Text as="p">尚未提交可复盘的题组或科目。返回本次学习继续作答。</Text></StickerCard>}
        <ExamReviewMedia attemptId={id} slots={[...data.view.mediaSlots.filter(slot => slot.target.kind === 'content_set'
          ? data.view.state.sections.listening?.status === 'submitted'
          : slot.target.kind === 'group' && submittedGroups.some(group => group.id === slot.target.id)), ...data.review.mediaSlots]} />
        {submittedGroups.map(group => <StickerCard key={group.id} as="section" size="lg"><Flex direction="column" gap="5">
          <Text weight="bold" size="4">Part {group.partNumber}</Text>
          <Flex gap="2" wrap="wrap">{data.view.state.sections[group.sectionId].timedOut && <Badge variant="soft" radius="full">已按截止时保存答案结算</Badge>}
            {data.view.state.sections[group.sectionId].technicalInterruption && <Badge variant="soft" radius="full">包含技术中断</Badge>}
            <Badge variant="soft" radius="full">题组活动时间 {Math.round((data.view.state.groupActiveMs[group.id] ?? 0) / 1000)} 秒</Badge></Flex>
          <ExamGroupRenderer audio={{ slots: data.view.mediaSlots }} group={group} materials={data.view.materials} attemptId={id} answers={data.view.state.answers} disabled onAnswer={() => undefined}
            annotations={data.view.state.annotations ?? {}} solutions={data.review.solutions} results={data.review.results}
            renderQuestion={(question, fields, { compact }) => {
            const solution = data.review.solutions.find(item => item.questionId === question.id)
            const result = data.review.results[question.id]
            return <Flex key={question.id} direction="column" gap={compact ? '2' : '4'}>
              {fields}
              <Flex gap="2" wrap="wrap">{result?.points !== null && result?.maxPoints !== null && result && <Badge variant="soft" radius="full">{result.points} / {result.maxPoints}</Badge>}
                {data.view.state.helpQuestionIds.includes(question.id) && <Badge variant="soft" radius="full">曾查看指导</Badge>}</Flex>
              {solution && <SolutionDetails solution={solution} />}
              {question.scoring.kind !== 'example' && <ExamQuestionReflection attemptId={id} questionId={question.id} />}
            </Flex>
          }} />
        </Flex></StickerCard>)}
        {data.review.guidance.map(item => <StickerCard key={item.id} tone="paper" elevation="flat"><Flex direction="column" gap="3">
          <Text weight="bold">题型指导</Text><ExamMaterialBlocks blocks={item.blocks} attemptId={id} />
        </Flex></StickerCard>)}
        {data.review.listeningTranscripts.length > 0 && <StickerCard as="section" size="lg"><Flex direction="column" gap="4">
          <Flex><Button size="3" variant="soft" onClick={() => setTranscriptsOpen(value => !value)}>{transcriptsOpen ? '收起听力原文' : '查看已提交部分的听力原文'}</Button></Flex>
          {transcriptsOpen && data.review.listeningTranscripts.map(note => <Flex key={note.id} direction="column" gap="3"><Text weight="bold">听力 Part {note.partNumber}</Text><ExamMaterialBlocks blocks={note.blocks} attemptId={id} audience="review" /></Flex>)}
        </Flex></StickerCard>}
        {renderVocabulary?.({ attemptId: id, links: data.review.vocabularyLinks })}
        {renderGrading?.({ attemptId: id, view: data.view, onSaved: () => { void load() } })}
      </>}
    </div>
  </Flex></PageShell>
}

export function ExamAttemptReviewPage({ id, renderVocabulary, renderGrading }: { id: string; renderVocabulary?: VocabularyRenderer; renderGrading?: GradingRenderer }) {
  const { user } = useAuth()
  return user ? <Review key={`${user.id}:${id}`} id={id} userId={user.id} renderVocabulary={renderVocabulary} renderGrading={renderGrading} /> : null
}
