'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { AppDialog, LoadingOverlay, PageShell, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Tabs, Text, TextArea } from '@rosie/ui/themes'
import { validateExamDraft } from '../validation'
import type { ExamDraftInput, ValidationIssue } from '../validation/contracts'
import type { ExamPublicationState, ExamPublicationReceipt, ExamReviewScope } from '../types/publication'
import { examRequest, ExamRequestError, examErrorMessage } from '../client/examApi'
import { clearSavedExamCatalogCache, refreshAdminCatalog } from '../client/adminCatalog'
import { clearSavedExamImageCache } from '../client/imageTasks'
import { clearSavedExamMediaCache } from '../client/mediaEditor'
import { DraftText } from '../components/admin/DraftFields'
import { VocabularyFields } from '../components/admin/VocabularyFields'
import { ExamIssueList } from '../components/admin/ExamIssueList'
import { ExamPaperView } from '../components/admin/ExamPaperView'
import { ExamImageTools } from '../components/admin/ExamImageTools'
import { ExamManagementFields, focusQuestionEditor } from '../components/admin/ExamManagementFields'
import { ExamImageDialog } from '../components/admin/ExamImageDialog'
import { ExamSourcePage } from '../components/admin/ExamSourcePage'

type DraftRecord = { draft: ExamDraftInput; version: string; createdAt: string; updatedAt: string }
type PendingCommand = { path: string; body: string; method: 'PATCH' | 'POST'; kind: 'save' | 'review' | 'publish' | 'withdraw' | 'reopen'; draft?: ExamDraftInput }
const REVIEW_NAMES: Record<ExamReviewScope, string> = { exam: '题面与标准答案', explanations: '完整解析与来源', rubric: '主观题评分量表' }

function Editor({ id, userId }: { id: string; userId: string }) {
  const router = useRouter()
  const path = `/api/admin/exams/${encodeURIComponent(id)}`
  const [publication, setPublication] = useState<ExamPublicationState | null>(null)
  const [draft, setDraft] = useState<ExamDraftInput | null>(null)
  const [baseline, setBaseline] = useState('')
  const [raw, setRaw] = useState('')
  const [rawDirty, setRawDirty] = useState(false)
  const [blockEditing, setBlockEditing] = useState(false)
  const [tab, setTab] = useState('paper')
  const [selectedQuestionId, setSelectedQuestionId] = useState('')
  const [referenceTab, setReferenceTab] = useState<'source' | 'preview'>('source')
  const [sourcePage, setSourcePage] = useState<number | null>(null)
  const [imageSlotId, setImageSlotId] = useState<string | null>(null)
  const [imageRecrop, setImageRecrop] = useState(false)
  const [mediaVersion, setMediaVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [issues, setIssues] = useState<readonly ValidationIssue[]>([])
  const [notice, setNotice] = useState('')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState<PendingCommand | null>(null)
  const [dialog, setDialog] = useState<'leave' | 'reload' | 'publish' | 'withdraw' | 'reopen' | null>(null)
  const busyRef = useRef(false)
  const loadSequence = useRef(0)
  const dirty = blockEditing || rawDirty || (draft !== null && JSON.stringify(draft) !== baseline)

  const load = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++loadSequence.current
    setBlockEditing(false)
    setLoading(true)
    setError(null)
    setIssues([])
    try {
      const state = await examRequest<ExamPublicationState>(userId, `${path}/reviews`, { signal })
      const record = state.status === 'draft' ? await examRequest<DraftRecord>(userId, path, { signal }) : null
      if (record && record.version !== state.version) throw new ExamRequestError('exam_conflict', 409)
      if (signal?.aborted || loadSequence.current !== sequence) return
      setPublication(state)
      setDraft(record?.draft ?? null)
      setBaseline(record ? JSON.stringify(record.draft) : '')
      setRaw(record ? JSON.stringify(record.draft, null, 2) : '')
      setRawDirty(false)
      setPending(null)
      setIssues([])
    } catch (failure) {
      if (!signal?.aborted && loadSequence.current === sequence) {
        setError(failure)
        setIssues(failure instanceof ExamRequestError ? failure.issues : [])
      }
    } finally {
      if (!signal?.aborted && loadSequence.current === sequence) setLoading(false)
    }
  }, [path, userId])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => { controller.abort(); loadSequence.current += 1 }
  }, [load])

  useEffect(() => {
    if (!dirty && !pending) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, pending])

  function edit(value: ExamDraftInput) {
    if (pending || busyRef.current) return
    setDraft(value)
    setRaw(JSON.stringify(value, null, 2))
    setNotice('尚未保存')
  }

  async function execute(command: PendingCommand, nextQuestionId?: string): Promise<boolean> {
    if (busyRef.current) return false
    busyRef.current = true
    setBusy(true)
    setError(null)
    setIssues([])
    setPending(command)
    let acknowledged = false
    try {
      if (command.kind === 'save' && command.draft) {
        const receipt = await examRequest<{ version: string }>(userId, command.path, { method: command.method, body: command.body })
        acknowledged = true
        setDraft(command.draft)
        setBaseline(JSON.stringify(command.draft))
        setRaw(JSON.stringify(command.draft, null, 2))
        setRawDirty(false)
        setPending(null)
        setBlockEditing(false)
        setMediaVersion(value => value + 1)
        setPublication(previous => previous ? { ...previous, version: receipt.version, reviews: { exam: null, explanations: null, rubric: null }, readiness: { exam: [], explanations: [], canPublish: false } } : previous)
        setNotice('修改已保存。')
        if (nextQuestionId) setSelectedQuestionId(nextQuestionId)
        const results = await Promise.allSettled([
          clearSavedExamCatalogCache(userId, id),
          clearSavedExamImageCache(userId, id),
          clearSavedExamMediaCache(userId, id),
          examRequest<ExamPublicationState>(userId, `${path}/reviews`).then(setPublication),
        ])
        if (results.some(result => result.status === 'rejected')) {
          setNotice('修改已保存，旧缓存已清理；部分最新数据读取失败，请点击「重新读取」。')
        }
      } else if (command.kind === 'review') {
        const state = await examRequest<ExamPublicationState>(userId, command.path, { method: 'POST', body: command.body })
        acknowledged = true
        setPublication(state)
        setNotice('审核记录已保存。')
      } else if (command.kind === 'reopen') {
        await examRequest<ExamPublicationReceipt>(userId, command.path, { method: 'POST', body: command.body })
        acknowledged = true
        setPending(null)
        setNotice('已改回草稿，可以继续修改。')
        await load()
      } else {
        const receipt = await examRequest<ExamPublicationReceipt>(userId, command.path, { method: 'POST', body: command.body })
        acknowledged = true
        setPublication(previous => previous ? { ...previous, status: receipt.status, version: receipt.version } : previous)
        setDraft(null)
        setBaseline('')
        setRawDirty(false)
        setNotice(receipt.status === 'published' ? '已发布。发现问题可以改回草稿继续修改。' : '已下架，已有学习记录保留。可以改回草稿继续修改。')
        void refreshAdminCatalog(userId).catch(() => undefined)
      }
      setPending(null)
      return true
    } catch (failure) {
      setError(failure)
      if (failure instanceof ExamRequestError) {
        setIssues(failure.issues)
        if (acknowledged || (failure.status >= 400 && failure.status < 500 && failure.status !== 429)) setPending(null)
      }
      return acknowledged
    } finally { setBusy(false); busyRef.current = false }
  }

  async function persist(value: ExamDraftInput): Promise<boolean> {
    if (!publication || pending || busyRef.current) return false
    const result = validateExamDraft(value)
    if (!result.ok) { setIssues(result.issues); setError(new ExamRequestError('exam_invalid_draft', 400, result.issues)); return false }
    return execute({ path, method: 'PATCH', kind: 'save', draft: value,
      body: JSON.stringify({ draft: value, requestId: crypto.randomUUID(), expectedVersion: publication.version }) })
  }

  function save() {
    if (!draft || rawDirty || blockEditing) return
    void persist(draft)
  }

  function review(scope: ExamReviewScope, decision: 'approved' | 'blocked') {
    if (!publication || dirty || pending || (decision === 'blocked' && !reason.trim())) return
    void execute({ path: `${path}/reviews`, method: 'POST', kind: 'review', body: JSON.stringify({
      expectedVersion: publication.version, requestId: crypto.randomUUID(), scope, decision,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    }) })
  }

  function exportDraft() {
    if (!draft) return
    const url = URL.createObjectURL(new Blob([rawDirty ? raw : JSON.stringify(draft, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'exam-draft.private.json'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function openIssueSection(action: 'content' | 'words' | 'raw' | 'review') {
    if (blockEditing) return
    if (action !== 'review') {
      setTab(action)
      if (action === 'raw' && draft && !rawDirty) setRaw(JSON.stringify(draft, null, 2))
    }
    const target = document.getElementById(action === 'review' ? 'exam-review-controls' : 'exam-editor-tabs')
    target?.scrollIntoView({ block: 'start' })
    target?.focus({ preventScroll: true })
  }

  const issueListProps = { draft, revisionId: id, navigationDisabled: dirty || busy || !!pending, onOpen: openIssueSection }
  const questions = draft?.content.groups.flatMap(group => group.questions) ?? []
  const selectedQuestion = questions.find(question => question.id === selectedQuestionId) ?? questions[0]
  const selectedIndex = questions.findIndex(question => question.id === selectedQuestion?.id)
  const selectedSourcePage = selectedQuestion?.provenance.sources[0]?.pdfPage
    ?? draft?.content.groups.find(group => group.questions.some(question => question.id === selectedQuestion?.id))?.provenance.sources[0]?.pdfPage ?? 1
  const openImage = (slotId: string, recrop = false) => {
    if (dirty || busy || pending) { setNotice('请先保存当前修改，再处理图片。'); return }
    setImageRecrop(recrop)
    setImageSlotId(slotId)
  }

  return <PageShell title="试卷内容与审核" tone="paper" width="full" onBack={() => dirty || pending ? setDialog('leave') : router.push('/admin/exams')}>
    <div className="relative flex min-h-[calc(100dvh-10rem)] flex-col">
      <LoadingOverlay appearance="quiet" visible={loading} placement="content" />
      {!loading && <Flex direction="column" gap="5">
        <Flex gap="3" wrap="wrap" align="center">
          {publication && <Badge variant="soft" radius="full">{publication.status === 'draft' ? '草稿' : publication.status === 'published' ? '已发布' : '已下架'}</Badge>}
          <Button size="3" variant="soft" disabled={busy || blockEditing} onClick={() => dirty || pending ? setDialog('reload') : void load()}>重新读取</Button>
          {draft && <Button size="3" variant="soft" disabled={blockEditing} onClick={exportDraft}>导出当前修改</Button>}
          {draft && <Button size="3" variant="soft" asChild disabled={dirty || busy || !!pending}><Link href={`/admin/exams/images?revisionId=${encodeURIComponent(id)}`}>全部图片任务</Link></Button>}
          {draft && tab !== 'raw' && !blockEditing && <Button size="3" loading={busy && pending?.kind === 'save'} disabled={busy || !!pending || rawDirty || !dirty} onClick={() => save()}>保存修改</Button>}
          <Text role="status" aria-live="polite" size="2">{notice}</Text>
        </Flex>
        {error != null && <StickerCard tone="danger" elevation="flat"><Flex direction="column" gap="3">
          <Text as="p" role="alert">{!publication ? '读取试卷失败：' : ''}{examErrorMessage(error)}</Text>
          {issues.length > 0 && <ExamIssueList {...issueListProps} issues={issues} />}
          {error instanceof ExamRequestError && /^[a-z][a-z0-9_]{0,79}$/.test(error.code) && <Text as="p" size="1" color="gray">错误代码：{error.code}</Text>}
          {pending && <Flex><Button size="3" variant="soft" loading={busy} onClick={() => void execute(pending)}>重试原操作</Button></Flex>}
        </Flex></StickerCard>}
        {draft && <Tabs.Root id="exam-editor-tabs" tabIndex={-1} value={tab} onValueChange={value => { if (blockEditing) return; setTab(value); if (value === 'raw' && !rawDirty) setRaw(JSON.stringify(draft, null, 2)) }}>
          <Tabs.List><Tabs.Trigger disabled={blockEditing} value="paper">完整电子试卷</Tabs.Trigger><Tabs.Trigger disabled={blockEditing} value="content">管理试卷</Tabs.Trigger><Tabs.Trigger disabled={blockEditing} value="words">词条关联</Tabs.Trigger><Tabs.Trigger disabled={blockEditing} value="raw">内容包编辑</Tabs.Trigger></Tabs.List>
          <Tabs.Content value="paper" className="mt-4"><ExamPaperView draft={draft} revisionId={id} userId={userId}
            editingDisabled={busy || !!pending || rawDirty} onChange={persist} onEditingChange={setBlockEditing}
            onRecrop={slotId => openImage(slotId, true)} /></Tabs.Content>
          <Tabs.Content value="content" className="mt-4"><div className="grid items-start gap-4 xl:grid-cols-[210px_minmax(0,1fr)_minmax(320px,0.85fr)]">
            <StickerCard as="aside" size="sm" className="xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:overflow-auto"><Flex direction="column" gap="3">
              <Text weight="bold">逐题审阅 · {selectedIndex + 1}/{questions.length}</Text>
              {draft.content.groups.map(group => <Flex key={group.id} direction="column" gap="2">
                <Text size="2" weight="bold">{group.sectionId} · Part {group.partNumber}</Text>
                {group.questions.map(question => <Button key={question.id} size="2" variant={selectedQuestion?.id === question.id ? 'solid' : 'soft'}
                  onClick={() => { setSelectedQuestionId(question.id); focusQuestionEditor(question.id) }}>{question.displayLabel ?? `第 ${question.location.questionNumber} 题`}</Button>)}
              </Flex>)}
            </Flex></StickerCard>
            <StickerCard as="section" size="md">
              <ExamManagementFields draft={draft} selectedQuestionId={selectedQuestionId || undefined}
                disabled={busy || !!pending || rawDirty} onChange={edit} />
            </StickerCard>
            <StickerCard as="aside" size="md" className="xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:overflow-auto"><Flex direction="column" gap="3">
              <Flex gap="2"><Button size="2" variant={referenceTab === 'source' ? 'solid' : 'soft'} onClick={() => setReferenceTab('source')}>原书对照</Button>
                <Button size="2" variant={referenceTab === 'preview' ? 'solid' : 'soft'} onClick={() => setReferenceTab('preview')}>实时预览</Button></Flex>
              <ExamImageTools draft={draft} revisionId={id} questionId={selectedQuestion?.id} onChange={edit}
                onOpenImage={openImage} onOpenSource={setSourcePage} editingDisabled={busy || !!pending || rawDirty}
                navigationDisabled={dirty || busy || !!pending || rawDirty} />
              {referenceTab === 'source' && <ExamSourcePage userId={userId} revisionId={id} title={draft.contentSet.source.title} page={selectedSourcePage} />}
              {referenceTab === 'preview' && <ExamPaperView key={mediaVersion} draft={draft} revisionId={id} userId={userId}
                focusQuestionId={selectedQuestion?.id} editingDisabled={busy || !!pending || rawDirty} />}
            </Flex></StickerCard>
          </div></Tabs.Content>
          <Tabs.Content value="words"><StickerCard as="section" size="lg" className="mt-4"><fieldset disabled={busy || !!pending} className="min-w-0"><VocabularyFields draft={draft} onChange={edit} /></fieldset></StickerCard></Tabs.Content>
          <Tabs.Content value="raw"><StickerCard as="section" size="lg" className="mt-4"><Flex direction="column" gap="3">
            <Text as="p">高级编辑：包含完整题面、私有解答、来源页、媒体槽位和词条关联。保存会直接存储修改；审核通过状态不能从这里写入。</Text>
            <TextArea aria-label="完整草稿内容包" size="3" rows={22} resize="vertical" value={raw} disabled={busy || !!pending} onChange={event => { setRaw(event.target.value); setRawDirty(true) }} />
            <Flex><Button size="3" variant="soft" loading={busy && pending?.kind === 'save'} disabled={busy || !!pending || !rawDirty} onClick={() => {
              try {
                const result = validateExamDraft(JSON.parse(raw) as unknown)
                if (!result.ok) { setIssues(result.issues); setError(new ExamRequestError('exam_invalid_draft', 400, result.issues)); return }
                if (result.value.content.id !== id) { setIssues([]); setError(new ExamRequestError('exam_revision_mismatch', 400)); return }
                void persist(result.value)
              } catch { setIssues([]); setError(new ExamRequestError('exam_invalid_json', 400)) }
            }}>保存修改</Button></Flex>
          </Flex></StickerCard></Tabs.Content>
        </Tabs.Root>}
        {draft && <ExamImageDialog userId={userId} revisionId={id} slotId={imageSlotId} initialEditing={imageRecrop} onClose={() => setImageSlotId(null)} onSaved={() => { setMediaVersion(value => value + 1); void load() }} />}
        {draft && <AppDialog open={sourcePage !== null} size="preview" title={`原书 PDF 第 ${sourcePage ?? 1} 页`} onOpenChange={open => { if (!open) setSourcePage(null) }}>
          <ExamSourcePage showTitle={false} userId={userId} revisionId={id} title={draft.contentSet.source.title} page={sourcePage ?? 1} />
        </AppDialog>}
        {publication && <StickerCard as="section" size="lg"><Flex id="exam-review-controls" tabIndex={-1} direction="column" gap="4">
          <Text as="p" size="4" weight="bold">审核与发布</Text>
          {publication.status === 'draft' && <>
            <Text as="p">下面的检查和审核只是提醒，不会拦住发布。保存后的内容可以直接发布；发现问题可以改回草稿再改。</Text>
            <DraftText label="审核说明（阻断时必填）" multiline value={reason} onChange={setReason} />
            {(Object.keys(REVIEW_NAMES) as ExamReviewScope[]).map(scope => <Flex key={scope} direction="column" gap="2">
              <Text weight="bold">{REVIEW_NAMES[scope]}</Text>
              <Text size="2">{publication.reviews[scope]?.decision === 'approved' ? '本版本已审核' : publication.reviews[scope]?.decision === 'blocked' ? `已阻断：${publication.reviews[scope]?.reason ?? ''}` : '本版本待审核'}</Text>
              <Flex gap="2" wrap="wrap"><Button size="3" variant="soft" disabled={busy || !!pending || dirty} onClick={() => review(scope, 'approved')}>确认已对照审核</Button>
                <Button size="3" variant="soft" color="red" disabled={busy || !!pending || dirty || !reason.trim()} onClick={() => review(scope, 'blocked')}>标记阻断</Button></Flex>
            </Flex>)}
            <Text weight="bold">题目与考试准备</Text><ExamIssueList {...issueListProps} issues={publication.readiness.exam} />
            <Text weight="bold">答案与解析准备</Text><ExamIssueList {...issueListProps} issues={publication.readiness.explanations} />
            <Flex gap="3" wrap="wrap"><Button size="3" disabled={busy || !!pending || dirty} onClick={() => setDialog('publish')}>发布此版本</Button>
              <Button size="3" variant="soft" asChild><Link href={`/admin/sync?panel=exams&revisionId=${encodeURIComponent(id)}`}>管理考试资源</Link></Button></Flex>
          </>}
          {publication.status !== 'draft' && <Flex gap="3" wrap="wrap">
            <Button size="3" disabled={busy || !!pending} onClick={() => setDialog('reopen')}>改回草稿继续修改</Button>
            {publication.status === 'published' && <Button size="3" color="red" variant="soft" disabled={busy || !!pending} onClick={() => setDialog('withdraw')}>下架此版本</Button>}
          </Flex>}
          {publication.status === 'published' && <Text as="p">学生可以开始这份试卷。要改题目或答案，先改回草稿，改完再发布。已有学习记录保留。</Text>}
          {publication.status === 'withdrawn' && <Text as="p">已下架，不能开始新的考试。可以改回草稿继续修改，已有学习记录保留。</Text>}
        </Flex></StickerCard>}
      </Flex>}
    </div>
    <AppDialog open={dialog !== null} onOpenChange={open => { if (!open && !busy) setDialog(null) }} closeDisabled={busy}
      title={dialog === 'publish' ? '发布此版本' : dialog === 'withdraw' ? '下架此版本' : dialog === 'reopen' ? '改回草稿' : '当前修改尚未保存'}>
      <Flex direction="column" gap="4">
        <Text as="p">{dialog === 'publish' ? '发布后学生可以开始这份试卷。缺图、未审核或其它问题不会拦住发布。要修改时可以改回草稿，已有学习记录保留。'
          : dialog === 'withdraw' ? '下架后不能开始新的考试，已有学习记录和复盘保留。之后仍可以改回草稿继续修改。'
          : dialog === 'reopen' ? '改回草稿后可以继续修改这份内容。学生要等再次发布才能开始新的考试，已有学习记录保留。'
          : pending ? '有一次操作尚未确认结果。建议先重试原操作；离开后请重新读取服务器状态，不要另建重复内容。'
          : '离开或重新读取会丢弃当前编辑。可先取消并导出当前修改。'}</Text>
        <Flex justify="end" gap="3"><Button size="3" variant="soft" color="gray" disabled={busy} onClick={() => setDialog(null)}>取消</Button>
          <Button size="3" color={dialog === 'withdraw' ? 'red' : 'amber'} disabled={busy} onClick={() => {
            const action = dialog; setDialog(null)
            if (action === 'leave') router.push('/admin/exams')
            else if (action === 'reload') void load()
            else if (publication && (action === 'publish' || action === 'withdraw' || action === 'reopen')) void execute({ path: `${path}/${action}`, method: 'POST', kind: action,
              body: JSON.stringify({ requestId: crypto.randomUUID(), expectedVersion: publication.version }) })
          }}>{dialog === 'publish' ? '确认发布' : dialog === 'withdraw' ? '确认下架' : dialog === 'reopen' ? '改回草稿' : dialog === 'reload' ? '丢弃修改并重新读取' : '离开编辑页'}</Button></Flex>
      </Flex>
    </AppDialog>
  </PageShell>
}

export function AdminExamEditorPage({ id }: { id: string }) {
  const { user } = useAuth()
  return user ? <Editor key={`${user.id}:${id}`} userId={user.id} id={id} /> : null
}
