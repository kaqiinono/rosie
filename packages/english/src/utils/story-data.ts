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

const KNIGHT_AT_DAWN_GLOSSARY: GlossaryWord[] = [
  {
    word: 'knight',
    meaningCn: 'n. 骑士；受封的武士',
    meaningEn: 'a soldier in the Middle Ages who fought on horseback',
    category: '中世纪与城堡',
  },
  {
    word: 'armor',
    meaningCn: 'n. 盔甲；护身甲',
    meaningEn: 'metal clothing worn to protect the body in battle',
    category: '中世纪与城堡',
  },
  {
    word: 'drawbridge',
    meaningCn: 'n. 吊桥；可升降的桥',
    meaningEn: 'a bridge that can be raised to block the entrance to a castle',
    category: '中世纪与城堡',
  },
  {
    word: 'moat',
    meaningCn: 'n. 护城河',
    meaningEn: 'a deep ditch, often filled with water, around a castle',
    category: '中世纪与城堡',
  },
  {
    word: 'inner ward',
    meaningCn: 'n. 城堡内院',
    meaningEn: 'the protected inner courtyard of a castle',
    category: '中世纪与城堡',
  },
  {
    word: 'hawk house',
    meaningCn: 'n. 养鹰屋',
    meaningEn: 'a building where trained hawks were kept',
    category: '中世纪与城堡',
  },
  {
    word: 'fanfares',
    meaningCn: 'n. 号角齐鸣；仪式号声',
    meaningEn: 'a short, loud piece of music played on trumpets or horns',
    category: '中世纪与城堡',
  },
  {
    word: 'Great Hall',
    meaningCn: 'n. 城堡大厅；宴会厅',
    meaningEn: 'the main room of a castle for meals and gatherings',
    category: '中世纪与城堡',
  },
  {
    word: 'peacock',
    meaningCn: 'n. 孔雀',
    meaningEn: 'a large bird whose male has bright tail feathers',
    category: '动植物与自然',
  },
  {
    word: 'courtyard',
    meaningCn: 'n. 庭院；院子',
    meaningEn: 'an open area surrounded by the walls of a building or castle',
    category: '中世纪与城堡',
  },
  {
    word: 'cobblestone',
    meaningCn: 'n. 鹅卵石；铺路石',
    meaningEn: 'a rounded stone used for paving a street or courtyard',
    category: '中世纪与城堡',
  },
  {
    word: 'armory',
    meaningCn: 'n. 武器库；盔甲室',
    meaningEn: 'a room where weapons and armor are kept',
    category: '中世纪与城堡',
  },
  {
    word: 'breastplate',
    meaningCn: 'n. 护胸甲',
    meaningEn: 'a piece of armor that protects the chest',
    category: '中世纪与城堡',
  },
  {
    word: 'crossbow',
    meaningCn: 'n. 弩；十字弓',
    meaningEn: 'a weapon that shoots short arrows from a bow fixed to a stock',
    category: '中世纪与城堡',
  },
  {
    word: 'battle-axe',
    meaningCn: 'n. 战斧',
    meaningEn: 'a large axe formerly used as a weapon',
    category: '中世纪与城堡',
  },
  {
    word: 'visor',
    meaningCn: 'n. 头盔面罩',
    meaningEn: 'the movable metal part of a helmet that covers the face',
    category: '中世纪与城堡',
  },
  {
    word: 'dungeon',
    meaningCn: 'n. 地牢；城堡中的牢房',
    meaningEn: 'a dark prison inside a castle',
    category: '中世纪与城堡',
  },
  {
    word: 'Duke',
    meaningCn: 'n. 公爵',
    meaningEn: 'a nobleman of high rank',
    category: '中世纪与城堡',
  },
  {
    word: 'storeroom',
    meaningCn: 'n. 储藏室',
    meaningEn: 'a room where supplies are stored',
    category: '中世纪与城堡',
  },
  {
    word: 'secret passage',
    meaningCn: 'n. 秘密通道',
    meaningEn: 'a hidden route through a building',
    category: '中世纪与城堡',
  },
  {
    word: 'precipice',
    meaningCn: 'n. 悬崖；峭壁',
    meaningEn: 'a very steep side of a cliff or mountain',
    category: '地形与动作',
  },
  {
    word: 'trapdoor',
    meaningCn: 'n. 活板门；地板暗门',
    meaningEn: 'a small door in a floor or ceiling',
    category: '中世纪与城堡',
  },
  {
    word: 'tread water',
    meaningCn: 'v. 踩水；直立浮水',
    meaningEn: 'to stay upright in deep water by moving the arms and legs',
    category: '地形与动作',
  },
  {
    word: 'dog-paddle',
    meaningCn: 'v. 狗刨式游泳',
    meaningEn: 'to swim by moving the hands and feet like a dog',
    category: '地形与动作',
  },
  {
    word: 'embankment',
    meaningCn: 'n. 堤岸；堤坡',
    meaningEn: 'a raised bank of earth beside water',
    category: '地形与动作',
  },
  {
    word: 'dismount',
    meaningCn: 'v. 下马',
    meaningEn: 'to get off a horse or bicycle',
    category: '中世纪与城堡',
  },
  {
    word: 'reins',
    meaningCn: 'n. 缰绳',
    meaningEn: 'long straps used to guide a horse',
    category: '中世纪与城堡',
  },
  {
    word: 'canter',
    meaningCn: 'v. 慢跑；使马慢跑',
    meaningEn: 'to move at a smooth speed faster than a trot but slower than a gallop',
    category: '中世纪与城堡',
  },
]

function glossaryForParagraphs(volumeSlug: string, paragraphs: string[]): GlossaryWord[] {
  const body = paragraphs.join(' ').toLowerCase()
  const glossary =
    volumeSlug === 'the-knight-at-dawn'
      ? [...STORY_GLOSSARY, ...KNIGHT_AT_DAWN_GLOSSARY]
      : STORY_GLOSSARY
  return glossary.filter((entry) => {
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
        glossary: glossaryForParagraphs(volume.slug, chapter.paragraphs),
      })),
    })),
  },
]

export const STORY_STAGE = 'story'
