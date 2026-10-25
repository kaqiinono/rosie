import type { WordEntry } from '@rosie/core'
import type { GrammarExerciseGroup } from '../grammar/types'
import { getWordFormCandidates, type WordFormMatch } from './word-forms'

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
  /** Optional heading aligned by index with `paragraphs` (e.g. diary dates). */
  paragraphTitles?: string[]
  paragraphs: string[]
  glossary?: GlossaryWord[]
  learningSections?: ReadingLearningSection[]
}

export interface ReadingWordRef {
  stage: string
  unit: string
  lesson: string
  word: string
}

export interface ReadingGrammarReference {
  book: 'essential' | 'intermediate' | 'advanced'
  unitNumber: number
  role: 'primary' | 'foundation' | 'extension'
  label: string
}

export interface ReadingGrammarSummaryPoint {
  label: string
  text: string
}

export interface ReadingGrammarSummaryCard {
  title: string
  formula?: string
  signals?: string
  points: ReadingGrammarSummaryPoint[]
}

export interface ReadingGrammarSummaryContrast {
  example: string
  note: string
}

export interface ReadingGrammarSummary {
  cards: ReadingGrammarSummaryCard[]
  contrastTitle: string
  contrasts: ReadingGrammarSummaryContrast[]
  decisionGuide: string[]
  reminders?: string[]
}

export interface ReadingExerciseSection {
  type: 'exercises'
  id: string
  eyebrow: string
  title: string
  description?: string
  groups: GrammarExerciseGroup[]
  wordRefs?: ReadingWordRef[]
  evidenceByItem?: Record<number, number>
}

export interface ReadingGrammarSection {
  type: 'grammar'
  id: string
  eyebrow: string
  title: string
  groups: GrammarExerciseGroup[]
  grammarRefs: ReadingGrammarReference[]
  summary: ReadingGrammarSummary
}

export interface ReadingWritingSection {
  type: 'writing'
  id: string
  eyebrow: string
  title: string
  prompt: string
  questions: string[]
  suggestedWords: string[]
  modelAnswer: string[]
}

export type ReadingLearningSection =
  | ReadingExerciseSection
  | ReadingGrammarSection
  | ReadingWritingSection

export function resolveReadingWordRef(
  ref: ReadingWordRef,
  vocab: WordEntry[],
): WordEntry | undefined {
  const expected = ref.word.toLowerCase()
  return vocab.find(
    (entry) =>
      entry.stage === ref.stage &&
      entry.unit === ref.unit &&
      entry.lesson === ref.lesson &&
      entry.word.toLowerCase() === expected,
  )
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
    key: '5a-u1l1',
    stage: '5A',
    unit: 'Unit 1',
    lesson: 'Lesson 1',
    title: 'A Trip to Peru',
    paragraphTitles: [
      'Friday, 10 July',
      'Sunday, 12 July',
      'Monday, 13 July',
      'Tuesday, 14 July',
      'Friday, 17 July',
      'Sunday, 19 July',
    ],
    paragraphs: [
      "I'm so excited: we're leaving for Peru tomorrow! Our first stop is the capital, Lima. We'll be visiting some of Lima's beautiful churches. We'll also see the monument honouring Peru's national hero, José de San Martín.",
      "Today, we're going to Cusco, the oldest city on the continent. It's also among the highest, at 3,400 m (11,150 ft.) above sea level. We're visiting Cusco Cathedral, which took almost 100 years to build. We're also eating some Peruvian dishes, including ceviche, raw fish in lime juice.",
      "We're going to Machu Picchu today. This is a city of Incan ruins, found high in the Andes Mountains. Machu Picchu was very important during the Incan empire, but was forgotten until 1911, when an explorer named Hiram Bingham found the city. Today, it's one of the most popular tourist destinations in the world.",
      "Today, we're visiting Ollantaytambo. This historic fort is made from huge fifty-ton stones. What's fascinating is that the blocks came from an area over 5 km (3.1 mi.) away. People moved the blocks down a mountain, across a river, and up another mountain to build the fort — with no trucks or trains!",
      "Today, we're in Puno, a small town near the Bolivian border. From Puno, we're taking a boat to the Uros Islands. People live in straw houses on these floating islands. Some of the straw houses are simple, but others are quite modern: they've even got satellite TV and WiFi!",
      "Unfortunately, our next destination is Lima's airport. It's time to go home. Goodbye, Peru!",
    ],
    glossary: [
      {
        word: 'ceviche',
        ipa: '/səˈviːtʃeɪ/',
        meaningCn: 'n. 酸橘汁腌鱼；秘鲁特色生鱼料理',
        meaningEn: 'a South American dish of raw fish prepared with lime or lemon juice',
        category: '超纲词汇',
      },
      {
        word: 'explorer',
        ipa: '/ɪkˈsplɔːrə(r)/',
        meaningCn: 'n. 探险家；探索者',
        meaningEn: 'a person who travels to places to learn about or discover them',
        category: '超纲词汇',
      },
      {
        word: 'national hero',
        meaningCn: 'n. 民族英雄；国家英雄',
        meaningEn: 'a person admired by a country for important or brave actions',
        category: '超纲词汇',
      },
      {
        word: 'tourist destination',
        meaningCn: 'n. 旅游目的地',
        meaningEn: 'a place that many tourists travel to visit',
        category: '超纲词汇',
      },
      {
        word: 'floating island',
        meaningCn: 'n. 浮岛；漂浮的岛屿',
        meaningEn: 'an island that floats on the surface of water',
        category: '超纲词汇',
      },
      {
        word: 'Peru',
        meaningCn: '秘鲁（南美洲国家）',
        meaningEn: 'a country in western South America',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Lima',
        meaningCn: '利马（秘鲁首都）',
        meaningEn: 'the capital city of Peru',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'José de San Martín',
        meaningCn: '何塞·德·圣马丁（南美洲独立运动领袖）',
        meaningEn: 'a national hero associated with the independence of Peru',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Cusco',
        meaningCn: '库斯科（秘鲁历史名城）',
        meaningEn: 'a historic city in Peru and a former centre of the Incan Empire',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Cusco Cathedral',
        meaningCn: '库斯科大教堂',
        meaningEn: 'a historic cathedral in the city of Cusco',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Machu Picchu',
        meaningCn: '马丘比丘（秘鲁印加古城遗址）',
        meaningEn: 'an ancient Incan city high in the Andes Mountains',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'the Andes Mountains',
        meaningCn: '安第斯山脉',
        meaningEn: 'a major mountain range in South America',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Incan',
        meaningCn: 'adj. 印加人的；印加帝国的',
        meaningEn: 'connected with the Inca people or their empire',
        category: '超纲词汇',
      },
      {
        word: 'Hiram Bingham',
        meaningCn: '海勒姆·宾厄姆（美国探险家）',
        meaningEn: 'an American explorer associated with Machu Picchu',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Ollantaytambo',
        meaningCn: '奥扬泰坦博（秘鲁印加古镇和遗址）',
        meaningEn: 'a historic Incan town and archaeological site in Peru',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Puno',
        meaningCn: '普诺（秘鲁城市）',
        meaningEn: 'a city in southeastern Peru near Lake Titicaca',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Bolivian',
        meaningCn: 'adj. 玻利维亚的',
        meaningEn: 'connected with Bolivia',
        category: '超纲词汇',
      },
      {
        word: 'the Uros Islands',
        meaningCn: '乌鲁斯群岛（当地居民用芦苇建造的浮岛）',
        meaningEn: 'floating islands made from reeds near Puno in Peru',
        category: '专有名词',
        isProperNoun: true,
      },
    ],
    learningSections: [
      {
        type: 'exercises',
        id: 'reading-comprehension',
        eyebrow: '课文理解',
        title: '读懂这趟秘鲁之旅',
        description: '先完成词义匹配，再根据旅行日记找出每项活动发生的地点。',
        wordRefs: ['border', 'monument', 'ruin', 'fascinating', 'historic'].map((word) => ({
          stage: '5A',
          unit: 'Unit 1',
          lesson: 'Lesson 1',
          word,
        })),
        evidenceByItem: { 1: 2, 2: 3, 3: 1, 4: 5, 5: 4 },
        groups: [
          {
            section: '3',
            instruction: 'Match each word with its meaning. 括号里是教材中的乱序字母。',
            items: [
              {
                number: 1,
                type: 'matching',
                prompt: 'border (dberor)',
                answer: 'The area where two countries meet.',
                options: [
                  'Very interesting.',
                  'What remains of an old building.',
                  'From a long time ago.',
                  'A statue or building to honour a person or event.',
                  'The area where two countries meet.',
                ],
              },
              {
                number: 2,
                type: 'matching',
                prompt: 'monument (nmoeunmt)',
                answer: 'A statue or building to honour a person or event.',
                options: [
                  'Very interesting.',
                  'What remains of an old building.',
                  'From a long time ago.',
                  'A statue or building to honour a person or event.',
                  'The area where two countries meet.',
                ],
              },
              {
                number: 3,
                type: 'matching',
                prompt: 'ruin (uinr)',
                answer: 'What remains of an old building.',
                options: [
                  'Very interesting.',
                  'What remains of an old building.',
                  'From a long time ago.',
                  'A statue or building to honour a person or event.',
                  'The area where two countries meet.',
                ],
              },
              {
                number: 4,
                type: 'matching',
                prompt: 'fascinating (ntfnscailaig)',
                answer: 'Very interesting.',
                options: [
                  'Very interesting.',
                  'What remains of an old building.',
                  'From a long time ago.',
                  'A statue or building to honour a person or event.',
                  'The area where two countries meet.',
                ],
              },
              {
                number: 5,
                type: 'matching',
                prompt: 'historic (coishtir)',
                answer: 'From a long time ago.',
                options: [
                  'Very interesting.',
                  'What remains of an old building.',
                  'From a long time ago.',
                  'A statue or building to honour a person or event.',
                  'The area where two countries meet.',
                ],
              },
            ],
          },
          {
            section: '4',
            instruction: 'Match each activity with the place where it happened.',
            items: [
              {
                number: 1,
                type: 'matching',
                prompt: 'Eating ceviche',
                answer: 'Cusco',
                options: ['Lima', 'Cusco', 'Machu Picchu', 'Ollantaytambo', 'the Uros Islands'],
              },
              {
                number: 2,
                type: 'matching',
                prompt: 'Seeing Incan ruins',
                answer: 'Machu Picchu',
                options: ['Lima', 'Cusco', 'Machu Picchu', 'Ollantaytambo', 'the Uros Islands'],
              },
              {
                number: 3,
                type: 'matching',
                prompt: "Visiting a monument to Peru's national hero",
                answer: 'Lima',
                options: ['Lima', 'Cusco', 'Machu Picchu', 'Ollantaytambo', 'the Uros Islands'],
              },
              {
                number: 4,
                type: 'matching',
                prompt: 'Seeing straw houses',
                answer: 'the Uros Islands',
                options: ['Lima', 'Cusco', 'Machu Picchu', 'Ollantaytambo', 'the Uros Islands'],
              },
              {
                number: 5,
                type: 'matching',
                prompt: 'Visiting an enormous stone fort',
                answer: 'Ollantaytambo',
                options: ['Lima', 'Cusco', 'Machu Picchu', 'Ollantaytambo', 'the Uros Islands'],
              },
            ],
          },
        ],
      },
      {
        type: 'grammar',
        id: 'present-simple-vs-continuous',
        eyebrow: '本课语法',
        title: 'Present simple and present continuous',
        grammarRefs: [
          { book: 'essential', unitNumber: 8, role: 'primary', label: '两种时态对比' },
          { book: 'essential', unitNumber: 3, role: 'foundation', label: '现在进行时陈述句' },
          { book: 'essential', unitNumber: 4, role: 'foundation', label: '现在进行时疑问句' },
          { book: 'essential', unitNumber: 5, role: 'foundation', label: '一般现在时陈述句' },
          { book: 'essential', unitNumber: 6, role: 'foundation', label: '一般现在时否定句' },
          { book: 'essential', unitNumber: 7, role: 'foundation', label: '一般现在时疑问句' },
          { book: 'essential', unitNumber: 25, role: 'extension', label: '现在进行时表示未来安排' },
        ],
        summary: {
          cards: [
            {
              title: '一般现在时 · Present simple',
              formula: '主语 + 动词原形 / 第三人称单数',
              signals: 'every day · on Mondays · usually · always',
              points: [
                { label: '普遍事实', text: 'In Peru, people speak Spanish.' },
                { label: '经常发生', text: 'Do you write in your diary every day?' },
                { label: '长期状态', text: 'Cusco is high in the mountains.' },
                { label: '公共时刻表', text: 'The bus leaves at 12.30.' },
              ],
            },
            {
              title: '现在进行时 · Present continuous',
              formula: '主语 + am / is / are + doing',
              signals: 'now · today · at the moment · this year',
              points: [
                { label: '正在发生', text: "I'm reading a book." },
                { label: '当前阶段的临时情况', text: "I'm not sending any postcards this year." },
                { label: '已确定的个人安排', text: "We're meeting Laura at 1.00." },
              ],
            },
          ],
          contrastTitle: '本课最重要的区别',
          contrasts: [
            { example: 'The bus leaves at 12.30.', note: '公共时刻表 → 一般现在时' },
            { example: "We're meeting Laura at 1.00.", note: '个人已安排的计划 → 现在进行时' },
          ],
          decisionGuide: [
            '事实、习惯、长期状态、时刻表 → 一般现在时。',
            '正在发生、临时情况、个人已安排的未来计划 → 现在进行时。',
          ],
          reminders: [
            '现在进行时必须包含 am/is/are + doing。',
            '一般现在时疑问句通常使用 do/does。',
            '句子有未来时间，不代表一定要用 will。',
            'be going to 和 will 在课文中出现，但不是本课 Grammar 框的重点。',
          ],
        },
        groups: [
          {
            section: '快速检查',
            instruction: 'Choose the best answer.',
            items: [
              {
                number: 1,
                type: 'multiple_choice',
                prompt: 'Which sentence describes a timetable? ______',
                answer: 'The bus leaves at twelve thirty.',
                options: ["We're meeting Laura at one.", 'The bus leaves at twelve thirty.'],
                explanation: '公共班次和时刻表用一般现在时。',
              },
              {
                number: 2,
                type: 'multiple_choice',
                prompt: 'Which sentence describes something happening now? ______',
                answer: "I'm reading a book now.",
                options: ['I read a book every day.', "I'm reading a book now."],
                explanation: 'now 表示此刻正在发生，用现在进行时。',
              },
              {
                number: 3,
                type: 'multiple_choice',
                prompt: 'Which expression usually goes with the present simple? ______',
                answer: 'every day',
                options: ['every day', 'at the moment'],
                explanation: 'every day 表示规律发生的事情，通常用一般现在时。',
              },
            ],
          },
          {
            section: '5',
            instruction: 'Complete the sentences with the present simple or present continuous.',
            items: [
              {
                number: 1,
                type: 'fill_blank',
                prompt: 'We ______ for a walk this evening. (go)',
                answer: 'are going',
                explanation: '已经安排好的未来计划，用现在进行时。',
              },
              {
                number: 2,
                type: 'fill_blank',
                prompt: "My train ______ Cusco at 7 o'clock. (leave)",
                answer: 'leaves',
                explanation: '火车时刻表用一般现在时。',
              },
              {
                number: 3,
                type: 'fill_blank',
                prompt: "Why ______ you ______ in this photo? What's so funny? (laugh)",
                answer: 'are, laughing',
                explanation: '描述照片中正在发生的动作，用现在进行时。',
              },
              {
                number: 4,
                type: 'fill_blank',
                prompt: "I ______ any postcards this year. (not send)",
                answer: 'am not sending',
                explanation: 'this year 表示当前阶段的临时情况，用现在进行时。',
              },
              {
                number: 5,
                type: 'fill_blank',
                prompt: "Tourists ______ their cameras inside the cathedral because photos aren't allowed. (not use)",
                answer: "don't use",
                explanation: '这是长期有效的一般规定，用一般现在时。',
              },
            ],
          },
          {
            section: '6',
            instruction: 'Complete the dialogue with the correct form of the verbs in brackets.',
            items: [
              { number: 1, type: 'fill_blank', prompt: 'Tito: What ______ you ______? (do)', answer: 'are, doing' },
              { number: 2, type: 'fill_blank', prompt: 'Clara: I ______ at a website. (look)', answer: 'am looking' },
              { number: 3, type: 'fill_blank', prompt: 'It ______ lots of interesting information about Peru. (have got)', answer: 'has got' },
              { number: 4, type: 'fill_blank', prompt: 'The most common name in Peru ______ José. (be)', answer: 'is' },
              { number: 5, type: 'fill_blank', prompt: 'Clara: Why ______ you ______ my phone off? (switch)', answer: 'are, switching' },
              { number: 6, type: 'fill_blank', prompt: 'Tito: We ______ Laura at 1.00. (meet)', answer: 'are meeting' },
              { number: 7, type: 'fill_blank', prompt: 'The bus ______ at 12.30. (leave)', answer: 'leaves' },
            ],
          },
        ],
      },
      {
        type: 'exercises',
        id: 'place-vocabulary',
        eyebrow: '词汇应用',
        title: 'Places in a city',
        description: '使用本课词库中的五个场所词完成句子。',
        wordRefs: ['bridge', 'fountain', 'market', 'palace', 'sculpture'].map((word) => ({
          stage: '5A',
          unit: 'Unit 1',
          lesson: 'Lesson 1',
          word,
        })),
        groups: [
          {
            section: '8',
            instruction: 'Complete the sentences with these words.',
            items: [
              { number: 1, type: 'fill_blank', prompt: 'The artist created a large ______ in the park.', answer: 'sculpture', options: ['bridge', 'fountain', 'market', 'palace', 'sculpture'] },
              { number: 2, type: 'fill_blank', prompt: 'We must walk across the ______ to get to the island.', answer: 'bridge', options: ['bridge', 'fountain', 'market', 'palace', 'sculpture'] },
              { number: 3, type: 'fill_blank', prompt: 'The king lives in a large ______.', answer: 'palace', options: ['bridge', 'fountain', 'market', 'palace', 'sculpture'] },
              { number: 4, type: 'fill_blank', prompt: "Sometimes when it's hot, tourists put their feet in the ______.", answer: 'fountain', options: ['bridge', 'fountain', 'market', 'palace', 'sculpture'] },
              { number: 5, type: 'fill_blank', prompt: "If you want to buy a present for Mum, let's go to the ______.", answer: 'market', options: ['bridge', 'fountain', 'market', 'palace', 'sculpture'] },
            ],
          },
        ],
      },
      {
        type: 'writing',
        id: 'famous-place-writing',
        eyebrow: '说一说，写一写',
        title: 'A famous place in China',
        prompt: 'Write five sentences about a famous place in your country.',
        questions: [
          "What's its name?",
          'Where is it?',
          'Is it ancient or modern?',
          'Why do people visit it?',
          'Why do you like or not like it?',
        ],
        suggestedWords: ['ancient', 'beautiful', 'fascinating', 'historic', 'interesting', 'modern', 'ugly'],
        modelAnswer: [
          'The Great Wall is a famous place in China.',
          'It is in the north of China, near Beijing.',
          'It is ancient and very long.',
          'People visit it because it is historic and fascinating.',
          'I like it because the views from the wall are beautiful.',
        ],
      },
    ],
  },
  {
    key: '5a-u1l2',
    stage: '5A',
    unit: 'Unit 1',
    lesson: 'Lesson 2',
    title: 'The Grand Canyon',
    paragraphTitles: ['', '', '', 'Guess what!'],
    paragraphs: [
      "The Grand Canyon is a massive gorge located in the US state of Arizona, and it's considered one of the seven wonders of the natural world. Scientists think the Colorado River, which still runs through the canyon, has created the gorge slowly over the past six million years. However, new research suggests that this started happening as far back as 70 million years ago. Today, the canyon is 446 km (277 mi.) long, up to 29 km (18 mi.) wide and nearly 1.6 km (1 mi.) deep at certain points.",
      "Millions of visitors come to the Grand Canyon each year. In fact, the Grand Canyon received over six million tourists in 2016, the most it's ever seen. Camping is very popular around the canyon. Some visitors love to hike through it, while others prefer to explore the canyon on a mule. The paths can be rocky, steep and narrow. It's best to have some experience if you plan to explore on foot. Lots of visitors go rafting on the Colorado River. The fast, powerful waters of the river make for an exciting ride! If you want a different kind of adventure, visit the 'Skywalk', a glass pathway over the western side of the canyon. As you walk on the glass, you can see the bottom of the canyon, which is 1,200 m (4,000 ft.) below!",
      "If you go, plan your visit carefully. Check the weather and bring the right clothing. It can get as hot as 47°C (120°F) in the summer, and there's little shade. Bring sunscreen and lots of water to drink. The Grand Canyon is beautiful, but it can be dangerous. It's easier to stay safe if you're prepared.",
      'Supai Village — a village of approximately 200 people — is the only town in the Grand Canyon. No roads go in and out of the village, so people travel mainly by mule.',
    ],
    glossary: [
      {
        word: 'canyon',
        ipa: '/ˈkænjən/',
        meaningCn: 'n. 峡谷',
        meaningEn: 'a deep valley with very steep sides, often with a river below',
        category: '超纲词汇',
      },
      {
        word: 'massive',
        ipa: '/ˈmæsɪv/',
        meaningCn: 'adj. 巨大的；非常大的',
        meaningEn: 'very large and heavy',
        category: '超纲词汇',
      },
      {
        word: 'mule',
        ipa: '/mjuːl/',
        meaningCn: 'n. 骡子',
        meaningEn: 'an animal whose parents are a horse and a donkey',
        category: '文化与旅行',
      },
      {
        word: 'glass pathway',
        meaningCn: 'n. 玻璃步道',
        meaningEn: 'a walking path made with a glass floor',
        category: '文化与旅行',
      },
      {
        word: 'shade',
        ipa: '/ʃeɪd/',
        meaningCn: 'n. 阴凉处；背阴',
        meaningEn: 'an area protected from direct sunlight',
        category: '超纲词汇',
      },
      {
        word: 'the Grand Canyon',
        meaningCn: '大峡谷（美国亚利桑那州的著名峡谷）',
        meaningEn: 'a vast canyon in Arizona in the United States',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Arizona',
        meaningCn: '亚利桑那州（美国州名）',
        meaningEn: 'a state in the southwestern United States',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'the Colorado River',
        meaningCn: '科罗拉多河',
        meaningEn: 'the river that runs through the Grand Canyon',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Skywalk',
        meaningCn: '大峡谷天空步道',
        meaningEn: 'a glass walkway over the western side of the Grand Canyon',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Supai Village',
        meaningCn: '苏派村（大峡谷内的村庄）',
        meaningEn: 'the only village inside the Grand Canyon',
        category: '专有名词',
        isProperNoun: true,
      },
    ],
    learningSections: [
      {
        type: 'exercises',
        id: 'reading-comprehension',
        eyebrow: '课文理解',
        title: '读懂大峡谷',
        description: '根据课文选择 C（正确）、I（错误）或 DS（文中未提及）。',
        groups: [
          {
            section: '3',
            instruction: "Write C (Correct), I (Incorrect) or DS (Doesn't say).",
            items: [
              { number: 1, type: 'multiple_choice', prompt: 'The Colorado River is very deep. ______', answer: 'DS', options: ['C', 'I', 'DS'], explanation: '课文说明峡谷的深度，但没有说明科罗拉多河本身有多深。' },
              { number: 2, type: 'multiple_choice', prompt: 'Scientists agree that the canyon began forming 70 million years ago. ______', answer: 'I', options: ['C', 'I', 'DS'], explanation: '课文说科学家认为河流在过去六百万年形成峡谷；新研究才提出可能早至七千万年前。' },
              { number: 3, type: 'multiple_choice', prompt: 'The waters of the Colorado River are powerful. ______', answer: 'C', options: ['C', 'I', 'DS'], explanation: '第二段明确写到 the fast, powerful waters。' },
              { number: 4, type: 'multiple_choice', prompt: 'Over six million visitors came to the Grand Canyon in 2016. ______', answer: 'C', options: ['C', 'I', 'DS'], explanation: '第二段明确给出了 2016 年超过六百万游客。' },
              { number: 5, type: 'multiple_choice', prompt: 'The glass pathway is at the bottom of the canyon. ______', answer: 'I', options: ['C', 'I', 'DS'], explanation: 'Skywalk 在峡谷西侧上方，脚下约 1,200 m 才是谷底。' },
              { number: 6, type: 'multiple_choice', prompt: 'Some people fall and get hurt in the Grand Canyon. ______', answer: 'DS', options: ['C', 'I', 'DS'], explanation: '课文提醒峡谷可能危险，但没有说有人跌倒受伤。' },
              { number: 7, type: 'multiple_choice', prompt: "Many visitors don't wear the right clothes. ______", answer: 'DS', options: ['C', 'I', 'DS'], explanation: '课文建议带合适衣物，但没有说明许多游客穿错衣服。' },
            ],
          },
        ],
      },
      {
        type: 'grammar',
        id: 'stative-verbs',
        eyebrow: '本课语法',
        title: 'Stative verbs',
        grammarRefs: [
          { book: 'essential', unitNumber: 8, role: 'primary', label: '现在进行时与一般现在时' },
          { book: 'essential', unitNumber: 3, role: 'foundation', label: '现在进行时陈述句' },
          { book: 'essential', unitNumber: 5, role: 'foundation', label: '一般现在时陈述句' },
        ],
        summary: {
          cards: [
            {
              title: '静态动词通常不用进行时',
              formula: '状态、感受、拥有、想法和感官 → 通常用一般现在时',
              signals: '即使有 now / at the moment，也要先判断动词表达“状态”还是“动作”',
              points: [
                { label: '感受', text: 'like, hate, admire, prefer, want' },
                { label: '拥有', text: 'belong to, own' },
                { label: '理解和观点', text: 'believe, remember, understand, know' },
                { label: '感官', text: 'feel, hear, see, smell' },
              ],
            },
            {
              title: 'see 和 think 会随意思改变',
              formula: '状态意义 → 一般现在时；动作意义 → 可用现在进行时',
              signals: 'at the moment 常提示正在进行，但不能单独决定时态',
              points: [
                { label: 'see = 理解', text: "The path goes down there. I see." },
                { label: 'see = 会面', text: 'The doctor is seeing someone at the moment.' },
                { label: 'think = 认为', text: 'What do you think of the view?' },
                { label: 'think = 考虑', text: "We're thinking about going to see the Grand Canyon." },
              ],
            },
          ],
          contrastTitle: '同一个动词，意思决定时态',
          contrasts: [
            { example: 'I see.', note: 'see = understand，是状态 → 一般现在时' },
            { example: 'The doctor is seeing someone.', note: 'see = have an appointment，是正在进行的动作 → 现在进行时' },
            { example: 'What do you think of the view?', note: 'think = have an opinion，是观点 → 一般现在时' },
            { example: "We're thinking about going.", note: 'think = consider，是正在考虑 → 现在进行时' },
          ],
          decisionGuide: [
            '先判断动词是在描述稳定状态，还是正在发生的动作。',
            'like / prefer / remember / know 等静态意义通常用一般现在时。',
            'see / think 意思变成“会面 / 考虑”时，可以使用现在进行时。',
          ],
          reminders: [
            '不要看到 at the moment 就机械地选择现在进行时。',
            'have 表示“拥有”时通常不用进行时；have a great time 表示活动时可用进行时。',
          ],
        },
        groups: [
          {
            section: '7',
            instruction: 'Complete the sentences with the present simple or present continuous of the verbs in brackets.',
            items: [
              { number: 1, type: 'fill_blank', prompt: 'Tom and Dan ______ about climbing Mount Everest! (think)', answer: 'are thinking', explanation: 'think about 表示“考虑”，是当前正在进行的思考。' },
              { number: 2, type: 'fill_blank', prompt: '______ you ______ camping by the beach? (remember)', answer: 'Do, remember', explanation: 'remember 表示记忆状态，通常用一般现在时。' },
              { number: 3, type: 'fill_blank', prompt: 'I ______ hiking to skiing. (prefer)', answer: 'prefer', explanation: 'prefer 表示喜好，是静态动词。' },
              { number: 4, type: 'fill_blank', prompt: "Helen can't come out with us because she ______ Ana tonight. (see)", answer: 'is seeing', explanation: 'see 表示“与某人见面”，这里是已安排的活动。' },
              { number: 5, type: 'fill_blank', prompt: '______ anybody ______ about going to the beach? (think)', answer: 'Is, thinking', explanation: 'think about 表示“考虑”，可用现在进行时。' },
              { number: 6, type: 'fill_blank', prompt: 'They ______ a great time at the Grand Canyon. (have)', answer: 'are having', explanation: 'have a great time 表示正在经历的活动，不是“拥有”状态。' },
            ],
          },
        ],
      },
      {
        type: 'exercises',
        id: 'place-vocabulary',
        eyebrow: '词汇应用',
        title: 'Landforms and travel',
        description: '复习地貌形容词、课文重点词和旅行短语动词。',
        wordRefs: ['gorge', 'past', 'point', 'powerful', 'rafting', 'rocky', 'flat', 'narrow', 'shallow', 'steep', 'wide'].map((word) => ({
          stage: '5A',
          unit: 'Unit 1',
          lesson: 'Lesson 2',
          word,
        })),
        groups: [
          {
            section: '4',
            instruction: 'Complete the sentences with these words: gorge, past, point, powerful, rafting, rocky.',
            items: [
              { number: 1, type: 'fill_blank', prompt: 'The path is very ______, so be careful while you are walking.', answer: 'rocky', options: ['gorge', 'past', 'point', 'powerful', 'rafting', 'rocky'] },
              { number: 2, type: 'fill_blank', prompt: "I haven't been hiking for the ______ few years.", answer: 'past', options: ['gorge', 'past', 'point', 'powerful', 'rafting', 'rocky'] },
              { number: 3, type: 'fill_blank', prompt: '______ on that river without a helmet is too dangerous!', answer: 'rafting', options: ['gorge', 'past', 'point', 'powerful', 'rafting', 'rocky'] },
              { number: 4, type: 'fill_blank', prompt: 'At one ______, the river is 3 m (10 ft.) deep.', answer: 'point', options: ['gorge', 'past', 'point', 'powerful', 'rafting', 'rocky'] },
              { number: 5, type: 'fill_blank', prompt: 'The view from the top of the ______ is fantastic.', answer: 'gorge', options: ['gorge', 'past', 'point', 'powerful', 'rafting', 'rocky'] },
              { number: 6, type: 'fill_blank', prompt: 'You need a ______ torch to see in the mountains at night.', answer: 'powerful', options: ['gorge', 'past', 'point', 'powerful', 'rafting', 'rocky'] },
            ],
          },
          {
            section: '6',
            instruction: 'Complete the sentences with the words from Activity 5: flat, narrow, shallow, steep, wide.',
            items: [
              { number: 1, type: 'fill_blank', prompt: "It's easier to ride a bicycle on ______ land.", answer: 'flat', options: ['flat', 'narrow', 'shallow', 'steep', 'wide'] },
              { number: 2, type: 'fill_blank', prompt: 'This chair is too ______ to fit through the doorway.', answer: 'wide', options: ['flat', 'narrow', 'shallow', 'steep', 'wide'] },
              { number: 3, type: 'fill_blank', prompt: "This is a ______ hill. I'm getting tired climbing it.", answer: 'steep', options: ['flat', 'narrow', 'shallow', 'steep', 'wide'] },
              { number: 4, type: 'fill_blank', prompt: "The streets are only for pedestrians. They're too ______ for cars.", answer: 'narrow', options: ['flat', 'narrow', 'shallow', 'steep', 'wide'] },
              { number: 5, type: 'fill_blank', prompt: "We can't fish in this river. It's too ______.", answer: 'shallow', options: ['flat', 'narrow', 'shallow', 'steep', 'wide'] },
            ],
          },
          {
            section: 'Phrasal verbs',
            instruction: 'Circle the correct words.',
            items: [
              { number: 1, type: 'multiple_choice', prompt: "My dad's car often ______ because it's 18 years old.", answer: 'breaks down', options: ['breaks into', 'breaks down'] },
              { number: 2, type: 'multiple_choice', prompt: "Julia isn't here at the moment. She's ______ later.", answer: 'coming back', options: ['coming back', 'coming across'] },
              { number: 3, type: 'multiple_choice', prompt: "Let's ______ early tomorrow so we get there by lunchtime.", answer: 'set off', options: ['set about', 'set off'] },
              { number: 4, type: 'multiple_choice', prompt: '______ the train! It leaves in one minute!', answer: 'Get on', options: ['Get on', 'Get over'] },
              { number: 5, type: 'multiple_choice', prompt: 'We had a great view when the plane ______.', answer: 'took off', options: ['took after', 'took off'] },
              { number: 6, type: 'multiple_choice', prompt: 'Kate and her family are ______ for the weekend.', answer: 'going away', options: ['going away', 'going about'] },
              { number: 7, type: 'multiple_choice', prompt: 'Where do we have to ______ for our flight?', answer: 'check in', options: ['check in', 'check up'] },
              { number: 8, type: 'multiple_choice', prompt: 'Can we all ______ a taxi and go to the museum?', answer: 'get in', options: ['get on', 'get in'] },
            ],
          },
        ],
      },
    ],
  },
  {
    key: '5a-u1l3',
    stage: '5A',
    unit: 'Unit 1',
    lesson: 'Lesson 3',
    title: 'Amazing Places Around the World',
    paragraphTitles: ['Ahmad, 17, India', 'Tina, 16, New Zealand', 'Petros, 13, Greece'],
    paragraphs: [
      "Not many people who visit India know about the Darjeeling Himalayan Railway. There's a special train which uses the railway called the 'Toy Train' because it's so small. The journey to the town of Darjeeling is very slow because the route through the mountains is steep and narrow. The 80-km (50-mi.) journey can take up to ten hours, but the views are really impressive!",
      "Norway is the place where you expect to find fjords, but we have our own 'Fiordland' in New Zealand! Some of the fjords, which are deep lakes between high mountains, are over 200 m (656 ft.) deep! Parts of the Lord of the Rings film trilogy were filmed in Fiordland, so now it's popular with tourists who love these films.",
      "Greece is famous for its ancient monuments and sandy beaches, but did you know about its mountains, gorges and rivers? Zagori, in Epirus, is a fantastic mountain area in the north of Greece. There are many paths. Some have got old bridges over the rivers and the gorges. There are other paths which you can take to walk to the tops of the mountains. I'm going there this spring. I can't wait!",
    ],
    glossary: [
      {
        word: 'the Darjeeling Himalayan Railway',
        meaningCn: '大吉岭喜马拉雅铁路（印度著名的山区铁路）',
        meaningEn: 'a historic mountain railway in India',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Toy Train',
        meaningCn: '“玩具火车”（大吉岭喜马拉雅铁路列车的昵称）',
        meaningEn: 'the nickname of the small train on the Darjeeling Himalayan Railway',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Darjeeling',
        meaningCn: '大吉岭（印度城市）',
        meaningEn: 'a town in the mountains of northeastern India',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Fiordland',
        meaningCn: '峡湾地区（新西兰西南部地区）',
        meaningEn: 'a region of mountains, lakes and fjords in New Zealand',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'the Lord of the Rings',
        meaningCn: '《指环王》（电影系列）',
        meaningEn: 'a fantasy film trilogy partly filmed in New Zealand',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Zagori',
        meaningCn: '扎戈里（希腊北部山区）',
        meaningEn: 'a mountain area in northern Greece',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Epirus',
        meaningCn: '伊庇鲁斯（希腊西北部地区）',
        meaningEn: 'a region in northwestern Greece',
        category: '专有名词',
        isProperNoun: true,
      },
    ],
    learningSections: [
      {
        type: 'exercises',
        id: 'reading-comprehension',
        eyebrow: '课文理解',
        title: 'Amazing places',
        description: '根据三位学生的介绍回答问题。',
        groups: [
          {
            section: '2',
            instruction: 'Answer the questions.',
            items: [
              { number: 1, type: 'multiple_choice', prompt: "What's another name for the Darjeeling Himalayan Railway train?", answer: 'The Toy Train.', options: ['The Toy Train.', 'The Mountain Express.', 'The India Railway.'] },
              { number: 2, type: 'multiple_choice', prompt: "Why isn't the train fast?", answer: 'Because the route through the mountains is steep and narrow.', options: ['Because the route through the mountains is steep and narrow.', 'Because the train stops at every bridge.', 'Because the journey is 200 km long.'] },
              { number: 3, type: 'multiple_choice', prompt: 'Why is Fiordland popular with some tourists?', answer: 'Because parts of the Lord of the Rings film trilogy were filmed there.', options: ['Because parts of the Lord of the Rings film trilogy were filmed there.', 'Because it has sandy beaches.', 'Because its railway is famous.'] },
              { number: 4, type: 'multiple_choice', prompt: 'What do people expect to find in Greece?', answer: 'Ancient monuments and sandy beaches.', options: ['Ancient monuments and sandy beaches.', 'Fjords and deep lakes.', 'A small mountain railway.'] },
              { number: 5, type: 'multiple_choice', prompt: 'Where in Greece is Zagori?', answer: 'In Epirus, in the north of Greece.', options: ['In Epirus, in the north of Greece.', 'On an island in southern Greece.', 'Near Athens, in central Greece.'] },
            ],
          },
        ],
      },
      {
        type: 'grammar',
        id: 'relative-clauses',
        eyebrow: '本课语法',
        title: 'Relative clauses',
        grammarRefs: [
          { book: 'essential', unitNumber: 95, role: 'primary', label: '补充信息的关系从句' },
          { book: 'essential', unitNumber: 92, role: 'foundation', label: 'who / that / which 关系从句' },
          { book: 'essential', unitNumber: 94, role: 'foundation', label: 'whose / where 关系从句' },
          { book: 'essential', unitNumber: 96, role: 'extension', label: '补充信息关系从句进阶' },
        ],
        summary: {
          cards: [
            {
              title: '关系从句补充说明人、动物、事物、地点或时间',
              formula: '名词 + who / whose / which / where / when + 从句',
              points: [
                { label: '人', text: 'who：Is that the boy who came from Ireland?' },
                { label: '所属', text: 'whose：Is that the boy whose name is Ahmad?' },
                { label: '事物', text: 'which：Japan is a country which is in Asia.' },
                { label: '地点', text: 'where：Ireland is a place where it often rains.' },
              ],
            },
            {
              title: '限定性与非限定性关系从句',
              formula: '必要信息不加逗号；额外信息前后加逗号',
              points: [
                { label: '限定性', text: 'The paths which lead to the mountains are narrow.' },
                { label: '非限定性', text: 'Crete, which is an island, is in Greece.' },
                { label: 'that', text: '限定性从句中可用 that 代替 who / which。' },
                { label: '限制', text: '非限定性从句不能用 that。' },
              ],
            },
          ],
          contrastTitle: '逗号决定信息的作用',
          contrasts: [
            { example: 'Tina, who comes from New Zealand, is 16 years old.', note: '姓名已明确人物，从句只补充额外信息，要用逗号。' },
            { example: 'Norway is the place where you expect to find fjords.', note: '从句说明是哪一个地方，是必要信息，不用逗号。' },
            { example: 'Some of the fjords, which are deep lakes between high mountains, are over 200 m deep.', note: 'which 从句补充解释 fjords，要用逗号。' },
          ],
          decisionGuide: [
            '先找被说明的名词，再判断它是人、所属关系、事物、地点还是时间。',
            '删掉从句后若无法确定说的是谁或什么，用限定性关系从句，不加逗号。',
            '删掉从句后主句仍指向明确对象，用非限定性关系从句，并在前后加逗号。',
          ],
          reminders: ['非限定性关系从句不能用 that。', '教材中的 when 用来说明时间；where 用来说明地点。'],
        },
        groups: [
          {
            section: '3',
            instruction: 'Choose whether each sentence is correct. Add commas to the other sentences.',
            items: [
              { number: 1, type: 'multiple_choice', prompt: "This is the hotel where we're staying.", answer: 'Correct', options: ['Correct', 'Needs commas'], explanation: 'where 从句限定是哪一家酒店，不加逗号。' },
              { number: 2, type: 'multiple_choice', prompt: 'Reykjavik which is the capital of Iceland is beautiful.', answer: 'Needs commas', options: ['Correct', 'Needs commas'], explanation: 'Reykjavik, which is the capital of Iceland, is beautiful.' },
              { number: 3, type: 'multiple_choice', prompt: 'My mum who loves ancient monuments wants to go to Rome.', answer: 'Needs commas', options: ['Correct', 'Needs commas'], explanation: 'My mum, who loves ancient monuments, wants to go to Rome.' },
              { number: 4, type: 'multiple_choice', prompt: 'The day when Dan reached the top of the mountain was his birthday.', answer: 'Correct', options: ['Correct', 'Needs commas'], explanation: 'when 从句限定是哪一天，不加逗号。' },
            ],
          },
          {
            section: '4',
            instruction: 'Combine the sentences using non-defining relative clauses. Use the words in bold.',
            items: [
              { number: 1, type: 'fill_blank', prompt: "The Taj Mahal is in India. It's a famous monument. (which)", answer: 'The Taj Mahal, which is a famous monument, is in India.' },
              { number: 2, type: 'fill_blank', prompt: "Dan lives in Peru. He is Dad's friend. (who)", answer: "Dan, who is Dad's friend, lives in Peru." },
              { number: 3, type: 'fill_blank', prompt: 'Amsterdam is very flat. Most people use bicycles there. (where)', answer: 'Amsterdam, where most people use bicycles, is very flat.' },
              { number: 4, type: 'fill_blank', prompt: 'Paul is travelling around the world. His sister is in my class. (whose)', answer: 'Paul, whose sister is in my class, is travelling around the world.' },
            ],
          },
        ],
      },
      {
        type: 'exercises',
        id: 'there-it-they',
        eyebrow: '写作准备',
        title: 'There is / There are vs It is / They are',
        description: 'There is / There are 引出某地存在的人或事物；It is / They are 回指已经提到的内容。',
        wordRefs: ['fjord (also fiord)', 'trilogy', 'route', 'impressive', 'expect'].map((word) => ({
          stage: '5A',
          unit: 'Unit 1',
          lesson: 'Lesson 3',
          word,
        })),
        groups: [
          {
            section: 'Writing B',
            instruction: 'Complete the description with there, it or they.',
            items: [
              { number: 1, type: 'fill_blank', prompt: '______ are fantastic beaches and many cycling paths on the island of Porquerolles.', answer: 'There' },
              { number: 2, type: 'fill_blank', prompt: '______ are no cars on the island.', answer: 'There' },
              { number: 3, type: 'fill_blank', prompt: "______ aren't allowed, so you must walk or cycle everywhere.", answer: 'They' },
              { number: 4, type: 'fill_blank', prompt: '______ are also some ancient ruins on the island.', answer: 'There' },
              { number: 5, type: 'fill_blank', prompt: '______ are from an old fort and a bath house.', answer: 'They' },
              { number: 6, type: 'fill_blank', prompt: '______ is a beautiful hotel where my family stayed when we visited the island.', answer: 'There' },
              { number: 7, type: 'fill_blank', prompt: '______ is expensive, but it’s worth it!', answer: 'It' },
            ],
          },
        ],
      },
      {
        type: 'writing',
        id: 'place-description-writing',
        eyebrow: '写作任务',
        title: 'A place people should visit',
        prompt: 'Write a description of a place people should visit in your country. Include defining and non-defining relative clauses, and use There is, There are, It is and They are correctly.',
        questions: [
          "What's its name?",
          'Where is it?',
          'What is there to see and do there?',
          'Why do you think it’s interesting?',
          'Why do you recommend it?',
        ],
        suggestedWords: ['ancient', 'beautiful', 'fascinating', 'historic', 'impressive', 'relaxing'],
        modelAnswer: [
          'Hangzhou, which is in eastern China, is a beautiful city that people should visit.',
          'There is a famous lake called West Lake, where visitors can walk, cycle and take boat trips.',
          'There are also ancient temples and quiet gardens. They are wonderful places to learn about local history.',
          'The lake is especially impressive in spring, when the trees and flowers are colourful. It is peaceful even though the city is busy.',
          'I recommend Hangzhou because there is something interesting for every visitor, and the views are unforgettable.',
        ],
      },
    ],
  },
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
        meaningEn:
          'a short notice promoting a product, job, or service (British shortening of advertisement)',
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
      'When he died, Ötzi was aged about 45, an old man. He was in poor health. His lungs were black and he had worm eggs in his stomach, which probably made him ill. His bones were weak, especially in his shoulders, knees and ankles. Ötzi had 61 tattoos on his skin.',
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
      'When you do exercise, make sure you stretch. If body parts like your ankles, knees and wrists are weak, you can injure them easily. Regular stretching helps make these body parts strong.',
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
  {
    key: '4a-u7l1',
    stage: '4A',
    unit: 'Unit 7',
    lesson: 'Lesson 1',
    title: 'A Trip to Costa Rica',
    paragraphs: [
      "Rosa: Bruno, I'm so excited. We're going to visit Costa Rica this summer.",
      'Bruno: Cool! Where are you going in Costa Rica?',
      "Rosa: We're going to explore a huge national park, Parque Tortuguero.",
      'Bruno: How long will you be there?',
      "Rosa: We're going to spend four days there.",
      'Bruno: What are you going to do there?',
      "Rosa: Well, there's a jungle, a volcano and a beach. We'll explore all three.",
      'Bruno: How are you going to explore the jungle?',
      "Rosa: Well, on the first day, we'll walk through the jungle. I'm going to take lots of photos. There's amazing wildlife, like the red-eyed tree frog and the green iguana. It's going to be awesome!",
      'Bruno: And on the second day?',
      "Rosa: We're going on a boat tour through the jungle. I'm sure we'll see monkeys and crocodiles – they're everywhere. On the third day, we'll explore the area near the Arenal Volcano. It's one of the most active volcanoes on Earth!",
      'Bruno: Really? Will you be safe?',
      "Rosa: Of course. They're not going to take us if it's erupting.",
      'Bruno: I hope not! And what will you do on the fourth day?',
      "Rosa: This is the day I'm most excited about. We're going to visit the beach to see where the turtles lay their eggs. We're going to see some baby turtles in the sand.",
      'Bruno: Sounds great, Rosa!',
    ],
    glossary: [
      {
        word: 'Costa Rica',
        meaningCn: '哥斯达黎加（中美洲国家）',
        meaningEn: 'a country in Central America',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Parque Tortuguero',
        meaningCn: '托尔图格罗国家公园（哥斯达黎加的国家公园名）',
        meaningEn: 'the name of the national park in this passage',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Arenal Volcano',
        meaningCn: '阿雷纳尔火山（哥斯达黎加的活火山）',
        meaningEn: 'an active volcano in Costa Rica',
        category: '专有名词',
        isProperNoun: true,
      },
    ],
  },
  {
    key: '4a-u7l2',
    stage: '4A',
    unit: 'Unit 7',
    lesson: 'Lesson 2',
    title: 'Plants That Eat Meat',
    paragraphs: [
      "What do plants need to grow? If you said light, soil and water, you're right! But some plants have got different needs — they eat meat! Meat-eating plants usually grow in areas with poor soil. This soil can't give them enough food, so they've found another way to get it: eating insects and other small creatures. (Don't worry, though. Plants only eat people in books and films!)",
      "One well-known meat-eating plant is the Venus flytrap. It grows in very humid climates with lots of insects. Insects fly into the plant because it's got a bright, red colour and a fruity smell. When the insect lands, the leaves close together and trap it inside.",
      "Another meat-eating plant is the pitcher plant. There are several varieties of pitcher plant, and some of them can become very big, with stems up to 6 m. (20 ft.) long, and flowers 1 m. (3.3 ft.) high. They can hold up to two litres of sweet, sticky liquid. Curious animals go inside for a drink, but then they slide down the plant's slippery side and become its next meal. And it's not always thirsty insects that go into pitcher plants. Finding a mouse or a lizard inside a pitcher plant is not too unusual.",
      'These beautiful plants attract animals with their sweet smells, and then they eat them. Who knew that plants could be so clever?',
    ],
    glossary: [
      {
        word: 'Venus flytrap',
        ipa: '/ˌviːnəs ˈflaɪtræp/',
        meaningCn: '捕蝇草（一种食肉植物）',
        meaningEn: 'a meat-eating plant whose leaves snap shut on insects',
        category: '超纲词汇',
      },
      {
        word: 'pitcher plant',
        ipa: '/ˈpɪtʃər plɑːnt/',
        meaningCn: '猪笼草（一种食肉植物）',
        meaningEn: 'a meat-eating plant with a deep cup that traps animals',
        category: '超纲词汇',
      },
      {
        word: 'litre',
        ipa: '/ˈliːtər/',
        meaningCn: 'n. 升（容量单位）',
        meaningEn: 'a unit for measuring an amount of liquid',
        category: '超纲词汇',
      },
    ],
  },
  {
    key: '4a-u7l3',
    stage: '4A',
    unit: 'Unit 7',
    lesson: 'Lesson 3',
    title: "Let's Take Care of Our Turtles!",
    paragraphs: [
      "Turtles are amazing creatures, aren't they? Turtles have been on Earth for millions of years, but now nearly 70 per cent of turtle species are endangered.",
      "Some of the reasons that turtles are endangered include:\nPeople want to have turtles as pets, but they're not surviving and having babies like they do in the wild.\nMore and more people are eating turtle meat, which causes population loss.\nTurtles get caught in fishing nets by accident and are dying.\nHungry turtles are eating plastic that's in the ocean, which is making them sick.",
      'Around the world, people have opened turtle sanctuaries — protected areas that help turtles stay alive and protect their eggs. One example is in Bora Bora. In 1991, a tourist at the Hotel Le Méridien brought an injured turtle to the hotel. After that, the hotel opened a turtle protection centre.',
      "It works to help turtles protect their babies, treat injured turtles and teach hotel visitors about the danger turtles are in. The sanctuary is a success, and it's growing. Visitors are returning home and sharing the message about endangered turtles. And this is just one example. By sharing information and helping turtles, we can make a difference, can't we?",
    ],
    glossary: [
      {
        word: 'species',
        ipa: '/ˈspiːʃiːz/',
        meaningCn: 'n. 物种，种类',
        meaningEn: 'a group of animals or plants of the same kind',
        category: '超纲词汇',
      },
      {
        word: 'per cent',
        ipa: '/pər ˈsent/',
        meaningCn: '百分之……',
        meaningEn: 'one part in every hundred',
        category: '超纲词汇',
      },
      {
        word: 'Bora Bora',
        meaningCn: '波拉波拉岛（南太平洋的一个岛）',
        meaningEn: 'a small island in the South Pacific',
        category: '专有名词',
        isProperNoun: true,
      },
      {
        word: 'Hotel Le Méridien',
        meaningCn: '艾美酒店（文中波拉波拉岛上的酒店名）',
        meaningEn: 'the name of the hotel on Bora Bora in this passage',
        category: '专有名词',
        isProperNoun: true,
      },
    ],
  },
  {
    key: '5a-u2l1',
    stage: '5A',
    unit: 'Unit 2',
    lesson: 'Lesson 1',
    title: 'Power in the Path',
    paragraphs: [
      'Have you ever taken a bike ride in the sun? It might make your ride a little hotter, but a cycle path in a sunny area can be a good thing. In fact, in the Netherlands, one company decided to build a cycle path that can create energy using the sun.',
      "In the town of Krommenie, there’s a 70 m (230 ft.) cycle path with solar panels built into it. These panels absorb light from the sun’s rays. They then use that light to create electricity, which can power specific things (like street lights) or go right into the electrical grid. In its first year, this short path was creating enough energy to power one house for a whole year!",
      "Developers are still doing research. They must make sure the path is strong enough for buses and trucks to drive over it. They must also make sure the path isn’t too smooth because that could get slippery, causing cyclists to fall. This test path must be just right before this type of path can be built in other places.",
      "In another Dutch town, Eindhoven, there’s a cycle path that uses solar energy to make art. The path, which opened in 2014, is made up of thousands of tiny lights that absorb the sun during the day and glow at night. From above, these lights combine to look like the famous painting The Starry Night by Dutch artist Vincent van Gogh. This one-kilometre path is part of a larger cycle path that honours van Gogh, who lived in this area from 1883 to 1885. It’s a beautiful and creative way to use the power of the sun, and the path attracts many visitors.",
    ],
    glossary: [
      { word: 'Krommenie', meaningCn: '克罗默尼（荷兰城镇）', meaningEn: 'a town in the Netherlands', category: '专有名词', isProperNoun: true },
      { word: 'Eindhoven', meaningCn: '埃因霍温（荷兰城市）', meaningEn: 'a city in the Netherlands', category: '专有名词', isProperNoun: true },
      { word: 'Vincent van Gogh', meaningCn: '文森特·梵高（荷兰画家）', meaningEn: 'a Dutch artist', category: '专有名词', isProperNoun: true },
      { word: 'The Starry Night', meaningCn: '《星月夜》（梵高画作）', meaningEn: 'a famous painting by Vincent van Gogh', category: '专有名词', isProperNoun: true },
      { word: 'electrical grid', meaningCn: 'n. 电网', meaningEn: 'a network that carries electricity to homes and businesses', category: '超纲词汇' },
    ],
    learningSections: [
      {
        type: 'exercises', id: 'power-in-the-path-reading', eyebrow: '课文理解', title: '读懂太阳能自行车道',
        description: '完成教材第 3、4 题：选择正确词语并判断正误。',
        wordRefs: ['absorb', 'electricity', 'smooth', 'glow', 'create'].map((word) => ({ stage: '5A', unit: 'Unit 2', lesson: 'Lesson 1', word })),
        groups: [
          { section: '3', instruction: 'Circle the correct words.', items: [
            { number: 1, type: 'multiple_choice', prompt: "Solar panels ______ the sun's light to create power.", answer: 'absorb', options: ['absorb', 'glow'] },
            { number: 2, type: 'multiple_choice', prompt: 'The sun gives off ______ of light.', answer: 'rays', options: ['electricity', 'rays'] },
            { number: 3, type: 'multiple_choice', prompt: "Solar panels have a ______ top that isn't safe for cyclists to ride on.", answer: 'smooth', options: ['glow', 'smooth'] },
            { number: 4, type: 'multiple_choice', prompt: 'The lights ______ at night to look like a famous painting.', answer: 'glow', options: ['glow', 'create'] },
            { number: 5, type: 'multiple_choice', prompt: 'During the storm, we had no ______.', answer: 'electricity', options: ['electricity', 'rays'] },
            { number: 6, type: 'multiple_choice', prompt: 'The lights work together to ______ a picture.', answer: 'create', options: ['absorb', 'create'] },
          ] },
          { section: '4', instruction: 'Read. Tick T for True or F for False.', items: [
            { number: 1, type: 'multiple_choice', prompt: "The cycle path in Krommenie uses the sun's rays to create electricity.", answer: 'True', options: ['True', 'False'] },
            { number: 2, type: 'multiple_choice', prompt: 'The electricity created by the cycle path can only power street lights.', answer: 'False', options: ['True', 'False'] },
            { number: 3, type: 'multiple_choice', prompt: 'In the first year, the cycle path created enough energy to power one house for a whole year.', answer: 'True', options: ['True', 'False'] },
            { number: 4, type: 'multiple_choice', prompt: 'The path should be very smooth so that cyclists can go on it.', answer: 'False', options: ['True', 'False'] },
            { number: 5, type: 'multiple_choice', prompt: 'Both cycle paths mentioned in the article were built for the same reason.', answer: 'False', options: ['True', 'False'] },
            { number: 6, type: 'multiple_choice', prompt: 'Vincent van Gogh probably rode his bike on the cycle path in Eindhoven.', answer: 'False', options: ['True', 'False'] },
          ] },
        ],
      },
      {
        type: 'grammar', id: 'past-tenses-and-used-to', eyebrow: '本课语法', title: 'Past simple, past continuous and used to',
        grammarRefs: [
          { book: 'essential', unitNumber: 8, role: 'primary', label: '过去进行时' },
          { book: 'essential', unitNumber: 7, role: 'foundation', label: '一般过去时' },
          { book: 'essential', unitNumber: 18, role: 'extension', label: 'used to' },
        ],
        summary: { cards: [
          { title: '一般过去时', formula: '动词过去式', signals: 'yesterday · last night · in 2014', points: [{ label: '完成的过去动作', text: 'The path opened in 2014.' }] },
          { title: '过去进行时', formula: 'was / were + doing', signals: 'while · when', points: [{ label: '过去某时正在进行', text: 'She was working as a secretary.' }] },
          { title: 'used to', formula: 'used to + 动词原形', signals: 'when I was young · in the past', points: [{ label: '过去常常发生、现在不再发生', text: 'Televisions used to be only black and white.' }] },
        ], contrastTitle: '本课最重要的区别', contrasts: [
          { example: 'She was writing a letter when the paint disappeared.', note: '长动作用过去进行时；发生并打断它的动作用一般过去时。' },
          { example: "I didn't use to send many messages from my phone.", note: 'used to 描述过去状态或习惯。' },
        ], decisionGuide: ['过去完成的动作 → 一般过去时。', '过去某时正在发生的动作或故事背景 → 过去进行时。', '过去经常发生、现在不再发生的习惯或状态 → used to。'], reminders: ['否定形式用 didn’t use to，不用 didn’t used to。'] },
        groups: [
          { section: '6', instruction: 'Complete the sentences with the correct form of do or make.', items: [
            { number: 1, type: 'fill_blank', prompt: 'Last week in science, we ______ an experiment with solar energy.', answer: 'did', explanation: 'do an experiment' },
            { number: 2, type: 'fill_blank', prompt: "It doesn't ______ a difference what anyone thinks.", answer: 'make', explanation: 'make a difference' },
            { number: 3, type: 'fill_blank', prompt: 'Has Mum ______ a decision about where to have dinner?', answer: 'made', explanation: 'make a decision' },
            { number: 4, type: 'fill_blank', prompt: '______ your parents a favour and clean up the house.', answer: 'Do', explanation: 'do a favour' },
            { number: 5, type: 'fill_blank', prompt: "Please, don't ______ a sound!", answer: 'make', explanation: 'make a sound' },
          ] },
          { section: '7', instruction: 'Complete the paragraph with the past simple or the past continuous form of the verbs in brackets.', items: [
            { number: 1, type: 'fill_blank', prompt: "Bette Nesmith Graham ______ to be an inventor. (not want)", answer: "didn't want" },
            { number: 2, type: 'fill_blank', prompt: 'She ______ to become an artist when she ______ a job as a secretary after World War II. (hope / get)', answer: 'hoped / got' },
            { number: 3, type: 'fill_blank', prompt: 'While she ______ as a secretary, she ______ of a good way to cover and correct the mistakes. (work / think)', answer: 'was working / thought' },
            { number: 4, type: 'fill_blank', prompt: 'One day, she ______ a bottle and took it to work with her. (put)', answer: 'put' },
            { number: 5, type: 'fill_blank', prompt: 'While she ______ a letter, she put the paint on the mistakes and they ______! (write / disappear)', answer: 'was writing / disappeared' },
          ] },
          { section: '8', instruction: 'Write sentences with a form of used to.', items: [
            { number: 1, type: 'fill_blank', prompt: 'The Internet ______ very slow.', answer: 'used to be' },
            { number: 2, type: 'fill_blank', prompt: 'Mobile phones ______ cameras.', answer: "didn't use to have" },
            { number: 3, type: 'fill_blank', prompt: '______ cyclists ______ helmets?', answer: 'Did cyclists use to wear' },
            { number: 4, type: 'fill_blank', prompt: 'People ______ emails.', answer: "didn't use to send" },
          ] },
        ],
      },
    ],
  },
  {
    key: '5a-u2l2', stage: '5A', unit: 'Unit 2', lesson: 'Lesson 2', title: "What's Out There?",
    paragraphs: [
      'People have always wondered if life exists beyond Earth. Ever since the 17th century, when Galileo began using a telescope to study outer space, we have been curious about what – if anything – lives beyond our planet. Today, scientists are hoping to discover some life forms in outer space. Not creatures from the science fiction films, but rather microscopic life forms, which might be found in water.',
      "Scientists have already spent much time and money looking for water on the surface of Mars. They’ve found water underneath Mars’s surface, but not like the lakes and rivers we have on Earth. Scientists feel that the Red Planet probably had water on its surface billions of years ago. Today, researchers continue to investigate whether the planet has ever been able to support life.",
      "Two moons are also showing signs that life could be possible – Jupiter’s moon, Europa, and Saturn’s moon, Enceladus. Both moons have got icy surfaces with water underneath. Europa is billions of years older than Enceladus. For that reason, many scientists think it’s more likely than Enceladus to have life, because life forms take a long time to develop.",
      "Scientists have also started studying the possibility of life on a planet outside our solar system. There’s a planet orbiting Proxima Centauri, the next closest star to Earth after the Sun. This rocky planet is about the same size as Earth and may be warm enough for liquid water. It’s too early to tell if life could exist on the planet, but scientists hope to learn more when the James Webb Space Telescope explores this area of space, starting in 2018. With exciting new missions planned, scientists are hoping that we’ll soon know if we’re alone in the universe, or if we’ve got some microscopic neighbours.",
    ],
    glossary: [
      { word: 'Galileo', meaningCn: '伽利略（意大利天文学家）', meaningEn: 'an Italian scientist and astronomer', category: '专有名词', isProperNoun: true },
      { word: 'Mars', meaningCn: '火星', meaningEn: 'the fourth planet from the Sun', category: '专有名词', isProperNoun: true },
      { word: 'Europa', meaningCn: '欧罗巴（木星的卫星）', meaningEn: 'a moon of Jupiter', category: '专有名词', isProperNoun: true },
      { word: 'Enceladus', meaningCn: '恩克拉多斯（土星的卫星）', meaningEn: 'a moon of Saturn', category: '专有名词', isProperNoun: true },
      { word: 'Proxima Centauri', meaningCn: '比邻星', meaningEn: 'the closest star to the Sun', category: '专有名词', isProperNoun: true },
      { word: 'James Webb Space Telescope', meaningCn: '詹姆斯·韦布空间望远镜', meaningEn: 'a space telescope used to observe the universe', category: '专有名词', isProperNoun: true },
    ],
    learningSections: [
      { type: 'exercises', id: 'outer-space-reading', eyebrow: '课文理解', title: '寻找宇宙中的生命', wordRefs: ['discover', 'microscopic', 'investigate', 'orbit', 'exist', 'support', 'surface'].map((word) => ({ stage: '5A', unit: 'Unit 2', lesson: 'Lesson 2', word })), groups: [
        { section: '3', instruction: 'Read. Answer the questions.', items: [
          { number: 1, type: 'fill_blank', prompt: 'What type of life forms do scientists hope to discover?', answer: 'microscopic life forms' },
          { number: 2, type: 'fill_blank', prompt: 'When do scientists believe Mars had water on its surface?', answer: 'billions of years ago' },
          { number: 3, type: 'fill_blank', prompt: 'What do Europa and Enceladus have in common?', answer: 'They both have icy surfaces with water underneath.' },
          { number: 4, type: 'fill_blank', prompt: 'Why is Europa more likely than Enceladus to have life on it?', answer: 'Because Europa is billions of years older.' },
          { number: 5, type: 'fill_blank', prompt: 'Why might the planet orbiting Proxima Centauri support life?', answer: 'It may be warm enough for liquid water.' },
          { number: 6, type: 'fill_blank', prompt: 'How will scientists learn more about this planet?', answer: 'The James Webb Space Telescope will explore the area.' },
        ] },
        { section: '4', instruction: 'Circle the correct meaning of each word.', items: [
          { number: 1, type: 'multiple_choice', prompt: 'discover', answer: 'to find', options: ['to find', 'to give'] },
          { number: 2, type: 'multiple_choice', prompt: 'microscopic', answer: 'very small', options: ['very large', 'very small'] },
          { number: 3, type: 'multiple_choice', prompt: 'investigate', answer: 'to do research', options: ['to do research', 'to make a mistake'] },
          { number: 4, type: 'multiple_choice', prompt: 'orbit', answer: 'to go around something', options: ['to absorb', 'to go around something'] },
          { number: 5, type: 'multiple_choice', prompt: 'exist', answer: 'to be', options: ['to make', 'to be'] },
          { number: 6, type: 'multiple_choice', prompt: 'support', answer: "to give what's needed", options: ["to give what's needed", 'to make an effort'] },
          { number: 7, type: 'multiple_choice', prompt: 'surface', answer: 'the top of something', options: ['the inside of something', 'the top of something'] },
        ] },
      ] },
      { type: 'grammar', id: 'present-perfect-simple', eyebrow: '本课语法', title: 'Present perfect simple', grammarRefs: [
        { book: 'essential', unitNumber: 11, role: 'primary', label: '现在完成时（一）' }, { book: 'essential', unitNumber: 12, role: 'foundation', label: '现在完成时（二）' },
      ], summary: { cards: [
        { title: '构成', formula: 'have / has + 过去分词', signals: 'ever · never · already · just · for · since · yet', points: [{ label: '与现在有关的过去', text: 'Scientists have already spent much time looking for water.' }] },
        { title: '时间', points: [{ label: '开始于过去并持续', text: 'How long have human beings lived on Earth?' }, { label: '过去发生、结果影响现在', text: 'I’ve just found a really good website about astronomy.' }] },
      ], contrastTitle: '本课最重要的区别', contrasts: [{ example: 'He met Neil Armstrong.', note: '说清具体过去时间 → 一般过去时。' }, { example: "He’s met Neil Armstrong.", note: '不说具体时间、经历和现在有关 → 现在完成时。' }], decisionGuide: ['有 yesterday、last night、in 2018 等明确过去时间 → 一般过去时。', '强调经历、结果或延续到现在 → 现在完成时。'], reminders: ['have been 表示去过且已回来；have gone 表示去了还没回来。'] }, groups: [
        { section: '6', instruction: 'Complete the sentences with the past simple or present perfect simple.', items: [
          { number: 1, type: 'fill_blank', prompt: 'I ______ to go into outer space for years! (want)', answer: 'have wanted' },
          { number: 2, type: 'fill_blank', prompt: 'We ______ the TV programme about space last night. (watch)', answer: 'watched' },
          { number: 3, type: 'fill_blank', prompt: '______ people ______ Mars? (visit)', answer: 'Have people visited' },
          { number: 4, type: 'fill_blank', prompt: 'The astronauts ______ special food during their trip last month. (eat)', answer: 'ate' },
          { number: 5, type: 'fill_blank', prompt: 'Jack ______ to interview the scientists and he’ll be back later. (go)', answer: 'has gone' },
          { number: 6, type: 'fill_blank', prompt: 'Powerful telescopes like the James Webb Telescope ______ for long. (not exist)', answer: "haven't existed" },
        ] },
        { section: 'Prepositions A', instruction: 'Write the prepositions: for, in, on or with.', items: [
          { number: 1, type: 'fill_blank', prompt: 'concentrate ______', answer: 'on' }, { number: 2, type: 'fill_blank', prompt: 'congratulate ______', answer: 'on' }, { number: 3, type: 'fill_blank', prompt: 'deal ______', answer: 'with' }, { number: 4, type: 'fill_blank', prompt: 'depend ______', answer: 'on' }, { number: 5, type: 'fill_blank', prompt: 'search ______', answer: 'for' }, { number: 6, type: 'fill_blank', prompt: 'succeed ______', answer: 'in' },
        ] },
      ] },
    ],
  },
  {
    key: '5a-u2l3', stage: '5A', unit: 'Unit 2', lesson: 'Lesson 3', title: 'Technology Through Time',
    paragraphs: [
      "When people hear the word ‘technology’, many think of the newest, most modern robots or electronic gadgets. But technology is defined as the use of science to make new things and solve problems. People have always used technology to solve problems. Take a look at some technologies of the past that really changed how humans live.",
      'Around 2.6 million years ago, our ancestors began using simple stone tools as hammers and knives. This may be considered the earliest use of technology. Around 25,000 years ago, the sewing needle was invented, which means that it’s much easier for people to make and wear clothes, something that they had begun doing about 170,000 years ago.',
      'Around 5,500 years ago, the wheel was invented in Mesopotamia in 3500 BCE. This technology is originally developed for potters. It takes 300 years for the wheel to be used for transport. Around 600 years ago, in 1439, Johannes Gutenberg demonstrates the printing press. With this machine, it’s possible to create many copies of a paper in little time. The printing press leads to the spread of information through books and newspapers.',
      'Around 150 years ago, by the late 1800s, different inventors are working on the automobile. Karl Friedrich Benz creates the first automobile powered by petrol. It looks more like a bike than a car! Around 100 years ago, on 25 March 1925, John Logie Baird shows the first televised images in motion at a London department store. The invention of the TV set brings the world into people’s homes.',
      'Since the 1970s, the first mobile telephone call takes place in 1973, and mobile phones become more common by the mid-1980s. By 1993, the first smartphone is invented. These gadgets have since changed how we do almost everything!',
    ],
    glossary: [
      { word: 'Mesopotamia', meaningCn: '美索不达米亚（古代地区）', meaningEn: 'an ancient region in the Middle East', category: '专有名词', isProperNoun: true },
      { word: 'Johannes Gutenberg', meaningCn: '约翰内斯·古腾堡（印刷术发明者）', meaningEn: 'a German inventor of the printing press', category: '专有名词', isProperNoun: true },
      { word: 'Karl Friedrich Benz', meaningCn: '卡尔·弗里德里希·本茨（汽车先驱）', meaningEn: 'a German automobile inventor', category: '专有名词', isProperNoun: true },
      { word: 'John Logie Baird', meaningCn: '约翰·洛吉·贝尔德（电视先驱）', meaningEn: 'a television inventor', category: '专有名词', isProperNoun: true },
    ],
    learningSections: [
      { type: 'exercises', id: 'technology-impact', eyebrow: '课文理解', title: '发明及其影响', wordRefs: ['ancestor', 'hammer', 'sewing needle', 'printing press', 'automobile', 'gadget'].map((word) => ({ stage: '5A', unit: 'Unit 2', lesson: 'Lesson 3', word })), groups: [
        { section: '2', instruction: 'Match the invention with its impact.', items: [
          { number: 1, type: 'matching', prompt: 'stone tools', answer: 'Considered the earliest technology.', options: ['Changed how people communicate and use the Internet.', 'Brought the world into people’s living rooms.', 'Considered the earliest technology.', 'Made it easier to get from one place to another quickly.', 'Helped people make clothing.', 'Helped to develop transportation.', 'Helped spread information quickly in books and newspapers.'] },
          { number: 2, type: 'matching', prompt: 'sewing needle', answer: 'Helped people make clothing.', options: ['Changed how people communicate and use the Internet.', 'Brought the world into people’s living rooms.', 'Considered the earliest technology.', 'Made it easier to get from one place to another quickly.', 'Helped people make clothing.', 'Helped to develop transportation.', 'Helped spread information quickly in books and newspapers.'] },
          { number: 3, type: 'matching', prompt: 'wheel', answer: 'Helped to develop transportation.', options: ['Changed how people communicate and use the Internet.', 'Brought the world into people’s living rooms.', 'Considered the earliest technology.', 'Made it easier to get from one place to another quickly.', 'Helped people make clothing.', 'Helped to develop transportation.', 'Helped spread information quickly in books and newspapers.'] },
          { number: 4, type: 'matching', prompt: 'printing press', answer: 'Helped spread information quickly in books and newspapers.', options: ['Changed how people communicate and use the Internet.', 'Brought the world into people’s living rooms.', 'Considered the earliest technology.', 'Made it easier to get from one place to another quickly.', 'Helped people make clothing.', 'Helped to develop transportation.', 'Helped spread information quickly in books and newspapers.'] },
          { number: 5, type: 'matching', prompt: 'car', answer: 'Made it easier to get from one place to another quickly.', options: ['Changed how people communicate and use the Internet.', 'Brought the world into people’s living rooms.', 'Considered the earliest technology.', 'Made it easier to get from one place to another quickly.', 'Helped people make clothing.', 'Helped to develop transportation.', 'Helped spread information quickly in books and newspapers.'] },
          { number: 6, type: 'matching', prompt: 'TV', answer: 'Brought the world into people’s living rooms.', options: ['Changed how people communicate and use the Internet.', 'Brought the world into people’s living rooms.', 'Considered the earliest technology.', 'Made it easier to get from one place to another quickly.', 'Helped people make clothing.', 'Helped to develop transportation.', 'Helped spread information quickly in books and newspapers.'] },
          { number: 7, type: 'matching', prompt: 'mobile phone', answer: 'Changed how people communicate and use the Internet.', options: ['Changed how people communicate and use the Internet.', 'Brought the world into people’s living rooms.', 'Considered the earliest technology.', 'Made it easier to get from one place to another quickly.', 'Helped people make clothing.', 'Helped to develop transportation.', 'Helped spread information quickly in books and newspapers.'] },
        ] },
      ] },
      { type: 'grammar', id: 'so-and-such', eyebrow: '口语表达', title: 'Emphasising with so and such', grammarRefs: [{ book: 'essential', unitNumber: 99, role: 'primary', label: 'so 和 such' }], summary: { cards: [
        { title: 'so', formula: 'so + adjective / adverb', points: [{ label: '强调形容词或副词', text: 'He’s so clever! He drove here so quickly!' }] },
        { title: 'such', formula: 'such a/an + adjective + singular noun', points: [{ label: '强调名词短语', text: 'That’s such a nice phone!' }, { label: '不可数或复数名词', text: 'That’s such good news! They’re such smart robots!' }] },
      ], contrastTitle: '本课最重要的区别', contrasts: [{ example: 'It works so quickly.', note: 'quickly 是副词，用 so。' }, { example: 'It has such a small screen.', note: 'a small screen 是名词短语，用 such。' }], decisionGuide: ['形容词或副词前 → so。', 'a/an + 形容词 + 单数名词，或形容词 + 不可数/复数名词前 → such。'], reminders: ['不要说 so a small screen。'] }, groups: [
        { section: 'Say it like this', instruction: 'Use the dialogue pattern to make a new dialogue about a gadget.', items: [
          { number: 1, type: 'fill_blank', prompt: 'Have you seen my new phone? It works ______ quickly!', answer: 'so' },
          { number: 2, type: 'fill_blank', prompt: "And it's got ______ a small screen, too!", answer: 'such' },
          { number: 3, type: 'fill_blank', prompt: "It's ______ useful because I can take it with me everywhere.", answer: 'so' },
          { number: 4, type: 'fill_blank', prompt: "And it's got ______ fun games on it!", answer: 'such' },
        ] },
      ] },
      { type: 'writing', id: 'new-gadget-email', eyebrow: '写作', title: 'Write an email about a new gadget', prompt: 'Write an email to a friend about a new gadget that you have got. Use ordering words and also / too to organise your ideas.', questions: ['Paragraph 1: Say hello, ask how your friend is, and say what you have been doing.', 'Paragraph 2: Introduce the new gadget; explain what it does and why you wanted it.', 'Paragraph 3: Describe it and give some details.', 'Paragraph 4: Say how much it cost and where you got it.', 'Closing: Say goodbye to your friend.'], suggestedWords: ['Firstly', 'First of all', 'To start with', 'Secondly', 'In addition', 'Finally', 'also', 'too', 'gadget', 'useful'], modelAnswer: [
        'Hi Jiro,\n\nWhat have you been doing? I’ve been busy with my new gadget.',
        'Firstly, I got a small drone. It comes with a camera, so I can fly it high in the sky and take photos from above.',
        'Secondly, it has a video camera, too. It’s so useful because it is small and doesn’t use much power. In addition, I can control it with my smartphone.',
        'Finally, it wasn’t very expensive. I bought it online with my own money. I can send you the link if you want one, too.',
        'Talk soon,\nKen',
      ] },
    ],
  },
  // 5A Units 3–5: transcribed from IMG_1836–IMG_1856 (1838 supplied separately).
  // Pages: U3 28–33; U4 36–41; U5 48–53. Duplicate photos are merged.
  // Listening-only tasks and handwritten annotations are excluded.
  // Open questions use answer: '' and visible reference options, not exact-match grading.
  // Cambridge references: official Essential Grammar in Use contents (4th edition):
  // https://assets.cambridge.org/97811074/80537/frontmatter/9781107480537_frontmatter.pdf
  // Intermediate extensions follow English Grammar in Use Units 9, 10, 15, 20, 23, 24.
  {
    "key": "5a-u3l1",
    "stage": "5A",
    "unit": "Unit 3",
    "lesson": "Lesson 1",
    "title": "What To Do About Wildfires",
    "paragraphs": [
      "Nature can be beautiful, but it can also be dangerous. Take wildfires, for example. More and more wildfires have been burning recently. They’ve burnt millions of hectares in the last few years. Wildfires occur most often in the western USA, but they can happen anywhere.",
      "Natural causes like lightning and hot sun have caused wildfires, but most wildfires are started by humans. Once a wildfire starts, it burns anything in its path such as trees, bushes and even buildings. Dry weather and high winds help wildfires spread, and they can move very quickly, up to 23 km (14 mi.) an hour.",
      "So, what should you do to prevent a wildfire? First, always be careful around fire. Follow fire safety rules in parks and public areas, especially when camping. And if you do make a fire outdoors, be sure that you put it out completely. Even if you’re careful, you should be prepared for a wildfire. If one starts in your area, check TV, radio and emergency alerts on smartphones to learn what to do. Pay attention to the fire and communicate with emergency workers. Always follow their instructions.",
      "Wildfires can be scary, but did you know they can actually help a forest? The fire kills sick plants and harmful insects that have been living in the forest’s ecosystem. Certain animals do better in the burnt-out habitat that fires create. And by burning trees and their leaves, wildfires allow sunlight to reach the forest floor, so light can reach seedlings and help them grow into new plants. Wildfires are dangerous and can cause a lot of damage. But they’re also a part of the natural world, and they can be healthy for a forest. So, we can’t simply view them as destruction, but also as nature making room for new beginnings."
    ],
    "learningSections": [
      {
        "type": "exercises",
        "id": "reading-comprehension",
        "eyebrow": "总结",
        "title": "理解野火的成因、预防与影响",
        "groups": [
          {
            "section": "4",
            "bookPage": 28,
            "instruction": "Answer the questions. Use evidence from the article.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "Where do wildfires occur most often?",
                "answer": "",
                "options": [
                  "参考：In the western USA."
                ]
              },
              {
                "number": 2,
                "type": "short_answer",
                "prompt": "What are two natural causes of wildfires?",
                "answer": "",
                "options": [
                  "参考：Lightning and hot sun."
                ]
              },
              {
                "number": 3,
                "type": "short_answer",
                "prompt": "How are most wildfires started?",
                "answer": "",
                "options": [
                  "参考：They are started by humans."
                ]
              },
              {
                "number": 4,
                "type": "short_answer",
                "prompt": "What can you do to prevent wildfires?",
                "answer": "",
                "options": [
                  "参考：Be careful around fire, follow fire safety rules and put outdoor fires out completely."
                ]
              },
              {
                "number": 5,
                "type": "short_answer",
                "prompt": "What should you do if a wildfire burns nearby?",
                "answer": "",
                "options": [
                  "参考：Check emergency alerts and follow emergency workers’ instructions."
                ]
              },
              {
                "number": 6,
                "type": "short_answer",
                "prompt": "What are two ways that a wildfire can help a forest?",
                "answer": "",
                "options": [
                  "参考：It kills sick plants and harmful insects, and allows sunlight to reach seedlings."
                ]
              }
            ]
          },
          {
            "section": "10",
            "bookPage": 29,
            "instruction": "Discuss with a partner. These are open questions.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "What kind of natural disasters have happened in your country recently?",
                "answer": ""
              },
              {
                "number": 2,
                "type": "short_answer",
                "prompt": "What happened?",
                "answer": ""
              },
              {
                "number": 3,
                "type": "short_answer",
                "prompt": "What did people do to help?",
                "answer": ""
              },
              {
                "number": 4,
                "type": "short_answer",
                "prompt": "What have people been doing to prevent another similar disaster?",
                "answer": ""
              }
            ]
          }
        ]
      },
      {
        "type": "grammar",
        "id": "present-perfect-continuous",
        "eyebrow": "语法",
        "title": "Present perfect continuous",
        "groups": [
          {
            "section": "5",
            "bookPage": 29,
            "instruction": "Find the present perfect continuous verbs in the article. How many are there?",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "Write the verb phrases and their number.",
                "answer": "",
                "options": [
                  "参考：Two: have been burning; have been living."
                ]
              }
            ]
          },
          {
            "section": "6",
            "bookPage": 29,
            "instruction": "Complete with the present perfect continuous: build, burn, clean, not rain, not watch, work.",
            "items": [
              {
                "number": 1,
                "type": "fill_blank",
                "prompt": "My hands are dirty because I ______ up from the fire.",
                "answer": "have been cleaning"
              },
              {
                "number": 2,
                "type": "fill_blank",
                "prompt": "We ______ TV recently, so we didn’t know about the fire.",
                "answer": "haven’t been watching\nhave not been watching"
              },
              {
                "number": 3,
                "type": "fill_blank",
                "prompt": "______ the fire ______ all night?",
                "answer": "Has; been burning"
              },
              {
                "number": 4,
                "type": "fill_blank",
                "prompt": "The weather’s been cool, but it ______.",
                "answer": "hasn’t been raining\nhas not been raining"
              },
              {
                "number": 5,
                "type": "fill_blank",
                "prompt": "The birds ______ a nest in that tree since yesterday.",
                "answer": "have been building"
              },
              {
                "number": 6,
                "type": "fill_blank",
                "prompt": "______ you ______ as a firefighter for many years?",
                "answer": "Have; been working"
              }
            ]
          }
        ],
        "grammarRefs": [
          {
            "book": "intermediate",
            "unitNumber": 9,
            "role": "extension",
            "label": "中级：现在完成进行时"
          },
          {
            "book": "essential",
            "unitNumber": 19,
            "role": "foundation",
            "label": "for / since / ago"
          }
        ],
        "summary": {
          "cards": [
            {
              "title": "从过去持续到现在",
              "formula": "have / has been + verb-ing",
              "signals": "all day / night / week · for · since · lately · recently",
              "points": [
                {
                  "label": "持续的动作",
                  "text": "He’s been working really hard all summer."
                },
                {
                  "label": "最近反复发生",
                  "text": "They’ve been communicating with firefighters in recent weeks."
                }
              ]
            },
            {
              "title": "询问持续时间",
              "formula": "How long have / has ... been + verb-ing?",
              "signals": "for + 时间段 · since + 起点",
              "points": [
                {
                  "label": "时间段",
                  "text": "We’ve been watching the fire burn for two hours."
                },
                {
                  "label": "起点",
                  "text": "They’ve been helping out in the forests since 2008."
                }
              ]
            }
          ],
          "contrastTitle": "关键区别",
          "contrasts": [
            {
              "example": "They’ve burnt millions of hectares.",
              "note": "现在完成时强调结果：烧毁了多少。"
            },
            {
              "example": "More and more wildfires have been burning recently.",
              "note": "现在完成进行时强调近期持续或反复发生。"
            }
          ],
          "decisionGuide": [
            "强调从过去延续到现在的活动或最近反复发生的活动 → have / has been + -ing。",
            "问持续多久用 How long；时间段前用 for，起点前用 since。"
          ],
          "reminders": [
            "for (very) long 常用于疑问句和否定句。中级拓展单元需对应书籍已录入后使用。"
          ]
        }
      },
      {
        "type": "exercises",
        "id": "place-vocabulary",
        "eyebrow": "词汇",
        "title": "野火与自然灾害词汇",
        "groups": [
          {
            "section": "3",
            "bookPage": 28,
            "instruction": "Write the word: burning, caused, damage, emergency, prevent, put out, spread.",
            "items": [
              {
                "number": 1,
                "type": "fill_blank",
                "prompt": "How can we ______ wildfires from starting?",
                "answer": "prevent"
              },
              {
                "number": 2,
                "type": "fill_blank",
                "prompt": "Please use this bucket of water to ______ the fire.",
                "answer": "put out"
              },
              {
                "number": 3,
                "type": "fill_blank",
                "prompt": "A wildfire has been ______ in this area for three weeks.",
                "answer": "burning"
              },
              {
                "number": 4,
                "type": "fill_blank",
                "prompt": "When you have an ______, you must call for help.",
                "answer": "emergency"
              },
              {
                "number": 5,
                "type": "fill_blank",
                "prompt": "Last month’s fire ______ 100 million euros’ worth of ______.",
                "answer": "caused; damage"
              },
              {
                "number": 6,
                "type": "fill_blank",
                "prompt": "The fire started in the garage and quickly ______ through the rest of the house.",
                "answer": "spread"
              }
            ]
          },
          {
            "section": "8",
            "bookPage": 29,
            "instruction": "Match each definition to a natural disaster.",
            "items": [
              {
                "number": 1,
                "type": "matching",
                "prompt": "When the ocean’s water comes onto the land",
                "answer": "tsunami",
                "options": [
                  "wildfire",
                  "tsunami",
                  "hurricane",
                  "flood",
                  "drought",
                  "volcano"
                ]
              },
              {
                "number": 2,
                "type": "matching",
                "prompt": "When rain fills buildings and streets with water",
                "answer": "flood",
                "options": [
                  "wildfire",
                  "tsunami",
                  "hurricane",
                  "flood",
                  "drought",
                  "volcano"
                ]
              },
              {
                "number": 3,
                "type": "matching",
                "prompt": "A long period of very dry weather",
                "answer": "drought",
                "options": [
                  "wildfire",
                  "tsunami",
                  "hurricane",
                  "flood",
                  "drought",
                  "volcano"
                ]
              },
              {
                "number": 4,
                "type": "matching",
                "prompt": "A mountain that lets out fiery hot liquid",
                "answer": "volcano",
                "options": [
                  "wildfire",
                  "tsunami",
                  "hurricane",
                  "flood",
                  "drought",
                  "volcano"
                ]
              },
              {
                "number": 5,
                "type": "matching",
                "prompt": "A fire that is not under control",
                "answer": "wildfire",
                "options": [
                  "wildfire",
                  "tsunami",
                  "hurricane",
                  "flood",
                  "drought",
                  "volcano"
                ]
              },
              {
                "number": 6,
                "type": "matching",
                "prompt": "A large storm with strong winds and rain",
                "answer": "hurricane",
                "options": [
                  "wildfire",
                  "tsunami",
                  "hurricane",
                  "flood",
                  "drought",
                  "volcano"
                ]
              }
            ]
          }
        ],
        "wordRefs": [
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 1",
            "word": "burn"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 1",
            "word": "cause"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 1",
            "word": "damage"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 1",
            "word": "emergency"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 1",
            "word": "prevent"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 1",
            "word": "put out"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 1",
            "word": "spread"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 1",
            "word": "drought"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 1",
            "word": "flood"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 1",
            "word": "hurricane"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 1",
            "word": "tsunami"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 1",
            "word": "volcano"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 1",
            "word": "wildfire"
          }
        ]
      },
      {
        "type": "writing",
        "id": "natural-disaster-writing",
        "eyebrow": "写作",
        "title": "Write about a natural disaster",
        "prompt": "Write a short paragraph about the natural disaster you discussed in Activity 10. The model below is an example, not a report of a real event.",
        "questions": [
          "What happened and where?",
          "What did people do to help?",
          "What have people been doing to prevent a similar disaster?"
        ],
        "suggestedWords": [
          "flood",
          "damage",
          "emergency",
          "prevent",
          "have been helping"
        ],
        "modelAnswer": [
          "Last month, heavy rain caused a flood in a small town. Water filled the streets and damaged some houses. Emergency workers helped people get to safe places. Since then, people have been cleaning the streets and repairing their homes. They have also been checking the drains to help prevent another flood."
        ]
      }
    ]
  },
  {
    "key": "5a-u3l2",
    "stage": "5A",
    "unit": "Unit 3",
    "lesson": "Lesson 2",
    "title": "Nature’s Creative Creatures",
    "paragraphs": [
      "You’ve probably learnt a lot about animals, but we bet you haven’t been studying animals as unusual as these. Here are three unusual creatures found in nature.",
      "This unusual Australian animal seems to have parts from other, more common species: a duck’s bill, a body covered with fur, and a beaver-like tail.",
      "The platypus is a good swimmer, but it also lives on land. Its webbed feet change when it’s on land to help it run. The platypus is a mammal – mothers nurse their babies for about four months. But what’s unusual about this mammal is that it lays eggs!",
      "The short-horned lizard lives in North America. It’s got horns on its head and back, and a body covered in scales. What makes the short-horned lizard different from other reptiles is how it defends itself. It can blow its body up so it looks like a spiked balloon. If that doesn’t work, it shoots blood from its eyes to trick predators. It can shoot the blood from 1 m (3 ft) away!",
      "Don’t judge this bird by its colourful appearance. Although it looks bright and cheerful, the king vulture has got a pretty disgusting job: it eats dead animals. By eating these bodies, the king vulture cleans up the forest floor in Central and South America, where it lives. This helps prevent the spread of disease. The vulture’s brightly coloured head is bald, and this lack of feathers helps it stay clean while it eats. Plus, it’s got a very strong beak and claws, which are also useful at mealtimes.",
      "The duck-billed platypus might look very cute, but be careful! The male platypus is poisonous and its sting can be deadly."
    ],
    "learningSections": [
      {
        "type": "exercises",
        "id": "reading-comprehension",
        "eyebrow": "总结",
        "title": "奇特动物的生存本领",
        "groups": [
          {
            "section": "3",
            "bookPage": 30,
            "instruction": "Choose the correct answer.",
            "items": [
              {
                "number": 1,
                "type": "multiple_choice",
                "prompt": "What’s a mammal?",
                "answer": "an animal that gets milk from its mother",
                "options": [
                  "an animal with scales",
                  "an animal that gets milk from its mother"
                ]
              },
              {
                "number": 2,
                "type": "multiple_choice",
                "prompt": "What’s unusual about a platypus’s feet?",
                "answer": "They change on land and in water.",
                "options": [
                  "They change on land and in water.",
                  "They’ve got strong claws."
                ]
              },
              {
                "number": 3,
                "type": "multiple_choice",
                "prompt": "How does the king vulture help its habitat?",
                "answer": "It prevents the spread of disease.",
                "options": [
                  "It makes it more colourful.",
                  "It prevents the spread of disease."
                ]
              },
              {
                "number": 4,
                "type": "multiple_choice",
                "prompt": "Which is one way the short-horned lizard defends itself?",
                "answer": "It shoots blood from its eyes.",
                "options": [
                  "It covers itself in scales.",
                  "It shoots blood from its eyes."
                ]
              },
              {
                "number": 5,
                "type": "multiple_choice",
                "prompt": "Which type of animal commonly lays eggs?",
                "answer": "reptiles",
                "options": [
                  "reptiles",
                  "mammals"
                ]
              }
            ]
          },
          {
            "section": "8",
            "bookPage": 31,
            "instruction": "Write two things each animal has got. Use beak, bill, claw, fur, horn, scales and any others you know.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "lion",
                "answer": "",
                "options": [
                  "参考：For example: fur and claws."
                ]
              },
              {
                "number": 2,
                "type": "short_answer",
                "prompt": "penguin",
                "answer": "",
                "options": [
                  "参考：For example: a beak and feathers."
                ]
              },
              {
                "number": 3,
                "type": "short_answer",
                "prompt": "snake",
                "answer": "",
                "options": [
                  "参考：For example: scales and a tail."
                ]
              },
              {
                "number": 4,
                "type": "short_answer",
                "prompt": "rhinoceros",
                "answer": "",
                "options": [
                  "参考：For example: a horn and a tail."
                ]
              },
              {
                "number": 5,
                "type": "short_answer",
                "prompt": "platypus",
                "answer": "",
                "options": [
                  "参考：For example: a bill and fur."
                ]
              }
            ]
          }
        ]
      },
      {
        "type": "grammar",
        "id": "perfect-simple-vs-continuous",
        "eyebrow": "语法",
        "title": "Present perfect simple and continuous",
        "groups": [
          {
            "section": "5",
            "bookPage": 31,
            "instruction": "Circle the correct words.",
            "items": [
              {
                "number": 1,
                "type": "multiple_choice",
                "prompt": "Have you ever ______ a vet?",
                "answer": "met",
                "options": [
                  "met",
                  "been meeting"
                ]
              },
              {
                "number": 2,
                "type": "multiple_choice",
                "prompt": "I have ______ for this species of lizard all year.",
                "answer": "been searching",
                "options": [
                  "searched",
                  "been searching"
                ]
              },
              {
                "number": 3,
                "type": "multiple_choice",
                "prompt": "Ky has ______ the film about Australian animals four times.",
                "answer": "watched",
                "options": [
                  "been watching",
                  "watched"
                ]
              },
              {
                "number": 4,
                "type": "multiple_choice",
                "prompt": "Have you ever ______ about the echidna? It’s another egg-laying mammal.",
                "answer": "read",
                "options": [
                  "read",
                  "been reading"
                ]
              },
              {
                "number": 5,
                "type": "multiple_choice",
                "prompt": "We’ve ______ about mammals in science all term.",
                "answer": "been learning",
                "options": [
                  "been learning",
                  "learnt"
                ]
              },
              {
                "number": 6,
                "type": "multiple_choice",
                "prompt": "They’ve just ______ a new species of frog.",
                "answer": "found",
                "options": [
                  "been finding",
                  "found"
                ]
              }
            ]
          },
          {
            "section": "6",
            "bookPage": 31,
            "instruction": "Complete the dialogue with the present perfect simple or continuous.",
            "items": [
              {
                "number": 1,
                "type": "fill_blank",
                "prompt": "Theo: You look so tired, Emma! What ______? (you/do)",
                "answer": "have you been doing"
              },
              {
                "number": 2,
                "type": "fill_blank",
                "prompt": "Emma: I ______ on my unusual animal project. (work)",
                "answer": "have been working"
              },
              {
                "number": 3,
                "type": "fill_blank",
                "prompt": "But I ______ it yet. (not finish)",
                "answer": "haven’t finished\nhave not finished"
              },
              {
                "number": 4,
                "type": "fill_blank",
                "prompt": "I ______ for information online all morning. (search)",
                "answer": "have been searching"
              },
              {
                "number": 5,
                "type": "fill_blank",
                "prompt": "Theo: ______ your animal? (you/choose)",
                "answer": "Have you chosen"
              },
              {
                "number": 6,
                "type": "fill_blank",
                "prompt": "Emma: Yes, I have. I ______ to write about the naked mole rat. (decide)",
                "answer": "have decided"
              },
              {
                "number": 7,
                "type": "fill_blank",
                "prompt": "Theo: Really? I ______ of them before. (hear)",
                "answer": "haven’t heard\nhave not heard"
              },
              {
                "number": 8,
                "type": "fill_blank",
                "prompt": "Emma: I saw one at the zoo last year. And since then I ______ to know more about them. (want)",
                "answer": "have wanted"
              }
            ]
          }
        ],
        "grammarRefs": [
          {
            "book": "intermediate",
            "unitNumber": 10,
            "role": "extension",
            "label": "中级：现在完成进行时与现在完成时"
          },
          {
            "book": "essential",
            "unitNumber": 18,
            "role": "foundation",
            "label": "How long have you ...?"
          }
        ],
        "summary": {
          "cards": [
            {
              "title": "结果与数量",
              "formula": "have / has + past participle",
              "signals": "how many · how much · how many times · just · ever",
              "points": [
                {
                  "label": "已完成",
                  "text": "I’ve read a book about reptiles. (= I’ve finished the book.)"
                },
                {
                  "label": "数量",
                  "text": "How many books about birds have you read?"
                }
              ]
            },
            {
              "title": "活动与持续时间",
              "formula": "have / has been + verb-ing",
              "signals": "how long · all day · all morning · all year",
              "points": [
                {
                  "label": "活动过程",
                  "text": "I’ve been reading a great book about volcanoes."
                },
                {
                  "label": "持续的活动",
                  "text": "I’m tired because I’ve been planting trees all day."
                }
              ]
            }
          ],
          "contrastTitle": "关键区别",
          "contrasts": [
            {
              "example": "I’ve read a book about reptiles.",
              "note": "着重完成的结果。"
            },
            {
              "example": "How long have you been reading your book?",
              "note": "着重阅读持续多久。"
            }
          ],
          "decisionGuide": [
            "问完成了多少或几次 → 现在完成时。",
            "问活动持续多久或解释活动造成的现状 → 现在完成进行时。",
            "want 等状态动词一般不用进行时。"
          ],
          "reminders": [
            "教材第 6 题第 7 空括号为 hear；句意为“以前没听说过”，需使用否定形式。"
          ]
        }
      },
      {
        "type": "exercises",
        "id": "place-vocabulary",
        "eyebrow": "词汇",
        "title": "动物特征与短语动词",
        "groups": [
          {
            "section": "4",
            "bookPage": 30,
            "instruction": "Write the word for each meaning.",
            "items": [
              {
                "number": 1,
                "type": "fill_blank",
                "prompt": "The way something looks: ______",
                "answer": "appearance"
              },
              {
                "number": 2,
                "type": "fill_blank",
                "prompt": "The group of scaly animals that includes snakes and lizards: ______",
                "answer": "reptiles"
              },
              {
                "number": 3,
                "type": "fill_blank",
                "prompt": "A group of animals related to each other (i.e. dogs, wolves): ______",
                "answer": "species"
              },
              {
                "number": 4,
                "type": "fill_blank",
                "prompt": "The group of animals that get milk from their mothers: ______",
                "answer": "mammals"
              },
              {
                "number": 5,
                "type": "fill_blank",
                "prompt": "An animal that hunts other animals: ______",
                "answer": "predator"
              },
              {
                "number": 6,
                "type": "fill_blank",
                "prompt": "To protect oneself: ______",
                "answer": "defend"
              }
            ]
          },
          {
            "section": "Phrasal verbs",
            "bookPage": 31,
            "instruction": "Complete with: answer for, cut down on, die out, get across, look into, run out of.",
            "items": [
              {
                "number": 1,
                "type": "fill_blank",
                "prompt": "Some species will ______ if we don’t act.",
                "answer": "die out"
              },
              {
                "number": 2,
                "type": "fill_blank",
                "prompt": "We must ______ protecting endangered animals.",
                "answer": "look into"
              },
              {
                "number": 3,
                "type": "fill_blank",
                "prompt": "Changing habitats may cause some animals to ______ food.",
                "answer": "run out of"
              },
              {
                "number": 4,
                "type": "fill_blank",
                "prompt": "How can we ______ the important messages about the environment ______ to everybody?",
                "answer": "get; across"
              },
              {
                "number": 5,
                "type": "fill_blank",
                "prompt": "In the future, we’ll have to ______ the things we do wrong today.",
                "answer": "answer for"
              },
              {
                "number": 6,
                "type": "fill_blank",
                "prompt": "I want to ______ the number of plastic bags I use because they can harm animals.",
                "answer": "cut down on"
              }
            ]
          }
        ],
        "wordRefs": [
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 2",
            "word": "appearance"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 2",
            "word": "defend"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 2",
            "word": "mammal"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 2",
            "word": "predator"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 2",
            "word": "reptile"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 2",
            "word": "species"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 2",
            "word": "beak"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 2",
            "word": "bill"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 2",
            "word": "claw"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 2",
            "word": "fur"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 2",
            "word": "horn"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 2",
            "word": "scales"
          }
        ]
      }
    ],
    "paragraphTitles": [
      "",
      "Duck-billed platypus",
      "",
      "Short-horned lizard",
      "King vulture",
      "Guess what!"
    ],
    "glossary": [
      {
        "word": "platypus",
        "meaningCn": "n. 鸭嘴兽",
        "meaningEn": "an Australian egg-laying mammal with a duck-like bill",
        "category": "超纲词汇"
      },
      {
        "word": "vulture",
        "meaningCn": "n. 秃鹫",
        "meaningEn": "a bird that feeds on dead animals",
        "category": "超纲词汇"
      }
    ]
  },
  {
    "key": "5a-u3l3",
    "stage": "5A",
    "unit": "Unit 3",
    "lesson": "Lesson 3",
    "title": "Amelie’s Iceland Journal",
    "paragraphs": [
      "I’m so excited to be in Iceland this weekend. This morning, we got on a bus to the southern coast, to see some of Iceland’s natural beauty. We’re going to try to see the Northern Lights tomorrow night. Even if we don’t see them, I’ve already seen some of the most amazing sights on the journey.",
      "We stopped in a national park today and explored an ice cave. They call it the ‘Crystal Cave’ because the ice is as clear as crystal. Exploring ice caves can be dangerous, so we went with a guide. We had to wear special boots – the least comfortable boots I’ve ever worn – but it was worth it.",
      "Today we explored the Jökulsárlón glacier lagoon. It’s a large lake made from melted glaciers, and the coldest lake I’ve ever visited! I did NOT want to go swimming. We also saw waterfalls and a black sand beach. It was nothing like the beaches near us. The guide said it was called ‘Diamond Beach’, because the black sand shines like diamonds.",
      "At night, we went out to look for the Northern Lights. They occur when the Sun’s energy meets certain gases in the Earth’s atmosphere. It’s hard to know when they’ll appear. But we got lucky and saw them our first night. They were green and purple. It was incredible – a light show by nature. I’ve never seen anything more amazing in my life!",
      "Sadly, we’re leaving tomorrow. It went too fast, but I’ll remember this weekend better than any other. It was amazing!"
    ],
    "learningSections": [
      {
        "type": "exercises",
        "id": "reading-comprehension",
        "eyebrow": "总结",
        "title": "冰岛的自然景观",
        "groups": [
          {
            "section": "2",
            "bookPage": 32,
            "instruction": "Answer the questions.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "What did Amelie do first in Iceland?",
                "answer": "",
                "options": [
                  "参考：She got on a bus to the southern coast."
                ]
              },
              {
                "number": 2,
                "type": "short_answer",
                "prompt": "Why did she need a guide to explore the ice cave?",
                "answer": "",
                "options": [
                  "参考：Exploring ice caves can be dangerous."
                ]
              },
              {
                "number": 3,
                "type": "short_answer",
                "prompt": "What’s a glacier lagoon?",
                "answer": "",
                "options": [
                  "参考：A large lake made from melted glaciers."
                ]
              },
              {
                "number": 4,
                "type": "short_answer",
                "prompt": "Why was the beach called ‘Diamond Beach’?",
                "answer": "",
                "options": [
                  "参考：Because the black sand shines like diamonds."
                ]
              },
              {
                "number": 5,
                "type": "short_answer",
                "prompt": "When do the Northern Lights appear?",
                "answer": "",
                "options": [
                  "参考：When the Sun’s energy meets certain gases in the Earth’s atmosphere."
                ]
              }
            ]
          },
          {
            "section": "Say it like this",
            "bookPage": 32,
            "instruction": "Talk about what is or isn’t worth doing when travelling. Use: It’s worth + verb-ing because ... / It isn’t worth + verb-ing because ...",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "Would you like to see the places in Amelie’s journal? Why or why not?",
                "answer": ""
              },
              {
                "number": 2,
                "type": "short_answer",
                "prompt": "Discuss going by bus, taking photos, staying in a nice hotel, renting a bike, eating at restaurants and seeing sights.",
                "answer": ""
              }
            ]
          }
        ]
      },
      {
        "type": "grammar",
        "id": "comparatives-superlatives",
        "eyebrow": "语法",
        "title": "Comparatives and superlatives",
        "groups": [
          {
            "section": "3",
            "bookPage": 33,
            "instruction": "Complete with the comparative or superlative form.",
            "items": [
              {
                "number": 1,
                "type": "fill_blank",
                "prompt": "People should try ______ (hard) than they already do to look after the environment.",
                "answer": "harder"
              },
              {
                "number": 2,
                "type": "fill_blank",
                "prompt": "One of the ______ (big) problems is pollution from cars.",
                "answer": "biggest"
              },
              {
                "number": 3,
                "type": "fill_blank",
                "prompt": "People use their cars ______ (frequently) than they need to.",
                "answer": "more frequently"
              },
              {
                "number": 4,
                "type": "fill_blank",
                "prompt": "Public transport is often ______ (fast) and ______ (cheap) than it was in the past.",
                "answer": "faster; cheaper"
              },
              {
                "number": 5,
                "type": "fill_blank",
                "prompt": "They should go to the ______ (near) park and explore it.",
                "answer": "nearest"
              },
              {
                "number": 6,
                "type": "fill_blank",
                "prompt": "Some of ______ (beautiful) sights in nature, like caves, waterfalls and cliffs, can be seen at a park.",
                "answer": "the most beautiful"
              },
              {
                "number": 7,
                "type": "fill_blank",
                "prompt": "Once people understand the natural world ______ (good), they learn to take care of it.",
                "answer": "better"
              }
            ]
          }
        ],
        "grammarRefs": [
          {
            "book": "essential",
            "unitNumber": 87,
            "role": "foundation",
            "label": "比较级的构成"
          },
          {
            "book": "essential",
            "unitNumber": 89,
            "role": "foundation",
            "label": "not as ... as"
          },
          {
            "book": "essential",
            "unitNumber": 90,
            "role": "primary",
            "label": "最高级"
          }
        ],
        "summary": {
          "cards": [
            {
              "title": "比较两者",
              "formula": "-er / more ... than · (not) as ... as",
              "signals": "than · as ... as",
              "points": [
                {
                  "label": "短形容词或副词",
                  "text": "Jan can cycle faster than Mick."
                },
                {
                  "label": "长形容词或副词",
                  "text": "Exploring ice caves is more difficult than exploring ordinary caves."
                },
                {
                  "label": "同级比较",
                  "text": "The bus is as quick as the car in traffic."
                }
              ]
            },
            {
              "title": "与一组比较",
              "formula": "the + -est / most",
              "signals": "in my class · of all",
              "points": [
                {
                  "label": "最高级",
                  "text": "Lily is the oldest girl in my class."
                },
                {
                  "label": "副词最高级",
                  "text": "Helen works the most carefully of all my students."
                }
              ]
            }
          ],
          "contrastTitle": "关键区别",
          "contrasts": [
            {
              "example": "My computer is slower than yours.",
              "note": "两者比较用比较级。"
            },
            {
              "example": "Science is the most interesting lesson.",
              "note": "一组中最突出用最高级。"
            }
          ],
          "decisionGuide": [
            "先判断比较两者还是在一组中比较。",
            "短词常加 -er/-est，长词常用 more/most；同等程度用 as ... as。"
          ],
          "reminders": [
            "good / well → better → best；bad / badly → worse → worst；far → further → furthest；many / much → more → most；little → less → least。"
          ]
        }
      },
      {
        "type": "exercises",
        "id": "place-vocabulary",
        "eyebrow": "词汇",
        "title": "表达观点与教材范文",
        "groups": [
          {
            "section": "Writing A",
            "bookPage": 33,
            "instruction": "Practise giving your opinion with: I (really) think/believe ...; In my opinion/view, ...; It is/isn’t true that ...; I agree/disagree that ...",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "Give your opinion about a natural place you know.",
                "answer": ""
              }
            ]
          },
          {
            "section": "Writing B",
            "bookPage": 33,
            "instruction": "Read the model letter and identify phrases expressing opinions.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "Dear Sir or Madam,\n\nIn last month’s magazine, you asked for readers to suggest new Natural Wonders of the World. I really think that the national park on my island should be a natural wonder. I’m talking about El Yunque National Forest, in Puerto Rico.\n\nIt’s true that the park isn’t the biggest. It’s only about 12,000 hectares. Even though it’s small, it’s got beautiful caves and waterfalls, as well as a big variety of plants and animals. There are hundreds of types of trees, and many rare plants. Lots of reptiles, birds and mammals live in the forest, but El Yunque is best known for the coquí frog. In my view, this is the cutest frog you’ll ever see. Some people don’t like its noise, but I disagree. It sounds like music to me.\n\nIn addition to everything above, I really believe that El Yunque is one of the safest rain forests in the world. There are lots of people, and none of its animals is poisonous. In my opinion, El Yunque deserves to be a Natural Wonder!\n\nYours faithfully,\nYanira",
                "answer": "",
                "options": [
                  "参考：I really think; It’s true that; In my view; I disagree; I really believe; In my opinion."
                ]
              }
            ]
          }
        ],
        "wordRefs": [
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 3",
            "word": "incredible"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 3",
            "word": "beauty"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 3",
            "word": "crystal"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 3",
            "word": "lagoon"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 3",
            "word": "melt"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 3",
            "word": "diamond"
          },
          {
            "stage": "5A",
            "unit": "Unit 3",
            "lesson": "Lesson 3",
            "word": "gas"
          }
        ]
      },
      {
        "type": "writing",
        "id": "natural-wonder-letter",
        "eyebrow": "写作",
        "title": "Nominate a Natural Wonder",
        "prompt": "Write a letter to a magazine nominating a place you know to be a Natural Wonder. Use opinion phrases, then check them as in Activity D.",
        "questions": [
          "Paragraph 1: Mention the contest and name the place.",
          "Paragraph 2: Explain why you are nominating it and why it should be a Natural Wonder.",
          "Paragraph 3: Summarise your argument."
        ],
        "suggestedWords": [
          "I really think",
          "In my view",
          "In my opinion",
          "I believe",
          "beautiful",
          "incredible"
        ],
        "modelAnswer": [
          "Dear Sir or Madam,\n\nYou asked readers to suggest a new Natural Wonder. I really think that the lake near my town should win.",
          "In my view, it is the most beautiful place in our area. The water is clear, and tall trees grow around it. Many birds live there. I believe that it is a wonderful place to learn about nature.",
          "In my opinion, this lake deserves to be a Natural Wonder because of its beauty and wildlife.\n\nYours faithfully,\nRosie"
        ]
      }
    ],
    "paragraphTitles": [
      "2 January",
      "",
      "3 January",
      "",
      ""
    ],
    "glossary": [
      {
        "word": "Jökulsárlón",
        "meaningCn": "杰古沙龙冰河湖（冰岛）",
        "meaningEn": "a glacier lagoon in Iceland",
        "category": "专有名词",
        "isProperNoun": true
      },
      {
        "word": "Northern Lights",
        "meaningCn": "北极光",
        "meaningEn": "coloured lights sometimes seen in the northern sky",
        "category": "专有名词",
        "isProperNoun": true
      }
    ]
  },
  {
    "key": "5a-u4l1",
    "stage": "5A",
    "unit": "Unit 4",
    "lesson": "Lesson 1",
    "title": "The Legendary Bermuda Triangle: A Mystery No More",
    "paragraphs": [
      "For years, people have believed that an area of the Atlantic Ocean between Bermuda, Puerto Rico and Florida, USA was a dangerous place. They thought planes and boats passing through here were likely to disappear. By 1964, a writer had called the area the ‘Bermuda Triangle’. The name stuck, and so did the mystery.",
      "In 1945, five US Navy planes, called Flight 19, took off from Florida and never came back. After they disappeared into the Bermuda Triangle, theories had begun to spread that the area was a danger zone. Even before this famous flight, several ships had disappeared in these waters. People had many different ideas about why this happened. Some people even believed that a giant octopus was responsible!",
      "However, scientists believe that weather is part of the problem. Unusually shaped clouds above the area create strong winds that go down into the water, creating huge tsunami waves that can take down boats or low-flying planes. And many researchers believe that there’s no mystery at all. Shipwrecks and plane crashes happen all over the world. It just seems to happen more in the Bermuda Triangle because there’s more traffic.",
      "The Bermuda Triangle is also one of the deepest areas of the Atlantic, with some areas being 8 km (5 mi.) deep. So, remains are hard to find, which makes the disappearances seem even more mysterious. In 2011, the Flight 19 planes were found, proving that they didn’t completely disappear. But no matter how much evidence there is that the Bermuda Triangle is no more dangerous than any other part of the ocean, many still believe that there’s a mystery."
    ],
    "learningSections": [
      {
        "type": "exercises",
        "id": "reading-comprehension",
        "eyebrow": "总结",
        "title": "理解文章中的说法与证据",
        "groups": [
          {
            "section": "4",
            "bookPage": 36,
            "instruction": "According to the article, tick True or False.",
            "items": [
              {
                "number": 1,
                "type": "multiple_choice",
                "prompt": "By the time Flight 19 disappeared, the area had already been called the Bermuda Triangle.",
                "answer": "False",
                "options": [
                  "True",
                  "False"
                ]
              },
              {
                "number": 2,
                "type": "multiple_choice",
                "prompt": "People had many different theories about what caused the disappearances.",
                "answer": "True",
                "options": [
                  "True",
                  "False"
                ]
              },
              {
                "number": 3,
                "type": "multiple_choice",
                "prompt": "A giant octopus had probably eaten the planes and ships.",
                "answer": "False",
                "options": [
                  "True",
                  "False"
                ]
              },
              {
                "number": 4,
                "type": "multiple_choice",
                "prompt": "Strong winds and waves probably caused some of the crashes.",
                "answer": "True",
                "options": [
                  "True",
                  "False"
                ]
              },
              {
                "number": 5,
                "type": "multiple_choice",
                "prompt": "The Bermuda Triangle has got some of the deepest areas of the Atlantic.",
                "answer": "True",
                "options": [
                  "True",
                  "False"
                ]
              },
              {
                "number": 6,
                "type": "multiple_choice",
                "prompt": "Evidence shows that the Bermuda Triangle is the most dangerous zone in the Atlantic Ocean.",
                "answer": "False",
                "options": [
                  "True",
                  "False"
                ]
              }
            ]
          },
          {
            "section": "10",
            "bookPage": 37,
            "instruction": "Describe a mystery you’ve heard about to a partner.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "What happened?",
                "answer": ""
              },
              {
                "number": 2,
                "type": "short_answer",
                "prompt": "Has it been solved? What evidence is there?",
                "answer": ""
              }
            ]
          }
        ],
        "description": "以下题目按教材文章作答。文章中的历史与科学说法属于原文内容。"
      },
      {
        "type": "grammar",
        "id": "past-perfect-simple",
        "eyebrow": "语法",
        "title": "Past perfect simple",
        "groups": [
          {
            "section": "5",
            "bookPage": 37,
            "instruction": "Circle the correct words.",
            "items": [
              {
                "number": 1,
                "type": "multiple_choice",
                "prompt": "By July 1582, they had ______ the war.",
                "answer": "lost",
                "options": [
                  "lose",
                  "lost"
                ]
              },
              {
                "number": 2,
                "type": "multiple_choice",
                "prompt": "I thought you had ______ the island before.",
                "answer": "visited",
                "options": [
                  "visited",
                  "visit"
                ]
              },
              {
                "number": 3,
                "type": "multiple_choice",
                "prompt": "______ about the Bermuda Triangle?",
                "answer": "Had Victor heard",
                "options": [
                  "Had heard Victor",
                  "Had Victor heard"
                ]
              },
              {
                "number": 4,
                "type": "multiple_choice",
                "prompt": "I had finished my journey ______ last night.",
                "answer": "by",
                "options": [
                  "by",
                  "since"
                ]
              },
              {
                "number": 5,
                "type": "multiple_choice",
                "prompt": "The expert said that the lost city had never ______.",
                "answer": "existed",
                "options": [
                  "existed",
                  "exist"
                ]
              },
              {
                "number": 6,
                "type": "multiple_choice",
                "prompt": "They ______ about the Bermuda Triangle before they went on the ship.",
                "answer": "hadn’t heard",
                "options": [
                  "hadn’t heard",
                  "heard"
                ]
              }
            ]
          },
          {
            "section": "6",
            "bookPage": 37,
            "instruction": "Complete with the past perfect simple: hear, learn, leave, not read, not see, take off.",
            "items": [
              {
                "number": 1,
                "type": "fill_blank",
                "prompt": "By the time I got to Jakub’s house, he ______ for the library.",
                "answer": "had left"
              },
              {
                "number": 2,
                "type": "fill_blank",
                "prompt": "______ anybody ______ of this mystery before the 1940s?",
                "answer": "Had; heard"
              },
              {
                "number": 3,
                "type": "fill_blank",
                "prompt": "Jenny ______ anything about shipwrecks before you gave her this book.",
                "answer": "hadn’t read\nhad not read"
              },
              {
                "number": 4,
                "type": "fill_blank",
                "prompt": "The planes of Flight 19 disappeared after they ______ from Florida.",
                "answer": "had taken off"
              },
              {
                "number": 5,
                "type": "fill_blank",
                "prompt": "______ the people ______ how to swim before they got on the ship?",
                "answer": "Had; learnt"
              },
              {
                "number": 6,
                "type": "fill_blank",
                "prompt": "Harry ______ the Atlantic Ocean before he got to Puerto Rico last week.",
                "answer": "hadn’t seen\nhad not seen"
              }
            ]
          }
        ],
        "grammarRefs": [
          {
            "book": "intermediate",
            "unitNumber": 15,
            "role": "extension",
            "label": "中级：过去完成时"
          },
          {
            "book": "essential",
            "unitNumber": 24,
            "role": "foundation",
            "label": "规则与不规则动词"
          }
        ],
        "summary": {
          "cards": [
            {
              "title": "过去的过去",
              "formula": "had + past participle",
              "signals": "before · by + 过去时间",
              "points": [
                {
                  "label": "先于另一个过去动作",
                  "text": "Rebecca had read a book about mysteries at sea, so she enjoyed the film about the Bermuda Triangle."
                },
                {
                  "label": "截至过去某时已经完成",
                  "text": "By 1950, several boats had disappeared."
                }
              ]
            },
            {
              "title": "否定与疑问",
              "formula": "had not / hadn’t + past participle · Had + subject + past participle?",
              "signals": "before + 过去事件",
              "points": [
                {
                  "label": "所有主语都用 had",
                  "text": "They hadn’t heard about the Bermuda Triangle before they went on the ship."
                }
              ]
            }
          ],
          "contrastTitle": "关键区别",
          "contrasts": [
            {
              "example": "They had disappeared before the search began.",
              "note": "先发生的动作：had disappeared。"
            },
            {
              "example": "The search began.",
              "note": "后发生的过去动作：一般过去时。"
            }
          ],
          "decisionGuide": [
            "找出两个过去时间点：更早的动作用过去完成时。",
            "by 强调截至某个过去时间，before 强调在另一个过去事件之前。"
          ],
          "reminders": []
        }
      },
      {
        "type": "exercises",
        "id": "place-vocabulary",
        "eyebrow": "词汇",
        "title": "谜团、前缀与后缀",
        "groups": [
          {
            "section": "3",
            "bookPage": 36,
            "instruction": "Complete with: crash, disappeared, evidence, mystery, theory, shipwreck, zone.",
            "items": [
              {
                "number": 1,
                "type": "fill_blank",
                "prompt": "The ship ______ at sea, with 300 people on board.",
                "answer": "disappeared"
              },
              {
                "number": 2,
                "type": "fill_blank",
                "prompt": "There’s no ______ that the Bermuda Triangle is more dangerous than anywhere else.",
                "answer": "evidence"
              },
              {
                "number": 3,
                "type": "fill_blank",
                "prompt": "In the past, no one knew why they got lost. It was a ______.",
                "answer": "mystery"
              },
              {
                "number": 4,
                "type": "fill_blank",
                "prompt": "Cars must go slowly in the school ______.",
                "answer": "zone"
              },
              {
                "number": 5,
                "type": "fill_blank",
                "prompt": "Dad has got an interesting ______ about what caused the plane ______.",
                "answer": "theory; crash"
              },
              {
                "number": 6,
                "type": "fill_blank",
                "prompt": "The divers were exploring the ______ at the bottom of the ocean.",
                "answer": "shipwreck"
              }
            ]
          },
          {
            "section": "7",
            "bookPage": 37,
            "instruction": "Read the examples. Prefixes: dis- (disappear, dishonest), im- (impatient, impossible), ir- (irregular, irresponsible), un- (unpleasant, unwise). Suffixes: -able (doable, believable), -ful (careful, useful), -ish (childish, foolish), -less (careless, harmless).",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "If you’re careful, you can swim here.",
                "answer": "",
                "options": [
                  "参考：careful: taking care to avoid danger."
                ]
              },
              {
                "number": 2,
                "type": "short_answer",
                "prompt": "These people are not telling the truth. They’re not being honest.",
                "answer": "",
                "options": [
                  "参考：honest: telling the truth."
                ]
              },
              {
                "number": 3,
                "type": "short_answer",
                "prompt": "It’s foolish to go swimming during a storm.",
                "answer": "",
                "options": [
                  "参考：foolish: not sensible."
                ]
              },
              {
                "number": 4,
                "type": "short_answer",
                "prompt": "Going out on a boat is pleasant on a sunny day, but not in the rain.",
                "answer": "",
                "options": [
                  "参考：pleasant: enjoyable."
                ]
              },
              {
                "number": 5,
                "type": "short_answer",
                "prompt": "The captain is responsible for getting the ship to its destination.",
                "answer": "",
                "options": [
                  "参考：responsible: having a duty."
                ]
              },
              {
                "number": 6,
                "type": "short_answer",
                "prompt": "It’s wise to stay indoors in a hurricane.",
                "answer": "",
                "options": [
                  "参考：wise: showing good judgement."
                ]
              }
            ]
          },
          {
            "section": "8",
            "bookPage": 37,
            "instruction": "Complete by adding a prefix or suffix to the word in brackets.",
            "items": [
              {
                "number": 1,
                "type": "fill_blank",
                "prompt": "Mum didn’t think the story of the shipwreck was very ______ (believe).",
                "answer": "believable"
              },
              {
                "number": 2,
                "type": "fill_blank",
                "prompt": "Pablo is very ______ (child). He only wants to play.",
                "answer": "childish"
              },
              {
                "number": 3,
                "type": "fill_blank",
                "prompt": "It would be ______ (wise) to miss the exam.",
                "answer": "unwise"
              },
              {
                "number": 4,
                "type": "fill_blank",
                "prompt": "The information hasn’t been very ______ (use).",
                "answer": "useful"
              },
              {
                "number": 5,
                "type": "fill_blank",
                "prompt": "I wonder what caused the aeroplanes to ______ (appear).",
                "answer": "disappear"
              }
            ]
          }
        ],
        "wordRefs": [
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 1",
            "word": "crash"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 1",
            "word": "disappear"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 1",
            "word": "evidence"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 1",
            "word": "mystery"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 1",
            "word": "theory"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 1",
            "word": "shipwreck"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 1",
            "word": "zone"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 1",
            "word": "careful"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 1",
            "word": "honest"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 1",
            "word": "foolish"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 1",
            "word": "pleasant"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 1",
            "word": "responsible"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 1",
            "word": "wise"
          }
        ]
      },
      {
        "type": "writing",
        "id": "mystery-paragraph",
        "eyebrow": "写作",
        "title": "Describe a mystery",
        "prompt": "Write a paragraph about the mystery you described in Activity 10. Say what happened and whether it has been solved. The model is a fictional example.",
        "questions": [
          "What disappeared or seemed strange?",
          "What had happened before it?",
          "How was the mystery solved, or why is it still a mystery?"
        ],
        "suggestedWords": [
          "mystery",
          "disappeared",
          "evidence",
          "had left",
          "found"
        ],
        "modelAnswer": [
          "One morning, our class trophy disappeared. We had left it on a shelf the day before, but nobody could find it. We looked for evidence and asked our teacher for help. Later, the cleaner told us that she had put it in a cupboard before cleaning the shelf. The mystery was solved, and everyone was happy."
        ]
      }
    ],
    "glossary": [
      {
        "word": "Bermuda Triangle",
        "meaningCn": "百慕大三角",
        "meaningEn": "an area of the Atlantic Ocean between Bermuda, Puerto Rico and Florida",
        "category": "专有名词",
        "isProperNoun": true
      },
      {
        "word": "Flight 19",
        "meaningCn": "第 19 飞行队",
        "meaningEn": "the group of five US Navy planes discussed in the article",
        "category": "专有名词",
        "isProperNoun": true
      }
    ]
  },
  {
    "key": "5a-u4l2",
    "stage": "5A",
    "unit": "Unit 4",
    "lesson": "Lesson 2",
    "title": "The Mysterious Disappearance of Amelia Earhart",
    "paragraphs": [
      "On the morning of 2nd July, 1937, Amelia Earhart was due to land her plane on the tiny island of Howland in the Pacific Ocean. She never arrived, though. She and her plane simply disappeared.",
      "Amelia was ten when she saw her first plane. She didn’t think it was very exciting. She had said, ‘It was a thing of rusty wire and wood and not at all interesting ...’ Ten years later, however, she was a passenger in a plane for ten minutes, flying over Los Angeles. At that moment, she decided to learn how to fly.",
      "Amelia was a pilot at a time when many women didn’t work, and most people had never been in a plane. By the age of 35, she had already broken one world record. In 1932, she became the first woman to fly alone across the Atlantic Ocean. But Amelia had even bigger dreams. She wanted to be the first woman to fly around the world.",
      "In June 1937, she began her flight from Miami, Florida, with her navigator, Fred Noonan. After they had flown across the USA, they went to Brazil. They continued their journey across Africa, Asia and Australia. On 2nd July they took off from New Guinea and headed for Howland Island, but the plane never arrived. People searched for Earhart and Noonan for weeks, but didn’t find them.",
      "There are several theories about what happened. Some think Fred and Amelia got lost, ran out of fuel, and crashed into the sea; others think they landed on another island and got stuck there. Some people even think that Amelia had been working as a spy and was captured. One thing is certain: Amelia Earhart will always be a legend.",
      "In 2014, another pilot named Amelia Earhart (no relation) made a record-breaking flight. She became the youngest woman to fly 39,000 km (24,300 mi.) around the world in a single-engine plane."
    ],
    "learningSections": [
      {
        "type": "exercises",
        "id": "reading-comprehension",
        "eyebrow": "总结",
        "title": "Amelia 的飞行与失踪",
        "groups": [
          {
            "section": "3",
            "bookPage": 38,
            "instruction": "Read. Answer the questions.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "What did Amelia Earhart think of the first aeroplane she saw?",
                "answer": "",
                "options": [
                  "参考：She thought it was rusty and not interesting."
                ]
              },
              {
                "number": 2,
                "type": "short_answer",
                "prompt": "What world record did Amelia break?",
                "answer": "",
                "options": [
                  "参考：She became the first woman to fly alone across the Atlantic Ocean."
                ]
              },
              {
                "number": 3,
                "type": "short_answer",
                "prompt": "What was Fred Noonan’s job on Amelia’s flight?",
                "answer": "",
                "options": [
                  "参考：He was her navigator."
                ]
              },
              {
                "number": 4,
                "type": "short_answer",
                "prompt": "What are three theories about Amelia’s disappearance?",
                "answer": "",
                "options": [
                  "参考：They ran out of fuel and crashed; they landed on another island; or Amelia was captured as a spy."
                ]
              },
              {
                "number": 5,
                "type": "short_answer",
                "prompt": "Why is Amelia a legend?",
                "answer": "",
                "options": [
                  "参考：For example: she set a world record and inspired people with her flying achievements."
                ]
              }
            ]
          }
        ]
      },
      {
        "type": "grammar",
        "id": "past-simple-vs-perfect",
        "eyebrow": "语法",
        "title": "Past simple and past perfect simple",
        "groups": [
          {
            "section": "5",
            "bookPage": 39,
            "instruction": "Complete the paragraph with the past simple or past perfect simple.",
            "items": [
              {
                "number": 1,
                "type": "fill_blank",
                "prompt": "I had a strange experience a few months ago. It ______ (be) a summer evening.",
                "answer": "was"
              },
              {
                "number": 2,
                "type": "fill_blank",
                "prompt": "I ______ (just say) goodnight to my friend Janet.",
                "answer": "had just said"
              },
              {
                "number": 3,
                "type": "fill_blank",
                "prompt": "She ______ (invite) me to her house to watch a film.",
                "answer": "had invited"
              },
              {
                "number": 4,
                "type": "fill_blank",
                "prompt": "I ______ (leave) her house at 8 o’clock.",
                "answer": "left"
              },
              {
                "number": 5,
                "type": "fill_blank",
                "prompt": "I realised that it ______ (already get) dark.",
                "answer": "had already got"
              },
              {
                "number": 6,
                "type": "fill_blank",
                "prompt": "I started walking when suddenly, I ______ (notice) a bright red light in the sky.",
                "answer": "noticed"
              },
              {
                "number": 7,
                "type": "fill_blank",
                "prompt": "It blinked very fast, and then it ______ (disappear).",
                "answer": "disappeared"
              },
              {
                "number": 8,
                "type": "fill_blank",
                "prompt": "Was it from a TV tower? Maybe. It ______ (be) all very mysterious.",
                "answer": "was"
              }
            ]
          }
        ],
        "grammarRefs": [
          {
            "book": "intermediate",
            "unitNumber": 15,
            "role": "extension",
            "label": "中级：过去完成时"
          },
          {
            "book": "essential",
            "unitNumber": 11,
            "role": "foundation",
            "label": "一般过去时"
          }
        ],
        "summary": {
          "cards": [
            {
              "title": "较早完成的动作",
              "formula": "had + past participle",
              "signals": "before · already · just",
              "points": [
                {
                  "label": "先用完燃料",
                  "text": "The plane crashed because it had run out of fuel."
                }
              ]
            },
            {
              "title": "后来发生的动作",
              "formula": "past simple",
              "signals": "when · after",
              "points": [
                {
                  "label": "降落先于暴风雨",
                  "text": "They had just landed when the storm began."
                }
              ]
            }
          ],
          "contrastTitle": "关键区别",
          "contrasts": [
            {
              "example": "The plane crashed.",
              "note": "叙述过去发生的事件。"
            },
            {
              "example": "It had run out of fuel.",
              "note": "解释那件事之前已经发生了什么。"
            }
          ],
          "decisionGuide": [
            "先理清事件顺序，再选时态。",
            "较早的动作用 had + 过去分词；后来的动作用一般过去时。"
          ],
          "reminders": []
        }
      },
      {
        "type": "exercises",
        "id": "place-vocabulary",
        "eyebrow": "词汇",
        "title": "飞行、get 短语与形容词介词搭配",
        "groups": [
          {
            "section": "4",
            "bookPage": 38,
            "instruction": "Write the word for each definition.",
            "items": [
              {
                "number": 1,
                "type": "fill_blank",
                "prompt": "Come down to the ground in a plane: ______",
                "answer": "land"
              },
              {
                "number": 2,
                "type": "fill_blank",
                "prompt": "A person on a plane who finds its route: ______",
                "answer": "navigator"
              },
              {
                "number": 3,
                "type": "fill_blank",
                "prompt": "Go up into the air in a plane: ______",
                "answer": "take off"
              },
              {
                "number": 4,
                "type": "fill_blank",
                "prompt": "Go towards: ______",
                "answer": "head for"
              },
              {
                "number": 5,
                "type": "fill_blank",
                "prompt": "Gas or petrol: ______",
                "answer": "fuel"
              },
              {
                "number": 6,
                "type": "fill_blank",
                "prompt": "The best performance ever of an activity: ______",
                "answer": "record"
              },
              {
                "number": 7,
                "type": "fill_blank",
                "prompt": "A person who’s known for doing something well: ______",
                "answer": "legend"
              }
            ]
          },
          {
            "section": "6",
            "bookPage": 39,
            "instruction": "Read these phrases and their examples.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "get a chance — Did you get a chance to watch the film?",
                "answer": "",
                "options": [
                  "参考：有机会。"
                ]
              },
              {
                "number": 2,
                "type": "short_answer",
                "prompt": "get home — Tom got home at 11:00.",
                "answer": "",
                "options": [
                  "参考：到家。"
                ]
              },
              {
                "number": 3,
                "type": "short_answer",
                "prompt": "get the impression — I got the impression that she was an interesting woman.",
                "answer": "",
                "options": [
                  "参考：获得某种印象。"
                ]
              },
              {
                "number": 4,
                "type": "short_answer",
                "prompt": "get a job — My aunt got a job at the shop.",
                "answer": "",
                "options": [
                  "参考：找到工作。"
                ]
              },
              {
                "number": 5,
                "type": "short_answer",
                "prompt": "get a reply — I never got a reply from you.",
                "answer": "",
                "options": [
                  "参考：收到回复。"
                ]
              },
              {
                "number": 6,
                "type": "short_answer",
                "prompt": "get a surprise — Henri really got a surprise when his mum gave him a puppy.",
                "answer": "",
                "options": [
                  "参考：感到惊喜。"
                ]
              }
            ]
          },
          {
            "section": "7",
            "bookPage": 39,
            "instruction": "Complete with the correct form of the phrases from Activity 6.",
            "items": [
              {
                "number": 1,
                "type": "fill_blank",
                "prompt": "She ______ in an office, but her hobby was flying.",
                "answer": "got a job"
              },
              {
                "number": 2,
                "type": "fill_blank",
                "prompt": "‘Who’s there?’ I asked. I didn’t ______.",
                "answer": "get a reply"
              },
              {
                "number": 3,
                "type": "fill_blank",
                "prompt": "Did you ______ to talk to the police?",
                "answer": "get a chance"
              },
              {
                "number": 4,
                "type": "fill_blank",
                "prompt": "I ______ when I found out my cousin had arrived.",
                "answer": "got a surprise"
              },
              {
                "number": 5,
                "type": "fill_blank",
                "prompt": "I’m not sure why, but I ______ that he doesn’t like me.",
                "answer": "get the impression"
              },
              {
                "number": 6,
                "type": "fill_blank",
                "prompt": "What time did you ______ last night?",
                "answer": "get home"
              }
            ]
          },
          {
            "section": "Prepositions A",
            "bookPage": 39,
            "instruction": "Use about, at, for, in or of.",
            "items": [
              {
                "number": 1,
                "type": "fill_blank",
                "prompt": "afraid ______",
                "answer": "of"
              },
              {
                "number": 2,
                "type": "fill_blank",
                "prompt": "capable ______",
                "answer": "of"
              },
              {
                "number": 3,
                "type": "fill_blank",
                "prompt": "good ______",
                "answer": "at"
              },
              {
                "number": 4,
                "type": "fill_blank",
                "prompt": "interested ______",
                "answer": "in"
              },
              {
                "number": 5,
                "type": "fill_blank",
                "prompt": "jealous ______",
                "answer": "of"
              },
              {
                "number": 6,
                "type": "fill_blank",
                "prompt": "responsible ______",
                "answer": "for"
              },
              {
                "number": 7,
                "type": "fill_blank",
                "prompt": "suitable ______",
                "answer": "for"
              },
              {
                "number": 8,
                "type": "fill_blank",
                "prompt": "worried ______",
                "answer": "about"
              }
            ]
          },
          {
            "section": "Prepositions B",
            "bookPage": 39,
            "instruction": "Complete with the adjectives and prepositions from A.",
            "items": [
              {
                "number": 1,
                "type": "fill_blank",
                "prompt": "Was the pilot ______ the crash?",
                "answer": "responsible for"
              },
              {
                "number": 2,
                "type": "fill_blank",
                "prompt": "I’m ______ flying. Let’s go by train.",
                "answer": "afraid of"
              },
              {
                "number": 3,
                "type": "fill_blank",
                "prompt": "Some people were ______ Amelia because she was clever.",
                "answer": "jealous of"
              },
              {
                "number": 4,
                "type": "fill_blank",
                "prompt": "Nobody has seen John this week. Frank is really ______ him.",
                "answer": "worried about"
              },
              {
                "number": 5,
                "type": "fill_blank",
                "prompt": "Were they ______ surviving alone on an island? Could they do it?",
                "answer": "capable of"
              },
              {
                "number": 6,
                "type": "fill_blank",
                "prompt": "The film was very scary and not ______ children.",
                "answer": "suitable for"
              },
              {
                "number": 7,
                "type": "fill_blank",
                "prompt": "Are you ______ ancient places?",
                "answer": "interested in"
              },
              {
                "number": 8,
                "type": "fill_blank",
                "prompt": "She’s really ______ physics and wants to be a pilot.",
                "answer": "good at"
              }
            ]
          }
        ],
        "wordRefs": [
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 2",
            "word": "land"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 2",
            "word": "navigator"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 2",
            "word": "take off"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 2",
            "word": "head for"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 2",
            "word": "fuel"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 2",
            "word": "record"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 2",
            "word": "legend"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 2",
            "word": "get a chance"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 2",
            "word": "get home"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 2",
            "word": "get the impression"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 2",
            "word": "get a job"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 2",
            "word": "get a reply"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 2",
            "word": "get a surprise"
          }
        ]
      }
    ],
    "paragraphTitles": [
      "",
      "",
      "",
      "",
      "",
      "Guess what!"
    ],
    "glossary": [
      {
        "word": "Amelia Earhart",
        "meaningCn": "阿梅莉亚·埃尔哈特（飞行员）",
        "meaningEn": "the pilot whose disappearance is discussed in the article",
        "category": "专有名词",
        "isProperNoun": true
      },
      {
        "word": "Fred Noonan",
        "meaningCn": "弗雷德·努南（领航员）",
        "meaningEn": "Amelia Earhart’s navigator",
        "category": "专有名词",
        "isProperNoun": true
      },
      {
        "word": "Howland Island",
        "meaningCn": "豪兰岛",
        "meaningEn": "a small island in the Pacific Ocean",
        "category": "专有名词",
        "isProperNoun": true
      }
    ]
  },
  {
    "key": "5a-u4l3",
    "stage": "5A",
    "unit": "Unit 4",
    "lesson": "Lesson 3",
    "title": "Anansi and the Basket of Wisdom",
    "paragraphs": [
      "Anansi the spider knew that he was very clever, but he also knew he wasn’t wise. He didn’t like this, but he did not know what to do. One day he had an idea. He went around the village with a basket and asked each person to give him some of their wisdom. The people laughed at Anansi because they knew that of all the creatures, he needed wisdom the most. So each person put a bit in his basket and wished him good luck with his search.",
      "Soon his basket was full, but Anansi was worried that someone might be jealous of his wisdom and take it from him. He decided to hide it at the top of a tall tree. When he had tied the basket to the front part of his body, he tried to climb the tree, but it was too difficult. He tried again and again without success.",
      "Then his youngest son walked by. ‘What are you doing, Father?’ he asked, and Anansi told him. ‘Why don’t you carry the basket on your back instead?’ his son said.",
      "Anansi put the basket on his back and climbed the tree easily. But he wasn’t happy. ‘I walked all over the village and collected so much wisdom that I am the wisest creature ever, but my baby son is still wiser than me. Take back your wisdom!’ he said. And he threw the basket into the air and went home. With that, wisdom was spread all over the world."
    ],
    "learningSections": [
      {
        "type": "exercises",
        "id": "reading-comprehension",
        "eyebrow": "总结",
        "title": "Anansi 的智慧故事",
        "groups": [
          {
            "section": "1",
            "bookPage": 40,
            "instruction": "Think of a good title for the folk tale.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "Give the story a title and explain your choice.",
                "answer": ""
              }
            ]
          },
          {
            "section": "2",
            "bookPage": 40,
            "instruction": "Answer the questions.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "What opinion did Anansi have about his own character?",
                "answer": "",
                "options": [
                  "参考：He thought he was clever but not wise."
                ]
              },
              {
                "number": 2,
                "type": "short_answer",
                "prompt": "Where did he get his wisdom from?",
                "answer": "",
                "options": [
                  "参考：From people in his village."
                ]
              },
              {
                "number": 3,
                "type": "short_answer",
                "prompt": "Why did the people laugh at Anansi?",
                "answer": "",
                "options": [
                  "参考：They thought he needed wisdom the most."
                ]
              },
              {
                "number": 4,
                "type": "short_answer",
                "prompt": "Why couldn’t he climb the tree at first?",
                "answer": "",
                "options": [
                  "参考：The basket was tied to the front of his body."
                ]
              },
              {
                "number": 5,
                "type": "short_answer",
                "prompt": "Why was Anansi angry after he had climbed the tree?",
                "answer": "",
                "options": [
                  "参考：His young son was still wiser than he was."
                ]
              },
              {
                "number": 6,
                "type": "short_answer",
                "prompt": "What happened to the wisdom in the end?",
                "answer": "",
                "options": [
                  "参考：It was spread all over the world."
                ]
              }
            ]
          },
          {
            "section": "4",
            "bookPage": 41,
            "instruction": "Book discussion: Which books would suit you, a brother or sister, a best friend, and your mum or dad? Give reasons.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "Choose from a joke book, Amazing Mysteries, fairy tales, short stories, Peter Pan and Amazing Mazes. Explain your choices.",
                "answer": ""
              }
            ]
          }
        ]
      },
      {
        "type": "grammar",
        "id": "changed-plans",
        "eyebrow": "语法",
        "title": "Talking about plans that change",
        "groups": [
          {
            "section": "Say it like this",
            "bookPage": 40,
            "instruction": "Talk to a partner about yourself and how your own plans changed.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "Use was/were supposed to and was/were going to. Explain what actually happened.",
                "answer": ""
              }
            ]
          }
        ],
        "grammarRefs": [
          {
            "book": "intermediate",
            "unitNumber": 20,
            "role": "extension",
            "label": "中级：going to（包括过去的打算）"
          },
          {
            "book": "essential",
            "unitNumber": 26,
            "role": "foundation",
            "label": "be going to"
          }
        ],
        "summary": {
          "cards": [
            {
              "title": "原定的安排",
              "formula": "was / were (not) supposed to + verb",
              "signals": "for homework · but",
              "points": [
                {
                  "label": "原来应该做",
                  "text": "We were supposed to write a story for homework, but we didn’t have any ideas."
                }
              ]
            },
            {
              "title": "过去的打算",
              "formula": "was / were (not) going to + verb",
              "signals": "but · didn’t",
              "points": [
                {
                  "label": "打算改变",
                  "text": "I was going to write an email, but I didn’t have time."
                },
                {
                  "label": "与原打算不同",
                  "text": "They weren’t going to tell us about the mystery, but they did."
                }
              ]
            }
          ],
          "contrastTitle": "关键区别",
          "contrasts": [
            {
              "example": "I wasn’t supposed to read the ending of the story.",
              "note": "原定要求或安排。"
            },
            {
              "example": "I was going to write an email, but I didn’t have time.",
              "note": "当时的打算，后来没有实现。"
            }
          ],
          "decisionGuide": [
            "说明原定安排或要求 → was / were supposed to。",
            "说明过去的打算 → was / were going to；用 but 说明变化。"
          ],
          "reminders": []
        }
      },
      {
        "type": "exercises",
        "id": "place-vocabulary",
        "eyebrow": "词汇",
        "title": "叙事顺序与范文",
        "groups": [
          {
            "section": "Writing A",
            "bookPage": 41,
            "instruction": "Write your own examples using narrative sequence words: once upon a time; at the beginning; one day/morning/night; after a while; suddenly; about an hour/a few minutes/days later; then; after that; the next thing I knew; soon; in the end; finally.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "One night, Alex had a strange dream. Write another opening sentence.",
                "answer": ""
              },
              {
                "number": 2,
                "type": "short_answer",
                "prompt": "I was falling through the air and, suddenly, I woke up! Write another sentence with suddenly.",
                "answer": ""
              },
              {
                "number": 3,
                "type": "short_answer",
                "prompt": "The day started badly, but everything was OK in the end. Write another ending.",
                "answer": ""
              }
            ]
          },
          {
            "section": "Writing B",
            "bookPage": 41,
            "instruction": "The Boy Who Cried Wolf: Read the story and circle the correct words.",
            "items": [
              {
                "number": 1,
                "type": "multiple_choice",
                "prompt": "______ there was a boy who lived with his sheep on a mountain near a forest. He was bored and he wanted to have some fun.",
                "answer": "Once upon a time",
                "options": [
                  "One day",
                  "Once upon a time"
                ]
              },
              {
                "number": 2,
                "type": "multiple_choice",
                "prompt": "______ he was looking after his sheep one day, he had an idea. He left his sheep, ran towards the village and shouted, ‘Wolf! Wolf!’",
                "answer": "While",
                "options": [
                  "Soon",
                  "While",
                  "before"
                ]
              },
              {
                "number": 3,
                "type": "multiple_choice",
                "prompt": "______ the villagers heard him, they came to help him. But there was no wolf and they all went home, annoyed at the boy.",
                "answer": "As soon as",
                "options": [
                  "Then",
                  "As soon as"
                ]
              },
              {
                "number": 4,
                "type": "multiple_choice",
                "prompt": "______ the boy tried the same trick, and again the villagers came to help him and went home, angry again.",
                "answer": "A few days later",
                "options": [
                  "A few days later",
                  "Just then"
                ]
              },
              {
                "number": 5,
                "type": "multiple_choice",
                "prompt": "______ a few days later, something strange happened. The boy woke up and, as he was looking out of the window, he saw that a wolf had really come out of the forest! ‘Wolf! Wolf!’ he shouted even louder than before. This time the villagers, who had believed him twice before, didn’t believe him.",
                "answer": "Then",
                "options": [
                  "Then",
                  "At first"
                ]
              },
              {
                "number": 6,
                "type": "multiple_choice",
                "prompt": "______ nobody came to help him and the wolf ate all the boy’s sheep. He was very sad, but he learnt an important lesson. He realised that lying is wrong and that it causes a lot of trouble.",
                "answer": "In the end",
                "options": [
                  "In the end",
                  "At first"
                ]
              }
            ]
          }
        ],
        "wordRefs": [
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 3",
            "word": "wisdom"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 3",
            "word": "search"
          },
          {
            "stage": "5A",
            "unit": "Unit 4",
            "lesson": "Lesson 3",
            "word": "jealous"
          }
        ]
      },
      {
        "type": "writing",
        "id": "folk-tale-writing",
        "eyebrow": "写作",
        "title": "Write a folk tale",
        "prompt": "Write about a mystery or a folk tale you know. Use past tenses, narrative sequence words and a title. Check the sequence words as in Activity D.",
        "questions": [
          "Paragraph 1: Introduce the main characters and set the scene. Where and when did it happen?",
          "Paragraphs 2 and 3: Explain what happened, in order.",
          "Paragraph 4: Explain the ending and describe the characters’ feelings and reactions."
        ],
        "suggestedWords": [
          "once upon a time",
          "one day",
          "then",
          "suddenly",
          "after that",
          "in the end"
        ],
        "modelAnswer": [
          "The Lion and the Mouse\n\nOnce upon a time, a lion lived in a forest. One day, a little mouse ran over him while he was sleeping.",
          "The lion woke up and caught the mouse. The mouse begged him to let her go and promised to help him one day. The lion laughed, but he set her free.",
          "A few days later, the lion was caught in a net. The mouse heard his cries and came to help. She bit through the ropes until he was free.",
          "In the end, the lion thanked the mouse. He had thought she was too small to help him, but she had saved his life. He learnt that even a small friend can be a great help."
        ]
      }
    ],
    "glossary": [
      {
        "word": "Anansi",
        "meaningCn": "阿南西（非洲民间故事中的蜘蛛）",
        "meaningEn": "the spider character in this African folk tale",
        "category": "专有名词",
        "isProperNoun": true
      }
    ]
  },
  {
    "key": "5a-u5l1",
    "stage": "5A",
    "unit": "Unit 5",
    "lesson": "Lesson 1",
    "title": "What type of career is best for you?",
    "paragraphs": [
      "Each spring, school careers officers meet with students to talk about their goals for the future. They talk about students’ interests, qualifications and what the students will do after finishing school. Next, the careers officer gives students a quiz to learn more about them and their preferences. Here’s an example of the type of quiz a careers officer might give.",
      "Are you going to want to spend time with people at work?\na Yes, all the time\nb Yes, some of the time\nc No, I like working alone",
      "How important is it to be well paid?\na Very important\nb Somewhat important\nc The least important part of the job",
      "How experienced are you with technology?\na Very experienced\nb Not very experienced, but willing to learn\nc I don’t like working with technology",
      "Are you a leader?\na Yes\nb Somewhat, but I also like to learn from others\nc No",
      "How creative are you?\na Somewhat creative\nb Very creative\nc It depends on my interest",
      "If you got mostly a’s, you are ambitious and want to make money. But you’re willing to help others, too. You’re going to spend a lot of time working, too. You might be a doctor, for example.",
      "If you got mostly b’s, you will have a career doing something creative. You’re going to be a teacher or a writer, for example.",
      "If you got mostly c’s, you will work with your hands in some way. Maybe you’re going to work with machines, for example. Think about becoming a mechanic or a gardener."
    ],
    "learningSections": [
      {
        "type": "exercises",
        "id": "reading-comprehension",
        "eyebrow": "总结",
        "title": "职业兴趣与选择",
        "groups": [
          {
            "section": "4",
            "bookPage": 48,
            "instruction": "Answer the questions.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "Why do careers officers meet with students?",
                "answer": "",
                "options": [
                  "参考：To talk about their goals for the future."
                ]
              },
              {
                "number": 2,
                "type": "short_answer",
                "prompt": "What do they discuss?",
                "answer": "",
                "options": [
                  "参考：Students’ interests, qualifications and what they will do after finishing school."
                ]
              },
              {
                "number": 3,
                "type": "short_answer",
                "prompt": "Why does the careers officer give the quiz?",
                "answer": "",
                "options": [
                  "参考：To learn more about students and their preferences."
                ]
              },
              {
                "number": 4,
                "type": "short_answer",
                "prompt": "What other jobs can you think of for each category?",
                "answer": ""
              },
              {
                "number": 5,
                "type": "short_answer",
                "prompt": "Take the quiz in the reading. Write your five choices (a/b/c), count them, then read the corresponding result. What is your result? Do you agree? Why?",
                "answer": ""
              }
            ]
          },
          {
            "section": "11",
            "bookPage": 49,
            "instruction": "Talk about your future career. Ask and answer with a partner.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "What job are you going to do in the future?",
                "answer": ""
              },
              {
                "number": 2,
                "type": "short_answer",
                "prompt": "What qualifications and skills will you need?",
                "answer": ""
              },
              {
                "number": 3,
                "type": "short_answer",
                "prompt": "What will be difficult about it? What will be enjoyable?",
                "answer": ""
              }
            ]
          }
        ]
      },
      {
        "type": "grammar",
        "id": "future-simple-going-to",
        "eyebrow": "语法",
        "title": "Future simple and be going to",
        "groups": [
          {
            "section": "5",
            "bookPage": 49,
            "instruction": "Find four examples of the future simple in the reading. Which uses do they illustrate?",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "Quote the four phrases and explain their uses.",
                "answer": "",
                "options": [
                  "参考：教材要求找 4 个例子，但可见原文只有 3 处 will：will do、will have a career、will work，均表示预测。going to 不是 will 形式。"
                ]
              }
            ]
          },
          {
            "section": "6",
            "bookPage": 49,
            "instruction": "Find four examples of be going to in the reading. Which two meanings do they have?",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "Quote four phrases and explain whether each expresses a plan or a prediction.",
                "answer": "",
                "options": [
                  "参考：Are you going to want ...?; You’re going to spend ...; You’re going to be ...; you’re going to work ... . Discuss plans/intentions and predictions based on the quiz results."
                ]
              }
            ]
          },
          {
            "section": "7",
            "bookPage": 49,
            "instruction": "Complete Samira’s email with the future simple or be going to.",
            "items": [
              {
                "number": 1,
                "type": "fill_blank",
                "prompt": "Hi! I’ve got something exciting to tell you. This summer I ______ (work) on an island!",
                "answer": "am going to work"
              },
              {
                "number": 2,
                "type": "fill_blank",
                "prompt": "My uncle ______ (open) a restaurant in Malta and he needs some waiters and waitresses.",
                "answer": "is going to open"
              },
              {
                "number": 3,
                "type": "fill_blank",
                "prompt": "He thinks the restaurant probably ______ (not be) busy at first.",
                "answer": "won’t be\nwill not be"
              },
              {
                "number": 4,
                "type": "fill_blank",
                "prompt": "So I’m sure that we ______ (have) lots of time to relax.",
                "answer": "will have"
              },
              {
                "number": 5,
                "type": "fill_blank",
                "prompt": "The only thing I’m worried about is my English. I ______ (study) very hard from now on.",
                "answer": "am going to study"
              },
              {
                "number": 6,
                "type": "fill_blank",
                "prompt": "PS ______ (you/go) to Dina’s party on Saturday?",
                "answer": "Are you going to go"
              }
            ]
          }
        ],
        "grammarRefs": [
          {
            "book": "essential",
            "unitNumber": 26,
            "role": "foundation",
            "label": "be going to"
          },
          {
            "book": "essential",
            "unitNumber": 27,
            "role": "foundation",
            "label": "will / shall"
          },
          {
            "book": "intermediate",
            "unitNumber": 23,
            "role": "extension",
            "label": "中级：will 与 be going to"
          }
        ],
        "summary": {
          "cards": [
            {
              "title": "will",
              "formula": "will + verb",
              "signals": "I think · I hope · I’m sure · probably",
              "points": [
                {
                  "label": "预测",
                  "text": "There will be more students at university next year."
                },
                {
                  "label": "即时决定",
                  "text": "I won’t phone Kim this evening."
                },
                {
                  "label": "承诺与帮助",
                  "text": "I promise I’ll finish the work tonight."
                },
                {
                  "label": "请求",
                  "text": "Will you tell me your name and address?"
                }
              ]
            },
            {
              "title": "be going to",
              "formula": "am / is / are going to + verb",
              "signals": "已做的计划 · 眼前证据",
              "points": [
                {
                  "label": "计划或意图",
                  "text": "I’m going to be a teacher."
                },
                {
                  "label": "有依据的预测",
                  "text": "He’s going to pass the test because he’s clever."
                }
              ]
            }
          ],
          "contrastTitle": "关键区别",
          "contrasts": [
            {
              "example": "Stop talking or I’ll tell the teacher.",
              "note": "will 可以表示警告。"
            },
            {
              "example": "I’m going to be a teacher.",
              "note": "be going to 表示事先的计划。"
            }
          ],
          "decisionGuide": [
            "刚作决定、请求、承诺或个人预测 → will。",
            "既有计划或根据眼前证据作预测 → be going to。"
          ],
          "reminders": []
        }
      },
      {
        "type": "exercises",
        "id": "place-vocabulary",
        "eyebrow": "词汇",
        "title": "职业与教育词汇",
        "groups": [
          {
            "section": "3",
            "bookPage": 48,
            "instruction": "Circle the correct words.",
            "items": [
              {
                "number": 1,
                "type": "multiple_choice",
                "prompt": "Martin isn’t very ______. He just wants to play video games all day.",
                "answer": "ambitious",
                "options": [
                  "ambitious",
                  "experienced"
                ]
              },
              {
                "number": 2,
                "type": "multiple_choice",
                "prompt": "What are the ______ needed for this job?",
                "answer": "qualifications",
                "options": [
                  "goals",
                  "qualifications"
                ]
              },
              {
                "number": 3,
                "type": "multiple_choice",
                "prompt": "My sister wants a ______ in the arts.",
                "answer": "career",
                "options": [
                  "career",
                  "leader"
                ]
              },
              {
                "number": 4,
                "type": "multiple_choice",
                "prompt": "Diana is a(n) ______ writer. Her stories are so unique!",
                "answer": "creative",
                "options": [
                  "ambitious",
                  "creative"
                ]
              },
              {
                "number": 5,
                "type": "multiple_choice",
                "prompt": "My ______ is to become a professional dancer.",
                "answer": "goal",
                "options": [
                  "goal",
                  "leader"
                ]
              },
              {
                "number": 6,
                "type": "multiple_choice",
                "prompt": "Bao is a(n) ______ police officer. He’s been doing it for eighteen years.",
                "answer": "experienced",
                "options": [
                  "creative",
                  "experienced"
                ]
              },
              {
                "number": 7,
                "type": "multiple_choice",
                "prompt": "Our school has needed a new ______ ever since Mrs Thompson left.",
                "answer": "leader",
                "options": [
                  "career",
                  "leader"
                ]
              }
            ]
          },
          {
            "section": "8",
            "bookPage": 49,
            "instruction": "Read the vocabulary examples.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "After you fill out the job application, sign and date it.",
                "answer": "",
                "options": [
                  "参考：application: 申请。"
                ]
              },
              {
                "number": 2,
                "type": "short_answer",
                "prompt": "Her boss let her take three days off.",
                "answer": "",
                "options": [
                  "参考：boss: 老板。"
                ]
              },
              {
                "number": 3,
                "type": "short_answer",
                "prompt": "Micah is taking language courses so he can work in China.",
                "answer": "",
                "options": [
                  "参考：course: 课程。"
                ]
              },
              {
                "number": 4,
                "type": "short_answer",
                "prompt": "Mum has got a degree in medicine.",
                "answer": "",
                "options": [
                  "参考：degree: 学位。"
                ]
              },
              {
                "number": 5,
                "type": "short_answer",
                "prompt": "When you finish school, they sometimes give you a diploma.",
                "answer": "",
                "options": [
                  "参考：diploma: 毕业文凭。"
                ]
              },
              {
                "number": 6,
                "type": "short_answer",
                "prompt": "What is Jillian’s occupation? Is she a teacher?",
                "answer": "",
                "options": [
                  "参考：occupation: 职业。"
                ]
              },
              {
                "number": 7,
                "type": "short_answer",
                "prompt": "The starting salary for this career is 80,000 € a year.",
                "answer": "",
                "options": [
                  "参考：salary: 薪水。"
                ]
              },
              {
                "number": 8,
                "type": "short_answer",
                "prompt": "After finishing secondary school, I’ll go to university to study art.",
                "answer": "",
                "options": [
                  "参考：university: 大学。"
                ]
              }
            ]
          },
          {
            "section": "9",
            "bookPage": 49,
            "instruction": "Circle the odd one out.",
            "items": [
              {
                "number": 1,
                "type": "multiple_choice",
                "prompt": "Circle the odd one out.",
                "answer": "course",
                "options": [
                  "boss",
                  "course",
                  "university"
                ]
              },
              {
                "number": 2,
                "type": "multiple_choice",
                "prompt": "Circle the odd one out.",
                "answer": "goal",
                "options": [
                  "occupation",
                  "career",
                  "goal"
                ]
              },
              {
                "number": 3,
                "type": "multiple_choice",
                "prompt": "Circle the odd one out.",
                "answer": "application",
                "options": [
                  "leader",
                  "diploma",
                  "application"
                ]
              },
              {
                "number": 4,
                "type": "multiple_choice",
                "prompt": "Circle the odd one out.",
                "answer": "leader",
                "options": [
                  "degree",
                  "diploma",
                  "leader"
                ]
              }
            ]
          }
        ],
        "wordRefs": [
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 1",
            "word": "ambitious"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 1",
            "word": "career"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 1",
            "word": "creative"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 1",
            "word": "experienced"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 1",
            "word": "goal"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 1",
            "word": "leader"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 1",
            "word": "qualification"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 1",
            "word": "application"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 1",
            "word": "boss"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 1",
            "word": "course"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 1",
            "word": "degree"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 1",
            "word": "diploma"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 1",
            "word": "occupation"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 1",
            "word": "salary"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 1",
            "word": "university"
          }
        ]
      },
      {
        "type": "writing",
        "id": "perfect-job-writing",
        "eyebrow": "写作",
        "title": "My perfect job",
        "prompt": "Write a paragraph about your perfect job. Answer the questions in Activity 11.",
        "questions": [
          "What job are you going to do?",
          "What qualifications and skills will you need?",
          "What will be difficult? What will be enjoyable?"
        ],
        "suggestedWords": [
          "career",
          "qualification",
          "degree",
          "creative",
          "will",
          "going to"
        ],
        "modelAnswer": [
          "My perfect job is to be a teacher. I’m going to study hard and get a university degree. I will need to be patient and good at explaining things. Planning lessons for different students will sometimes be difficult, but I think the job will be enjoyable. I will help children learn new things and become more confident."
        ]
      }
    ],
    "paragraphTitles": [
      "",
      "Quiz: Question 1",
      "Question 2",
      "Question 3",
      "Question 4",
      "Question 5",
      "Mostly a’s",
      "Mostly b’s",
      "Mostly c’s"
    ]
  },
  {
    "key": "5a-u5l2",
    "stage": "5A",
    "unit": "Unit 5",
    "lesson": "Lesson 2",
    "title": "Kiara’s Solution to Drought",
    "paragraphs": [
      "In 2016, South Africa had a terrible drought. As a result, crops were destroyed and farm animals died. It’s difficult to prevent these losses during a drought, but there’s a solution: a special substance for the soil called a super-absorbent polymer, or SAP. The purpose of an SAP is to help soil absorb water and keep it in the ground. During a drought, the SAPs can slowly let water out to keep the crops alive. However, SAPs have got their own problems. Some have got chemicals which are bad for the environment. Also, they’re very expensive, at US $2,000–$3,000 per metric tonne, which makes it tough for many farmers to buy and use them.",
      "South African student Kiara Nirghin understands these problems and has got a sensible solution. She discovered that orange and avocado peels work well as a natural SAP. She created a powder from these peels that absorbs water and keeps it in the ground, just like any other SAP. But her powder doesn’t add chemicals, and it costs less money because it’s made from orange peels thrown away at juice factories. Kiara’s solution can sell for US $30–$60 per metric tonne. And it isn’t just cheaper – it’s more effective! In 2016, sixteen-year-old Kiara won the top prize at the Google Science Fair for this discovery.",
      "Kiara is an ambitious student. For her, the Google Science Fair prize is just the beginning. ‘I might look into health sciences or engineering,’ she says when asked about her goals. ‘Something so I can improve the world.’ In the future, Kiara will probably be working in agriculture sciences doing work to help farmers. She will also be testing her orange peel SAP for other uses, including improving water quality. Kiara is determined to make a difference.",
      "Students between the ages of 13 and 18 can enter the Google Science Fair. The top prize for winning the competition is $50,000 in scholarship money."
    ],
    "learningSections": [
      {
        "type": "exercises",
        "id": "reading-comprehension",
        "eyebrow": "总结",
        "title": "问题与解决方案",
        "groups": [
          {
            "section": "3",
            "bookPage": 50,
            "instruction": "Read and choose Problem or Solution.",
            "items": [
              {
                "number": 1,
                "type": "multiple_choice",
                "prompt": "The drought in South Africa has harmed crops and farm animals.",
                "answer": "Problem",
                "options": [
                  "Problem",
                  "Solution"
                ]
              },
              {
                "number": 2,
                "type": "multiple_choice",
                "prompt": "SAPs absorb water and let it out during a drought.",
                "answer": "Solution",
                "options": [
                  "Problem",
                  "Solution"
                ]
              },
              {
                "number": 3,
                "type": "multiple_choice",
                "prompt": "SAPs cost between US $2,000–$3,000 per metric tonne.",
                "answer": "Problem",
                "options": [
                  "Problem",
                  "Solution"
                ]
              },
              {
                "number": 4,
                "type": "multiple_choice",
                "prompt": "Kiara creates a low-cost SAP that sells for US $30–$60 per metric tonne.",
                "answer": "Solution",
                "options": [
                  "Problem",
                  "Solution"
                ]
              },
              {
                "number": 5,
                "type": "multiple_choice",
                "prompt": "Kiara is testing her SAP for other uses.",
                "answer": "Solution",
                "options": [
                  "Problem",
                  "Solution"
                ]
              }
            ]
          }
        ],
        "description": "保留教材 2016 年报道及赛事旁栏；其中赛事年龄和奖金描述属于当时的教材内容。"
      },
      {
        "type": "grammar",
        "id": "future-continuous",
        "eyebrow": "语法",
        "title": "Future continuous",
        "groups": [
          {
            "section": "7",
            "bookPage": 51,
            "instruction": "Complete with the future continuous.",
            "items": [
              {
                "number": 1,
                "type": "fill_blank",
                "prompt": "I ______ (not take) my science exams this May. I’m not ready.",
                "answer": "won’t be taking\nwill not be taking"
              },
              {
                "number": 2,
                "type": "fill_blank",
                "prompt": "______ you ______ (leave) school this time next year?",
                "answer": "Will; be leaving"
              },
              {
                "number": 3,
                "type": "fill_blank",
                "prompt": "Sonja ______ (write) her school project all day tomorrow.",
                "answer": "will be writing"
              },
              {
                "number": 4,
                "type": "fill_blank",
                "prompt": "We ______ (travel) to Brazil in a few days.",
                "answer": "will be travelling"
              }
            ]
          },
          {
            "section": "8",
            "bookPage": 51,
            "instruction": "Write complete sentences in the future continuous.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "In a few days / we / do our experiment",
                "answer": "In a few days, we will be doing our experiment."
              },
              {
                "number": 2,
                "type": "short_answer",
                "prompt": "This time tomorrow / I / leave for school",
                "answer": "This time tomorrow, I will be leaving for school."
              },
              {
                "number": 3,
                "type": "short_answer",
                "prompt": "Daniel / not finish his project / soon",
                "answer": "Daniel won’t be finishing his project soon.\nDaniel will not be finishing his project soon."
              },
              {
                "number": 4,
                "type": "short_answer",
                "prompt": "During the weekend / Mum and Dad / take us to the science fair",
                "answer": "During the weekend, Mum and Dad will be taking us to the science fair."
              },
              {
                "number": 5,
                "type": "short_answer",
                "prompt": "In five years / she / not work as a scientist",
                "answer": "In five years, she won’t be working as a scientist.\nIn five years, she will not be working as a scientist."
              }
            ]
          }
        ],
        "grammarRefs": [
          {
            "book": "intermediate",
            "unitNumber": 24,
            "role": "extension",
            "label": "中级：将来进行时与将来完成时"
          },
          {
            "book": "essential",
            "unitNumber": 27,
            "role": "foundation",
            "label": "will / shall"
          }
        ],
        "summary": {
          "cards": [
            {
              "title": "将来某时正在进行",
              "formula": "will be + verb-ing",
              "signals": "this time tomorrow · in a few days · next week · during the trip",
              "points": [
                {
                  "label": "肯定",
                  "text": "This time tomorrow, we’ll be travelling to South Africa."
                },
                {
                  "label": "疑问",
                  "text": "Will she be studying during the trip?"
                },
                {
                  "label": "否定",
                  "text": "No, I won’t. They won’t be working this hard in a few days."
                }
              ]
            }
          ],
          "contrastTitle": "关键区别",
          "contrasts": [
            {
              "example": "Kiara will probably be working in agriculture sciences.",
              "note": "强调将来某时正在做的活动。"
            },
            {
              "example": "The invention will affect how people water their plants.",
              "note": "一般将来时说明将来的影响。"
            }
          ],
          "decisionGuide": [
            "看到将来某个时刻，并强调那时正在发生 → will be + -ing。",
            "所有人称都用 will；否定用 will not / won’t be + -ing。"
          ],
          "reminders": []
        }
      },
      {
        "type": "exercises",
        "id": "place-vocabulary",
        "eyebrow": "词汇",
        "title": "科学研究与短语动词",
        "groups": [
          {
            "section": "4",
            "bookPage": 50,
            "instruction": "Circle the best meaning for each word.",
            "items": [
              {
                "number": 1,
                "type": "multiple_choice",
                "prompt": "tough",
                "answer": "difficult",
                "options": [
                  "soft",
                  "difficult"
                ]
              },
              {
                "number": 2,
                "type": "multiple_choice",
                "prompt": "sensible",
                "answer": "reasonable",
                "options": [
                  "reasonable",
                  "experienced"
                ]
              },
              {
                "number": 3,
                "type": "multiple_choice",
                "prompt": "purpose",
                "answer": "reason",
                "options": [
                  "reason",
                  "opinion"
                ]
              },
              {
                "number": 4,
                "type": "multiple_choice",
                "prompt": "determined",
                "answer": "focused on a goal",
                "options": [
                  "focused on a goal",
                  "well paid"
                ]
              },
              {
                "number": 5,
                "type": "multiple_choice",
                "prompt": "effective",
                "answer": "useful",
                "options": [
                  "foolish",
                  "useful"
                ]
              },
              {
                "number": 6,
                "type": "multiple_choice",
                "prompt": "substance",
                "answer": "material",
                "options": [
                  "material",
                  "career"
                ]
              }
            ]
          },
          {
            "section": "5",
            "bookPage": 51,
            "instruction": "Read the vocabulary in context.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "The invention will affect how people water their plants.",
                "answer": "",
                "options": [
                  "参考：affect: 影响。"
                ]
              },
              {
                "number": 2,
                "type": "short_answer",
                "prompt": "Kiara’s mum wants her to inspire other girls to study science.",
                "answer": "",
                "options": [
                  "参考：inspire: 激励。"
                ]
              },
              {
                "number": 3,
                "type": "short_answer",
                "prompt": "You need a good knowledge of science to understand the problem.",
                "answer": "",
                "options": [
                  "参考：knowledge: 知识。"
                ]
              },
              {
                "number": 4,
                "type": "short_answer",
                "prompt": "They’re studying biology to prepare for a career as a scientist.",
                "answer": "",
                "options": [
                  "参考：prepare: 做准备。"
                ]
              },
              {
                "number": 5,
                "type": "short_answer",
                "prompt": "We’re working on our science project after school this week.",
                "answer": "",
                "options": [
                  "参考：project: 项目。"
                ]
              },
              {
                "number": 6,
                "type": "short_answer",
                "prompt": "We’re doing this experiment to prove our theory.",
                "answer": "",
                "options": [
                  "参考：prove: 证明。"
                ]
              }
            ]
          },
          {
            "section": "6",
            "bookPage": 51,
            "instruction": "Complete with words from Activity 5.",
            "items": [
              {
                "number": 1,
                "type": "fill_blank",
                "prompt": "My experiment will ______ that this species can live with little water.",
                "answer": "prove"
              },
              {
                "number": 2,
                "type": "fill_blank",
                "prompt": "Are you ______ to enter the science fair?",
                "answer": "prepared"
              },
              {
                "number": 3,
                "type": "fill_blank",
                "prompt": "Nobody is sure how these chemicals will ______ the soil.",
                "answer": "affect"
              },
              {
                "number": 4,
                "type": "fill_blank",
                "prompt": "My uncle has a good ______ of the newest technology, so I’ll ask him.",
                "answer": "knowledge"
              }
            ]
          },
          {
            "section": "Phrasal verbs",
            "bookPage": 51,
            "instruction": "Circle the correct words.",
            "items": [
              {
                "number": 1,
                "type": "multiple_choice",
                "prompt": "I can’t keep ______ with James. He walks so fast.",
                "answer": "up",
                "options": [
                  "out",
                  "up"
                ]
              },
              {
                "number": 2,
                "type": "multiple_choice",
                "prompt": "How did you put up ______ sleeping on the ground for two weeks?",
                "answer": "with",
                "options": [
                  "with",
                  "to"
                ]
              },
              {
                "number": 3,
                "type": "multiple_choice",
                "prompt": "Don’t give ______ now! You can do it!",
                "answer": "up",
                "options": [
                  "up",
                  "off"
                ]
              },
              {
                "number": 4,
                "type": "multiple_choice",
                "prompt": "Pete was quite ill. It took him months to get ______ it.",
                "answer": "over",
                "options": [
                  "by",
                  "over"
                ]
              },
              {
                "number": 5,
                "type": "multiple_choice",
                "prompt": "I wanted to go camping this year, but Joe put me ______.",
                "answer": "off",
                "options": [
                  "on",
                  "off"
                ]
              },
              {
                "number": 6,
                "type": "multiple_choice",
                "prompt": "He wanted to participate in the science fair, but the organisers turned him ______.",
                "answer": "down",
                "options": [
                  "down",
                  "up"
                ]
              }
            ]
          }
        ],
        "wordRefs": [
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 2",
            "word": "tough"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 2",
            "word": "sensible"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 2",
            "word": "purpose"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 2",
            "word": "determined"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 2",
            "word": "effective"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 2",
            "word": "substance"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 2",
            "word": "affect"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 2",
            "word": "inspire"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 2",
            "word": "knowledge"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 2",
            "word": "prepare"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 2",
            "word": "project"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 2",
            "word": "prove"
          }
        ]
      }
    ],
    "paragraphTitles": [
      "",
      "",
      "",
      "Guess what!"
    ],
    "glossary": [
      {
        "word": "Kiara Nirghin",
        "meaningCn": "基亚拉·尼尔金（南非学生发明者）",
        "meaningEn": "the South African student featured in the article",
        "category": "专有名词",
        "isProperNoun": true
      },
      {
        "word": "Google Science Fair",
        "meaningCn": "谷歌科学挑战赛（教材所述赛事）",
        "meaningEn": "the science competition described in the textbook",
        "category": "专有名词",
        "isProperNoun": true
      },
      {
        "word": "super-absorbent polymer",
        "meaningCn": "n. 高吸水性聚合物（SAP）",
        "meaningEn": "a material that absorbs and holds a large amount of water",
        "category": "超纲词汇"
      }
    ]
  },
  {
    "key": "5a-u5l3",
    "stage": "5A",
    "unit": "Unit 5",
    "lesson": "Lesson 3",
    "title": "The Future",
    "paragraphs": [
      "I’m about to apply to university for courses in computer science. After university, I’m not going to get a job. I’m going to start my own company and be my own boss! There are so many young people running online companies. I think anyone with an original idea can succeed. By the age of twenty-five, I probably won’t have become a millionaire, but maybe I’ll have enough money to buy my own home.",
      "I play the guitar in a band called Nobody’s Heroes. We’ve played a few times at local music festivals and people say we’ve got talent. By the time I’m twenty-five, I hope we will have become famous. Maybe we will have even been on a world tour! My parents are worried that I’m wasting my time and they complain about the noise I make when I’m practising. They hope that I’ll give up music and try to get some qualifications for a career in business or medicine.",
      "I’m not interested in being rich or famous, but I really love travelling and photography! First, I want to study for a degree in languages. I’m determined to travel round the world taking amazing photos of people and places. By the time I’m twenty-five, I hope I will have visited lots of interesting places and had some amazing experiences. Who knows? Maybe I will have sold my photos to magazines! Maybe I will have moved to another country!"
    ],
    "learningSections": [
      {
        "type": "exercises",
        "id": "reading-comprehension",
        "eyebrow": "总结",
        "title": "三位少年的未来梦想",
        "groups": [
          {
            "section": "2",
            "bookPage": 52,
            "instruction": "Choose Laura, Tomás or Chiyo.",
            "items": [
              {
                "number": 1,
                "type": "multiple_choice",
                "prompt": "Who may live in another country one day?",
                "answer": "Chiyo",
                "options": [
                  "Laura",
                  "Tomás",
                  "Chiyo"
                ]
              },
              {
                "number": 2,
                "type": "multiple_choice",
                "prompt": "Who wants to be his/her own boss?",
                "answer": "Laura",
                "options": [
                  "Laura",
                  "Tomás",
                  "Chiyo"
                ]
              },
              {
                "number": 3,
                "type": "multiple_choice",
                "prompt": "Who has got a special talent that he/she wants to use?",
                "answer": "Tomás",
                "options": [
                  "Laura",
                  "Tomás",
                  "Chiyo"
                ]
              },
              {
                "number": 4,
                "type": "multiple_choice",
                "prompt": "Who has got parents that don’t support his/her dream?",
                "answer": "Tomás",
                "options": [
                  "Laura",
                  "Tomás",
                  "Chiyo"
                ]
              }
            ]
          },
          {
            "section": "2.5",
            "bookPage": 52,
            "instruction": "Who will continue his/her education after school? Write both names.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "Name the two teenagers and explain.",
                "answer": "",
                "options": [
                  "参考：Laura wants to study computer science; Chiyo wants a degree in languages."
                ]
              }
            ]
          },
          {
            "section": "Say it like this",
            "bookPage": 52,
            "instruction": "Use be about to + verb for immediate future plans. Example: I’m about to make a cup of tea. Do you want one? Mum is about to go shopping.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "Tell a partner about something you are about to do: go on holiday, have lunch, start a project or do homework.",
                "answer": ""
              }
            ]
          }
        ]
      },
      {
        "type": "grammar",
        "id": "future-perfect-simple",
        "eyebrow": "语法",
        "title": "Future perfect simple",
        "groups": [
          {
            "section": "3",
            "bookPage": 53,
            "instruction": "Complete with the future perfect simple.",
            "items": [
              {
                "number": 1,
                "type": "fill_blank",
                "prompt": "Emad ______ (not save) enough money for his trip by next year.",
                "answer": "won’t have saved\nwill not have saved"
              },
              {
                "number": 2,
                "type": "fill_blank",
                "prompt": "By next week, ______ you ______ (complete) your applications for university?",
                "answer": "will; have completed"
              },
              {
                "number": 3,
                "type": "fill_blank",
                "prompt": "By the age of twenty-five, we ______ (find) good jobs.",
                "answer": "will have found"
              },
              {
                "number": 4,
                "type": "fill_blank",
                "prompt": "Grandma and Grandpa ______ (leave) for Japan by next month.",
                "answer": "will have left"
              },
              {
                "number": 5,
                "type": "fill_blank",
                "prompt": "The judges ______ (not decide) the winners of the science fair by this evening.",
                "answer": "won’t have decided\nwill not have decided"
              }
            ]
          },
          {
            "section": "4",
            "bookPage": 53,
            "instruction": "Write what Vicki will or won’t have done by 2030. The textbook photos show: footballer ✗, married ✓, Machu Picchu ✓, degree ✓, expensive car ✗.",
            "items": [
              {
                "number": 1,
                "type": "fill_blank",
                "prompt": "By 2030, Vicki ______ a professional footballer.",
                "answer": "won’t have become\nwill not have become"
              },
              {
                "number": 2,
                "type": "fill_blank",
                "prompt": "By 2030, Vicki ______ married.",
                "answer": "will have got"
              },
              {
                "number": 3,
                "type": "fill_blank",
                "prompt": "By 2030, Vicki ______ Machu Picchu.",
                "answer": "will have visited"
              },
              {
                "number": 4,
                "type": "fill_blank",
                "prompt": "By 2030, Vicki ______ a degree from university.",
                "answer": "will have got"
              },
              {
                "number": 5,
                "type": "fill_blank",
                "prompt": "By 2030, Vicki ______ an expensive car.",
                "answer": "won’t have bought\nwill not have bought"
              }
            ]
          }
        ],
        "grammarRefs": [
          {
            "book": "intermediate",
            "unitNumber": 24,
            "role": "extension",
            "label": "中级：将来进行时与将来完成时"
          },
          {
            "book": "essential",
            "unitNumber": 24,
            "role": "foundation",
            "label": "规则与不规则动词"
          }
        ],
        "summary": {
          "cards": [
            {
              "title": "将来某时之前完成",
              "formula": "will have + past participle",
              "signals": "by the time · by the age of · by tomorrow / next week / month / year",
              "points": [
                {
                  "label": "截至将来某时",
                  "text": "By the time I get home, I will have fallen asleep."
                },
                {
                  "label": "截至某个年龄",
                  "text": "By the age of 30, she will have become a doctor."
                }
              ]
            }
          ],
          "contrastTitle": "关键区别",
          "contrasts": [
            {
              "example": "She will be working as a scientist.",
              "note": "将来进行时：那时正在做。"
            },
            {
              "example": "She will have become a doctor.",
              "note": "将来完成时：那时之前已经完成。"
            }
          ],
          "decisionGuide": [
            "先找将来的截止时间（by ...）。",
            "强调截止前已经完成 → will have + 过去分词；否定用 won’t have。"
          ],
          "reminders": []
        }
      },
      {
        "type": "exercises",
        "id": "place-vocabulary",
        "eyebrow": "词汇",
        "title": "写作技巧：主题句",
        "groups": [
          {
            "section": "Writing A",
            "bookPage": 53,
            "instruction": "Each paragraph begins with a topic sentence. Choose the sentence that fits.",
            "items": [
              {
                "number": 1,
                "type": "multiple_choice",
                "prompt": "Elora’s Dream: ______ She is quite shy with people, though, and it can be tough for her to make friends. So, she prefers spending her time with animals.",
                "answer": "Elora, who is 17 years old, is a lovely person.",
                "options": [
                  "Elora, who is 17 years old, is very popular at school.",
                  "Elora, who is 17 years old, is a lovely person."
                ]
              }
            ]
          },
          {
            "section": "Writing A discussion",
            "bookPage": 53,
            "instruction": "Explain why the other topic sentence does not fit.",
            "items": [
              {
                "number": 1,
                "type": "short_answer",
                "prompt": "Why does “very popular at school” not fit the paragraph?",
                "answer": "",
                "options": [
                  "参考：The paragraph describes her shyness and difficulty making friends; it does not develop the idea of popularity."
                ]
              }
            ]
          },
          {
            "section": "Writing B",
            "bookPage": 53,
            "instruction": "Choose the topic sentence for each paragraph.",
            "items": [
              {
                "number": 1,
                "type": "multiple_choice",
                "prompt": "______ Now she’s determined to make her dream come true. She is good at science and is studying very hard to go to university next year. She’s also working part-time at a local animal shelter, where she looks after animals that don’t have a home.",
                "answer": "Elora has always dreamed of becoming a vet.",
                "options": [
                  "Elora has always dreamed of becoming a vet.",
                  "Since she was a little girl, Elora has wanted to work in an animal shelter."
                ]
              },
              {
                "number": 2,
                "type": "multiple_choice",
                "prompt": "______ I’m sure she’ll pass her exams, go to university and get a degree. In a few years, she will be working as a vet and helping animals which she loves so much.",
                "answer": "I think that Elora will succeed in getting her dream job.",
                "options": [
                  "I think that Elora will succeed in getting her dream job.",
                  "In a couple of years, Elora will have become a vet."
                ]
              }
            ]
          }
        ],
        "wordRefs": [
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 3",
            "word": "complain"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 3",
            "word": "be about to do ..."
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 3",
            "word": "run"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 3",
            "word": "succeed"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 3",
            "word": "millionaire"
          },
          {
            "stage": "5A",
            "unit": "Unit 5",
            "lesson": "Lesson 3",
            "word": "tour"
          }
        ]
      },
      {
        "type": "writing",
        "id": "ambition-article",
        "eyebrow": "写作",
        "title": "Write about someone’s ambition",
        "prompt": "Write an article about someone you know who has got an ambition to do something. Use a topic sentence in each main paragraph, and check them as in Activity D.",
        "questions": [
          "Paragraph 1: Introduce the person and describe his/her skills and abilities.",
          "Paragraph 2: State the dream or ambition and explain how the person is trying to make it come true.",
          "Paragraph 3: Say if and when you think the person will achieve the goal."
        ],
        "suggestedWords": [
          "ambition",
          "determined",
          "prepare",
          "succeed",
          "will be",
          "will have"
        ],
        "modelAnswer": [
          "Mia’s Dream\n\nMy friend Mia is a creative and patient person. She enjoys drawing animals and is good at noticing small details. She also likes telling stories with her pictures.",
          "Mia dreams of becoming an illustrator. She practises drawing every day and reads many picture books. She is going to study art and learn how to use computer drawing programs.",
          "I think Mia will achieve her goal because she works hard and enjoys learning. By the time she finishes university, she will have made a collection of her best drawings. I hope she will be illustrating books one day."
        ]
      }
    ],
    "paragraphTitles": [
      "Laura, 15",
      "Tomás, 17",
      "Chiyo, 16"
    ],
    "glossary": [
      {
        "word": "Nobody’s Heroes",
        "meaningCn": "Nobody’s Heroes（Tomás 的乐队名）",
        "meaningEn": "the band Tomás plays in",
        "category": "专有名词",
        "isProperNoun": true
      }
    ]
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
function wordForms(word: string): string[] {
  const labelled = /^(.+?)\s*\((?:AmE\s+)?([^)]+)\)$/i.exec(word.trim())
  return labelled ? [labelled[1].trim(), labelled[2].trim()] : [word]
}

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
  const stems = words.flatMap((word) => wordForms(word).flatMap(expandStems))
  const sorted = stems.slice().sort((a, b) => b.length - a.length)
  const pattern = sorted.map(escapeRegex).join('|')
  return new RegExp(`\\b(${pattern})${INFLECTION_SUFFIX}\\b`, 'gi')
}

/** Build the passage matcher from complete entries, including explicit word_forms. */
export function buildEntryMatchRegex(entries: WordEntry[]): RegExp | null {
  if (entries.length === 0) return null
  const forms = entries.flatMap(getWordFormCandidates).map((candidate) => candidate.text)
  const pattern = [...new Set(forms.map((form) => form.toLowerCase()))]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|')
  return pattern ? new RegExp(`\\b(${pattern})\\b`, 'gi') : null
}

/**
 * Given a matched text fragment from {@link buildWordMatchRegex} and the
 * candidate word entries, return the entry whose `word` is the base form of
 * the match (case-insensitive, plural- and inflection-tolerant).
 */
export function resolveMatchedWord(matchedText: string, candidates: WordEntry[]): WordEntry | null {
  return resolveWordFormMatch(matchedText, candidates)?.entry ?? null
}

/** Resolve a surface form and retain the relation shown by reading popups/quizzes. */
export function resolveWordFormMatch(
  matchedText: string,
  candidates: WordEntry[],
): WordFormMatch | null {
  const normalized = matchedText.trim().toLowerCase()
  let best: WordFormMatch | null = null
  for (const entry of candidates) {
    const candidate = getWordFormCandidates(entry).find(
      (form) => form.text.toLowerCase() === normalized,
    )
    if (!candidate) continue
    const match = { ...candidate, entry, matchedText }
    if (
      !best ||
      candidate.source === 'base' ||
      (candidate.source === 'explicit' && best.source === 'generated')
    ) {
      best = match
    }
    if (candidate.source === 'base') break
  }
  return best
}

/** Legacy resolver for callers that still use the suffix-only matcher. */
export function resolveLegacyMatchedWord(
  matchedText: string,
  candidates: WordEntry[],
): WordEntry | null {
  const stems = deinflectCandidates(matchedText)
  let best: WordEntry | null = null
  for (const c of candidates) {
    const forms = wordForms(c.word).map((word) => word.toLowerCase())
    if (forms.some((word) => stems.includes(word))) {
      if (!best || c.word.length > best.word.length) best = c
    }
  }
  return best
}

const SENTENCE_SPLIT = /(?<=[.!?])\s+/

/** Per-word inflection-tolerant regex source (shared by single-word lookups). */
function inflectedSource(word: string): string {
  const stems = wordForms(word).flatMap(expandStems)
  const pattern = stems.map(escapeRegex).join('|')
  return `\\b(?:${pattern})${INFLECTION_SUFFIX}\\b`
}

export function buildEntryRegex(entry: WordEntry): RegExp {
  const pattern = getWordFormCandidates(entry)
    .map((candidate) => candidate.text)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|')
  return new RegExp(`\\b(?:${pattern})\\b`, 'i')
}

/**
 * Find the first sentence (across all paragraphs) that contains `word`.
 * Inflection-tolerant — matches `interviewing` against `interview`, etc.
 */
export function findSentenceForWord(
  passage: ReadingPassage,
  word: string | WordEntry,
): { sentence: string; paragraphIndex: number } | null {
  const regex = typeof word === 'string' ? new RegExp(inflectedSource(word), 'i') : buildEntryRegex(word)
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
export function blankWordInSentence(sentence: string, word: string | WordEntry): string {
  const re = typeof word === 'string' ? new RegExp(inflectedSource(word), 'i') : buildEntryRegex(word)
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
export function findParagraphIndexForWord(
  passage: ReadingPassage,
  word: string | WordEntry,
): number | null {
  const regex = typeof word === 'string' ? new RegExp(inflectedSource(word), 'i') : buildEntryRegex(word)
  for (let i = 0; i < passage.paragraphs.length; i++) {
    if (regex.test(passage.paragraphs[i])) return i
  }
  return null
}
