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

export interface OrchestratorInput {
  message: string
  context?: ChatContext
}

export async function runAgentOrchestrator(
  supabase: SupabaseClient,
  input: OrchestratorInput,
): Promise<AgentResponse> {
  const classified = classifyIntent(input.message, input.context)
  const blocks: AgentResponse['blocks'] = []
  let hits: KnowledgeSearchHit[] = []

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

  try {
    hits = await searchKnowledge(supabase, {
      query: input.message,
      subject: classified.subject,
      grade: input.context?.grade,
      matchCount: 6,
      metadata: input.context?.activeContent?.sourceRef
        ? { sourceRef: input.context.activeContent.sourceRef }
        : undefined,
    })
  } catch {
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

  if (classified.intent === 'math_problem') {
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
  const mathBlock = blocks.find((b) => b.type === 'math_solution')
  if (mathBlock?.type === 'math_solution') {
    const problemAction = resolveProblemAction(mathBlock.problemId)
    if (problemAction && !actions.some((a) => a.type === 'open_problem' || a.type === 'navigate')) {
      actions.unshift(problemAction)
    }
  }
  const practiceBlock = blocks.find((b) => b.type === 'math_problem')
  if (practiceBlock?.type === 'math_problem') {
    const problemAction = resolveProblemAction(practiceBlock.problemId)
    if (problemAction && !actions.some((action) => action.type === 'open_problem')) {
      actions.unshift(problemAction)
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
      hits.length > 0
        ? summaryText
        : '我在知识库里还没有找到相关内容。你可以换个问法，或者让爸爸妈妈帮忙导入资料哦。',
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
    return `《${passage.title}》主要内容在这里啦，你可以点下面按钮读全文。`
  }

  const char = blocks.find((b) => b.type === 'char_card')
  if (char?.type === 'char_card') {
    return `这是“${char.char}”的生字卡，点击卡片可以翻面查看拼音、组词和字形信息。`
  }

  const math = blocks.find((b) => b.type === 'math_solution')
  if (math?.type === 'math_solution') {
    return `这道题可以这样思考，下面是解题步骤。想自己试的话，点「去看这道题」。`
  }

  const practice = blocks.find((b) => b.type === 'math_problem')
  if (practice?.type === 'math_problem') {
    return `我把《${practice.title}》放到对话里了，直接作答就可以。提交后再查看完整题解。`
  }

  const poem = blocks.find((b) => b.type === 'poem_recite')
  if (poem?.type === 'poem_recite') {
    return `《${poem.title}》背诵练习已经准备好了，直接填写空缺的字再提交。`
  }

  const status = blocks.find((b) => b.type === 'learning_status')
  if (status?.type === 'learning_status') {
    return status.subject
      ? `这是你当前的${status.subject === 'english' ? '英语' : status.subject === 'math' ? '数学' : '语文'}学习情况。`
      : '这是你当前三科的学习概况。'
  }

  const todayTasks = blocks.find((b) => b.type === 'today_tasks')
  if (todayTasks?.type === 'today_tasks') {
    return todayTasks.subject
      ? '这是你今天这门学科的任务和当前进度。'
      : '这是你今天三科的任务和当前进度。'
  }

  if (hits[0]) {
    return `我找到了一些相关内容，帮你整理在下面啦。`
  }

  return `关于「${message.slice(0, 40)}」，让我想想…`
}
