export type AiSubject = 'english' | 'math' | 'chinese'

export interface AgentSource {
  sourceRef: string
  title: string
  snippet?: string
  subject?: AiSubject
}

export type AgentBlock =
  | { type: 'text'; content: string }
  | {
      type: 'word_card'
      sourceRef: string
      word: string
      ipa?: string
      chineseDef: string
      example?: string
      stage?: string
      unit?: string
      lesson?: string
      explanation?: string
      phonics?: string
      syllables?: string[]
      keywords?: [string, string][]
      vocabType?: 'Target' | 'Context' | 'Extension'
      imagePath?: string
    }
  | {
      type: 'char_card'
      sourceRef: string
      char: string
      pinyin: string
      phrases: string[]
      unit?: number
      lessonTitle?: string
      radical?: string
      radicalName?: string
      structure?: string
      strokeCount?: number
    }
  | {
      type: 'passage_excerpt'
      sourceRef: string
      title: string
      subject?: AiSubject
      bookSlug?: string
      lessonKey?: string
      passageKey?: string
      stage?: string
      unit?: string
      lesson?: string
      paragraphs: string[]
    }
  | {
      type: 'math_solution'
      sourceRef: string
      problemId: string
      title: string
      steps: string[]
      finalAnswer?: string
      analysisImageUrl?: string
      fromCatalog: boolean
    }
  | {
      type: 'math_problem'
      sourceRef: string
      problemId: string
      title: string
    }
  | {
      type: 'poem_recite'
      sourceRef: string
      bookSlug: string
      poemId: string
      title: string
    }
  | {
      type: 'learning_status'
      subject?: AiSubject
      view: 'mastery' | 'mistakes' | 'overview'
    }
  | { type: 'today_tasks'; subject?: AiSubject }

export type AgentAction =
  | { type: 'navigate'; href: string; label: string; icon?: string }
  | { type: 'open_problem'; problemId: string; label: string }
  | { type: 'open_reading'; href: string; label: string }

export interface AgentResponse {
  text: string
  blocks: AgentBlock[]
  actions: AgentAction[]
  sources?: AgentSource[]
}

export interface ChatContext {
  subject?: AiSubject
  lessonId?: string
  grade?: number
  activeContent?: {
    sourceRef: string
    title: string
    problemId?: string
    wordKey?: string
  }
}

export type TeachingStage = 'understand' | 'attempt' | 'hint' | 'check' | 'transfer' | 'summary'

export type TeachingSessionStatus = 'active' | 'completed' | 'abandoned'

export interface TeachingSessionState {
  id: string
  conversationId?: string
  subject: AiSubject
  contentRef?: string
  teachingStage: TeachingStage
  hintLevel: 0 | 1 | 2 | 3
  attemptCount: number
  latestAnswer?: string
  errorKind?: string
  state: Record<string, unknown>
  status: TeachingSessionStatus
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface KnowledgeSearchHit {
  chunkId: string
  documentId: string
  subject: AiSubject
  content: string
  metadata: Record<string, unknown>
  similarity: number
}

export interface LinkManifestEntry {
  sourceRef: string
  href: string
  title: string
  subject?: AiSubject
  problemId?: string
  wordKey?: string
}
