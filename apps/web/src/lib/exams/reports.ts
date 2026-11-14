import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExamLearningReport, ExamManualEvaluation, ExamReportAttempt, ExamReportEvidence, ExamWordProgress, ExamWordReport } from '@rosie/exams'
import { ExamApiError } from './http'
import { attemptStorageError } from './attempts'
import { buildExamInsights, collectExamEvidence, INSIGHT_THRESHOLDS, reportWindow, shanghaiDate, withinReport,
  type ReportAttemptRow, type ReportExposureRow, type ReportRevisionRow } from './insights'
import { buildExamRecommendations, type ReportWordBatch } from './recommendations'

interface WordEvidenceRow {
  batch_id: string; word_entry_id: string; completed_at: string
  evidence: { version: 'word-review-v1'; meaning: ExamWordProgress; spelling: ExamWordProgress }
}
interface WordItemRow { batch_id: string; word_entry_id: string }
interface WordTransferRow { batch_id: string; attempt_id: string; created_at: string }
interface ManualReviewRow {
  id: string; attemptId: string; questionId: string; reviewedAt: string; comment: string; points: number; maxPoints: number
  dimensions: { dimensionId: string; score: number; comment: string }[]
}

/** Paginate owner-scoped reads; never draw a conclusion from a truncated history. */
async function allRows<T>(load: (start: number, end: number) => PromiseLike<{ data: unknown; error: { message?: string } | null }>): Promise<T[]> {
  const result: T[] = []
  for (let offset = 0; offset < 20_000; offset += 500) {
    const response = await load(offset, offset + 499)
    if (response.error) attemptStorageError(response.error)
    if (!Array.isArray(response.data)) throw new ExamApiError('exam_unavailable', 503)
    result.push(...response.data as T[])
    if (response.data.length < 500) return result
  }
  throw new ExamApiError('exam_report_limit', 503)
}

function status(attempt: ReportAttemptRow): ExamReportAttempt['status'] {
  if (Object.values(attempt.state.sections).some(section => section.status !== 'submitted')) return 'unfinished'
  return Object.values(attempt.state.results).some(result => result.outcome === 'pending') ? 'pending_review' : 'completed'
}

function summarizeAttempt(attempt: ReportAttemptRow, revision: ReportRevisionRow, window: ExamLearningReport['window']): ExamReportAttempt {
  const parts: ExamReportAttempt['parts'] = []
  for (const group of revision.content.groups.filter(item => attempt.state.groupIds.includes(item.id))) {
    const section = attempt.state.sections[group.sectionId]
    if (section?.status !== 'submitted' || !section.submittedAt || !withinReport(section.submittedAt, window)) continue
    let part = parts.find(item => item.sectionId === group.sectionId && item.partNumber === group.partNumber)
    if (!part) {
      part = { sectionId: group.sectionId, partNumber: group.partNumber, objectivePoints: 0, objectiveMaximum: 0,
        unanswered: 0, pendingManual: 0, helpCount: 0, interrupted: section.technicalInterruption, timedOut: section.timedOut, groups: [] }
      parts.push(part)
    }
    part.groups.push({ id: group.id, activeMs: attempt.state.groupActiveMs[group.id] ?? 0 })
    for (const question of group.questions) {
      const result = attempt.state.results[question.id]
      if (question.scoring.kind === 'objective' && result && result.points !== null && result.maxPoints !== null) {
        part.objectivePoints += result.points
        part.objectiveMaximum += result.maxPoints
        if (result.outcome === 'unanswered') part.unanswered += 1
      }
      if (result?.outcome === 'pending') part.pendingManual += 1
      if (attempt.state.helpQuestionIds.includes(question.id)) part.helpCount += 1
    }
  }
  const submittedAt = Object.values(attempt.state.sections).flatMap(section => section.submittedAt ? [section.submittedAt] : []).sort().at(-1) ?? null
  return { id: attempt.id, title: revision.set_snapshot.title, mode: attempt.state.mode, status: status(attempt), submittedAt, parts }
}

function tally(items: readonly ExamReportEvidence[], exclusion: ExamReportEvidence['exclusions'][number]) {
  const selected = items.filter(item => !item.exclusions.includes('not_objective') && !item.exclusions.includes('missing_result') && item.exclusions.includes(exclusion))
  return { correct: selected.filter(item => item.correct).length, total: selected.length }
}

function wordReport(batches: readonly ReportWordBatch[], items: readonly WordItemRow[], evidence: readonly WordEvidenceRow[],
  transfers: readonly WordTransferRow[], examEvidence: readonly ExamReportEvidence[], revisions: ReadonlyMap<string, ReportRevisionRow>, window: ExamLearningReport['window']): ExamWordReport {
  const finished = evidence.filter(row => withinReport(row.completed_at, window))
  const pending = new Set(batches.filter(batch => batch.status !== 'completed').map(batch => batch.id))
  const words = new Set(finished.map(row => row.word_entry_id))
  const applications = new Set<string>()
  for (const item of examEvidence.filter(row => row.included && row.correct && withinReport(row.submittedAt, window))) {
    const revision = revisions.get(item.contentRevisionId)
    for (const link of revision?.content.vocabularyLinks ?? []) {
      if (link.role !== 'key' || link.review.status === 'blocked' || !link.questionIds.some(id => id === item.questionId)) continue
      if (evidence.some(row => row.word_entry_id === link.wordEntryId && Date.parse(row.completed_at) < Date.parse(item.submittedAt)
        && transfers.some(transfer => transfer.batch_id === row.batch_id && transfer.attempt_id === item.attemptId))) applications.add(link.wordEntryId)
    }
  }
  const phase = (key: 'meaning' | 'spelling') => {
    const values = finished.map(row => row.evidence[key])
    return { independentCorrect: values.filter(value => value.firstIndependent === true && value.firstCorrect === true).length,
      independentAttempts: values.filter(value => value.firstIndependent === true && value.firstCorrect !== null).length,
      attempts: values.reduce((sum, value) => sum + value.attempts, 0), helpClicks: values.reduce((sum, value) => sum + value.helpClicks, 0) }
  }
  return { completedBatches: batches.filter(batch => batch.completed_at && withinReport(batch.completed_at, window)).length,
    completedWords: words.size, pendingWords: new Set(items.filter(item => pending.has(item.batch_id)).map(item => item.word_entry_id)).size,
    meaning: phase('meaning'), spelling: phase('spelling'), applicationWords: applications.size,
    awaitingVerificationWords: [...words].filter(id => !applications.has(id)).length }
}

async function manualReviews(db: SupabaseClient, userId: string, attempts: readonly ReportAttemptRow[], revisions: ReadonlyMap<string, ReportRevisionRow>, window: ExamLearningReport['window']): Promise<ExamManualEvaluation[]> {
  const result: ExamManualEvaluation[] = []
  for (const attempt of attempts.filter(row => Date.parse(row.updated_at) >= Date.parse(window.from)
    && revisions.get(row.content_revision_id)?.content.groups.some(group => row.state.groupIds.includes(group.id)
      && row.state.sections[group.sectionId]?.status === 'submitted' && group.questions.some(question => question.scoring.kind === 'manual')))) {
    const response = await db.rpc('read_exam_manual_reviews', { p_user: userId, p_attempt_id: attempt.id })
    if (response.error) attemptStorageError(response.error)
    if (!Array.isArray(response.data)) throw new ExamApiError('exam_unavailable', 503)
    const rows = (response.data as ManualReviewRow[]).sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt) || a.id.localeCompare(b.id))
    const latest = new Map(rows.map(row => [row.questionId, row.id]))
    for (const row of rows.filter(item => withinReport(item.reviewedAt, window))) {
      if (row.attemptId !== attempt.id) throw new ExamApiError('exam_unavailable', 503)
      result.push({ id: row.id, attemptId: row.attemptId, questionId: row.questionId, reviewedAt: row.reviewedAt,
        dimensions: row.dimensions.map(dimension => ({ id: dimension.dimensionId, score: dimension.score, maximum: null, comment: dimension.comment })),
        points: row.points, maxPoints: row.maxPoints, comment: row.comment, current: latest.get(row.questionId) === row.id })
    }
  }
  return result.sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt) || a.id.localeCompare(b.id))
}

export async function readExamReport(db: SupabaseClient, userId: string, days: 14 | 28, now = Date.now()): Promise<ExamLearningReport> {
  const window = reportWindow(days, now)
  const insightWindow = reportWindow(28, now)
  const [attempts, exposures, batches, wordItems, wordEvidence, transfers] = await Promise.all([
    allRows<ReportAttemptRow>((from, to) => db.from('exam_attempts').select('id,content_revision_id,state,created_at,updated_at').eq('user_id', userId).order('id').range(from, to)),
    allRows<ReportExposureRow>((from, to) => db.from('exam_material_exposures').select('attempt_id,family_id,seen_before,first_exposed_at').eq('user_id', userId).order('attempt_id').order('family_id').range(from, to)),
    allRows<ReportWordBatch>((from, to) => db.from('exam_word_review_batches').select('id,status,completed_at,updated_at').eq('user_id', userId).order('id').range(from, to)),
    allRows<WordItemRow>((from, to) => db.from('exam_word_review_items').select('batch_id,word_entry_id').eq('user_id', userId).order('batch_id').order('word_entry_id').range(from, to)),
    allRows<WordEvidenceRow>((from, to) => db.from('exam_word_review_evidence').select('batch_id,word_entry_id,evidence,completed_at').eq('user_id', userId).order('batch_id').order('word_entry_id').range(from, to)),
    allRows<WordTransferRow>((from, to) => db.from('exam_word_review_transfers').select('batch_id,attempt_id,created_at').eq('user_id', userId).order('batch_id').order('attempt_id').range(from, to)),
  ])
  const revisionIds = [...new Set(attempts.map(attempt => attempt.content_revision_id))]
  const revisions = new Map<string, ReportRevisionRow>()
  for (let offset = 0; offset < revisionIds.length; offset += 100) {
    const response = await db.from('exam_content_revisions').select('id,set_snapshot,content').in('id', revisionIds.slice(offset, offset + 100))
    if (response.error) attemptStorageError(response.error)
    for (const row of (response.data ?? []) as ReportRevisionRow[]) revisions.set(row.id, row)
  }
  if (revisionIds.some(id => !revisions.has(id))) throw new ExamApiError('exam_unavailable', 503)
  const allEvidence = collectExamEvidence(attempts, revisions, exposures, insightWindow)
  const insightEvidence = allEvidence.filter(item => withinReport(item.submittedAt, insightWindow))
  if (insightEvidence.length > 10_000) throw new ExamApiError('exam_report_limit', 503)
  const evidence = insightEvidence.filter(item => withinReport(item.submittedAt, window))
  const valid = evidence.filter(item => item.included)
  const insights = buildExamInsights(allEvidence, insightWindow)
  const summaries = attempts.flatMap(attempt => {
    const revision = revisions.get(attempt.content_revision_id)
    if (!revision) return []
    const summary = summarizeAttempt(attempt, revision, window)
    return summary.parts.length ? [summary] : []
  }).sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? '') || a.id.localeCompare(b.id))
  const words = wordReport(batches, wordItems, wordEvidence, transfers, allEvidence, revisions, window)
  const publishedResponse = await db.from('exam_content_revisions').select('id,set_snapshot,content').eq('status', 'published')
    .eq('set_snapshot->>purpose', 'training').order('id').limit(101)
  if (publishedResponse.error) attemptStorageError(publishedResponse.error)
  const published = (publishedResponse.data ?? []) as ReportRevisionRow[]
  const recommendations = await buildExamRecommendations(db, { attempts, batches, published: published.slice(0, 100),
    seenFamilies: new Set(exposures.map(row => row.family_id)), insights, evidence,
    verificationBatches: batches.filter(batch => batch.status === 'completed' && batch.completed_at && withinReport(batch.completed_at, insightWindow)
      && !transfers.some(transfer => transfer.batch_id === batch.id)).map(batch => ({ id: batch.id,
      wordEntryIds: wordItems.filter(item => item.batch_id === batch.id).map(item => item.word_entry_id) })) })
  const manualEvaluations = await manualReviews(db, userId, attempts, revisions, window)
  const daysRows: ExamLearningReport['days'] = []
  for (let time = Date.parse(window.from); time <= now; time += 86_400_000) {
    const date = shanghaiDate(time)
    const daily = evidence.filter(item => shanghaiDate(item.submittedAt) === date && !item.exclusions.includes('not_objective'))
    const independent = daily.filter(item => item.included)
    daysRows.push({ date, numerator: independent.filter(item => item.correct).length, denominator: independent.length, submittedQuestions: daily.length })
  }
  const gaps: string[] = []
  if (evidence.some(item => item.exclusions.includes('missing_exposure'))) gaps.push('部分题组缺少可核实的材料家族接触记录，已从独立样本中排除。')
  if (words.awaitingVerificationWords) gaps.push('部分补练词尚无新材料中的独立应用证据，等待新题验证。')
  if (published.length > 100) gaps.push('推荐候选范围限于前 100 个已发布训练版本；报告统计未截断。')
  return { ruleVersion: 'insights-v1', generatedAt: new Date(now).toISOString(), window, insightWindow, thresholds: INSIGHT_THRESHOLDS,
    progress: { completedSessions: summaries.filter(item => item.status !== 'unfinished').length,
      questionCount: new Set(evidence.filter(item => item.outcome !== 'unscored').map(item => item.questionId)).size,
      groupCount: new Set(evidence.map(item => `${revisions.get(item.contentRevisionId)?.content.contentSetId}:${item.groupId}`)).size,
      unfinishedSessions: attempts.filter(item => status(item) === 'unfinished').length,
      pendingManual: summaries.reduce((sum, attempt) => sum + attempt.parts.reduce((total, part) => total + part.pendingManual, 0), 0) },
    performance: { numerator: valid.filter(item => item.correct).length, denominator: valid.length,
      helped: tally(evidence, 'help'), repeated: tally(evidence, 'repeated_question'), seen: tally(evidence, 'seen_material'), interrupted: tally(evidence, 'technical_interruption'),
      questionTypes: [...new Set(evidence.map(item => item.questionTypeId))].sort(), knowledgePoints: [...new Set(evidence.flatMap(item => item.knowledgePointIds))].sort() },
    days: daysRows, evidence, insights, attempts: summaries, manualEvaluations, words, recommendations, gaps }
}
