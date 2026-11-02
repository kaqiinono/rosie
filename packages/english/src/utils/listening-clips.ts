import type { ReadingPassage } from './reading-data'

export interface ListeningClip {
  singleRead: [number, number]
  target: string
  english: string
  chinese: string
}

// In recording order. Two sentences are practiced in separate clauses.
const u3l2: [string, string, [number, number]][] = [
  ['title', '大自然中的奇妙生物', [4.20, 6.40]],
  ['0-0', '你可能已经学过不少有关动物的知识，', [0.60, 4.00]],
  ['0-1', '但我们猜你还没有研究过像下面这些一样奇特的动物。', [1.05, 5.36]],
  ['0-2', '下面是自然界中三种不同寻常的生物。', [1.09, 4.17]],
  ['heading-1', '鸭嘴兽', [1.32, 2.85]],
  ['1-0', '这种奇特的澳大利亚动物，身上的一些部位似乎来自其他更常见的物种：', [0.93, 6.53]],
  ['1-1', '鸭子般的嘴、长满毛的身体，还有像河狸一样的尾巴。', [0.80, 5.41]],
  ['2-0', '鸭嘴兽很会游泳，但它也在陆地上生活。', [1.55, 5.24]],
  ['2-1', '上岸时，它带蹼的脚会发生变化，方便它奔跑。', [1.45, 5.01]],
  ['2-2', '鸭嘴兽是哺乳动物，妈妈会给宝宝喂大约四个月的奶。', [0.88, 5.81]],
  ['2-3', '但这种哺乳动物特别的地方在于，它会下蛋！', [2.20, 6.04]],
  ['heading-3', '短角蜥蜴', [2.07, 3.44]],
  ['3-0', '短角蜥蜴生活在北美洲。', [1.16, 3.84]],
  ['3-1', '它的头上和背上长着角，身体上覆盖着鳞片。', [1.50, 5.95]],
  ['3-2', '短角蜥蜴与其他爬行动物的不同之处在于它保护自己的方式。', [1.20, 6.31]],
  ['3-3', '它能把身体鼓起来，看起来像个带刺的气球。', [1.65, 5.54]],
  ['3-4', '如果这招不管用，它就从眼睛里喷出血来迷惑捕食者。', [1.40, 5.87]],
  ['3-5', '它喷出的血能射到一米（三英尺）远的地方！', [1.33, 5.28]],
  ['heading-4', '王鹫', [1.30, 2.36]],
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

export function readingSegments(passage: ReadingPassage, index: number): string[] {
  let text = passage.paragraphs[index]
  for (const phrase of passage.listeningBreaks?.[index] ?? []) {
    text = text.replace(' ' + phrase, '\n' + phrase)
  }
  return text.split(/(?<=[.!?])\s+|\n/)
}

export function listeningClipsFor(passage: ReadingPassage | undefined): ListeningClip[] {
  if (passage?.key !== '5a-u3l2') return []
  return u3l2.map(([target, chinese, singleRead]) => {
    const [paragraph, sentence] = target.split('-')
    const english = target === 'title' ? passage.title
      : paragraph === 'heading' ? passage.paragraphTitles![Number(sentence)]
      : readingSegments(passage, Number(paragraph))[Number(sentence)]
    return { target, english, chinese, singleRead }
  })
}
