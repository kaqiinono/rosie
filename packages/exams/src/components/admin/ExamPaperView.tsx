'use client'

import { examMediaEditorStore } from '../../client/mediaEditor'
import { RegionEditActions, RegionEditButton, StickerCard } from '@rosie/ui'
import { Button, Flex, Heading, SegmentedControl, Text } from '@rosie/ui/themes'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@rosie/core'
import type { ExamDraftInput } from '../../validation/contracts'
import type { ExamActivity, ExamOption } from '../../types/content'
import { imageWorkspaceStore, useExamImageBlob } from '../../client/imageTasks'
import type { ExamImageWorkspace } from '../../types/imageTasks'
import { ExamGroupRenderer } from '../ExamGroupRenderer'
import { ExamOptionImage } from '../ExamOptionImage'
import { ExamMaterialImage } from '../ExamMaterialImage'
import type { ExamAnswer } from '../../types/attempts'
import { ExamActivityEditContext, ExamAuthoringContext, type ExamAuthoringTarget } from '../ExamAuthoringRegion'
import { ExamRegionFields } from './ExamRegionFields'
import { DraftFields } from './DraftFields'
import { ImageSizeControl } from './ImageSizeControl'
import { resizeDraftImage } from './resizeDraftImage'
import { validateExamDraft } from '../../validation'
import { examIssueTasks } from './examIssueTasks'

type Props = {
  draft: ExamDraftInput
  revisionId: string
  focusQuestionId?: string
  userId: string
  editingDisabled?: boolean
  onChange?: (draft: ExamDraftInput) => Promise<boolean>
  onEditingChange?: (editing: boolean) => void
  /** Opens the existing source-page cropper for one image. */
  onRecrop?: (slotId: string) => void
}

function PaperImage({ userId, revisionId, slotId, alt, workspace, option, aspectRatio, displayWidth, onRecrop, recropDisabled }: {
  userId: string; revisionId: string; slotId: string; alt: string; workspace: ExamImageWorkspace | null; option?: ExamOption; aspectRatio?: number
  displayWidth?: number
  onRecrop?: () => void
  recropDisabled?: boolean
}) {
  const task = workspace?.tasks.find(item => item.slot.id === slotId)
  const params = new URLSearchParams({ revisionId, slotId }).toString()
  const image = useExamImageBlob(userId, task?.binding ? `/api/exams/media?${params}` : null, workspace?.bindingRevisionId ?? '')
  return <Flex direction="column" gap="2" className="relative w-full">
    {option && image.url ? <ExamOptionImage src={image.url} alt={alt} region={option.imageRegion} displayWidth={displayWidth} />
      : <ExamMaterialImage src={image.url} alt={alt} aspectRatio={aspectRatio} displayWidth={displayWidth}
        message={image.loading ? '正在读取插图…' : image.error ? '插图暂不可用' : !image.url ? workspace ? '此处缺图' : '正在读取图片状态…' : undefined} />}
    {onRecrop && <Flex className="absolute start-2 top-2 z-10">
      <Button size="1" variant="soft" color="green" disabled={recropDisabled} onClick={onRecrop}>重裁</Button>
    </Flex>}
  </Flex>
}

export function ExamPaperView({ draft, revisionId, focusQuestionId, userId, editingDisabled, onChange, onEditingChange, onRecrop }: Props) {
  const [editMode, setEditMode] = useState(false)
  const [editing, setEditing] = useState<{ key: string; draft: ExamDraftInput; imageWidth?: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const previewDraft = draft
  const finish = () => { setEditing(null); setSaveError(''); onEditingChange?.(false) }
  // An acknowledged retry may finish outside this component's original Save callback.
  useEffect(() => {
    setEditing(previous => previous?.draft === draft ? null : previous)
    setSaveError('')
  }, [draft])

  const saveRegion = async () => {
    if (!editing || !onChange || saving || editingDisabled) return
    const payload = JSON.parse(JSON.stringify(editing.draft)) as ExamDraftInput
    const result = validateExamDraft(payload)
    if (!result.ok) {
      setSaveError(examIssueTasks(result.issues, editing.draft).map(task => `${task.location}：${task.message}`).join('\n'))
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      if (await onChange(payload)) finish()
      else setSaveError('保存未成功，修改已保留在编辑区。请查看页面错误提示后重试。')
    } catch {
      setSaveError('保存未成功，修改已保留在编辑区。请重试。')
    } finally { setSaving(false) }
  }
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, ExamAnswer>>({})
  const { user } = useAuth()
  const store = useMemo(() => imageWorkspaceStore(revisionId), [revisionId])
  const { data: workspace } = store.useSessionData(user)
  const audioStore = useMemo(() => examMediaEditorStore(revisionId, draft.content.mediaBindingRevisionId), [revisionId, draft.content.mediaBindingRevisionId])
  const audioState = audioStore.useSessionData(user)

  const renderUnit = (key: string, label: string, content: ReactNode, fields: (value: ExamDraftInput) => ReactNode, tone: 'text' | 'image' | 'question' = 'question', reserveControls = false) => {
    if (!onChange || !editMode) return content
    const active = editing?.key === key
    return <section aria-label={label} className={`relative outline-2 outline-dashed -outline-offset-2 ${tone === 'question' ? 'h-full min-w-0' : ''} ${tone === 'text' ? 'outline-sky-600' : tone === 'image' ? 'outline-emerald-600' : 'outline-violet-600'}`}>
      {active && editing ? <Flex direction="column" gap="3">
        <Flex justify="between" align="center" gap="2" wrap="wrap">
          <Text weight="bold">{label}</Text>
          <RegionEditActions tone={tone} disabled={editingDisabled} saving={saving}
            onSave={() => void saveRegion()} onCancel={finish} />
        </Flex>
        <fieldset disabled={editingDisabled || saving} className="min-w-0">{fields(editing.draft)}</fieldset>
        {saveError && <Text role="alert" size="2" color="red" className="whitespace-pre-wrap">{saveError}</Text>}
        <Text size="1" color="gray">保存会直接存储修改，成功后返回预览。</Text>
      </Flex> : <>
        {tone === 'question' || reserveControls ? <div className="grid h-full min-w-0 grid-cols-[minmax(0,1fr)_32px]">
          <div className="min-w-0">{content}</div>
        </div> : content}
        <RegionEditButton tone={tone} disabled={editingDisabled || !!editing} label={`编辑 ${label}`}
          onClick={() => { setEditing({ key, draft }); onEditingChange?.(true) }} />
      </>}
    </section>
  }

  const recropFor = (slotId: string) => onChange && editMode && onRecrop ? () => onRecrop(slotId) : undefined
  const renderImage = (scope: string, slotId: string, alt: string, aspectRatio?: number, displayWidth?: number) => {
    const preview = <PaperImage userId={userId} revisionId={revisionId} slotId={slotId}
      alt={alt} aspectRatio={aspectRatio} displayWidth={displayWidth} workspace={workspace}
      onRecrop={recropFor(slotId)} recropDisabled={editingDisabled || !!editing} />
    if (!onChange || !editMode) return preview
    const key = `image/${scope}/${slotId}`
    if (editing?.key === key) return renderUnit(key, '图片尺寸', preview, () => <Flex direction="column" gap="3">
      <Text size="2">{alt}</Text>
      <ImageSizeControl value={editing.imageWidth} disabled={editingDisabled} onChange={imageWidth => {
        setEditing(previous => previous?.key === key
          ? { ...previous, imageWidth, draft: resizeDraftImage(previous.draft, slotId, imageWidth) } : previous)
      }} />
      <Text size="1" color="gray">共用此图片的题目会同步更新显示尺寸。</Text>
    </Flex>, 'image')
    return <div className="relative w-full outline-2 outline-dashed -outline-offset-2 outline-emerald-600" style={{ maxWidth: displayWidth }}>
      {preview}
      <RegionEditButton tone="image" disabled={editingDisabled || !!editing}
        label={`编辑图片尺寸：${alt}`} onClick={() => {
          setEditing({ key, draft, imageWidth: displayWidth })
          onEditingChange?.(true)
        }} />
    </div>
  }
  const updateLocal = (next: ExamDraftInput) => setEditing(previous => previous ? { ...previous, draft: next } : previous)

  const renderRegion = (target: ExamAuthoringTarget, content: ReactNode) => {
    const group = draft.content.groups.find(value => value.id === target.groupId)
    if (!group) return content
    // Question prompts are already editable as their own question block.
    if (target.kind === 'blocks') {
      const sharedIds = new Set([...group.instructions, ...draft.content.materials.filter(material => group.materialIds.includes(material.id)).flatMap(material => material.blocks)].map(block => block.id))
      if (!target.blockIds.every(id => sharedIds.has(id))) return content
    }
    if (target.kind === 'activity' && !group.activities?.some(activity => activity.id === target.activityId)) return content
    const label = target.kind === 'blocks' ? '标题、说明与正文' : target.kind === 'material' ? '材料标题'
      : target.kind === 'options' || target.kind === 'pool' ? '选项'
      : target.field === 'title' ? '活动标题' : target.field === 'wordBank' ? '词库' : '共用选项'
    return renderUnit(`region/${JSON.stringify(target)}`, label, content,
      value => <ExamRegionFields draft={value} target={target} onChange={updateLocal} />, 'text', target.kind === 'options' || target.kind === 'pool')
  }

  return <ExamAuthoringContext.Provider value={onChange && editMode ? renderRegion : null}><Flex direction="column" gap="5">
    {onChange && <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
      <Flex gap="3" wrap="wrap" minWidth="0" aria-label="编辑选区颜色说明" aria-hidden={!editMode}
        className={editMode ? undefined : 'invisible'}><Text size="1" color="blue">蓝色：文字与选项</Text><Text size="1" color="green">绿色：图片</Text><Text size="1" color="purple">紫色：题目</Text></Flex>
      <SegmentedControl.Root value={editMode ? 'edit' : 'read'} aria-label="试卷预览模式"
        onValueChange={value => { if (!editing && !editingDisabled) setEditMode(value === 'edit') }}>
        <SegmentedControl.Item value="read">只读模式</SegmentedControl.Item>
        <SegmentedControl.Item value="edit">编辑模式</SegmentedControl.Item>
      </SegmentedControl.Root>
    </div>}
    {previewDraft.content.groups.filter(group => !focusQuestionId || group.questions.some(question => question.id === focusQuestionId)).map(group => {
      const activities: readonly ExamActivity[] = group.activities ?? [{ id: group.id, title: '',
        instructionIds: group.instructions.map(block => block.id), materialIds: group.materialIds,
        questionIds: group.questions.map(question => question.id), layout: 'questions' }]
      const materials = previewDraft.content.materials.filter(item => group.materialIds.includes(item.id))
      return <section key={group.id}><Flex direction="column" gap="4">
        {!focusQuestionId && <Heading as="h2" size="7">{group.sectionId} · Part {group.partNumber}</Heading>}
        <Flex direction="column" gap="8">
        {activities.filter(activity => !focusQuestionId || activity.questionIds.some(id => id === focusQuestionId)).map(activity => {
          const previewGroup = { ...group, activities: [activity], questions: group.questions.filter(question => activity.questionIds.includes(question.id)) }
          const activityKey = `activity/${activity.id}`
          const activityDraft = editing?.key === activityKey ? editing.draft : null
          const activityGroup = activityDraft?.content.groups.find(value => value.id === group.id)
          return <section key={activity.id} aria-label={activity.title || '题目区块'}>
            {activityDraft && activityGroup ? <Flex direction="column" gap="3">
              <Flex justify="between" align="center" gap="2" wrap="wrap">
                <Text weight="bold">编辑{activity.title ? ` ${activity.title}` : '题目'}</Text>
                <RegionEditActions tone="question" disabled={editingDisabled} saving={saving} onSave={() => void saveRegion()} onCancel={finish} />
              </Flex>
              <fieldset disabled={editingDisabled || saving} className="flex min-w-0 flex-col gap-3">
                {activityGroup.questions.filter(question => activity.questionIds.includes(question.id)).map(question => <StickerCard key={question.id} variant="soft" tone="paper" size="sm" radius="md">
                  <Flex direction="column" gap="3">
                    <Text weight="bold">{question.displayLabel ?? `第 ${question.location.questionNumber} 题`}</Text>
                    <DraftFields draft={activityDraft} onChange={updateLocal} selectedQuestionId={question.id} questionOnly />
                  </Flex>
                </StickerCard>)}
              </fieldset>
              {saveError && <Text role="alert" size="2" color="red" className="whitespace-pre-wrap">{saveError}</Text>}
              <Text size="1" color="gray">保存会直接存储修改，成功后返回预览。</Text>
            </Flex> : <ExamActivityEditContext.Provider value={onChange ? { start: () => { setEditing({ key: activityKey, draft }); onEditingChange?.(true) }, disabled: !!editing || !!editingDisabled } : null}>
            <ExamGroupRenderer handwritingEnabled studentPresentation group={previewGroup} materials={materials} attemptId="" adminRevisionId={revisionId}
              answers={previewAnswers} onAnswer={(questionId, answer) => setPreviewAnswers(previous => ({ ...previous, [questionId]: answer }))} disabled={editingDisabled || !!editing}
              renderImage={(slotId, alt, aspectRatio, displayWidth) => renderImage(`${group.id}/${activity.id}`, slotId, alt, aspectRatio, displayWidth)}
              renderMaterial={onChange ? (_material, content) => content : undefined}
              audio={{ slots: draft.content.mediaSlots, boundSlotIds: audioState.data?.slots.filter(slot => slot.binding).map(slot => slot.id) ?? [], loading: audioState.isLoading, error: !!audioState.error }}
              renderOptionImage={option => <PaperImage userId={userId} revisionId={revisionId} slotId={option.imageSlotId!} alt={option.label} workspace={workspace} option={option} displayWidth={option.displayWidth}
                onRecrop={recropFor(option.imageSlotId!)} recropDisabled={editingDisabled || !!editing} />}
              renderQuestion={(question, fields, { compact }) => {
                const content = renderUnit(question.id, question.displayLabel ?? `第 ${question.location.questionNumber} 题`, fields, value =>
                  <DraftFields draft={value} onChange={updateLocal} selectedQuestionId={question.id} questionOnly />)
                return compact ? content : <StickerCard asChild={!!onChange && editMode} variant="soft" tone={question.scoring.kind === 'example' ? 'accent' : 'white'} size="sm" elevation="flat" radius="md">{content}</StickerCard>
              }}
              renderQuestionTools={onChange && editMode ? question => renderUnit(question.id, `第 ${question.location.questionNumber} 题`,
                <Text size="2">{question.displayLabel ?? `第 ${question.location.questionNumber} 题`}</Text>, value =>
                  <DraftFields draft={value} onChange={updateLocal} selectedQuestionId={question.id} questionOnly />) : undefined}
              questionToolsForHiddenOnly />
            </ExamActivityEditContext.Provider>}
          </section>
        })}
        </Flex>
      </Flex></section>
    })}
  </Flex></ExamAuthoringContext.Provider>
}
