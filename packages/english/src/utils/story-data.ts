import { roaldDahl } from './story-roald-dahl'
import { magicTreeHouse } from './story-magic-tree-house'
import { dragonMasters } from './story-dragon-masters'
import { warriorsSeries } from './story-warriors'
import type { GlossaryWord } from './reading-data'
import type { StorySeries } from './story-types'

const STORY_GLOSSARY: GlossaryWord[] = [
  {
    word: 'Frog Creek',
    ipa: '/frɒɡ kriːk/',
    meaningCn: '青蛙溪（故事中的小镇）',
    meaningEn: 'the town where Jack and Annie live',
    category: '专有名词',
    isProperNoun: true,
  },
  {
    word: 'Pennsylvania',
    ipa: '/ˌpensɪlˈveɪniə/',
    meaningCn: '宾夕法尼亚州（美国州名）',
    meaningEn: 'a state in the eastern United States',
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
    ipa: '/əˌnæt.əˈsɔː.rəs/',
    meaningCn: '鸭嘴龙属的一种恐龙',
    meaningEn: 'a kind of duck-billed dinosaur',
    category: '恐龙与史前生物',
    isProperNoun: true,
  },
  {
    word: 'Triceratops',
    ipa: '/traɪˈserətɒps/',
    meaningCn: '三角龙',
    meaningEn: 'a dinosaur with three horns and a wide shield behind its head',
    category: '恐龙与史前生物',
    isProperNoun: true,
  },
  {
    word: 'Tyrannosaurus rex',
    ipa: '/tɪˌrænəˈsɔːrəs reks/',
    meaningCn: '霸王龙',
    meaningEn: 'a huge meat-eating dinosaur that walked on two legs',
    category: '恐龙与史前生物',
    isProperNoun: true,
  },
  { word: 'ladder', ipa: '/ˈlædə(r)/', meaningCn: 'n. 梯子', meaningEn: 'a set of steps used for climbing', category: '超纲词汇' },
  { word: 'porch', ipa: '/pɔːtʃ/', meaningCn: 'n. 门廊', meaningEn: 'a covered area by the entrance to a house', category: '超纲词汇' },
  { word: 'bookmark', ipa: '/ˈbʊkmɑːk/', meaningCn: 'n. 书签', meaningEn: 'something placed in a book to mark a page', category: '超纲词汇' },
  { word: 'crest', ipa: '/krest/', meaningCn: 'n. 冠；头冠', meaningEn: 'a raised part on top of an animal’s head', category: '恐龙与史前生物' },
  { word: 'glider', ipa: '/ˈɡlaɪdə(r)/', meaningCn: 'n. 滑翔机', meaningEn: 'an aircraft that can fly without using an engine', category: '超纲词汇' },
  { word: 'fern', ipa: '/fɜːn/', meaningCn: 'n. 蕨类植物', meaningEn: 'a plant with long leaves divided into many small parts', category: '动植物与自然' },
  { word: 'volcano', ipa: '/vɒlˈkeɪnəʊ/', meaningCn: 'n. 火山', meaningEn: 'a mountain that can send out hot rock, ash and gas', category: '动植物与自然' },
  { word: 'fuzzy', ipa: '/ˈfʌzi/', meaningCn: 'adj. 毛茸茸的；覆盖绒毛的', meaningEn: 'covered in soft, short hairs', category: '超纲词汇' },
  { word: 'mutant', ipa: '/ˈmjuːtənt/', meaningCn: 'n. 突变体；变异生物', meaningEn: 'a living thing with an inherited change that makes it different', category: '超纲词汇' },
  {
    word: 'medallion',
    ipa: '/məˈdæliən/',
    meaningCn: 'n. 圆形大奖章；圆形坠饰',
    meaningEn: 'a round piece of metal worn as an ornament',
    category: '超纲词汇',
  },
  { word: 'magnolia', ipa: '/mæɡˈnəʊliə/', meaningCn: 'n. 木兰；玉兰', meaningEn: 'a tree or bush with large, often pale flowers', category: '动植物与自然' },
  { word: 'bellow', ipa: '/ˈbeləʊ/', meaningCn: 'v. 发出低沉的吼声', meaningEn: 'to make a loud, deep cry', category: '超纲词汇' },
  { word: 'tuba', ipa: '/ˈtjuːbə/', meaningCn: 'n. 大号（一种低音乐器）', meaningEn: 'a large brass instrument that plays low notes', category: '超纲词汇' },
  { word: 'duck-billed', ipa: '/ˈdʌk.bɪld/', meaningCn: 'adj. 鸭嘴状的', meaningEn: 'having a mouth or bill shaped like a duck’s', category: '恐龙与史前生物' },
  { word: 'hilltop', ipa: '/ˈhɪltɒp/', meaningCn: 'n. 山顶', meaningEn: 'the highest part of a hill', category: '动植物与自然' },
  { word: 'teeter', ipa: '/ˈtiːtə(r)/', meaningCn: 'v. 摇晃；摇摇欲坠', meaningEn: 'to move unsteadily as if about to fall', category: '超纲词汇' },
  { word: 'chomp', ipa: '/tʃɒmp/', meaningCn: 'v. 大声咬；用力咀嚼', meaningEn: 'to bite or chew with a loud sound', category: '超纲词汇' },
  { word: 'graze', ipa: '/ɡreɪz/', meaningCn: 'v. 吃草', meaningEn: 'to eat grass or other plants growing on the ground', category: '动植物与自然' },
  { word: 'wobbly', ipa: '/ˈwɒbli/', meaningCn: 'adj. 摇晃的；不稳的', meaningEn: 'shaking slightly and not steady', category: '超纲词汇' },
  { word: 'bolt', ipa: '/bəʊlt/', meaningCn: 'v. 突然快速逃跑', meaningEn: 'to run away suddenly and very fast', category: '超纲词汇' },
  { word: 'dazed', ipa: '/deɪzd/', meaningCn: 'adj. 茫然的；晕头转向的', meaningEn: 'confused and slow to understand what is happening', category: '超纲词汇' },
  {
    word: 'engraving',
    ipa: '/ɪnˈɡreɪvɪŋ/',
    meaningCn: 'n. 雕刻的文字或图案',
    meaningEn: 'a design or words cut into a hard surface',
    category: '超纲词汇',
  },
  { word: 'clasp', ipa: '/klɑːsp/', meaningCn: 'v. 紧握；紧抱', meaningEn: 'to hold something firmly in your hands or arms', category: '超纲词汇' },
  { word: 'tingle', ipa: '/ˈtɪŋɡl/', meaningCn: 'v. 感到刺痛或麻痒', meaningEn: 'to feel many small stinging or prickling sensations', category: '超纲词汇' },
  { word: 'gripped', ipa: '/ɡrɪpt/', meaningCn: 'v. 紧紧抓住；grip 的过去式', meaningEn: 'held tightly', category: '故事难点词' },
  { word: 'peer', ipa: '/pɪə/', meaningCn: 'v. 仔细看；文中指往窗外张望', meaningEn: 'to look closely as if trying hard to see', category: '故事难点词' },
  { word: 'slant', ipa: '/slɑːnt/', meaningCn: 'v. 斜斜地照进来；文中指阳光斜照', meaningEn: 'to move or be at an angle', category: '故事难点词' },
  { word: 'soar', ipa: '/sɔː/', meaningCn: 'v. 翱翔；在高空飞行', meaningEn: 'to fly high in the air', category: '故事难点词' },
  { word: 'winding', ipa: '/ˈwaɪn.dɪŋ/', meaningCn: 'adj. 蜿蜒曲折的；文中形容小溪', meaningEn: 'following a path with many bends', category: '故事难点词' },
  { word: 'stroke', ipa: '/strəʊk/', meaningCn: 'v. 抚摸；用手轻轻摸过', meaningEn: 'to move your hand gently over something', category: '故事难点词' },
  { word: 'scramble', ipa: '/ˈskræm.bəl/', meaningCn: 'v. 匆匆攀爬；手脚并用地爬', meaningEn: 'to climb or move quickly, often using your hands', category: '故事难点词' },
  { word: 'pant', ipa: '/pænt/', meaningCn: 'v. 喘粗气；急促地呼吸', meaningEn: 'to breathe quickly and noisily', category: '故事难点词' },
  { word: 'dangle', ipa: '/ˈdæŋ.ɡəl/', meaningCn: 'v. 垂下来晃动', meaningEn: 'to hang loosely and swing a little', category: '故事难点词' },
  { word: 'jaw', ipa: '/dʒɔː/', meaningCn: 'n. 颌；文中指恐龙张合的上下颌', meaningEn: 'one of the parts of the mouth that hold the teeth', category: '故事难点词' },
  { word: 'glide', ipa: '/ɡlaɪd/', meaningCn: 'v. 滑行、滑翔；平稳地移动', meaningEn: 'to move smoothly and easily', category: '故事难点词' },
  { word: 'coast', ipa: '/kəʊst/', meaningCn: 'v. 借着惯性滑行；文中指翼龙缓缓滑向地面', meaningEn: 'to keep moving without using more force', category: '故事难点词' },
  { word: 'took off', ipa: '/tʊk ˈɒf/', meaningCn: '突然跑开；文中指两人一下子跑起来', meaningEn: 'left or started moving very quickly', category: '故事难点词' },
]

const KNIGHT_AT_DAWN_GLOSSARY: GlossaryWord[] = [
  {
    word: 'knight',
    ipa: '/naɪt/',
    meaningCn: 'n. 骑士；受封的武士',
    meaningEn: 'a soldier in the Middle Ages who fought on horseback',
    category: '中世纪与城堡',
  },
  {
    word: 'armor',
    ipa: '/ˈɑː.mə/',
    meaningCn: 'n. 盔甲；护身甲',
    meaningEn: 'metal clothing worn to protect the body in battle',
    category: '中世纪与城堡',
  },
  {
    word: 'drawbridge',
    ipa: '/ˈdrɔː.brɪdʒ/',
    meaningCn: 'n. 吊桥；可升降的桥',
    meaningEn: 'a bridge that can be raised to block the entrance to a castle',
    category: '中世纪与城堡',
  },
  {
    word: 'moat',
    ipa: '/məʊt/',
    meaningCn: 'n. 护城河',
    meaningEn: 'a deep ditch, often filled with water, around a castle',
    category: '中世纪与城堡',
  },
  {
    word: 'inner ward',
    ipa: '/ˌɪn.ə ˈwɔːd/',
    meaningCn: 'n. 城堡内院',
    meaningEn: 'the protected inner courtyard of a castle',
    category: '中世纪与城堡',
  },
  {
    word: 'hawk house',
    ipa: '/ˈhɔːk haʊs/',
    meaningCn: 'n. 养鹰屋',
    meaningEn: 'a building where trained hawks were kept',
    category: '中世纪与城堡',
  },
  {
    word: 'fanfares',
    ipa: '/ˈfæn.feəz/',
    meaningCn: 'n. 号角齐鸣；仪式号声',
    meaningEn: 'a short, loud piece of music played on trumpets or horns',
    category: '中世纪与城堡',
  },
  {
    word: 'Great Hall',
    ipa: '/ˌɡreɪt ˈhɔːl/',
    meaningCn: 'n. 城堡大厅；宴会厅',
    meaningEn: 'the main room of a castle for meals and gatherings',
    category: '中世纪与城堡',
  },
  {
    word: 'peacock',
    ipa: '/ˈpiː.kɒk/',
    meaningCn: 'n. 孔雀',
    meaningEn: 'a large bird whose male has bright tail feathers',
    category: '动植物与自然',
  },
  {
    word: 'courtyard',
    ipa: '/ˈkɔːt.jɑːd/',
    meaningCn: 'n. 庭院；院子',
    meaningEn: 'an open area surrounded by the walls of a building or castle',
    category: '中世纪与城堡',
  },
  {
    word: 'cobblestone',
    ipa: '/ˈkɒb.əl.stəʊn/',
    meaningCn: 'n. 鹅卵石；铺路石',
    meaningEn: 'a rounded stone used for paving a street or courtyard',
    category: '中世纪与城堡',
  },
  {
    word: 'armory',
    ipa: '/ˈɑː.mər.i/',
    meaningCn: 'n. 武器库；盔甲室',
    meaningEn: 'a room where weapons and armor are kept',
    category: '中世纪与城堡',
  },
  {
    word: 'breastplate',
    ipa: '/ˈbrest.pleɪt/',
    meaningCn: 'n. 护胸甲',
    meaningEn: 'a piece of armor that protects the chest',
    category: '中世纪与城堡',
  },
  {
    word: 'crossbow',
    ipa: '/ˈkrɒs.bəʊ/',
    meaningCn: 'n. 弩；十字弓',
    meaningEn: 'a weapon that shoots short arrows from a bow fixed to a stock',
    category: '中世纪与城堡',
  },
  {
    word: 'battle-axe',
    ipa: '/ˈbæt.əl.æks/',
    meaningCn: 'n. 战斧',
    meaningEn: 'a large axe formerly used as a weapon',
    category: '中世纪与城堡',
  },
  {
    word: 'visor',
    ipa: '/ˈvaɪ.zə/',
    meaningCn: 'n. 头盔面罩',
    meaningEn: 'the movable metal part of a helmet that covers the face',
    category: '中世纪与城堡',
  },
  {
    word: 'dungeon',
    ipa: '/ˈdʌn.dʒən/',
    meaningCn: 'n. 地牢；城堡中的牢房',
    meaningEn: 'a dark prison inside a castle',
    category: '中世纪与城堡',
  },
  {
    word: 'Duke',
    ipa: '/djuːk/',
    meaningCn: 'n. 公爵',
    meaningEn: 'a nobleman of high rank',
    category: '中世纪与城堡',
  },
  {
    word: 'storeroom',
    ipa: '/ˈstɔː.ruːm/',
    meaningCn: 'n. 储藏室',
    meaningEn: 'a room where supplies are stored',
    category: '中世纪与城堡',
  },
  {
    word: 'secret passage',
    ipa: '/ˌsiː.krət ˈpæs.ɪdʒ/',
    meaningCn: 'n. 秘密通道',
    meaningEn: 'a hidden route through a building',
    category: '中世纪与城堡',
  },
  {
    word: 'precipice',
    ipa: '/ˈpres.ɪ.pɪs/',
    meaningCn: 'n. 悬崖；峭壁',
    meaningEn: 'a very steep side of a cliff or mountain',
    category: '地形与动作',
  },
  {
    word: 'trapdoor',
    ipa: '/ˈtræp.dɔː/',
    meaningCn: 'n. 活板门；地板暗门',
    meaningEn: 'a small door in a floor or ceiling',
    category: '中世纪与城堡',
  },
  {
    word: 'tread water',
    ipa: '/ˌtred ˈwɔː.tə/',
    meaningCn: 'v. 踩水；直立浮水',
    meaningEn: 'to stay upright in deep water by moving the arms and legs',
    category: '地形与动作',
  },
  {
    word: 'dog-paddle',
    ipa: '/ˈdɒɡˌpæd.əl/',
    meaningCn: 'v. 狗刨式游泳',
    meaningEn: 'to swim by moving the hands and feet like a dog',
    category: '地形与动作',
  },
  {
    word: 'embankment',
    ipa: '/ɪmˈbæŋk.mənt/',
    meaningCn: 'n. 堤岸；堤坡',
    meaningEn: 'a raised bank of earth beside water',
    category: '地形与动作',
  },
  {
    word: 'dismount',
    ipa: '/dɪsˈmaʊnt/',
    meaningCn: 'v. 下马',
    meaningEn: 'to get off a horse or bicycle',
    category: '中世纪与城堡',
  },
  {
    word: 'reins',
    ipa: '/reɪnz/',
    meaningCn: 'n. 缰绳',
    meaningEn: 'long straps used to guide a horse',
    category: '中世纪与城堡',
  },
  {
    word: 'canter',
    ipa: '/ˈkæn.tə/',
    meaningCn: 'v. 以介于小跑与疾驰之间的步态跑；文中指马轻快地跑',
    meaningEn: 'to move at a smooth speed faster than a trot but slower than a gallop',
    category: '中世纪与城堡',
  },
  { word: 'flashlight', ipa: '/ˈflæʃ.laɪt/', meaningCn: 'n. 手电筒；flashlight 是美式用词', meaningEn: 'a small light you can carry in your hand', category: '故事难点词' },
  { word: 'examine', ipa: '/ɪɡˈzæm.ɪn/', meaningCn: 'v. 仔细查看、调查', meaningEn: 'to look at something carefully to find out more', category: '故事难点词' },
  { word: 'scoot', ipa: '/skuːt/', meaningCn: 'v. 快速溜开、溜走', meaningEn: 'to move away quickly', category: '故事难点词' },
  { word: 'peek', ipa: '/piːk/', meaningCn: 'n. 偷看一眼；take a peek 指偷偷瞧一眼', meaningEn: 'a quick or secret look', category: '故事难点词' },
  { word: 'feast', ipa: '/fiːst/', meaningCn: 'n. 盛宴；丰盛的宴席', meaningEn: 'a large meal for a special occasion', category: '故事难点词' },
  { word: 'squeak', ipa: '/skwiːk/', meaningCn: 'v. 发出尖细的声音；文中指两人害怕时细声回答', meaningEn: 'to make a short, high sound', category: '故事难点词' },
  { word: 'dimly lit', ipa: '/ˌdɪm.li ˈlɪt/', meaningCn: '光线昏暗的', meaningEn: 'lit by only a little light', category: '故事难点词' },
  { word: 'stumble', ipa: '/ˈstʌm.bəl/', meaningCn: 'v. 绊了一下；踉跄地走', meaningEn: 'to trip or move forward unsteadily', category: '故事难点词' },
  { word: 'creak', ipa: '/kriːk/', meaningCn: 'v. 嘎吱作响；多用于门、地板等', meaningEn: 'to make a long, high sound when something moves', category: '故事难点词' },
  { word: 'flicked off', ipa: '/ˌflɪkt ˈɒf/', meaningCn: '迅速关掉；文中指啪地关掉手电筒', meaningEn: 'switched something off with a quick movement', category: '故事难点词' },
  { word: 'quake', ipa: '/kweɪk/', meaningCn: 'v. 颤抖；文中指卫兵害怕得发抖', meaningEn: 'to shake, usually because you are afraid', category: '故事难点词' },
  { word: 'leap', ipa: '/liːp/', meaningCn: 'n. 跳跃；猛地一跳', meaningEn: 'a jump, often over a long distance', category: '故事难点词' },
  { word: 'shove', ipa: '/ʃʌv/', meaningCn: 'v. 用力推', meaningEn: 'to push something hard or roughly', category: '故事难点词' },
  { word: 'flail', ipa: '/fleɪl/', meaningCn: 'v. 胡乱挥动；文中指杰克在水里乱挥手臂', meaningEn: 'to wave your arms or legs wildly', category: '故事难点词' },
  { word: 'gasping for air', ipa: '/ˌɡɑː.spɪŋ fər ˈeə/', meaningCn: '大口喘气；急着吸进空气', meaningEn: 'trying to breathe by taking quick, deep breaths', category: '故事难点词' },
  { word: 'moonlit', ipa: '/ˈmuːn.lɪt/', meaningCn: 'adj. 月光照亮的', meaningEn: 'lit by the light of the moon', category: '故事难点词' },
  { word: 'in a daze', ipa: '/ɪn ə ˈdeɪz/', meaningCn: '迷迷糊糊地；还没回过神', meaningEn: 'in a confused state, not fully aware of what is happening', category: '故事难点词' },
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

const standaloneStorySeries: StorySeries[] = [
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
  roaldDahl,
  dragonMasters,
]

export const storySeries: StorySeries[] = [...standaloneStorySeries, ...warriorsSeries]

export type StoryShelfEntry = Omit<StorySeries, 'volumes'> & {
  count: number
  unit: '本' | '辑' | '季'
}

function toStoryShelfEntry({ volumes, ...series }: StorySeries): StoryShelfEntry {
  return {
    ...series,
    count: volumes.filter((volume) => volume.kind !== 'guide').length,
    unit: series.seasonNumber ? '本' : '辑',
  }
}

const warriorsSeasonEntries = warriorsSeries.map(toStoryShelfEntry)

export const warriorsCollection = {
  entry: {
    slug: 'warriors',
    title: 'Warriors',
    language: 'en',
    author: 'Erin Hunter',
    description: 'Explore the lives of the warrior cats and their Clans.',
    count: warriorsSeasonEntries.length,
    unit: '季',
  } satisfies StoryShelfEntry,
  seasons: warriorsSeasonEntries,
}

export const storyShelfEntries = [
  ...standaloneStorySeries.map(toStoryShelfEntry),
  warriorsCollection.entry,
]

export const STORY_STAGE = 'story'
