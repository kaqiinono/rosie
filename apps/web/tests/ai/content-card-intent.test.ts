import { describe, expect, it } from 'vitest'
import { classifyIntent } from '@rosie/ai'

describe('AI embedded content-card intent', () => {
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
