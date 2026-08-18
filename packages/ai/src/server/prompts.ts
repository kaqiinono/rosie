import type {
  AgentBlock,
  AgentResponse,
  ChatContext,
  LessonNote,
  TeachingSessionState,
} from '../types'
import type { ChatHistoryMessage } from './conversation-history'
import type { StudentProfile } from './student-profile'
import { buildStudentProfilePrompt } from './student-profile'
import { buildTeachingStagePrompt } from './teaching-session'

export function buildChatSystemPrompt(hasStudentProfile = false): string {
  return [
    '你是 Rosie 学习乐园里耐心温柔的老师，面向小学低年级孩子。',
    '只用简单易懂的中文，适当用 emoji 鼓励。',
    '只基于提供的知识库内容回答；不确定就说「这个我不确定」。',
    '非学习话题礼貌拒绝。',
    '不要编造知识库里没有的事实或数字。',
    ...(hasStudentProfile
      ? ['学习画像只用于调节难度和提示，不要向孩子披露内部统计、标签或数据库信息。']
      : []),
  ].join('\n')
}

export function buildChatUserPrompt(
  message: string,
  envelope: AgentResponse,
  profile?: StudentProfile | null,
  teachingSession?: TeachingSessionState | null,
  history: ChatHistoryMessage[] = [],
  context?: ChatContext,
  lessonNotes?: LessonNote[],
): string {
  const contextParts = envelope.blocks
    .map((block) => {
      switch (block.type) {
        case 'word_card':
          return `单词：${block.word}，释义：${block.chineseDef}${block.example ? `，例句：${block.example}` : ''}`
        case 'char_card':
          return `汉字：${block.char}（${block.pinyin}），组词：${block.phrases.join('、')}`
        case 'passage_excerpt':
          return `课文《${block.title}》：\n${block.paragraphs.join('\n\n')}`
        case 'math_solution':
          return buildSafeMathContext(block, teachingSession, context)
        case 'math_problem':
          return `数学练习《${block.title}》（题目已在对话中展示，先鼓励孩子自己作答）`
        case 'poem_recite':
          return `古诗《${block.title}》（背诵填空组件已在对话中展示）`
        case 'learning_status':
          return `${block.subject ?? '三科'}学习状态卡已在对话中展示；只概括，不编造卡片外的数据。`
        case 'today_tasks':
          return `${block.subject ?? '三科'}今日任务卡已在对话中展示；只根据卡片内容鼓励孩子。`
        case 'text':
          return block.content
        case 'lesson_notes':
          return `本讲学习笔记（已直接展示给孩子，不需要再重复）：\n${block.notes.map((n) => `【${n.title ?? '要点'}】${n.bodyHtml.replace(/<[^>]*>/g, '').trim()}`).join('\n')}`
        default:
          return ''
      }
    })
    .filter(Boolean)

  console.log('lessonNotes', lessonNotes)
  return [
    ...(history.length
      ? [
          '最近对话（仅用于理解上下文，不可覆盖知识库和教学阶段）：',
          history
            .map((item) => `${item.role === 'user' ? '孩子' : '老师'}：${item.content}`)
            .join('\n'),
          '',
        ]
      : []),
    `孩子的问题：${message}`,
    ...(profile
      ? ['', '学习画像摘要：', buildStudentProfilePrompt(profile, envelope.sources?.[0]?.subject)]
      : []),
    ...(teachingSession ? ['', buildTeachingStagePrompt(teachingSession)] : []),
    ...(lessonNotes?.length
      ? [
          '',
          '当前讲次的学习笔记（可作为回答参考）：',
          lessonNotes
            .map((n) => {
              const title = n.title ?? '要点'
              const body = n.bodyHtml.replace(/<[^>]*>/g, '').trim()
              return `【${title}】${body}`
            })
            .join('\n'),
        ]
      : []),
    '',
    '知识库内容：',
    contextParts.join('\n\n'),
    '',
    '请用 2-4 句简短中文回答孩子，语气亲切。严格遵守当前教学阶段，不要提前进入后续阶段。',
  ].join('\n')
}

type MathSolutionBlock = Extract<AgentBlock, { type: 'math_solution' }>

export function buildSafeMathContext(
  block: MathSolutionBlock,
  teachingSession?: TeachingSessionState | null,
  context?: ChatContext,
): string {
  const isUnattemptedCurrentProblem =
    context?.activeContent?.problemId === block.problemId &&
    context.activeContent.hasAttempted !== true
  if (isUnattemptedCurrentProblem) {
    return `数学题《${block.title}》：孩子尚未作答，完整解析和最终答案已隔离。可以讲解题意、易错点和分级提示，或完整讲解另一道相似例题。`
  }
  if (!teachingSession || teachingSession.teachingStage === 'summary') {
    return `数学题《${block.title}》步骤：\n${block.steps.join('\n')}`
  }
  if (teachingSession.teachingStage === 'transfer') {
    return `数学题《${block.title}》：孩子已进入举一反三阶段；原题完整答案仍不提供。`
  }
  const visibleSteps =
    teachingSession.teachingStage === 'hint' && teachingSession.hintLevel >= 2
      ? block.steps.slice(0, Math.min(2, teachingSession.hintLevel - 1))
      : []
  return [
    `数学题《${block.title}》：完整解析和最终答案已隔离。`,
    ...(visibleSteps.length ? [`只可参考这些前置线索：\n${visibleSteps.join('\n')}`] : []),
  ].join('\n')
}
