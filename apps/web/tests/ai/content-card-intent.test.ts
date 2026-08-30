import { describe, expect, it } from 'vitest'
import {
  classifyIntent,
  findDefaultEnglishPassageSourceRef,
  resolveContextualIntentMessage,
  selectEnglishPassageEntry,
} from '@rosie/ai'

describe('AI embedded content-card intent', () => {
  const grammarQuestions = [
    '现在时应该怎么用？',
    '过去时和过去式有什么区别？',
    '什么是现在完成时？',
    '被动语态怎么造句？',
    '动词形式为什么会变化？',
    '将来时怎么表达？',
    '祈使句是什么？',
    'there be 句型怎么用？',
    '助动词有什么作用？',
    '一般疑问句怎么回答？',
    '间接引语是什么？',
    '动名词和不定式有什么区别？',
    '人称代词的主格和宾格怎么区分？',
    '限定词和物主代词有什么区别？',
    '形容词和副词放在哪里？',
    '英语词序有什么规律？',
    '连词怎样连接从句？',
    '介词 in、on、at 怎么区分？',
    '什么是短语动词？',
    'What is present perfect?',
    'How does the passive voice work?',
    'When should I use a gerund?',
    'What is a possessive pronoun?',
    'Where does an adverb go?',
    'Explain subject-verb agreement.',
    'Should I use a/an here?',
  ]

  it.each(grammarQuestions)('recognizes grammar coverage: %s', (message) => {
    expect(classifyIntent(message)).toMatchObject({
      intent: 'grammar_qa',
      subject: 'english',
    })
  })

  it('recognizes a plain present-tense question as English grammar', () => {
    expect(classifyIntent('现在时应该怎么用？')).toMatchObject({
      intent: 'grammar_qa',
      subject: 'english',
    })
  })

  it('keeps questions on a grammar unit in grammar search', () => {
    expect(
      classifyIntent('这里为什么要用 is？', {
        subject: 'english',
        lessonId: '/english/grammar/essential/1',
        activeContent: {
          sourceRef: 'grammar_units:essential:1',
          title: 'Unit 1 · am/is/are',
        },
      }),
    ).toMatchObject({
      intent: 'grammar_qa',
      subject: 'english',
    })
  })

  it('recognizes an English word-card request', () => {
    expect(classifyIntent('帮我展示 apple 的单词卡')).toMatchObject({
      intent: 'word_lookup',
      subject: 'english',
      entities: { word: 'apple' },
    })
  })

  it('recognizes a Chinese character-card request without treating it as a passage', () => {
    expect(classifyIntent('展示汉字水的字卡')).toMatchObject({
      intent: 'char_lookup',
      subject: 'chinese',
      entities: { char: '水' },
    })
  })

  it('recognizes a math problem request as an in-chat practice session', () => {
    expect(classifyIntent('展示这道数学题让我做')).toMatchObject({
      intent: 'math_practice',
      subject: 'math',
    })
  })

  it('recognizes a request for a worked similar example', () => {
    expect(
      classifyIntent('给我一道相似例题，讲解完整过程', { subject: 'math' }),
    ).toMatchObject({
      intent: 'math_similar_example',
      subject: 'math',
    })
  })

  it('never treats the first character in a math word problem as a character card', () => {
    expect(classifyIntent('打字员30分钟能打1800个字，那么1小时能打多少个字？')).toMatchObject({
      intent: 'math_problem',
      subject: 'math',
    })
  })

  it('recognizes a poem recitation request', () => {
    expect(classifyIntent('考我背诵《静夜思》')).toMatchObject({
      intent: 'poem_recite',
      subject: 'chinese',
    })
  })

  it('keeps an English passage request out of word lookup', () => {
    expect(classifyIntent('读一下英语课文 Letters to HelpMe Hal')).toMatchObject({
      intent: 'passage_lookup',
      subject: 'english',
    })
  })

  it('carries a short choice reply into the previous passage request', () => {
    const resolved = resolveContextualIntentMessage('随便', [
      { role: 'user', content: '我想阅读一篇英文课文' },
      { role: 'assistant', content: '想读哪篇课文？' },
    ])

    expect(classifyIntent(resolved)).toMatchObject({
      intent: 'passage_lookup',
      subject: 'english',
    })
  })

  it('carries repeated next-passage requests back to the original reading intent', () => {
    const history = [
      { role: 'user' as const, content: '我想阅读一篇英文课文' },
      { role: 'assistant' as const, content: '《Letters to HelpMe Hal》内容在这里。' },
      { role: 'user' as const, content: '换一篇' },
      { role: 'assistant' as const, content: '《A School on a Nature Reserve》内容在这里。' },
    ]

    expect(classifyIntent(resolveContextualIntentMessage('再来一篇', history))).toMatchObject({
      intent: 'passage_lookup',
      subject: 'english',
    })
    expect(selectEnglishPassageEntry('再来一篇', history)?.title).not.toBe(
      'A School on a Nature Reserve',
    )
  })

  it('has a stable catalog passage for generic English reading requests', () => {
    expect(findDefaultEnglishPassageSourceRef()).toMatch(/^english:reading:/)
  })

  it('recognizes subject-specific and three-subject status requests', () => {
    expect(classifyIntent('看看我的英语掌握度')).toMatchObject({
      intent: 'learning_status',
      subject: 'english',
    })
    expect(classifyIntent('查看我的错题统计')).toMatchObject({
      intent: 'learning_status',
      subject: undefined,
    })
  })

  it('recognizes today-task requests and item-level mastery requests', () => {
    expect(classifyIntent('今天学什么')).toMatchObject({
      intent: 'today_tasks',
      subject: undefined,
    })
    expect(classifyIntent('apple 掌握得怎么样')).toMatchObject({
      intent: 'word_lookup',
      subject: 'english',
      entities: { word: 'apple' },
    })
    expect(classifyIntent('水字掌握得怎么样')).toMatchObject({
      intent: 'char_lookup',
      subject: 'chinese',
      entities: { char: '水' },
    })
  })
})
