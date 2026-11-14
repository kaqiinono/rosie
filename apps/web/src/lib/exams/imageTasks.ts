import 'server-only'
import { isDeepStrictEqual } from 'node:util'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExamImageTask, ExamImageWorkspace, MaterialBlock } from '@rosie/exams'
import { ExamApiError } from './http'
import { readExamMediaBinding, readExamMediaDraft } from './media'
import { imageReviewKey } from './imageReview'

export async function readExamImageContext(db: SupabaseClient, revisionId: string, slotId: string) {
  const record = await readExamMediaDraft(db, revisionId)
  if (record.status !== 'draft') throw new ExamApiError('exam_not_editable', 409)
  const state = await db.from('exam_image_task_states').select('retired').eq('content_revision_id', revisionId).eq('slot_id', slotId).maybeSingle()
  if (state.error) throw new ExamApiError('exam_image_storage_unavailable', 503)
  if (state.data?.retired) throw new ExamApiError('exam_image_task_removed', 409)
  const slot = record.draft.content.mediaSlots.find(item => item.id === slotId && item.purpose === 'question_image' && item.audience === 'student')
  if (!slot) throw new ExamApiError('exam_not_found', 404)
  const source = slot.provenance.sources[0] ?? null
  return { ...record, slot, source }
}

export async function readExamImageWorkspace(db: SupabaseClient, revisionId: string): Promise<ExamImageWorkspace> {
  const { draft, version, status } = await readExamMediaDraft(db, revisionId)
  if (status !== 'draft') throw new ExamApiError('exam_not_editable', 409)
  const bindingId = draft.content.mediaBindingRevisionId
  const binding = bindingId ? await readExamMediaBinding(db, revisionId, bindingId) : null
  const { data: jobs, error } = await db.from('exam_image_crop_jobs').select('slot_id,command,uploaded_file,receipt')
    .eq('content_revision_id', revisionId).order('updated_at', { ascending: false }).limit(2000)
  if (error) throw new ExamApiError('exam_image_storage_unavailable', 503)
  const states = await db.from('exam_image_task_states').select('slot_id,retired').eq('content_revision_id', revisionId)
  if (states.error) throw new ExamApiError('exam_image_storage_unavailable', 503)
  const reviews = await db.from('exam_image_task_reviews').select('slot_id,status,file_snapshot,version').eq('content_revision_id', revisionId)
  if (reviews.error) throw new ExamApiError('exam_image_storage_unavailable', 503)
  const sources = await db.from('exam_image_source_pages').select('source_id,pdf_page,sha256,state')
    .eq('source_id', draft.contentSet.source.id).eq('source_file_hash', draft.contentSet.source.fileHash)
  if (sources.error) throw new ExamApiError('exam_image_storage_unavailable', 503)
  const tasks: ExamImageTask[] = []
  for (const slot of draft.content.mediaSlots.filter(item => item.purpose === 'question_image')) {
    const group = draft.content.groups.find(item => item.id === slot.target.id || item.questions.some(q => q.id === slot.target.id)) ?? null
    const materials = draft.content.materials.filter(item => group?.materialIds.includes(item.id))
    const blocks: MaterialBlock[] = [...materials.flatMap(item => [...item.blocks]), ...(group?.instructions ?? []), ...(group?.questions.flatMap(q => [...q.prompt]) ?? [])]
    const image = blocks.find(block => block.kind === 'image' && block.mediaSlotId === slot.id)
    const question = group?.questions.find(q => (q.answerType === 'single_choice' || q.answerType === 'multiple_choice') && q.options.some(option => option.imageSlotId === slot.id))
    const option = (question?.answerType === 'single_choice' || question?.answerType === 'multiple_choice') ? question.options.find(item => item.imageSlotId === slot.id) : null
    const direct = group?.questions.filter(q => JSON.stringify(q).includes(`"${slot.id}"`)) ?? []
    const numbered = image && group?.questions.find(q => image.id.startsWith(`task-${q.location.questionNumber}-`))
    const related = question ? [question] : direct.length ? direct : numbered ? [numbered] : group?.questions ?? []
    const questionNumbers = related.map(q => q.location.questionNumber)
    const label = question ? `第 ${question.location.questionNumber} 题 · 选项 ${option?.label ?? ''}`
      : image?.kind === 'image' ? image.alt : slot.id.split(':').at(-1) ?? slot.id
    const source = slot.provenance.sources[0] ?? null
    const asset = sources.data?.find(item => item.source_id === source?.sourceId && item.pdf_page === source?.pdfPage && item.state === 'ready')
    const file = binding?.files.find(item => item.slot_id === slot.id && isDeepStrictEqual(item.slot, slot))
    const job = jobs?.find(item => item.slot_id === slot.id && item.receipt && item.uploaded_file?.id === file?.file_id)
    const retired = states.data?.some(item => item.slot_id === slot.id && item.retired) ?? false
    const review = reviews.data?.find(item => item.slot_id === slot.id)
    const reviewStatus = file && review && isDeepStrictEqual(review.file_snapshot, file)
      && (review.status === 'approved' || review.status === 'flagged') ? review.status : 'pending'
    tasks.push({ retired, slot, label, questionNumbers, source, sourceAvailable: !retired && !!asset, sourceSha256: asset?.sha256 ?? null, group, materials,
      binding: file ? { name: file.path.split('/').at(-1) ?? '', reviewed: file.reviewed } : null,
      review: { status: reviewStatus, version: review?.version ?? null, imageKey: file ? imageReviewKey(file) : null },
      savedRegion: job?.command?.region ?? null })
  }
  return { revisionId, title: draft.contentSet.title, version, bindingRevisionId: bindingId, tasks }
}
