import 'server-only'

import type { ExamAttemptState, ExamContentRevision, ExamContentSet, ExamReportEvidence, ExamReportWindow, ExamSkillInsight } from '@rosie/exams'

export interface ReportAttemptRow {
  id: string; content_revision_id: string; state: ExamAttemptState; created_at: string; updated_at: string
}
export interface ReportRevisionRow { id: string; set_snapshot: ExamContentSet; content: ExamContentRevision }
export interface ReportExposureRow { attempt_id: string; family_id: string; seen_before: boolean; first_exposed_at: string }

const DAY = 86_400_000
const SHANGHAI_OFFSET = 8 * 3_600_000
export const INSIGHT_THRESHOLDS = { questions: 8, families: 3, sessions: 2, belowAccuracy: 0.7 } as const

export function shanghaiDate(time: string | number): string {
  return new Date((typeof time === 'number' ? time : Date.parse(time)) + SHANGHAI_OFFSET).toISOString().slice(0, 10)
}

/** Include today and the preceding N-1 Shanghai calendar dates, through server now. */
export function reportWindow(days: 14 | 28, now: number): ExamReportWindow {
  const today = Math.floor((now + SHANGHAI_OFFSET) / DAY) * DAY - SHANGHAI_OFFSET
  const from = today - (days - 1) * DAY
  return { days, timeZone: 'Asia/Shanghai', from: new Date(from).toISOString(), until: new Date(now).toISOString(),
    fromDate: shanghaiDate(from), throughDate: shanghaiDate(now) }
}

export function withinReport(time: string, window: ExamReportWindow): boolean {
  const value = Date.parse(time)
  return Number.isFinite(value) && value >= Date.parse(window.from) && value <= Date.parse(window.until)
}

export function collectExamEvidence(attempts: readonly ReportAttemptRow[], revisions: ReadonlyMap<string, ReportRevisionRow>,
  exposures: readonly ReportExposureRow[], window: ExamReportWindow): ExamReportEvidence[] {
  const exposureMap = new Map(exposures.map(row => [`${row.attempt_id}:${row.family_id}`, row]))
  const evidence: ExamReportEvidence[] = []
  for (const attempt of attempts) {
    const revision = revisions.get(attempt.content_revision_id)
    if (!revision) continue
    for (const group of revision.content.groups.filter(item => attempt.state.groupIds.includes(item.id))) {
      const section = attempt.state.sections[group.sectionId]
      if (section?.status !== 'submitted' || !section.submittedAt) continue
      const familyIds = [...new Set(revision.content.materials.filter(material => group.materialIds.includes(material.id)).map(material => material.familyId))]
      const groupHelp = group.questions.some(question => attempt.state.helpQuestionIds.includes(question.id))
      for (const question of group.questions) {
        const result = attempt.state.results[question.id]
        const exclusions: ExamReportEvidence['exclusions'] = []
        if (question.scoring.kind !== 'objective') exclusions.push('not_objective')
        if (!result || !['correct', 'incorrect', 'unanswered'].includes(result.outcome)) exclusions.push('missing_result')
        if (!familyIds.length || familyIds.some(family => {
          const row = exposureMap.get(`${attempt.id}:${family}`)
          return !row || Date.parse(row.first_exposed_at) > Date.parse(section.submittedAt!)
        })) exclusions.push('missing_exposure')
        if (familyIds.some(family => exposureMap.get(`${attempt.id}:${family}`)?.seen_before || attempt.state.priorExposureFamilies.includes(family))) exclusions.push('seen_material')
        // An explanation of a shared-material sibling can assist the entire group.
        if (groupHelp) exclusions.push('help')
        if (section.technicalInterruption) exclusions.push('technical_interruption')
        if (!withinReport(section.submittedAt, window)) exclusions.push('outside_window')
        evidence.push({ attemptId: attempt.id, questionId: question.id, groupId: group.id,
          contentRevisionId: revision.id, submittedAt: section.submittedAt, sectionId: group.sectionId,
          partNumber: group.partNumber, primarySkillId: question.classification.primarySkillId,
          knowledgePointIds: [...question.classification.knowledgePointIds], questionTypeId: question.classification.questionTypeId,
          familyIds, correct: result?.outcome === 'correct', outcome: result?.outcome ?? 'missing',
          included: false, exclusions, timedOut: section.timedOut })
      }
    }
  }
  evidence.sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt) || a.attemptId.localeCompare(b.attemptId) || a.questionId.localeCompare(b.questionId))
  const firstQuestions = new Set<string>()
  for (const item of evidence) {
    // Lifetime first submission matters even when it was helped or outside this window.
    if (firstQuestions.has(item.questionId)) item.exclusions.push('repeated_question')
    firstQuestions.add(item.questionId)
    item.included = item.exclusions.length === 0
  }
  return evidence
}

export function buildExamInsights(evidence: readonly ExamReportEvidence[], window: ExamReportWindow): ExamSkillInsight[] {
  const buckets = new Map<string, ExamSkillInsight>()
  for (const item of evidence.filter(entry => withinReport(entry.submittedAt, window) && !entry.exclusions.includes('not_objective'))) {
    const labels: { kind: 'skill' | 'knowledge'; id: string }[] = [{ kind: 'skill', id: item.primarySkillId },
      ...item.knowledgePointIds.map(id => ({ kind: 'knowledge' as const, id }))]
    for (const label of labels) {
      const key = `${label.kind}:${label.id}`
      const bucket = buckets.get(key) ?? { ...label, status: 'observe' as const, numerator: 0, denominator: 0, familyCount: 0, sessionCount: 0, evidence: [] }
      bucket.evidence.push(item)
      buckets.set(key, bucket)
    }
  }
  return [...buckets.values()].map(bucket => {
    const valid = bucket.evidence.filter(item => item.included)
    bucket.numerator = valid.filter(item => item.correct).length
    bucket.denominator = valid.length
    bucket.familyCount = new Set(valid.flatMap(item => item.familyIds)).size
    bucket.sessionCount = new Set(valid.map(item => item.attemptId)).size
    const enough = bucket.denominator >= INSIGHT_THRESHOLDS.questions && bucket.familyCount >= INSIGHT_THRESHOLDS.families && bucket.sessionCount >= INSIGHT_THRESHOLDS.sessions
    bucket.status = !enough ? 'observe' : bucket.numerator / bucket.denominator < INSIGHT_THRESHOLDS.belowAccuracy ? 'strengthen' : 'sufficient'
    return bucket
  }).sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id))
}
