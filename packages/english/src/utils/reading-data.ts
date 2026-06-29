import type { WordEntry } from '@rosie/core'

/**
 * Auxiliary reading-only vocabulary. Distinct from `lessonWords` (which feed
 * mastery/recall): glossary entries are for in-passage lookup only — no quiz,
 * no mastery, no ✓ⁿ marks. Use for hard/超纲 vocab and proper nouns that may
 * trip the reader.
 */
export interface GlossaryWord {
  word: string
  ipa?: string
  /** Chinese gloss with POS tag, e.g. "n. 牛羚，角马". Required. */
  meaningCn: string
  /** Short English definition. Optional but recommended for lookup richness. */
  meaningEn?: string
  /** Grouping label for the glossary panel, e.g. "动植物与自然". */
  category?: string
  /** True for proper nouns (place/person names). Get italic in-text +
   *  "了解即可" badge in the panel. */
  isProperNoun?: boolean
}

export interface ReadingPassage {
  /** Stable storage key — `{stage小写}-u{N}l{M}`, unique across stages. */
  key: string
  /** English stage code, e.g. '4A'. Required: same Unit/Lesson can repeat across stages. */
  stage: string
  unit: string
  lesson: string
  title: string
  paragraphs: string[]
  glossary?: GlossaryWord[]
}

/** Stable key built from stage + unit + lesson — used for storage paths and DB rows. */
export function buildPassageKey(stage: string, unit: string, lesson: string): string {
  const u = unit.match(/\d+/)?.[0] ?? '?'
  const l = lesson.match(/\d+/)?.[0] ?? '?'
  return `${stage.toLowerCase()}-u${u}l${l}`
}

/**
 * `focusLessonKey` serialization for `WeeklyPlan`.
 * - With stage:  `{stage}::{unit}::{lesson}` (new)
 * - Without:     `{unit}::{lesson}`          (legacy — kept readable for old data)
 */
export function buildFocusLessonKey(
  stage: string | undefined,
  unit: string,
  lesson: string,
): string {
  return stage ? `${stage}::${unit}::${lesson}` : `${unit}::${lesson}`
}

export function parseFocusLessonKey(
  key: string,
): { stage?: string; unit: string; lesson: string } | null {
  const parts = key.split('::')
  if (parts.length === 3) return { stage: parts[0], unit: parts[1], lesson: parts[2] }
  if (parts.length === 2) return { unit: parts[0], lesson: parts[1] }
  return null
}

export const readingPassages: ReadingPassage[] = [
  {
    key: '4a-u5l1',
    stage: '4A',
    unit: 'Unit 5',
    lesson: 'Lesson 1',
    title: 'Letters to HelpMe Hal',
    paragraphs: [
      "Dear HelpMe Hal,\n\nI've just moved to Berlin, and this is my first term at Handel School. I've been at the school two weeks, and I haven't met any new friends.",
      "I have tried to talk to classmates after the bell rings at the end of the lessons, but nobody says much to me at all. Well, one person did. She told me that I can't wear a sweatshirt over my uniform. I'm really friendly, and want to meet people. I've never changed schools before. I don't know what to do. Please help!\n\nLonely Lea",
      "Dear Lonely Lea,\n\nCongratulations! You've taken your first step. Writing a letter to the school magazine is a great thing to do. Now, people will know that there's a super-friendly new student.",
      "Here are some ideas for making friends. First, don't talk to friends after the bell rings. Most people must move quickly to their next lesson. It's not you – people haven't got the time to talk. Instead, ask to sit with classmates at lunch, in the canteen. You'll have more time. Or, go out into the playground during the break. Find people doing something that is interesting to you, and talk to them. You'll have friends in no time!\n\nGood luck,\n\nHelpMe Hal",
    ],
    glossary: [
      {
        word: 'uniform',
        ipa: '/ˈjuːnɪfɔːrm/',
        meaningCn: 'n. 制服，校服',
        meaningEn: 'the official clothes students must wear at school',
        category: '校园生活与日常词汇',
      },
      {
        word: 'playground',
        ipa: '/ˈpleɪɡraʊnd/',
        meaningCn: 'n. 操场，游乐场',
        meaningEn: 'an outdoor area at school where children play during breaks',
        category: '校园生活与日常词汇',
      },
      {
        word: 'congratulations',
        ipa: '/kənˌɡrætʃuˈleɪʃnz/',
        meaningCn: 'int. & n. 祝贺，恭喜',
        meaningEn: 'words you say to praise someone for something good they did',
        category: '校园生活与日常词汇',
      },
      {
        word: 'in no time',
        meaningCn: '立即，马上，很快',
        meaningEn: 'very soon; after a short period',
        category: '核心短语与高阶表达',
      },
      {
        word: 'change schools',
        meaningCn: '转学',
        meaningEn: 'to leave one school and start attending another',
        category: '核心短语与高阶表达',
      },
      {
        word: 'take a step',
        meaningCn: '迈出一步，采取行动',
        meaningEn: 'to do something as the first move toward a goal',
        category: '核心短语与高阶表达',
      },
      {
        word: 'Berlin',
        meaningCn: '柏林（德国首都）',
        meaningEn: 'the capital city of Germany',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Handel',
        meaningCn: '韩德尔（文中指校名）',
        meaningEn: 'the name of the school in this passage',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Hal',
        meaningCn: '哈尔（专栏作者名）',
        meaningEn: 'the name of the advice columnist in this passage',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Lea',
        meaningCn: '莉亚（学生署名）',
        meaningEn: 'the nickname of the student who wrote the first letter',
        category: '专有名词',
        isProperNoun: true,
      },
    ],
  },
  {
    key: '4a-u5l2',
    stage: '4A',
    unit: 'Unit 5',
    lesson: 'Lesson 2',
    title: 'A School on a Nature Reserve',
    paragraphs: [
      'Have you ever taken a school trip to a nature reserve? Well, one school in South Africa is actually on a nature reserve. The Southern Cross Boarding School, in Hoedspruit, sits on a 1,100 hectare (2,700 acre) nature reserve, with many different types of wildlife including giraffes, snakes and wild boars.',
      'At Southern Cross, students work inside classrooms, just like you, but they also spend time learning in the wild. The school’s teachers feel students need a deep understanding of the natural world so that they can care for it. Teachers take students outside during all types of lessons. For example, preschool students don’t learn counting with a workbook. Instead, they go to the farm to count animals. In a language lesson, students discuss problems facing the plants and animals on the reserve. They work together to find the best solutions.',
      'Southern Cross students also enjoy activities such as rock climbing, kayaking and horse riding. Their education isn’t just about homework and exams. Students solve real-world problems, have fun and build friendships – all while learning to care for the Earth!',
      'Guess what? To get to their lessons, Southern Cross students must walk on a path that’s also used by the animals. Imagine saying ‘Good morning!’ to a passing wildebeest on the way to your morning lesson!',
    ],
    glossary: [
      // 动植物与自然
      {
        word: 'wildebeest',
        ipa: '/ˈwɪldəbiːst/',
        meaningCn: 'n. 牛羚，角马',
        meaningEn: 'a large African antelope with a heavy head and shaggy mane',
        category: '动植物与自然',
      },
      {
        word: 'wild boar',
        ipa: '/waɪld bɔːr/',
        meaningCn: 'n. 野猪',
        meaningEn: 'a wild pig native to Eurasia and Africa',
        category: '动植物与自然',
      },
      {
        word: 'nature reserve',
        meaningCn: 'n. 自然保护区',
        meaningEn: 'an area of land protected for its wildlife and plants',
        category: '动植物与自然',
      },
      // 户外活动与地理计量
      {
        word: 'kayaking',
        ipa: '/ˈkaɪækɪŋ/',
        meaningCn: 'n. 皮划艇运动',
        meaningEn: 'the sport of paddling a small narrow boat',
        category: '户外活动与地理计量',
      },
      {
        word: 'rock climbing',
        meaningCn: 'n. 攀岩运动',
        meaningEn: 'the sport of climbing up rock faces using hands and feet',
        category: '户外活动与地理计量',
      },
      {
        word: 'hectare',
        ipa: '/ˈhekteər/',
        meaningCn: 'n. 公顷（面积单位）',
        meaningEn: 'a unit of area equal to 10,000 square metres',
        category: '户外活动与地理计量',
      },
      {
        word: 'acre',
        ipa: '/ˈeɪkər/',
        meaningCn: 'n. 英亩（面积单位）',
        meaningEn: 'a unit of land area, about 4,047 square metres',
        category: '户外活动与地理计量',
      },
      // 学校与日常核心词
      {
        word: 'boarding school',
        meaningCn: 'n. 寄宿学校',
        meaningEn: 'a school where students live during term time',
        category: '学校与日常核心词',
      },
      {
        word: 'preschool',
        ipa: '/ˈpriːskuːl/',
        meaningCn: 'adj. 学龄前的；n. 幼儿园',
        meaningEn: 'a school for children before primary school age',
        category: '学校与日常核心词',
      },
      {
        word: 'workbook',
        ipa: '/ˈwɜːrkbʊk/',
        meaningCn: 'n. 练习册，作业本',
        meaningEn: 'a book with exercises and problems for students',
        category: '学校与日常核心词',
      },
      // 专有名词
      {
        word: 'South Africa',
        meaningCn: '南非（国家名）',
        meaningEn: 'a country at the southern tip of Africa',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Southern Cross',
        meaningCn: '南十字（文中指校名）',
        meaningEn: 'the name of the school in this passage',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Hoedspruit',
        meaningCn: '胡德斯普雷特（南非小镇名）',
        meaningEn: 'a small town in northeastern South Africa',
        category: '专有名词',
        isProperNoun: true,
      },
    ],
  },
  {
    key: '4a-u5l3',
    stage: '4A',
    unit: 'Unit 5',
    lesson: 'Lesson 3',
    title: "Who's new at school?",
    paragraphs: [
      'This year, there are a lot of new teachers at school and today we are interviewing one of them, Mr Romero, the new French teacher.',
      'Angela: Mr Romero, why did you come to Silva Community School? Mr R: Well, I was working in France but one day I saw an advert for this job on the Internet. I came back home, got the job and here I am!',
      'Angela: So how long have you been teaching here? Mr R: Let me see. Three months, I think. Yes, I moved here in the summer holidays and then we started lessons in September.',
      "Angela: Have you ever taught in this town before? Mr R: Yes, I have. I worked in a school in the town centre a few years ago. I love it here. Angela: Have you taught in many other schools? Mr R: No, I haven't. Just three: one in France and two here.",
      "Angela: Have you met many new people since you came back? Mr R: Yes, I have, because it isn't a big town. Everyone knows everyone else. That's nice! My daughter Elsa has made lots of friends, too. And there are many people here we have known for a long time, because I'm from this town. Angela: Well, it was nice talking to you, Mr Romero. I hope you don't give us too much homework!",
    ],
    glossary: [
      // 超纲词汇
      {
        word: 'advert',
        ipa: '/ˈædvɜːt/',
        meaningCn: 'n. 广告（advertisement 的缩写形式，英式英语中常用）',
        meaningEn: 'a short notice promoting a product, job, or service (British shortening of advertisement)',
        category: '超纲词汇',
      },
      {
        word: 'community',
        ipa: '/kəˈmjuːnəti/',
        meaningCn: 'n. 社区，社会',
        meaningEn: 'a group of people living in the same area or sharing common interests',
        category: '超纲词汇',
      },
      {
        word: 'Internet',
        ipa: '/ˈɪntənet/',
        meaningCn: 'n. 互联网，因特网',
        meaningEn: 'the global computer network that connects millions of devices worldwide',
        category: '超纲词汇',
      },
      // 专有名词
      {
        word: 'French',
        meaningCn: 'n. 法语；adj. 法国的，法国人的',
        meaningEn: 'relating to France, its people or its language',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Silva',
        meaningCn: '席尔瓦（学校的名字）',
        meaningEn: 'the name of the school in this passage',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Romero',
        meaningCn: '罗梅罗（人名，男老师的姓氏）',
        meaningEn: 'the surname of the new French teacher being interviewed',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Angela',
        meaningCn: '安吉拉（人名，采访学生的名字）',
        meaningEn: 'the name of the student interviewer',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Elsa',
        meaningCn: '艾莎（人名，老师女儿的名字）',
        meaningEn: "the name of Mr Romero's daughter",
        category: '专有名词',
        isProperNoun: true,
      },
    ],
  },
  {
    key: '4a-u6l1',
    stage: '4A',
    unit: 'Unit 6',
    lesson: 'Lesson 1',
    title: "You've got a cold. Now what?",
    paragraphs: [
      "You're coughing. You're sneezing. You've got earache. You feel awful! What's wrong?",
      "It sounds like you caught a cold. Colds are common in young people. In fact, young children get about six to eight colds a year. But how? Unfortunately, it's very easy to catch a cold!",
      "Has your mother ever told you to put your coat and hat on so you don't catch a cold? Well, you can't actually get a cold from being cold. Rather, you caught the cold the moment a virus entered your body. Once inside, the virus takes up to three days to make you ill. If you've got a cold, you can easily share it. Someone can catch your cold by touching you or anything you've touched.",
      "Colds often last for a week to ten days. Rest during this time, and drink lots of water and juice. If you have aches all over your body, get a thermometer and check your temperature. If your temperature is too high, you may have something worse than a cold. Check with your mum or dad, or go to the doctor. Take care of yourself. It's no fun being ill!",
    ],
    glossary: [
      {
        word: 'awful',
        ipa: '/ˈɔːfl/',
        meaningCn: 'adj. 糟糕的，难受的',
        meaningEn: 'very bad or unpleasant',
        category: '超纲词汇',
      },
      {
        word: 'unfortunately',
        ipa: '/ʌnˈfɔːtʃənətli/',
        meaningCn: 'adv. 不幸地，遗憾的是',
        meaningEn: 'used to say that something is sad or disappointing',
        category: '超纲词汇',
      },
      {
        word: 'share',
        ipa: '/ʃeər/',
        meaningCn: 'v. 分享；（在此）传染给别人',
        meaningEn: 'to give a part of something to others; here, to pass on',
        category: '超纲词汇',
      },
    ],
  },
  {
    key: '4a-u6l2',
    stage: '4A',
    unit: 'Unit 6',
    lesson: 'Lesson 2',
    title: 'The Mystery of Ötzi the Iceman',
    paragraphs: [
      "In 1991, two hikers made an amazing discovery: a 5,300-year-old mummy. Called Ötzi, because he was found in the Ötztal Alps of Italy, this mummy was in ice for thousands of years. Because of this, scientists have been able to learn a lot from Ötzi's ancient body.",
      "When he died, Ötzi was aged about 45, an old man. He was in poor health. His lungs were black and he had worm eggs in his stomach, which probably made him ill. His bones were weak, especially in his shoulders, knees and ankles. Ötzi had 61 tattoos on his skin.",
      "Studying Ötzi's body helps scientists understand life back then. Scientists found clothing and equipment that show Ötzi was an important man. Studies of his teeth tell scientists where he lived. They even learnt that Ötzi ate just two hours before he died.",
      "What scientists cannot fully understand is Ötzi's death. After much testing, they learnt that somebody killed Ötzi. They found an arrowhead in his left shoulder that caused bleeding. He also had a head injury. Scientists have got a lot of information, but there are still questions: Why was Ötzi in the mountains? Why was he killed? Perhaps we'll never know.",
    ],
    glossary: [
      {
        word: 'hiker',
        ipa: '/ˈhaɪkər/',
        meaningCn: 'n. 徒步者，远足者',
        meaningEn: 'a person who walks long distances in the countryside or mountains',
        category: '超纲词汇',
      },
      {
        word: 'equipment',
        ipa: '/ɪˈkwɪpmənt/',
        meaningCn: 'n. 装备，器材',
        meaningEn: 'the tools or things needed for an activity',
        category: '超纲词汇',
      },
      {
        word: 'Ötzi',
        ipa: '/ˈɜːtsi/',
        meaningCn: '奥兹（这具冰人木乃伊的名字）',
        meaningEn: 'the name given to the iceman mummy in this passage',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Ötztal Alps',
        meaningCn: '奥茨塔尔阿尔卑斯山（发现冰人的地方）',
        meaningEn: 'the mountains in Italy where Ötzi was found',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Italy',
        ipa: '/ˈɪtəli/',
        meaningCn: '意大利（国家名）',
        meaningEn: 'a country in southern Europe',
        category: '专有名词',
        isProperNoun: true,
      },
    ],
  },
  {
    key: '4a-u6l3',
    stage: '4A',
    unit: 'Unit 6',
    lesson: 'Lesson 3',
    title: 'Tips for Healthy Living',
    paragraphs: [
      "Kids don't often think about aches and pains. They just want to play and have fun, don't they? But even kids need to make sure they take good care of themselves. Follow these easy tips to have a healthy life.",
      "Stay active! Don't spend all your time in front of a screen. Your body gets weak if you don't use it. Play a sport, go running or simply go for a walk, but get outside.",
      "Be careful of what you put in your school bag! Too many books can give you backache. Try to take only two or three books home at a time. And leave anything you don't need at school. If your bag is still too heavy, ask a friend to help you carry something.",
      "Make sure you eat different types of healthy foods, including lots of fruit and vegetables. And drink lots of water to keep your body hydrated, especially when you're exercising or outside in the sun!",
      "When you do exercise, make sure you stretch. If body parts like your ankles, knees and wrists are weak, you can injure them easily. Regular stretching helps make these body parts strong.",
      "Get enough sleep. Try to sleep at least nine hours each night. And make sure you visit the doctor every year. Even if you don't feel ill, it's important that your doctor sees you. She might discover a problem that you didn't know about. You should also talk to your doctor about things like trying new sports.",
    ],
    glossary: [
      {
        word: 'backache',
        ipa: '/ˈbækeɪk/',
        meaningCn: 'n. 背痛，腰痛',
        meaningEn: 'a pain in your back',
        category: '超纲词汇',
      },
      {
        word: 'wrist',
        ipa: '/rɪst/',
        meaningCn: 'n. 手腕',
        meaningEn: 'the joint between your hand and your arm',
        category: '超纲词汇',
      },
      {
        word: 'regular',
        ipa: '/ˈreɡjələr/',
        meaningCn: 'adj. 经常的，有规律的',
        meaningEn: 'happening often or at fixed times',
        category: '超纲词汇',
      },
    ],
  },
]

/**
 * Three-dimensional passage lookup. `stage` is optional for backward
 * compatibility — when omitted, falls back to two-dimensional matching
 * (returns the first passage that matches unit + lesson regardless of stage).
 */
export function findPassage(
  stage: string | undefined,
  unit: string,
  lesson: string,
): ReadingPassage | undefined {
  return readingPassages.find(
    (p) => (!stage || p.stage === stage) && p.unit === unit && p.lesson === lesson,
  )
}

export function findPassageByKey(key: string): ReadingPassage | undefined {
  return readingPassages.find((p) => p.key === key)
}

export function hasPassageForLesson(
  stage: string | undefined,
  unit: string,
  lesson: string,
): boolean {
  return readingPassages.some(
    (p) => (!stage || p.stage === stage) && p.unit === unit && p.lesson === lesson,
  )
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Common English inflection suffixes appended to the captured base. Covers:
 *   -s    plural / 3rd-sing  (interviews, walks)
 *   -es   plural after s/sh/ch/x/z (boxes, buses)
 *   -ed   past tense         (walked, interviewed)
 *   -ing  present participle (walking, interviewing)
 *   -ies  -y → -ies plural   (tries, families)
 *   -ied  -y → -ied past     (tried, studied)
 */
const INFLECTION_SUFFIX = '(?:ies|ied|ing|ed|es|s)?'

/**
 * Expand a base word into stems that handle silent-e verbs (`solve` → also
 * include `solv` so `solving` / `solved` match via the suffix) and -y → -i
 * verbs (`try` → also include `tri` so `tries` / `tried` match). Sorted by
 * length desc so the longest match wins in regex alternation.
 */
function expandStems(word: string): string[] {
  const out = [word]
  if (word.endsWith('e') && word.length > 1) {
    out.push(word.slice(0, -1))
  }
  if (word.endsWith('y') && word.length > 1 && !/[aeiou]y$/i.test(word)) {
    out.push(word.slice(0, -1) + 'i')
  }
  return out
}

/**
 * Given a matched fragment like `interviewing` / `tried` / `solved`, generate
 * candidate base forms by stripping inflection suffixes. Counterpart to
 * {@link expandStems}: covers `-s`, `-es`, `-ed` (two ways for silent-e),
 * `-ing` (two ways), `-ies` → `-y`, `-ied` → `-y`.
 */
function deinflectCandidates(matchedText: string): string[] {
  const lower = matchedText.toLowerCase()
  const out = new Set<string>([lower])
  if (lower.endsWith('s') && lower.length > 1) out.add(lower.slice(0, -1))
  if (lower.endsWith('es') && lower.length > 2) out.add(lower.slice(0, -2))
  if (lower.endsWith('ies') && lower.length > 3) out.add(lower.slice(0, -3) + 'y')
  if (lower.endsWith('ed') && lower.length > 2) {
    out.add(lower.slice(0, -2)) // walked → walk
    out.add(lower.slice(0, -1)) // solved → solve
  }
  if (lower.endsWith('ied') && lower.length > 3) out.add(lower.slice(0, -3) + 'y')
  if (lower.endsWith('ing') && lower.length > 3) {
    out.add(lower.slice(0, -3)) // walking → walk
    out.add(lower.slice(0, -3) + 'e') // solving → solve
  }
  return [...out]
}

/**
 * Build a single case-insensitive regex matching any of the given words as
 * whole-word tokens with common English inflections (plural, past, present
 * participle). Examples: `interview` matches `interviews` / `interviewed` /
 * `interviewing`; `solve` matches `solves` / `solved` / `solving`; `try`
 * matches `tries` / `tried`. Longer phrases are placed first so multi-word
 * terms like `nature reserve` win over `nature` alone.
 *
 * Known limitations: consonant-doubling (`run` → `running`) is not handled.
 */
export function buildWordMatchRegex(words: string[]): RegExp | null {
  if (words.length === 0) return null
  const stems = words.flatMap(expandStems)
  const sorted = stems.slice().sort((a, b) => b.length - a.length)
  const pattern = sorted.map(escapeRegex).join('|')
  return new RegExp(`\\b(${pattern})${INFLECTION_SUFFIX}\\b`, 'gi')
}

/**
 * Given a matched text fragment from {@link buildWordMatchRegex} and the
 * candidate word entries, return the entry whose `word` is the base form of
 * the match (case-insensitive, plural- and inflection-tolerant).
 */
export function resolveMatchedWord(matchedText: string, candidates: WordEntry[]): WordEntry | null {
  const stems = deinflectCandidates(matchedText)
  let best: WordEntry | null = null
  for (const c of candidates) {
    const w = c.word.toLowerCase()
    if (stems.includes(w)) {
      if (!best || c.word.length > best.word.length) best = c
    }
  }
  return best
}

const SENTENCE_SPLIT = /(?<=[.!?])\s+/

/** Per-word inflection-tolerant regex source (shared by single-word lookups). */
function inflectedSource(word: string): string {
  const stems = expandStems(word)
  const pattern = stems.map(escapeRegex).join('|')
  return `\\b(?:${pattern})${INFLECTION_SUFFIX}\\b`
}

/**
 * Find the first sentence (across all paragraphs) that contains `word`.
 * Inflection-tolerant — matches `interviewing` against `interview`, etc.
 */
export function findSentenceForWord(
  passage: ReadingPassage,
  word: string,
): { sentence: string; paragraphIndex: number } | null {
  const regex = new RegExp(inflectedSource(word), 'i')
  for (let pi = 0; pi < passage.paragraphs.length; pi++) {
    const sentences = passage.paragraphs[pi].split(SENTENCE_SPLIT)
    for (const s of sentences) {
      if (regex.test(s)) {
        return { sentence: s, paragraphIndex: pi }
      }
    }
  }
  return null
}

/**
 * Replace the first occurrence of `word` (including inflected forms) in
 * `sentence` with `_______`. Uses the same inflection-tolerant regex as
 * {@link findSentenceForWord} so that sentences found by that function are
 * always blanked correctly (e.g. `interviewing` → `_______`).
 */
export function blankWordInSentence(sentence: string, word: string): string {
  const re = new RegExp(inflectedSource(word), 'i')
  return sentence.replace(re, '_______')
}

/**
 * Build a regex matching any glossary word as whole-word tokens. Supports
 * multi-word phrases (e.g. `nature reserve`, `South Africa`) and common
 * English inflections — see {@link buildWordMatchRegex} for details.
 */
export function buildGlossaryRegex(glossary: GlossaryWord[]): RegExp | null {
  if (glossary.length === 0) return null
  const stems = glossary.flatMap((g) => expandStems(g.word))
  const sorted = stems.slice().sort((a, b) => b.length - a.length)
  const pattern = sorted.map(escapeRegex).join('|')
  return new RegExp(`\\b(${pattern})${INFLECTION_SUFFIX}\\b`, 'gi')
}

/** Resolve a matched fragment to its glossary entry (inflection-tolerant). */
export function resolveGlossaryMatch(
  matchedText: string,
  glossary: GlossaryWord[],
): GlossaryWord | null {
  const stems = deinflectCandidates(matchedText)
  let best: GlossaryWord | null = null
  for (const g of glossary) {
    const w = g.word.toLowerCase()
    if (stems.includes(w)) {
      if (!best || g.word.length > best.word.length) best = g
    }
  }
  return best
}

/** Locate the paragraph that contains a given word (inflection-tolerant). */
export function findParagraphIndexForWord(passage: ReadingPassage, word: string): number | null {
  const regex = new RegExp(inflectedSource(word), 'i')
  for (let i = 0; i < passage.paragraphs.length; i++) {
    if (regex.test(passage.paragraphs[i])) return i
  }
  return null
}
