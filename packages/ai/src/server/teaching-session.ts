import type { TeachingSessionState } from '../types'

const HINT_PATTERN = /(?:提示|不会|不懂|帮帮|怎么做)/
const UNDERSTOOD_PATTERN = /(?:我懂了|明白了|会了|知道了)/
const ATTEMPT_PATTERN = /(?:我觉得|我认为|答案|先算|等于|应该是|我的方法)/

export function isExplicitTeachingBehavior(message: string): boolean {
  return (
    HINT_PATTERN.test(message) || UNDERSTOOD_PATTERN.test(message) || ATTEMPT_PATTERN.test(message)
  )
}

type TeachingTurnState = Pick<
  TeachingSessionState,
  'teachingStage' | 'hintLevel' | 'attemptCount' | 'status'
>

export function classifyTeachingTurn(
  message: string,
  current?: TeachingSessionState,
): TeachingTurnState {
  const base: TeachingTurnState = current
    ? {
        teachingStage: current.teachingStage,
        hintLevel: current.hintLevel,
        attemptCount: current.attemptCount,
        status: current.status,
      }
    : { teachingStage: 'understand', hintLevel: 0, attemptCount: 0, status: 'active' }

  if (UNDERSTOOD_PATTERN.test(message)) return { ...base, teachingStage: 'transfer' }
  if (current && ATTEMPT_PATTERN.test(message)) {
    return { ...base, teachingStage: 'attempt', attemptCount: base.attemptCount + 1 }
  }
  if (current && HINT_PATTERN.test(message)) {
    return {
      ...base,
      teachingStage: 'hint',
      hintLevel: Math.min(3, base.hintLevel + 1) as 0 | 1 | 2 | 3,
    }
  }
  return base
}

export function buildTeachingStagePrompt(session: TeachingSessionState): string {
  const sharedHint = `当前第${session.hintLevel}级提示（最多3级）：1级只提醒方向，2级拆解一步，3级给关键步骤但保留孩子作答。`
  const strategies = {
    english: {
      understand: '确认孩子理解单词、句子或短文在问什么；优先用图片感、动作或熟悉语境解释。',
      attempt: '让孩子先读音、拼读、说中文意思或补全一个短句，不直接公布答案。',
      hint: `按“首音/音节 → 词义类别 → 语境例句”逐级提示。${sharedHint}`,
      check: '分别检查发音、拼写和语境是否正确；先肯定一个正确点，再只纠正一个关键点。',
      transfer: '换一个简短句子，让孩子再次辨认、拼写或使用同一个词。',
      summary: '用“读音 + 词义 + 一个短搭配”总结，不扩展超出知识库的词义。',
    },
    math: {
      understand: '先让孩子说出已知条件、所求问题和它们的数量关系，不直接列出完整算式。',
      attempt: '让孩子先画、圈、分步说思路或只写第一步算式，不直接公布最终答案。',
      hint: `按“找条件 → 找关系 → 确定运算 → 检查单位”逐级提示。${sharedHint}`,
      check: '检查数量关系、运算、计算和单位；指出一个具体错误并让孩子自己改。',
      transfer: '保持题型关系不变，只替换较小数字或生活情境，给一道短迁移题。',
      summary: '用“先判断关系，再列式，最后验算和写单位”概括方法。',
    },
    chinese: {
      understand: '先确认是字音、字形、词义、句段理解还是背诵任务，再聚焦一个目标。',
      attempt: '让孩子先认读、组词、说句意、朗读或补一句，不直接给出整段答案。',
      hint: `按“偏旁/关键字词 → 句子线索 → 上下文或背诵提示”逐级提示。${sharedHint}`,
      check: '分别检查音、形、义或原文顺序；保留原文规范，不编造课文内容。',
      transfer: '换一个词语、句子或相邻背诵位置，让孩子独立再做一次。',
      summary: '用一个字词要点或一句段意总结，并提醒最容易读错、写错或漏背之处。',
    },
  } satisfies Record<
    TeachingSessionState['subject'],
    Record<TeachingSessionState['teachingStage'], string>
  >
  return `当前教学阶段：${session.teachingStage}。${strategies[session.subject][session.teachingStage]}`
}

export function shouldHideFullSolution(session: TeachingSessionState): boolean {
  return !['transfer', 'summary'].includes(session.teachingStage)
}
