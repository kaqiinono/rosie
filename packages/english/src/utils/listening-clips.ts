import { baiduReadingAudioUrl, lessonAudioUrl } from './reading-audio-types'
import type { ReadingPassage } from './reading-data'

export interface ListeningClip {
  singleRead: [number, number]
  sourceUrl?: string
  target: string
  english: string
  chinese: string
}

// In recording order. Two sentences are practiced in separate clauses.
const u3l2: [string, string, [number, number]][] = [
  ['title', '大自然中的奇妙生物', [4.2, 6.4]],
  ['0-0', '你可能已经学过不少有关动物的知识，', [0.6, 4.0]],
  ['0-1', '但我们猜你还没有研究过像下面这些一样奇特的动物。', [1.05, 5.36]],
  ['0-2', '下面是自然界中三种不同寻常的生物。', [1.09, 4.17]],
  ['heading-1', '鸭嘴兽', [1.32, 2.85]],
  ['1-0', '这种奇特的澳大利亚动物，身上的一些部位似乎来自其他更常见的物种：', [0.93, 6.53]],
  ['1-1', '鸭子般的嘴、长满毛的身体，还有像河狸一样的尾巴。', [0.8, 5.41]],
  ['2-0', '鸭嘴兽很会游泳，但它也在陆地上生活。', [1.55, 5.24]],
  ['2-1', '上岸时，它带蹼的脚会发生变化，方便它奔跑。', [1.45, 5.01]],
  ['2-2', '鸭嘴兽是哺乳动物，妈妈会给宝宝喂大约四个月的奶。', [0.88, 5.81]],
  ['2-3', '但这种哺乳动物特别的地方在于，它会下蛋！', [2.2, 6.04]],
  ['heading-3', '短角蜥蜴', [2.07, 3.44]],
  ['3-0', '短角蜥蜴生活在北美洲。', [1.16, 3.84]],
  ['3-1', '它的头上和背上长着角，身体上覆盖着鳞片。', [1.5, 5.95]],
  ['3-2', '短角蜥蜴与其他爬行动物的不同之处在于它保护自己的方式。', [1.2, 6.31]],
  ['3-3', '它能把身体鼓起来，看起来像个带刺的气球。', [1.65, 5.54]],
  ['3-4', '如果这招不管用，它就从眼睛里喷出血来迷惑捕食者。', [1.4, 5.87]],
  ['3-5', '它喷出的血能射到一米（三英尺）远的地方！', [1.33, 5.28]],
  ['heading-4', '王鹫', [1.3, 2.36]],
  ['4-0', '别只凭这只鸟色彩鲜艳的外表就对它下判断。', [1.54, 4.61]],
  ['4-1', '尽管王鹫看上去鲜艳又欢快，它的工作却挺令人反胃：它吃死去的动物。', [0.79, 8.38]],
  ['4-2', '王鹫生活在中美洲和南美洲，它吃掉这些动物尸体，清理了森林地面。', [1.03, 7.94]],
  ['4-3', '这有助于防止疾病传播。', [1.71, 3.99]],
  ['4-4', '王鹫颜色鲜亮的头上没有羽毛，这让它进食时更容易保持清洁。', [0.57, 7.03]],
  ['4-5', '此外，它的喙和爪子非常强壮，进食时也很有用。', [1.54, 6.57]],
  ['heading-5', '你猜怎么着！', [0.71, 1.55]],
  ['5-0', '鸭嘴兽或许看起来很可爱，但你可要小心！', [0.95, 4.76]],
  ['5-1', '雄性鸭嘴兽有毒，被它刺伤可能会致命。', [1.77, 6.48]],
]

// One complete sentence per recording, in source order. Times are clip-local.
const u3l3: [string, string, [number, number]][] = [
  ['0-0', '这周末能来到冰岛，我真是太兴奋了。', [0.12, 3.113]],
  ['0-1', '今天早上，我们坐上了前往南部海岸的巴士，去欣赏冰岛的一些自然美景。', [0.12, 5.909]],
  ['0-2', '我们打算明天晚上试着去看北极光。', [0.12, 3.044]],
  ['0-3', '即使看不到极光，我也已经在旅途中见到了一些最令人惊叹的景色。', [0.12, 5.724]],
  ['1-0', '今天我们在一座国家公园停留，探索了一个冰洞。', [0.12, 4.17]],
  ['1-1', '人们叫它“水晶洞”，因为洞里的冰像水晶一样清澈。', [0.12, 4.952]],
  ['1-2', '探索冰洞可能很危险，所以我们跟着一位向导前往。', [0.12, 4.535]],
  ['1-3', '我们必须穿上特殊的靴子——那是我穿过的最不舒服的靴子——但这一切都值得。', [0.12, 6.518]],
  ['2-0', '今天我们探索了杰古沙龙冰河湖。', [0.12, 4.508]],
  ['2-1', '这是一个由冰川融水形成的大湖，也是我去过的最冷的湖！', [0.12, 6.002]],
  ['2-2', '我可一点也不想下水游泳。', [0.12, 2.328]],
  ['2-3', '我们还看到了瀑布和一片黑沙滩。', [0.12, 3.48]],
  ['2-4', '它和我们家附近的海滩完全不一样。', [0.12, 2.37]],
  ['2-5', '向导说它叫“钻石海滩”，因为黑色的沙子像钻石一样闪闪发亮。', [0.12, 5.869]],
  ['3-0', '晚上，我们出去寻找北极光。', [0.12, 3.351]],
  ['3-1', '当太阳与地球大气层中的某些气体相遇时，就会出现北极光。', [0.12, 4.091]],
  ['3-2', '很难知道极光什么时候会出现。', [0.12, 2.238]],
  ['3-3', '不过我们很幸运，第一晚就看到了极光。', [0.12, 3.502]],
  ['3-4', '极光有绿色和紫色。', [0.08, 2.12]],
  ['3-5', '那真是不可思议——一场大自然的灯光秀。', [0.08, 3.747]],
  ['3-6', '我这辈子从没见过比这更令人惊叹的景象！', [0.12, 2.724]],
  ['4-0', '遗憾的是，我们明天就要离开了。', [0.12, 2.474]],
  ['4-1', '时间过得太快了，但这个周末会比其他任何周末都更让我难忘。', [0.12, 5.067]],
  ['4-2', '真是太棒了！', [0.12, 1.249]],
]

const clipsByPassage: Record<string, [string, string, [number, number]][]> = {
  '5a-u3l2': u3l2,
  '5a-u3l3': u3l3,
}

export function readingSegments(passage: ReadingPassage, index: number): string[] {
  let text = passage.paragraphs[index]
  for (const phrase of passage.listeningBreaks?.[index] ?? []) {
    text = text.replace(' ' + phrase, '\n' + phrase)
  }
  return text.split(/(?<=[.!?])\s+|\n/)
}

export function listeningClipsFor(passage: ReadingPassage | undefined): ListeningClip[] {
  if (!passage) return []
  const clips = clipsByPassage[passage.key]
  if (!clips) return []
  return clips.map(([target, chinese, singleRead]) => {
    const [paragraph, sentence] = target.split('-')
    const english =
      target === 'title'
        ? passage.title
        : paragraph === 'heading'
          ? passage.paragraphTitles![Number(sentence)]
          : readingSegments(passage, Number(paragraph))[Number(sentence)]
    return { target, english, chinese, singleRead }
  })
}

export function lessonListeningTargets(passage: ReadingPassage) {
  const targets = [{ target: 'title', english: passage.title }]
  passage.paragraphs.forEach((_, index) => {
    const heading = passage.paragraphTitles?.[index]
    if (heading) targets.push({ target: 'heading-' + index, english: heading })
    readingSegments(passage, index).forEach((english, sentence) => {
      targets.push({ target: index + '-' + sentence, english })
    })
  })
  return targets
}

export function playableListeningClips(
  passage: ReadingPassage | undefined,
  slots: string[],
): ListeningClip[] {
  if (!passage) return []
  const legacy = listeningClipsFor(passage)
  if (!slots.some((slot) => slot.startsWith(passage.key + '#clip:'))) return legacy
  const byTarget = new Map(
    legacy.map((clip, i) => [
      clip.target,
      {
        ...clip,
        sourceUrl: baiduReadingAudioUrl(passage.key) + '?clip=' + String(i + 1).padStart(2, '0'),
      },
    ]),
  )
  const available = new Set(slots)
  return lessonListeningTargets(passage).flatMap((sentence) => {
    const slot = 'clip:' + sentence.target
    const old = byTarget.get(sentence.target)
    if (available.has(passage.key + '#' + slot)) {
      return [
        {
          ...sentence,
          chinese: old?.chinese ?? '',
          singleRead: [0, Infinity] as [number, number],
          sourceUrl: lessonAudioUrl(passage.key, slot),
        },
      ]
    }
    return old ? [old] : []
  })
}
