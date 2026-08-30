import type { AiSubject, ChatContext } from '../types'

export type AgentIntent =
  | 'word_lookup'
  | 'char_lookup'
  | 'poem_recite'
  | 'learning_status'
  | 'today_tasks'
  | 'passage_lookup'
  | 'math_problem'
  | 'math_similar_example'
  | 'math_practice'
  | 'grammar_qa'
  | 'general_qa'

export interface ClassifiedIntent {
  intent: AgentIntent
  subject?: AiSubject
  entities: {
    word?: string
    char?: string
    passageTitle?: string
    problemHint?: string
  }
}

const ENGLISH_WORD_RE = /\b([a-zA-Z]{2,})\b/
const ENGLISH_WORD_HINTS = ['单词', '词卡', '英文卡片']
const PASSAGE_HINTS = ['课文', '讲什么', '主要内容', '阅读', '故事']
const MATH_HINTS = ['题', '怎么做', '解题', '应用题', '算', '数学']
const MATH_PRACTICE_HINTS = ['展示', '让我做', '我要做', '练习这道', '打开这道', '出示']
const MATH_SIMILAR_HINTS = ['相似题', '类似题', '相似例题', '类似例题', '同类题']
const CHAR_CARD_HINTS = ['生字卡', '汉字卡', '文字卡', '字卡', '展示这个字']
const POEM_RECITE_HINTS = ['背诵', '背古诗', '古诗填空', '考我古诗']
const STATUS_HINTS = ['掌握度', '掌握情况', '错题统计', '错题情况', '学习情况', '学习概况']
const TODAY_TASK_HINTS = ['今日任务', '今天学什么', '今天的计划', '今天要学', '今日计划']
// Keep this taxonomy aligned with the registered grammar TOC. Multi-word English
// phrases deliberately run before word lookup so questions such as
// "What is present perfect?" are not mistaken for a lookup of the word "What".
const GRAMMAR_HINTS_ZH = [
  '语法',
  '时态',
  '现在时',
  '进行时',
  '完成时',
  '将来时',
  '过去式',
  '一般现在',
  '一般过去',
  '过去进行',
  'be动词',
  '情态动词',
  '被动语态',
  '比较级',
  '最高级',
  '不定式',
  '过去时',
  '动词形式',
  '祈使句',
  '祈使语气',
  'there be',
  '助动词',
  '疑问句',
  '疑问词',
  '间接引语',
  '动名词',
  'ing形式',
  '-ing形式',
  '人称代词',
  '主格',
  '宾格',
  '物主代词',
  '所有格',
  '反身代词',
  '限定词',
  '冠词',
  '可数名词',
  '不可数名词',
  '名词复数',
  '形容词',
  '副词',
  '词序',
  '连词',
  '条件句',
  '定语从句',
  '关系从句',
  '从句',
  '介词',
  '短语动词',
  '主谓一致',
  '肯定句',
  '否定句',
]

const GRAMMAR_HINTS_EN = [
  'present tense',
  'present simple',
  'simple present',
  'present continuous',
  'present progressive',
  'present perfect',
  'past tense',
  'past simple',
  'simple past',
  'past continuous',
  'past progressive',
  'past perfect',
  'future tense',
  'future simple',
  'passive voice',
  'active voice',
  'verb form',
  'modal verb',
  'auxiliary verb',
  'helping verb',
  'imperative sentence',
  'question form',
  'question word',
  'reported speech',
  'indirect speech',
  'infinitive',
  'gerund',
  'personal pronoun',
  'subject pronoun',
  'object pronoun',
  'possessive adjective',
  'possessive pronoun',
  'reflexive pronoun',
  'determiner',
  'definite article',
  'indefinite article',
  'countable noun',
  'uncountable noun',
  'plural noun',
  'adjective',
  'adverb',
  'word order',
  'conjunction',
  'conditional sentence',
  'relative clause',
  'relative pronoun',
  'preposition',
  'phrasal verb',
  'comparative',
  'superlative',
  'subject-verb agreement',
]

const GRAMMAR_PATTERNS = [
  /\bthere\s+(?:is|are|was|were)\b/i,
  /\b(?:am|is|are)\s*\/\s*(?:is|are)\b/i,
  /\bdo\s*\/\s*does\b/i,
  /\bhave\s*\/\s*has\b/i,
  /\bwas\s*\/\s*were\b/i,
  /\ba\s*\/\s*an\b/i,
  /\bsome\s*\/\s*any\b/i,
  /\bmuch\s*\/\s*many\b/i,
  /\b(?:verb|动词)\s*[-–]?ing\b/i,
]

function hasGrammarHint(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    GRAMMAR_HINTS_ZH.some((hint) => lower.includes(hint.toLowerCase())) ||
    GRAMMAR_HINTS_EN.some((hint) => lower.includes(hint)) ||
    GRAMMAR_PATTERNS.some((pattern) => pattern.test(message))
  )
}

function isGrammarContext(context?: ChatContext): boolean {
  return (
    context?.activeContent?.sourceRef.startsWith('grammar_units:') === true ||
    context?.lessonId?.startsWith('/english/grammar/') === true
  )
}

function looksLikeMathWordProblem(message: string): boolean {
  const numbers = message.match(/\d+(?:\.\d+)?/g) ?? []
  return numbers.length >= 2 && /(?:多少|几(?:个|本|支|张|次|倍|分钟|小时)?)[？?]?/.test(message)
}

function subjectFromMessage(message: string, fallback?: AiSubject): AiSubject | undefined {
  if (
    message.includes('英语') ||
    message.includes('单词') ||
    hasGrammarHint(message)
  )
    return 'english'
  if (message.includes('数学') || message.includes('题目')) return 'math'
  if (message.includes('语文') || message.includes('生字')) return 'chinese'
  return fallback
}

function extractRequestedChar(message: string): string | undefined {
  return (
    message.match(/(?:生字|汉字|文字|字卡)[“”"']?([\u4e00-\u9fff])/)?.[1] ??
    message.match(/[“”"']([\u4e00-\u9fff])[“”"']/)?.[1]
  )
}

export function classifyIntent(message: string, context?: ChatContext): ClassifiedIntent {
  const trimmed = message.trim()
  const lower = trimmed.toLowerCase()

  if (isGrammarContext(context) || hasGrammarHint(trimmed)) {
    return {
      intent: 'grammar_qa',
      subject: 'english',
      entities: {},
    }
  }

  if (trimmed.includes('掌握')) {
    const wordMatch = trimmed.match(ENGLISH_WORD_RE)
    if (wordMatch?.[1]) {
      return {
        intent: 'word_lookup',
        subject: 'english',
        entities: { word: wordMatch[1].toLowerCase() },
      }
    }
    const charMatch = trimmed.match(/([\u4e00-\u9fff])字.{0,8}掌握/)
    if (charMatch?.[1]) {
      return {
        intent: 'char_lookup',
        subject: 'chinese',
        entities: { char: charMatch[1] },
      }
    }
  }

  if (TODAY_TASK_HINTS.some((hint) => trimmed.includes(hint))) {
    return {
      intent: 'today_tasks',
      subject: subjectFromMessage(trimmed, context?.subject),
      entities: {},
    }
  }

  if (STATUS_HINTS.some((hint) => trimmed.includes(hint))) {
    return {
      intent: 'learning_status',
      subject: subjectFromMessage(trimmed, context?.subject),
      entities: {},
    }
  }

  const requestedChar = extractRequestedChar(trimmed)
  if (requestedChar && CHAR_CARD_HINTS.some((hint) => trimmed.includes(hint))) {
    return {
      intent: 'char_lookup',
      subject: 'chinese',
      entities: { char: requestedChar },
    }
  }

  if (POEM_RECITE_HINTS.some((hint) => trimmed.includes(hint))) {
    return {
      intent: 'poem_recite',
      subject: 'chinese',
      entities: { passageTitle: trimmed },
    }
  }

  if (
    !PASSAGE_HINTS.some((hint) => trimmed.includes(hint)) &&
    (context?.subject === 'english' ||
      /\b(what|mean)\b/i.test(trimmed) ||
      trimmed.includes('什么意思') ||
      ENGLISH_WORD_HINTS.some((hint) => trimmed.includes(hint)))
  ) {
    const wordMatch = trimmed.match(ENGLISH_WORD_RE)
    if (wordMatch?.[1]) {
      return {
        intent: 'word_lookup',
        subject: 'english',
        entities: { word: wordMatch[1].toLowerCase() },
      }
    }
  }

  if (context?.subject === 'chinese' || PASSAGE_HINTS.some((h) => trimmed.includes(h))) {
    return {
      intent: 'passage_lookup',
      subject: context?.subject ?? (/英语|英文|English/i.test(trimmed) ? 'english' : 'chinese'),
      entities: { passageTitle: trimmed },
    }
  }

  if (
    context?.subject === 'math' ||
    MATH_HINTS.some((h) => trimmed.includes(h)) ||
    looksLikeMathWordProblem(trimmed)
  ) {
    return {
      intent:
        MATH_SIMILAR_HINTS.some((hint) => trimmed.includes(hint))
          ? 'math_similar_example'
          : trimmed.includes('题') && MATH_PRACTICE_HINTS.some((hint) => trimmed.includes(hint))
          ? 'math_practice'
          : 'math_problem',
      subject: 'math',
      entities: { problemHint: trimmed },
    }
  }

  if (ENGLISH_WORD_RE.test(trimmed) && (lower.includes('mean') || trimmed.includes('意思'))) {
    const wordMatch = trimmed.match(ENGLISH_WORD_RE)
    if (wordMatch?.[1]) {
      return {
        intent: 'word_lookup',
        subject: 'english',
        entities: { word: wordMatch[1].toLowerCase() },
      }
    }
  }

  return {
    intent: 'general_qa',
    subject: context?.subject ?? subjectFromMessage(trimmed),
    entities: {},
  }
}
