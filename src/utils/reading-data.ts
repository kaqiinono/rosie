import type { WordEntry } from './type'

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
  key: string
  unit: string
  lesson: string
  title: string
  paragraphs: string[]
  glossary?: GlossaryWord[]
}

export const readingPassages: ReadingPassage[] = [
  {
    key: 'u5l2',
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
    key: 'u5l3',
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
]

export function findPassage(unit: string, lesson: string): ReadingPassage | undefined {
  return readingPassages.find((p) => p.unit === unit && p.lesson === lesson)
}

export function findPassageByKey(key: string): ReadingPassage | undefined {
  return readingPassages.find((p) => p.key === key)
}

export function hasPassageForLesson(unit: string, lesson: string): boolean {
  return readingPassages.some((p) => p.unit === unit && p.lesson === lesson)
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
