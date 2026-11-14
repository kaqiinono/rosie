import type { GrammarExerciseGroup, GrammarLesson } from '@rosie/english/grammar/types'
import type { ReadingPassage } from '@rosie/english/utils/reading-data'
import type { WordEntry, CalcQuestion } from '@rosie/core'

export const WORD: WordEntry = { unit: 'Demo', lesson: 'Garden', word: 'garden', ipa: '/ˈɡɑːdən/', explanation: 'a place where flowers and plants grow', chineseDef: '花园', example: 'We play in the garden.', phonics: 'gar-den', partOfSpeech: ['n.'] }
export const PASSAGE: ReadingPassage = { key: 'homework-demo-garden', stage: 'Demo', unit: 'Garden', lesson: '1', title: 'A Little Garden', paragraphs: ['Rosie has a little garden. She waters the flowers every morning.', 'One day, she finds a small bird under a tree. She watches quietly. The bird sings a lovely song.'] }
export const POEM = { id: 'jing-ye-si', title: '静夜思', dynasty: '唐', author: '李白', source: 'lesson' as const, unit: 4, lesson: 7, lines: ['床前明月光，', '疑是地上霜。', '举头望明月，', '低头思故乡。'], requiresRecite: true }
export const GRAMMAR: GrammarLesson = { crossReferences: [], sections: [{ label: 'A', title: 'am / is / are', blocks: [
  { type: 'example_set', context: '介绍自己和朋友', items: [{ en: 'I am Rosie.', zh: '我是 Rosie。', bold: ['am'] }, { en: 'She is my friend.', zh: '她是我的朋友。', bold: ['is'] }] },
  { type: 'grammar_table', title: '选择正确的 be 动词', headers: ['主语', 'be 动词', '例句'], rows: [['I', 'am', 'I am happy.'], ['He / She / It', 'is', 'She is happy.'], ['You / We / They', 'are', 'They are happy.']] },
] }] }
export const GRAMMAR_EXERCISES: GrammarExerciseGroup[] = [
  { section: '1', instruction: '填空', items: [{ number: 1, type: 'fill_blank', prompt: 'I ______ happy.', answer: 'am' }] },
  { section: '2', instruction: '完成句子', items: [{ number: 2, type: 'sentence_completion', prompt: 'She ______ my friend.', answer: 'is' }] },
  { section: '3', instruction: '简短回答', items: [{ number: 3, type: 'short_answer', prompt: 'Are you happy? (Yes)', answer: 'Yes, I am.' }] },
  { section: '4', instruction: '改写句子', items: [{ number: 4, type: 'transformation', prompt: 'She is happy. → 使用缩写', answer: "She’s happy.\nShe's happy." }] },
  { section: '5', instruction: '选择', items: [{ number: 5, type: 'multiple_choice', prompt: 'They ______ students.', options: ['am', 'is', 'are'], answer: 'are' }] },
  { section: '6', instruction: '配对', items: [{ number: 6, type: 'matching', prompt: 'I', answer: 'am' }, { number: 7, type: 'matching', prompt: 'She', answer: 'is' }, { number: 8, type: 'matching', prompt: 'They', answer: 'are' }] },
]
const base = { signature: 'homework-demo', arity: 2 as const, level: 1, isChallenge: false, category: 'addsub' as const, coinBase: 0 }
export const CALC: Record<string, CalcQuestion> = {
  'calc-int': { ...base, signature: 'add(8,7)', display: '8 + 7 = ?', answer: { kind: 'int', value: 15 } },
  'calc-decimal': { ...base, signature: 'add(1.2,0.3)', display: '1.2 + 0.3 = ?', answer: { kind: 'decimal', value: 1.5, places: 1 } },
  'calc-fraction': { ...base, signature: 'frac:add(1/4,1/4)', display: '1/4 + 1/4 = ?', answer: { kind: 'fraction', num: 1, den: 2 } },
  'calc-remainder': { ...base, category: 'muldiv', signature: 'div(17,5)', display: '17 ÷ 5 = ?', answer: { kind: 'remainder', quotient: 3, remainder: 2 } },
  'calc-vertical': { ...base, signature: 'add(28,17)', display: '28 + 17 = ?', answerMode: 'vertical', answer: { kind: 'int', value: 45 } },
}
