import { magicTreeHouse } from './story-magic-tree-house'
import type { GlossaryWord } from './reading-data'
import type { StorySeries } from './story-types'

const STORY_GLOSSARY: GlossaryWord[] = [
  {
    word: 'Frog Creek',
    meaningCn: '青蛙溪（故事中的小镇）',
    category: '专有名词',
    isProperNoun: true,
  },
  {
    word: 'Pennsylvania',
    ipa: '/ˌpensɪlˈveɪniə/',
    meaningCn: '宾夕法尼亚州（美国州名）',
    category: '专有名词',
    isProperNoun: true,
  },
  {
    word: 'Pteranodon',
    ipa: '/təˈrænədɒn/',
    meaningCn: '无齿翼龙',
    meaningEn: 'a large flying reptile from prehistoric times',
    category: '恐龙与史前生物',
    isProperNoun: true,
  },
  {
    word: 'Cretaceous',
    ipa: '/krɪˈteɪʃəs/',
    meaningCn: '白垩纪的',
    meaningEn: 'relating to the prehistoric period when many dinosaurs lived',
    category: '恐龙与史前生物',
    isProperNoun: true,
  },
  {
    word: 'Anatosaurus',
    meaningCn: '鸭嘴龙属的一种恐龙',
    category: '恐龙与史前生物',
    isProperNoun: true,
  },
  {
    word: 'Triceratops',
    ipa: '/traɪˈserətɒps/',
    meaningCn: '三角龙',
    category: '恐龙与史前生物',
    isProperNoun: true,
  },
  {
    word: 'Tyrannosaurus rex',
    ipa: '/tɪˌrænəˈsɔːrəs reks/',
    meaningCn: '霸王龙',
    category: '恐龙与史前生物',
    isProperNoun: true,
  },
  { word: 'ladder', ipa: '/ˈlædə(r)/', meaningCn: 'n. 梯子', category: '超纲词汇' },
  { word: 'porch', ipa: '/pɔːtʃ/', meaningCn: 'n. 门廊', category: '超纲词汇' },
  { word: 'bookmark', ipa: '/ˈbʊkmɑːk/', meaningCn: 'n. 书签', category: '超纲词汇' },
  { word: 'crest', ipa: '/krest/', meaningCn: 'n. 冠；头冠', category: '恐龙与史前生物' },
  { word: 'glider', ipa: '/ˈɡlaɪdə(r)/', meaningCn: 'n. 滑翔机', category: '超纲词汇' },
  { word: 'fern', ipa: '/fɜːn/', meaningCn: 'n. 蕨类植物', category: '动植物与自然' },
  { word: 'volcano', ipa: '/vɒlˈkeɪnəʊ/', meaningCn: 'n. 火山', category: '动植物与自然' },
  { word: 'fuzzy', ipa: '/ˈfʌzi/', meaningCn: 'adj. 毛茸茸的；覆盖绒毛的', category: '超纲词汇' },
  { word: 'mutant', ipa: '/ˈmjuːtənt/', meaningCn: 'n. 突变体；变异生物', category: '超纲词汇' },
  {
    word: 'medallion',
    ipa: '/məˈdæliən/',
    meaningCn: 'n. 圆形大奖章；圆形坠饰',
    category: '超纲词汇',
  },
  { word: 'magnolia', ipa: '/mæɡˈnəʊliə/', meaningCn: 'n. 木兰；玉兰', category: '动植物与自然' },
  { word: 'bellow', ipa: '/ˈbeləʊ/', meaningCn: 'v. 发出低沉的吼声', category: '超纲词汇' },
  { word: 'tuba', ipa: '/ˈtjuːbə/', meaningCn: 'n. 大号（一种低音乐器）', category: '超纲词汇' },
  { word: 'duck-billed', meaningCn: 'adj. 鸭嘴状的', category: '恐龙与史前生物' },
  { word: 'hilltop', ipa: '/ˈhɪltɒp/', meaningCn: 'n. 山顶', category: '动植物与自然' },
  { word: 'teeter', ipa: '/ˈtiːtə(r)/', meaningCn: 'v. 摇晃；摇摇欲坠', category: '超纲词汇' },
  { word: 'chomp', ipa: '/tʃɒmp/', meaningCn: 'v. 大声咬；用力咀嚼', category: '超纲词汇' },
  { word: 'graze', ipa: '/ɡreɪz/', meaningCn: 'v. 吃草', category: '动植物与自然' },
  { word: 'wobbly', ipa: '/ˈwɒbli/', meaningCn: 'adj. 摇晃的；不稳的', category: '超纲词汇' },
  { word: 'bolt', ipa: '/bəʊlt/', meaningCn: 'v. 突然快速逃跑', category: '超纲词汇' },
  { word: 'dazed', ipa: '/deɪzd/', meaningCn: 'adj. 茫然的；晕头转向的', category: '超纲词汇' },
  {
    word: 'engraving',
    ipa: '/ɪnˈɡreɪvɪŋ/',
    meaningCn: 'n. 雕刻的文字或图案',
    category: '超纲词汇',
  },
  { word: 'clasp', ipa: '/klɑːsp/', meaningCn: 'v. 紧握；紧抱', category: '超纲词汇' },
  { word: 'tingle', ipa: '/ˈtɪŋɡl/', meaningCn: 'v. 感到刺痛或麻痒', category: '超纲词汇' },
]

function glossaryForParagraphs(paragraphs: string[]): GlossaryWord[] {
  const body = paragraphs.join(' ').toLowerCase()
  return STORY_GLOSSARY.filter((entry) => {
    const word = entry.word.toLowerCase()
    if (body.includes(word)) return true
    if (word.endsWith('y')) return body.includes(`${word.slice(0, -1)}ies`)
    if (word.endsWith('e'))
      return body.includes(`${word.slice(0, -1)}ing`) || body.includes(`${word}d`)
    return body.includes(`${word}s`) || body.includes(`${word}ed`) || body.includes(`${word}ing`)
  })
}

export const storySeries: StorySeries[] = [
  {
    ...magicTreeHouse,
    volumes: magicTreeHouse.volumes.map((volume) => ({
      ...volume,
      chapters: volume.chapters.map((chapter) => ({
        ...chapter,
        glossary: glossaryForParagraphs(chapter.paragraphs),
      })),
    })),
  },
]

export const STORY_STAGE = 'story'
