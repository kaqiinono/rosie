import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExamRecommendation, ExamReportEvidence, ExamSkillInsight, QuestionGroup } from '@rosie/exams'
import { validateExamDraft } from '@rosie/exams/validation'
import { readExamMediaBinding, verifyExamMediaForAttempt } from './media'
import type { ReportAttemptRow, ReportRevisionRow } from './insights'

export interface ReportWordBatch { id: string; status: 'collecting' | 'active' | 'completed'; updated_at: string; completed_at: string | null }
export interface RecommendationInput {
  attempts: readonly ReportAttemptRow[]
  batches: readonly ReportWordBatch[]
  published: readonly ReportRevisionRow[]
  seenFamilies: ReadonlySet<string>
  insights: readonly ExamSkillInsight[]
  evidence: readonly ExamReportEvidence[]
  verificationBatches: readonly { id: string; wordEntryIds: readonly string[] }[]
}

function referencedSlots(value: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach(item => referencedSlots(item, ids))
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if ((key === 'mediaSlotId' || key === 'imageSlotId') && typeof item === 'string') ids.add(item)
      else referencedSlots(item, ids)
    }
  }
  return ids
}

/** Candidate-only check. Attempt creation and each media request authorize again. */
async function groupAvailable(db: SupabaseClient, revision: ReportRevisionRow, group: QuestionGroup, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return false
  const { data, error } = await db.rpc('read_exam_publication', { p_id: revision.id }).abortSignal(signal)
  if (error || !data || typeof data !== 'object') return false
  const publication = data as Record<string, unknown>
  if (publication.status !== 'published' || !publication.draft || typeof publication.draft !== 'object') return false
  const stored = publication.draft as Record<string, unknown>
  if (!stored.content || typeof stored.content !== 'object') return false
  const result = validateExamDraft({ ...stored, content: { ...stored.content, status: 'draft' } })
  if (!result.ok || result.value.contentSet.purpose !== 'training') return false
  const draft = result.value
  const local = draft.content.groups.find(item => item.id === group.id)
  if (!local || !local.questions.length) return false
  const referenced = referencedSlots(local)
  draft.content.materials.filter(material => local.materialIds.includes(material.id)).forEach(material => referencedSlots(material, referenced))
  const relevant = draft.content.mediaSlots.filter(slot => referenced.has(slot.id) || (slot.target.kind === 'group' && slot.target.id === local.id)
    || (slot.target.kind === 'content_set' && slot.purpose === 'exam_listening' && local.sectionId === 'listening'))
  if (!relevant.length && !draft.content.mediaSlots.some(slot => slot.required)) return true
  if (!draft.content.mediaBindingRevisionId) return false
  try {
    const binding = await readExamMediaBinding(db, draft.content.id, draft.content.mediaBindingRevisionId)
    for (const slot of relevant) {
      const file = binding.files.find(item => item.slot_id === slot.id)
      if (!file?.reviewed) return false
      for (const sibling of binding.files.filter(item => item.file_id === file.file_id)) {
        // Unclear content-set/shared scopes are a real availability gap, not an
        // excuse to offer an unsafe or unusable one-group recommendation.
        if (sibling.slot.audience !== 'student' || sibling.slot.target.kind !== 'group' || sibling.slot.target.id !== local.id) return false
        for (const other of draft.content.groups.filter(item => item.id !== local.id)) {
          if (referencedSlots(other).has(sibling.slot_id) || draft.content.materials.some(material => other.materialIds.includes(material.id) && referencedSlots(material).has(sibling.slot_id))) return false
        }
        if (draft.content.guidance.some(item => item.groupIds.some(id => id !== local.id) && referencedSlots(item).has(sibling.slot_id))) return false
      }
    }
    // Creation currently verifies the frozen revision's required media; use the
    // same check here so a recommended group can pass that entry gate.
    await verifyExamMediaForAttempt(db, draft, draft.content.mediaBindingRevisionId, undefined, signal)
    return true
  } catch { return false }
}

export async function buildExamRecommendations(db: SupabaseClient, input: RecommendationInput): Promise<ExamRecommendation[]> {
  const result: ExamRecommendation[] = []
  const probeDeadline = Date.now() + 8000
  const probeSignal = AbortSignal.timeout(8000)
  const add = (item: ExamRecommendation) => { if (result.length < 3) result.push(item) }
  for (const attempt of [...input.attempts].filter(item => Object.values(item.state.sections).some(section => section.status !== 'submitted'))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id))) {
    if (result.length === 3) break
    add({ id: `continue:${attempt.id}`, kind: 'continue', title: '继续未完成的学习', reason: '先完成已开始的会话；原有计时和材料接触记录会保留。',
      href: `/exams/attempts/${attempt.id}`, practice: null, evidenceQuestionIds: [], batchIds: [] })
  }
  for (const batch of [...input.batches].filter(item => item.status !== 'completed')
    .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || a.updated_at.localeCompare(b.updated_at) || a.id.localeCompare(b.id))) {
    if (result.length === 3) break
    add({ id: `words:${batch.id}`, kind: 'words', title: '完成已确认的词汇补练', reason: '补练记录单独保留，不修改考试首次结果或词库掌握等级。',
      href: `/exams/review-words/${batch.id}`, practice: null, evidenceQuestionIds: [], batchIds: [batch.id] })
  }
  const chosenGroups = new Set<string>()
  for (const insight of input.insights.filter(item => item.status === 'strengthen').sort((a, b) => a.numerator / a.denominator - b.numerator / b.denominator || a.id.localeCompare(b.id))) {
    if (result.length === 3) break
    const candidates = input.published.filter(revision => revision.set_snapshot.purpose === 'training').flatMap(revision => revision.content.groups.map(group => {
      const families = revision.content.materials.filter(item => group.materialIds.includes(item.id)).map(item => item.familyId)
      const matches = group.questions.filter(question => insight.kind === 'skill' ? question.classification.primarySkillId === insight.id : question.classification.knowledgePointIds.includes(insight.id)).length
      const practiced = input.attempts.filter(attempt => attempt.content_revision_id === revision.id && attempt.state.groupIds.includes(group.id)).map(attempt => attempt.updated_at).sort().at(-1) ?? ''
      return { revision, group, matches, seen: !families.length || families.some(id => input.seenFamilies.has(id)), practiced }
    })).filter(item => item.matches > 0 && !chosenGroups.has(`${item.revision.id}:${item.group.id}`))
      .sort((a, b) => b.matches - a.matches || Number(a.seen) - Number(b.seen) || a.practiced.localeCompare(b.practiced)
        || a.revision.id.localeCompare(b.revision.id) || a.group.id.localeCompare(b.group.id))
    let selected: typeof candidates[number] | undefined
    // Bound remote probes; an exhausted scan is disclosed instead of silently
    // treating an unchecked resource as available.
    for (const candidate of candidates.slice(0, 12)) {
      if (Date.now() >= probeDeadline) break
      if (await groupAvailable(db, candidate.revision, candidate.group, probeSignal)) { selected = candidate; break }
    }
    const evidenceQuestionIds = insight.evidence.filter(item => item.included && !item.correct).map(item => item.questionId)
    if (selected) {
      chosenGroups.add(`${selected.revision.id}:${selected.group.id}`)
      add({ id: `practice:${insight.kind}:${insight.id}`, kind: 'practice', title: `${insight.id} · 完整题组练习`,
        reason: `最近 28 天独立答对 ${insight.numerator}/${insight.denominator} 题。${selected.seen ? '此材料已见，本次用于复习，不增加独立样本。' : '优先使用未见材料验证。'}`,
        href: null, practice: { revisionId: selected.revision.id, groupId: selected.group.id }, evidenceQuestionIds, batchIds: [] })
    } else add({ id: `gap:${insight.kind}:${insight.id}`, kind: 'gap', title: `${insight.id} · 等待可用题组`,
      reason: candidates.length > 12 || Date.now() >= probeDeadline ? '本次检查范围或时间内未确认可用完整题组，暂不推荐未经检查的资源，可稍后刷新。' : '暂无匹配且媒体可用的非保留测评题组；等待新增内容。',
      href: null, practice: null, evidenceQuestionIds, batchIds: [] })
  }
  const recentWrong = [...input.evidence].filter(item => item.outcome === 'incorrect' || item.outcome === 'unanswered')
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt) || a.questionId.localeCompare(b.questionId))
  const reviewed = new Set<string>()
  for (const item of recentWrong) {
    if (result.length === 3) break
    if (reviewed.has(item.attemptId)) continue
    reviewed.add(item.attemptId)
    add({ id: `review:${item.attemptId}`, kind: 'method_review', title: '回到已提交的题目复盘方法',
      reason: '对照原文依据和解释，自己判断是否与词义、听辨、拼写或审题有关；系统不猜测出错原因。',
      href: `/exams/attempts/${item.attemptId}`, practice: null, evidenceQuestionIds: [item.questionId], batchIds: [] })
  }
  // A completed word batch is linked atomically when the learner explicitly
  // starts its fresh-material check. It does not bypass higher-priority work.
  for (const batch of input.verificationBatches) {
    if (result.length === 3) break
    const candidates = input.published.filter(revision => revision.set_snapshot.purpose === 'training').flatMap(revision => revision.content.groups.map(group => {
      const families = revision.content.materials.filter(material => group.materialIds.includes(material.id)).map(material => material.familyId)
      const ids = new Set(group.questions.map(question => question.id))
      const matches = revision.content.vocabularyLinks.filter(link => link.role === 'key' && link.review.status !== 'blocked'
        && batch.wordEntryIds.includes(link.wordEntryId) && link.questionIds.some(id => ids.has(id))).length
      return { revision, group, matches, unseen: families.length > 0 && families.every(id => !input.seenFamilies.has(id)) }
    })).filter(item => item.matches > 0 && item.unseen && !chosenGroups.has(`${item.revision.id}:${item.group.id}`))
      .sort((a, b) => b.matches - a.matches || a.revision.id.localeCompare(b.revision.id) || a.group.id.localeCompare(b.group.id))
    let selected: typeof candidates[number] | undefined
    for (const candidate of candidates.slice(0, 12)) {
      if (Date.now() >= probeDeadline) break
      if (await groupAvailable(db, candidate.revision, candidate.group, probeSignal)) { selected = candidate; break }
    }
    if (selected) {
      chosenGroups.add(`${selected.revision.id}:${selected.group.id}`)
      add({ id: `transfer:${batch.id}`, kind: 'practice', title: '用新材料验证补练词', reason: '本次完整题组会关联已完成的补练批次；只有首次独立作答才形成应用证据。',
        href: null, practice: { revisionId: selected.revision.id, groupId: selected.group.id, wordReviewBatchId: batch.id }, evidenceQuestionIds: [], batchIds: [batch.id] })
    } else add({ id: `transfer-gap:${batch.id}`, kind: 'gap', title: '等待新题验证', reason: '补练已完成，当前尚未找到匹配词条且媒体可用的未见完整题组。',
      href: null, practice: null, evidenceQuestionIds: [], batchIds: [batch.id] })
  }
  return result
}
