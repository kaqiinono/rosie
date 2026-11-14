export const EXAM_REFLECTION_REASONS = [
  'unknown_word', 'unclear_audio', 'spelling', 'misunderstood_question', 'unsure',
] as const

export type ExamReflectionReason = typeof EXAM_REFLECTION_REASONS[number]

export const EXAM_REFLECTION_REASON_LABELS: Readonly<Record<ExamReflectionReason, string>> = {
  unknown_word: '不认识词', unclear_audio: '没听清', spelling: '拼写问题',
  misunderstood_question: '没看懂问题', unsure: '不确定',
}

export interface ExamQuestionReflectionRecord {
  questionId: string
  reason: ExamReflectionReason | null
  version: string
}

export interface ExamReflectionList { items: ExamQuestionReflectionRecord[] }

export interface ExamReflectionCommand {
  requestId: string
  questionId: string
  expectedVersion: string | null
  reason: ExamReflectionReason | null
}
