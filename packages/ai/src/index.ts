export type {
  AgentAction,
  AgentBlock,
  AgentResponse,
  AgentSource,
  AiSubject,
  ChatContext,
  KnowledgeSearchHit,
  LessonNote,
  LinkManifestEntry,
  SimilarProblem,
  TeachingSessionState,
  TeachingSessionStatus,
  TeachingStage,
} from './types'

export { default as AiAssistantPage } from './components/AiAssistantPage'
export { default as AiFloatingAssistant } from './components/AiFloatingAssistant'
export {
  findVisibleActiveProblem,
  shouldShowAiAssistant,
  subjectFromPathname,
} from './components/AiFloatingAssistant'
export { default as AiChatPanel } from './components/AiChatPanel'
export { default as AiVoiceInput } from './components/AiVoiceInput'
export { default as AiMessageRenderer } from './components/agent/AiMessageRenderer'

export {
  parseAgentResponse,
  safeParseAgentResponse,
  fallbackAgentResponse,
} from './agent/agent-response.schema'
export { classifyIntent } from './agent/classify-intent'
export { runAgentOrchestrator } from './agent/orchestrator'

export { upsertKnowledgeDocument } from './server/ingest-upsert'
export { runChatStream } from './server/chat'
export { transcribeAudio } from './server/transcribe'
export { chunkDocument } from './server/chunker'
export { contentHash, normalizeContent, stripHtml } from './server/content-hash'
export { updateKnowledgeSyncState } from './server/sync-state'
export type { KnowledgeSyncProgress, KnowledgeSyncStatus } from './server/sync-state'
export { aggregateAiQualityMetrics } from './server/metrics'
export type {
  AiConversationMetricRow,
  AiQualityMetrics,
  AiTeachingMetricRow,
} from './server/metrics'
export {
  advanceTeachingSession,
  getTeachingSession,
  startTeachingSession,
  teachingSessionActionSchema,
  teachingSessionStartSchema,
  TeachingSessionError,
  transitionTeachingSession,
  teachingCompletionKind,
} from './server/teaching-session-store'
export {
  resolveTeachingEvidenceTarget,
  verifyTeachingSessionEvidence,
} from './server/teaching-verification'
export type {
  TeachingEvidenceTarget,
  TeachingVerificationResult,
} from './server/teaching-verification'
export type {
  TeachingSessionAction,
  TeachingSessionStartInput,
} from './server/teaching-session-store'
export {
  loadStudentProfile,
  buildStudentProfilePrompt,
  todayInShanghai,
} from './server/student-profile'
export {
  buildTeachingStagePrompt,
  classifyTeachingTurn,
  isExplicitTeachingBehavior,
  shouldHideFullSolution,
} from './server/teaching-session'
export type {
  StudentActivePlan,
  StudentProfile,
  StudentSubjectProfile,
} from './server/student-profile'
export {
  resolveActionsForSourceRefs,
  resolveActionsForHits,
  isAllowedHref,
  findManifestByHref,
  findManifestByProblemId,
} from './server/tools/resolve-links'
export { resolveMathProblemId } from './server/tools/lookup-passage'
