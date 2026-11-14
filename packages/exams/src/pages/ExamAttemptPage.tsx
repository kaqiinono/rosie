'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { AppDialog, LoadingOverlay, PageShell, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Spinner, Text } from '@rosie/ui/themes'
import type { ExamAnswer, ExamAttemptView } from '../types/attempts'
import type { Question } from '../types/questions'
import { useExamAttempt } from '../client/useExamAttempt'
import { ExamMaterialBlocks } from '../components/ExamMaterialBlocks'
import { ExamGroupRenderer } from '../components/ExamGroupRenderer'
import { ExamQuestionFields } from '../components/ExamQuestionFields'
import { ExamAudioPlayer } from '../components/ExamAudioPlayer'
import { ExamSpeakingRecorder } from '../components/ExamSpeakingRecorder'
import { examRequest } from '../client/examApi'

export type SpeakingRenderer = (props: { attemptId: string; question: Question; answer?: ExamAnswer; disabled: boolean; scopeClosed?: boolean; onChange: (answer: ExamAnswer) => void; version: string; onServerChange: () => void; onPendingChange?: (pending: boolean) => void }) => ReactNode
const SECTION_NAMES: Record<string, string> = { reading_writing: '阅读与写作', listening: '听力', speaking: '亲子口语' }

function Countdown({ view, onExpired }: { view: ExamAttemptView; onExpired: () => void }) {
  const section = view.state.currentSectionId ? view.state.sections[view.state.currentSectionId] : null
  const [seconds, setSeconds] = useState<number | null>(null)
  const expiredCallback = useRef(onExpired)
  useEffect(() => {
    expiredCallback.current = onExpired
  }, [onExpired])
  useEffect(() => {
    if (!section?.deadlineAt || section.status !== 'active') return
    const deadline = Date.parse(section.deadlineAt)
    const server = Date.parse(view.serverNow)
    const started = performance.now()
    let fired = false
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - server - (performance.now() - started)) / 1000))
      setSeconds(remaining)
      if (remaining === 0 && !fired) { fired = true; expiredCallback.current() }
    }
    tick(); const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [section?.deadlineAt, section?.status, view.serverNow])
  if (!section?.deadlineAt || section.status !== 'active' || seconds === null) return null
  return <Text size="3" role="timer" aria-label="剩余时间">剩余 {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</Text>
}

function blank(answer: ExamAnswer | undefined, question: Question): boolean {
  if (!answer) return true
  if (answer.type === 'single_choice') return !answer.optionId
  if (answer.type === 'multiple_choice' && question.answerType === 'multiple_choice') return answer.optionIds.length !== question.selectionCount
  if (answer.type === 'gap_fill' && question.answerType === 'gap_fill') return question.gaps.some(gap => !answer.values[gap.id]?.trim() && !answer.ink?.[gap.id]?.strokes.length)
  if (answer.type === 'matching' && question.answerType === 'matching') return question.items.some(item => !answer.matches[item.id])
  if (answer.type === 'writing') return !answer.text.trim()
  if (answer.type === 'speaking') return !answer.recordingIds.length
  return answer.type === 'self_check' ? !answer.checkedIds.length : false
}

function Attempt({ id, userId, renderSpeaking }: { id: string; userId: string; renderSpeaking?: SpeakingRenderer }) {
  const data = useExamAttempt(userId, id)
  const { view, answers, busy } = data
  const router = useRouter()
  const [dialog, setDialog] = useState<'submit' | 'leave' | 'reload' | null>(null)
  const [expiredLocally, setExpiredLocally] = useState(false)
  const [audioFailed, setAudioFailed] = useState(false)
  const [recordingPending, setRecordingPending] = useState(false)
  const [handwritingEditors, setHandwritingEditors] = useState<Record<string, boolean>>({})
  const handwritingPending = Object.values(handwritingEditors).some(Boolean)
  const [showLateAnswers, setShowLateAnswers] = useState(false)
  const section = view?.state.currentSectionId ? view.state.sections[view.state.currentSectionId] : null
  const groups = view?.groups.filter(group => group.sectionId === view.state.currentSectionId) ?? []
  const group = groups.find(item => item.id === view?.state.currentGroupId) ?? groups[0]
  const currentIndex = group ? groups.findIndex(item => item.id === group.id) : -1
  const disabled = data.refreshing || (busy && data.pending?.action !== 'save') || (!!data.pending && !busy) || section?.status !== 'active' || expiredLocally
  const unanswered = groups.flatMap(item => item.questions).filter(question => question.scoring.kind !== 'example' && blank(answers[question.id], question)).length
  const lateGroups = view?.groups.filter(item => view.state.sections[item.sectionId]?.timedOut
    && item.questions.some(question => answers[question.id] && JSON.stringify(answers[question.id]) !== JSON.stringify(view.state.answers[question.id]))) ?? []

  useEffect(() => { setExpiredLocally(false) }, [view?.state.currentSectionId])
  useEffect(() => {
    if (!audioFailed || busy || data.pending || section?.status !== 'active') return
    setAudioFailed(false)
    void data.send('interrupt')
  }, [audioFailed, busy, data.pending, data.send, section?.status])
  useEffect(() => {
    if (!data.dirty && !data.pending && !recordingPending && !handwritingPending) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [data.dirty, data.pending, recordingPending, handwritingPending])
  useEffect(() => {
    const timer = setInterval(() => { void examRequest(userId, '/api/exams/media/session', { method: 'POST' }).catch(() => undefined) }, 10 * 60_000)
    return () => clearInterval(timer)
  }, [userId])

  return <PageShell title={view?.title ?? '考一考'} tone="paper" width="narrow" onBack={() => setDialog('leave')}>
    <div className="relative flex min-h-[calc(100dvh-10rem)] flex-col"><LoadingOverlay appearance="quiet" visible={data.loading} placement="content" />
      {!data.loading && <Flex direction="column" gap="5">
        {(data.error || (data.pending && !busy)) && <StickerCard tone="danger" elevation="flat"><Flex direction="column" gap="3"><Text as="p" role="alert">{data.error ?? '上次保存结果尚未确认，请重试原请求或明确重新读取。'}</Text>
          <Flex gap="2" wrap="wrap"><Button size="3" loading={busy} variant="soft" onClick={() => void data.retry()}>重试保存</Button><Button size="3" variant="soft" disabled={busy} onClick={() => setDialog('reload')}>重新读取</Button></Flex>
        </Flex></StickerCard>}
        {view && <>
          <Flex align="center" justify="between" gap="3" wrap="wrap"><Badge variant="soft" radius="full">{view.state.mode === 'mock' ? '模考' : '练习'}{view.state.currentSectionId ? ` · ${SECTION_NAMES[view.state.currentSectionId] ?? view.state.currentSectionId}` : ''}</Badge>
            <Countdown view={view} onExpired={() => { setExpiredLocally(true); void data.reload(false) }} />
            <Flex align="center" gap="2">{data.refreshing && <Spinner />}<Text size="2" role="status" aria-live="polite">{data.refreshing ? '正在读取保存进度…' : data.savedLabel}</Text></Flex></Flex>
          {(expiredLocally && data.dirty || lateGroups.length > 0) && <StickerCard tone="warning" elevation="flat"><Flex direction="column" gap="3">
            <Text as="p">时间已到，只有最后成功保存的答案计入成绩。未保存输入只保留在当前页面，离开后会丢失。</Text>
            {lateGroups.length > 0 && <Flex><Button size="3" variant="soft" onClick={() => setShowLateAnswers(value => !value)}>{showLateAnswers ? '收起未保存输入' : '查看未保存输入'}</Button></Flex>}
          </Flex></StickerCard>}
          {showLateAnswers && lateGroups.map(item => <StickerCard key={`late:${item.id}`} as="section" size="lg"><Flex direction="column" gap="4">
            <Text weight="bold">Part {item.partNumber} · 未计入成绩的输入</Text>
            {item.questions.filter(question => answers[question.id] && JSON.stringify(answers[question.id]) !== JSON.stringify(view.state.answers[question.id])).map(question =>
              <ExamQuestionFields key={question.id} question={question} group={item} attemptId={id} answer={answers[question.id]} disabled onChange={() => undefined} />)}
          </Flex></StickerCard>)}
          {view.state.currentSectionId === null && <StickerCard as="section" size="lg"><Flex direction="column" gap="4">
            {Object.entries(view.state.sections).filter(([, value]) => value.status === 'not_started').map(([sectionId]) => <Flex key={sectionId} direction="column" gap="2">
              <Text weight="bold">{SECTION_NAMES[sectionId] ?? sectionId}</Text><Text size="2" color="gray">{sectionId === 'reading_writing' ? '开始后计时 60 分钟。' : sectionId === 'listening' ? '开始后按审核的听力程序播放。请先确认声音正常。' : '请家长陪同，按 Part 录音并手动提交。'}</Text>
              <Flex><Button size="3" loading={busy} disabled={!!data.pending || data.refreshing} onClick={() => void data.send('start-section', { sectionId })}>开始{SECTION_NAMES[sectionId] ?? sectionId}</Button></Flex>
            </Flex>)}
            {Object.values(view.state.sections).some(value => value.status === 'submitted') && <Flex><Button size="3" variant="soft" asChild><Link href={`/exams/attempts/${id}/review`}>查看已提交部分与复盘</Link></Button></Flex>}
          </Flex></StickerCard>}
          {section?.status === 'interrupted' && <StickerCard tone="warning"><Flex direction="column" gap="3"><Text as="p">听力已记录技术中断。恢复后按服务器保存的位置继续，本次记录会保留中断标记。</Text>
            <Flex><Button size="3" loading={busy} disabled={!!data.pending} onClick={() => void data.send('resume')}>恢复听力</Button></Flex></Flex></StickerCard>}
          <ExamAudioPlayer view={view} userId={userId} position={data.position} onFailure={() => setAudioFailed(true)} />
          {group && <>
            <Flex gap="2" wrap="wrap" role="group" aria-label="题组导航">{groups.map((item, index) => <Button key={item.id} size="3" variant={item.id === group.id ? 'solid' : 'soft'} disabled={disabled || recordingPending || handwritingPending}
              onClick={() => void data.send('save', { groupId: item.id })}>题组 {index + 1}</Button>)}</Flex>
            <Text size="2" color="gray">题组 {currentIndex + 1} / {groups.length} · Part {group.partNumber}</Text>
            {data.help?.guidance.filter(item => item.groupIds.includes(group.id)).map(item => <StickerCard key={item.id} tone="paper" elevation="flat"><Flex direction="column" gap="3">
              <Text weight="bold">题型指导 · 已记录求助</Text><ExamMaterialBlocks blocks={item.blocks} attemptId={id} />
            </Flex></StickerCard>)}
            {!view.annotationPersistence && view.materials.some(material => group.materialIds.includes(material.id) && material.blocks.some(block => block.sentences?.length)) && <Text size="2" color="gray">阅读标记仅保留在本页，刷新后清空。</Text>}
            <ExamGroupRenderer key={group.id} group={group} materials={view.materials} attemptId={id}
              audio={{ slots: view.mediaSlots, disabledReason: view.state.mode === 'mock' ? '模考听力按考试流程播放' : section?.status !== 'active' || expiredLocally ? '当前作答已结束，请到复盘回听' : undefined }}
              handwritingEnabled={view.handwritingAvailable}
              onHandwritingEditing={(id, editing) => setHandwritingEditors(previous => previous[id] === editing ? previous : { ...previous, [id]: editing })}
              answers={answers} onAnswer={data.changeAnswer} disabled={disabled} solutions={data.help?.solutions}
              annotations={data.annotations} onAnnotation={data.changeAnnotation}
              renderSpeaking={question => (renderSpeaking ? renderSpeaking({ attemptId: id, question, answer: answers[question.id], disabled, scopeClosed: section?.status !== 'active' || expiredLocally, onChange: answer => data.changeAnswer(question.id, answer), version: view.version, onServerChange: () => { void data.reload(false) }, onPendingChange: setRecordingPending })
                  : <ExamSpeakingRecorder attemptId={id} question={question} answer={answers[question.id]} disabled={disabled} scopeClosed={section?.status !== 'active' || expiredLocally} onChange={answer => data.changeAnswer(question.id, answer)} version={view.version} onServerChange={() => { void data.reload(false) }} onPendingChange={setRecordingPending} />)}
              renderQuestionTools={question => view.state.mode === 'practice' ? <Flex><Button size="2" variant="ghost" disabled={disabled || recordingPending || handwritingPending} onClick={() => void data.send('help', { questionId: question.id })}>第 {question.location.questionNumber} 题指导（记录求助）</Button></Flex> : null}
              renderQuestion={(question, fields, { compact }) => compact ? fields : <StickerCard as="section" size="lg"><Flex direction="column" gap="4">
                {fields}
                {view.state.mode === 'practice' && question.scoring.kind !== 'example' && <Flex><Button size="3" variant="soft" disabled={disabled || recordingPending || handwritingPending} onClick={() => void data.send('help', { questionId: question.id })}>查看指导（记录求助）</Button></Flex>}
              </Flex></StickerCard>} />
            {handwritingPending && <Text size="2" role="status">写好后请点“写好了”，笔迹才会随进度保存。</Text>}
            <Flex justify="between" gap="3" wrap="wrap"><Button size="3" variant="soft" disabled={disabled || recordingPending || handwritingPending || currentIndex >= groups.length - 1} onClick={() => void data.send('save', { groupId: groups[currentIndex + 1].id })}>保存并到下一题组</Button>
              <Button size="3" loading={busy} disabled={disabled || recordingPending || handwritingPending} onClick={() => setDialog('submit')}>{view.state.mode === 'mock' ? '提交本科目' : '提交本题组'}</Button></Flex>
          </>}
        </>}
      </Flex>}
    </div>
    <AppDialog open={dialog !== null} onOpenChange={open => { if (!open && !busy) setDialog(null) }} closeDisabled={busy}
      title={dialog === 'submit' ? '确认提交' : dialog === 'reload' ? '重新读取保存进度' : '离开本次学习'}>
      <Flex direction="column" gap="4">{handwritingPending && <Text>请先点击手写面板的“写好了”保存笔迹，或取消本次书写。</Text>}{recordingPending && <Text as="p">请先停止并保存录音，或明确放弃本段，再离开或提交。</Text>}<Text as="p">{dialog === 'submit' ? unanswered ? `还有 ${unanswered} 题未作答。提交后答案锁定，可在复盘中查看解答。` : '提交后答案锁定，可在复盘中查看解答。'
        : dialog === 'reload' ? '将重新读取服务器进度，当前未保存的输入会被替换。'
        : view?.state.mode === 'mock' ? '离开不会重置截止时间。听力会先申请技术中断；普通科目的计时继续。' : '离开前会尝试保存当前答案。'}</Text>
        <Flex justify="end" gap="3"><Button size="3" variant="soft" color="gray" disabled={busy} onClick={() => setDialog(null)}>继续作答</Button>
          <Button size="3" loading={busy} disabled={recordingPending || handwritingPending} onClick={async () => {
            const action = dialog
            if (action === 'reload') { setDialog(null); await data.reload(); return }
            if (action === 'submit') { if (await data.send('submit')) setDialog(null); return }
            if (data.pending) { setDialog(null); return }
            if (section?.status === 'active' && !(await data.send('save'))) { setDialog(null); return }
            if (view?.state.mode === 'mock' && view.state.currentSectionId === 'listening' && section?.status === 'active' && !(await data.send('interrupt'))) { setDialog(null); return }
            router.push('/exams/ket')
          }}>{dialog === 'submit' ? '确认提交' : dialog === 'reload' ? '重新读取' : '保存并离开'}</Button></Flex>
      </Flex>
    </AppDialog>
  </PageShell>
}

export function ExamAttemptPage({ id, renderSpeaking }: { id: string; renderSpeaking?: SpeakingRenderer }) {
  const { user } = useAuth()
  return user ? <Attempt key={`${user.id}:${id}`} id={id} userId={user.id} renderSpeaking={renderSpeaking} /> : null
}
