import type { SupabaseClient } from '@supabase/supabase-js'
import { classifyIntent } from './classify-intent'
import { fallbackAgentResponse, parseAgentResponse } from './agent-response.schema'
import type { AgentResponse, ChatContext, KnowledgeSearchHit } from '../types'
import { searchKnowledge } from '../server/search'
import { lookupWord } from '../server/tools/lookup-word'
import { lookupChar } from '../server/tools/lookup-char'
import {
  buildMathProblemBlockFromHit,
  buildMathSolutionFromHit,
  buildPassageBlockFromHit,
  buildPoemReciteBlockFromHit,
} from '../server/tools/lookup-passage'
import { resolveActionsForHits, resolveProblemAction } from '../server/tools/resolve-links'
import type { LessonNote, SimilarProblem } from '../types'

export interface OrchestratorInput {
  message: string
  context?: ChatContext
  lessonNotes?: LessonNote[]
  similarProblem?: SimilarProblem
}

export async function runAgentOrchestrator(
  supabase: SupabaseClient,
  input: OrchestratorInput,
): Promise<AgentResponse> {
  const classified = classifyIntent(input.message, input.context)
  const blocks: AgentResponse['blocks'] = []
  let hits: KnowledgeSearchHit[] = []
  let searchUnavailable = false

  if (classified.intent === 'learning_status') {
    const view = input.message.includes('错题')
      ? 'mistakes'
      : input.message.includes('掌握')
        ? 'mastery'
        : 'overview'
    blocks.push({ type: 'learning_status', subject: classified.subject, view })
  }

  if (classified.intent === 'today_tasks') {
    blocks.push({ type: 'today_tasks', subject: classified.subject })
  }

  // ── Lesson review: return notes directly when user asks to review ──
  const isReviewIntent =
    input.context?.subject === 'math' &&
    input.lessonNotes?.length &&
    (input.message.includes('复习') ||
      input.message.includes('重点') ||
      input.message.includes('讲次') ||
      input.message.includes('笔记') ||
      input.message.includes('易错点'))
  if (isReviewIntent) {
    blocks.push({
      type: 'lesson_notes',
      notes: input.lessonNotes!.map((n) => ({
        title: n.title,
        bodyHtml: n.bodyHtml,
      })),
    })
  }

  // ── Similar problem: return a same-lesson problem with solution ──
  const isSimilarIntent =
    input.context?.subject === 'math' &&
    input.similarProblem &&
    (input.message.includes('相似') ||
      input.message.includes('类似') ||
      input.message.includes('例题') ||
      input.message.includes('讲解完整过程'))
  if (isSimilarIntent && input.similarProblem) {
    const sp = input.similarProblem
    blocks.push({
      type: 'math_solution',
      sourceRef: sp.href,
      problemId: sp.problemId,
      title: `相似例题《${sp.title}》`,
      steps: [sp.text, ...sp.analysis],
      fromCatalog: false,
    })
  }

  try {
    if (classified.intent === 'math_similar_example' && input.context?.activeContent?.sourceRef) {
      const currentHits = await searchKnowledge(supabase, {
        query: input.message,
        subject: 'math',
        matchCount: 2,
        metadata: { sourceRef: input.context.activeContent.sourceRef },
      })
      const comparisonQuery = currentHits[0]?.content ?? input.context.activeContent.title
      const similarHits = await searchKnowledge(supabase, {
        query: comparisonQuery,
        subject: 'math',
        grade: input.context?.grade,
        matchCount: 8,
      })
      hits = similarHits.filter(
        (hit) => hit.metadata.sourceRef !== input.context?.activeContent?.sourceRef,
      )
    } else {
      const activeSourceRef = input.context?.activeContent?.sourceRef
      hits = await searchKnowledge(supabase, {
        query: input.message,
        subject: classified.subject,
        grade: input.context?.grade,
        matchCount: 6,
        metadata: activeSourceRef
          ? { sourceRef: activeSourceRef }
          : classified.intent === 'grammar_qa'
            ? { knowledgeType: 'grammar' }
            : undefined,
      })
    }
  } catch (error) {
    searchUnavailable = true
    console.error('[ai/search] knowledge retrieval failed', error)
    hits = []
  }

  if (classified.intent === 'word_lookup' && classified.entities.word) {
    const { block } = await lookupWord(supabase, classified.entities.word)
    if (block) {
      blocks.push(block)
    }
  }

  if (classified.intent === 'char_lookup' && classified.entities.char) {
    const { block } = await lookupChar(supabase, classified.entities.char)
    if (block) blocks.push(block)
  }

  if (classified.intent === 'passage_lookup') {
    const passageHit = hits.find((h) => h.subject === 'chinese') ?? hits[0]
    if (passageHit) {
      const block = buildPassageBlockFromHit(passageHit)
      if (block) {
        blocks.push(block)
      }
    }
  }

  if (classified.intent === 'poem_recite') {
    const poemHit =
      hits.find(
        (hit) =>
          hit.subject === 'chinese' &&
          (typeof hit.metadata.poemId === 'string' ||
            (typeof hit.metadata.sourceRef === 'string' &&
              hit.metadata.sourceRef.includes(':poem:'))),
      ) ?? hits[0]
    if (poemHit) {
      const block = buildPoemReciteBlockFromHit(poemHit)
      if (block) blocks.push(block)
    }
  }

  if (classified.intent === 'math_practice') {
    const mathHit = hits.find((h) => h.subject === 'math') ?? hits[0]
    if (mathHit) {
      const block = buildMathProblemBlockFromHit(mathHit)
      if (block) blocks.push(block)
    }
  }

  if (classified.intent === 'math_problem' || classified.intent === 'math_similar_example') {
    const mathHit = hits.find((h) => h.subject === 'math') ?? hits[0]
    if (mathHit) {
      const block = await buildMathSolutionFromHit(supabase, mathHit)
      if (block) {
        blocks.push(block)
      }
    }
  }

  if (blocks.length === 0 && hits.length > 0) {
    const top = hits[0]
    if (top.subject === 'chinese') {
      const block = buildPassageBlockFromHit(top)
      if (block) {
        blocks.push(block)
      }
    } else if (top.subject === 'math') {
      const block = await buildMathSolutionFromHit(supabase, top)
      if (block) {
        blocks.push(block)
      }
    } else {
      blocks.push({ type: 'text', content: top.content.slice(0, 500) })
    }
  }

  const actions = resolveActionsForHits(hits)

  // For blocks with problemId, replace navigate actions with open_problem (supports inline rendering)
  const mathBlock = blocks.find((b) => b.type === 'math_solution')
  if (mathBlock?.type === 'math_solution') {
    // Remove any navigate action pointing to the same problem
    for (let i = actions.length - 1; i >= 0; i--) {
      if (actions[i].type === 'navigate') {
        actions.splice(i, 1)
      }
    }
    if (!actions.some((a) => a.type === 'open_problem')) {
      actions.unshift(resolveProblemAction(mathBlock.problemId, mathBlock.title))
    }
  }
  const practiceBlock = blocks.find((b) => b.type === 'math_problem')
  if (practiceBlock?.type === 'math_problem') {
    if (!actions.some((a) => a.type === 'open_problem')) {
      actions.unshift(resolveProblemAction(practiceBlock.problemId, practiceBlock.title))
    }
  }

  const sources = hits.slice(0, 4).map((hit) => ({
    sourceRef:
      typeof hit.metadata.sourceRef === 'string' ? hit.metadata.sourceRef : `chunk:${hit.chunkId}`,
    title: typeof hit.metadata.title === 'string' ? hit.metadata.title : hit.subject,
    snippet: hit.content.slice(0, 160),
    subject: hit.subject,
  }))

  const summaryText = buildSummaryText(input.message, blocks, hits)

  if (blocks.length === 0) {
    return fallbackAgentResponse(
      searchUnavailable
        ? '知识检索暂时不可用，请让爸爸妈妈检查 AI 配置。'
        : hits.length > 0
        ? summaryText
        : '我在知识库里还没找到相关内容。换个问法试试，或让爸爸妈妈帮忙导入资料。',
    )
  }

  const textBlock = blocks.find((b) => b.type === 'text')
  if (!textBlock) {
    blocks.unshift({ type: 'text', content: summaryText })
  }

  const response: AgentResponse = {
    text: summaryText,
    blocks,
    actions,
    sources,
  }

  return parseAgentResponse(response)
}

function buildSummaryText(
  message: string,
  blocks: AgentResponse['blocks'],
  hits: KnowledgeSearchHit[],
): string {
  const word = blocks.find((b) => b.type === 'word_card')
  if (word?.type === 'word_card') {
    return `${word.word} 的意思是：${word.chineseDef}`
  }

  const passage = blocks.find((b) => b.type === 'passage_excerpt')
  if (passage?.type === 'passage_excerpt') {
    return `《${passage.title}》内容在这里，点下方按钮读全文。`
  }

  const char = blocks.find((b) => b.type === 'char_card')
  if (char?.type === 'char_card') {
    return `“${char.char}”的生字卡，点击翻面看拼音和组词。`
  }

  const math = blocks.find((b) => b.type === 'math_solution')
  if (math?.type === 'math_solution') {
    const isSimilar = math.title.startsWith('相似例题')
    return isSimilar
      ? `相似例题，下面是解题过程。`
      : `这道题这样做，点「去看这道题」自己试试。`
  }

  const practice = blocks.find((b) => b.type === 'math_problem')
  if (practice?.type === 'math_problem') {
    return `《${practice.title}》已放入对话，直接作答。`
  }

  const poem = blocks.find((b) => b.type === 'poem_recite')
  if (poem?.type === 'poem_recite') {
    return `《${poem.title}》准备好了，填写空缺的字再提交。`
  }

  const status = blocks.find((b) => b.type === 'learning_status')
  if (status?.type === 'learning_status') {
    return status.subject
      ? `这是你的${status.subject === 'english' ? '英语' : status.subject === 'math' ? '数学' : '语文'}学习情况。`
      : '这是你三科的学习概况。'
  }

  const todayTasks = blocks.find((b) => b.type === 'today_tasks')
  if (todayTasks?.type === 'today_tasks') {
    return todayTasks.subject
      ? '这是你今天这门课的任务和进度。'
      : '这是你今天三科的任务和进度。'
  }

  const notes = blocks.find((b) => b.type === 'lesson_notes')
  if (notes?.type === 'lesson_notes') {
    return `本讲${notes.notes.length}条笔记，复习吧！`
  }

  if (hits[0]) {
    return `找到相关内容，整理在下面。`
  }

  return `关于「${message.slice(0, 40)}」，让我想想…`
}
