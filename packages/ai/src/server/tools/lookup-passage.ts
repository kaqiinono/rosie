import type { SupabaseClient } from '@supabase/supabase-js'
import type { KnowledgeSearchHit, AgentBlock } from '../../types'

export function buildPassageBlockFromHit(hit: KnowledgeSearchHit): AgentBlock | null {
  const sourceRef =
    typeof hit.metadata.sourceRef === 'string'
      ? hit.metadata.sourceRef
      : `document:${hit.documentId}`

  const title = typeof hit.metadata.title === 'string' ? hit.metadata.title : '课文节选'

  const bookSlug = typeof hit.metadata.bookSlug === 'string' ? hit.metadata.bookSlug : undefined
  const lessonKey = typeof hit.metadata.lessonKey === 'string' ? hit.metadata.lessonKey : undefined
  const passageKey =
    typeof hit.metadata.passageKey === 'string' ? hit.metadata.passageKey : undefined
  const stage = typeof hit.metadata.stage === 'string' ? hit.metadata.stage : undefined
  const unit = typeof hit.metadata.unit === 'string' ? hit.metadata.unit : undefined
  const lesson = typeof hit.metadata.lesson === 'string' ? hit.metadata.lesson : undefined

  const paragraphs = hit.content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (paragraphs.length === 0) return null

  return {
    type: 'passage_excerpt',
    sourceRef,
    title,
    subject: hit.subject,
    bookSlug,
    lessonKey,
    passageKey,
    stage,
    unit,
    lesson,
    paragraphs: paragraphs.slice(0, 3),
  }
}

export function buildPoemReciteBlockFromHit(hit: KnowledgeSearchHit): AgentBlock | null {
  const sourceRef =
    typeof hit.metadata.sourceRef === 'string'
      ? hit.metadata.sourceRef
      : `document:${hit.documentId}`
  const bookSlug = typeof hit.metadata.bookSlug === 'string' ? hit.metadata.bookSlug : undefined
  const poemId = typeof hit.metadata.poemId === 'string' ? hit.metadata.poemId : undefined
  if (!bookSlug || !poemId) return null
  return {
    type: 'poem_recite',
    sourceRef,
    bookSlug,
    poemId,
    title: typeof hit.metadata.title === 'string' ? hit.metadata.title : '古诗背诵',
  }
}

async function resolveAnalysisImageUrl(
  supabase: SupabaseClient,
  hit: KnowledgeSearchHit,
  problemId: string,
): Promise<string | undefined> {
  const staticUrl =
    typeof hit.metadata.analysisImg === 'string' ? hit.metadata.analysisImg : undefined
  const { data, error } = await supabase
    .from('math_problem_images')
    .select('storage_path')
    .eq('problem_id', problemId)
    .eq('image_kind', 'analysis')
    .maybeSingle()
  if (error || !data?.storage_path) return staticUrl
  return supabase.storage.from('math').getPublicUrl(data.storage_path).data.publicUrl || staticUrl
}

export async function buildMathSolutionFromHit(
  supabase: SupabaseClient,
  hit: KnowledgeSearchHit,
): Promise<AgentBlock | null> {
  const sourceRef =
    typeof hit.metadata.sourceRef === 'string'
      ? hit.metadata.sourceRef
      : `document:${hit.documentId}`

  const problemId = typeof hit.metadata.problemId === 'string' ? hit.metadata.problemId : sourceRef

  const title = typeof hit.metadata.title === 'string' ? hit.metadata.title : '数学题解'

  const metadataAnalysis = Array.isArray(hit.metadata.analysis)
    ? hit.metadata.analysis.filter((item): item is string => typeof item === 'string')
    : []
  const steps =
    metadataAnalysis.length > 0
      ? metadataAnalysis
      : hit.content
          .split(/\n+/)
          .map((line) => line.trim().match(/^(?:步骤\d+|解析)[:：]\s*(.+)$/)?.[1])
          .filter((line): line is string => Boolean(line))
          .slice(0, 8)

  const fallbackSteps =
    steps.length > 0
      ? steps
      : hit.content
          .split(/\n+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 6)

  if (fallbackSteps.length === 0) return null
  const analysisImageUrl = await resolveAnalysisImageUrl(supabase, hit, problemId)
  const finalAnswer =
    typeof hit.metadata.finalAnswer === 'string' ? hit.metadata.finalAnswer : undefined

  return {
    type: 'math_solution',
    sourceRef,
    problemId,
    title,
    steps: fallbackSteps,
    finalAnswer,
    analysisImageUrl,
    fromCatalog: true,
  }
}

export function buildMathProblemBlockFromHit(hit: KnowledgeSearchHit): AgentBlock | null {
  const sourceRef =
    typeof hit.metadata.sourceRef === 'string'
      ? hit.metadata.sourceRef
      : `document:${hit.documentId}`
  const problemId = typeof hit.metadata.problemId === 'string' ? hit.metadata.problemId : undefined
  if (!problemId) return null
  return {
    type: 'math_problem',
    sourceRef,
    problemId,
    title: typeof hit.metadata.title === 'string' ? hit.metadata.title : '数学练习',
  }
}
