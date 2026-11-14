export interface ExamReportWindow {
  days: 14 | 28
  timeZone: 'Asia/Shanghai'
  from: string
  until: string
  fromDate: string
  throughDate: string
}

export type ExamEvidenceExclusion = 'not_objective' | 'missing_result' | 'missing_exposure'
  | 'seen_material' | 'help' | 'technical_interruption' | 'repeated_question' | 'outside_window'

/** Metadata only: evidence never includes question text, answers or reserved materials. */
export interface ExamReportEvidence {
  attemptId: string
  questionId: string
  groupId: string
  contentRevisionId: string
  submittedAt: string
  sectionId: string
  partNumber: number
  primarySkillId: string
  knowledgePointIds: string[]
  questionTypeId: string
  familyIds: string[]
  correct: boolean
  outcome: string
  included: boolean
  exclusions: ExamEvidenceExclusion[]
  timedOut: boolean
}

export interface ExamSkillInsight {
  kind: 'skill' | 'knowledge'
  id: string
  status: 'observe' | 'strengthen' | 'sufficient'
  numerator: number
  denominator: number
  familyCount: number
  sessionCount: number
  evidence: ExamReportEvidence[]
}

export interface ExamReportAttempt {
  id: string
  title: string
  mode: 'practice' | 'mock'
  status: 'unfinished' | 'pending_review' | 'completed'
  submittedAt: string | null
  parts: {
    sectionId: string; partNumber: number; objectivePoints: number; objectiveMaximum: number
    unanswered: number; pendingManual: number; helpCount: number; interrupted: boolean; timedOut: boolean
    groups: { id: string; activeMs: number }[]
  }[]
}

export interface ExamManualEvaluation {
  id: string
  attemptId: string
  questionId: string
  reviewedAt: string
  dimensions: { id: string; score: number; maximum: number | null; comment: string }[]
  points: number
  maxPoints: number
  comment: string
  current: boolean
}

export interface ExamWordReport {
  completedBatches: number
  completedWords: number
  pendingWords: number
  meaning: { independentCorrect: number; independentAttempts: number; attempts: number; helpClicks: number }
  spelling: { independentCorrect: number; independentAttempts: number; attempts: number; helpClicks: number }
  /** Confirmed applications require fresh, independent objective evidence, not review answers. */
  applicationWords: number
  awaitingVerificationWords: number
}

export type ExamRecommendation = {
  id: string
  kind: 'continue' | 'words' | 'practice' | 'method_review' | 'gap'
  title: string
  reason: string
  href: string | null
  practice: { revisionId: string; groupId: string; wordReviewBatchId?: string } | null
  evidenceQuestionIds: string[]
  batchIds: string[]
}

export interface ExamLearningReport {
  ruleVersion: 'insights-v1'
  generatedAt: string
  window: ExamReportWindow
  insightWindow: ExamReportWindow
  thresholds: { questions: 8; families: 3; sessions: 2; belowAccuracy: 0.7 }
  progress: { completedSessions: number; questionCount: number; groupCount: number; unfinishedSessions: number; pendingManual: number }
  performance: {
    numerator: number; denominator: number
    helped: { correct: number; total: number }
    repeated: { correct: number; total: number }
    seen: { correct: number; total: number }
    interrupted: { correct: number; total: number }
    questionTypes: string[]; knowledgePoints: string[]
  }
  days: { date: string; numerator: number; denominator: number; submittedQuestions: number }[]
  evidence: ExamReportEvidence[]
  insights: ExamSkillInsight[]
  attempts: ExamReportAttempt[]
  manualEvaluations: ExamManualEvaluation[]
  words: ExamWordReport
  recommendations: ExamRecommendation[]
  gaps: string[]
}
