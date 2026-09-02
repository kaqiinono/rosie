import type { WordEntry } from '@rosie/core'
import type { GrammarExerciseGroup } from '../grammar/types'

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

/**
 * Given a matched text fragment from {@link buildWordMatchRegex} and the
 * candidate word entries, return the entry whose `word` is the base form of
 * the match (case-insensitive, plural- and inflection-tolerant).
 */
export function resolveMatchedWord(matchedText: string, candidates: WordEntry[]): WordEntry | null {
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
