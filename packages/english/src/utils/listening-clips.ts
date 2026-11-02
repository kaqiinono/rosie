import type { ReadingPassage } from './reading-data'

export interface ListeningClip {
  target: string
  english: string
  chinese: string
}

// In recording order. Two sentences are practiced in separate clauses.
const u3l2: [string, string, string?][] = [
  ['title', '大自然中的奇妙生物'],
  ['0-0', '你可能已经学过不少有关动物的知识，', 'You’ve probably learnt a lot about animals,'],
  ['0-0', '但我们猜你还没有研究过像下面这些一样奇特的动物。', 'but we bet you haven’t been studying animals as unusual as these.'],
  ['0-1', '下面是自然界中三种不同寻常的生物。'],
  ['heading-1', '鸭嘴兽'],
  ['1-0', '这种奇特的澳大利亚动物，身上的一些部位似乎来自其他更常见的物种：', 'This unusual Australian animal seems to have parts from other, more common species:'],
  ['1-0', '鸭子般的嘴、长满毛的身体，还有像河狸一样的尾巴。', 'a duck’s bill, a body covered with fur, and a beaver-like tail.'],
  ['2-0', '鸭嘴兽很会游泳，但它也在陆地上生活。'],
  ['2-1', '上岸时，它带蹼的脚会发生变化，方便它奔跑。'],
  ['2-2', '鸭嘴兽是哺乳动物，妈妈会给宝宝喂大约四个月的奶。'],
  ['2-3', '但这种哺乳动物特别的地方在于，它会下蛋！'],
  ['heading-3', '短角蜥蜴'],
  ['3-0', '短角蜥蜴生活在北美洲。'],
  ['3-1', '它的头上和背上长着角，身体上覆盖着鳞片。'],
  ['3-2', '短角蜥蜴与其他爬行动物的不同之处在于它保护自己的方式。'],
  ['3-3', '它能把身体鼓起来，看起来像个带刺的气球。'],
  ['3-4', '如果这招不管用，它就从眼睛里喷出血来迷惑捕食者。'],
  ['3-5', '它喷出的血能射到一米（三英尺）远的地方！'],
  ['heading-4', '王鹫'],
  ['4-0', '别只凭这只鸟色彩鲜艳的外表就对它下判断。'],
  ['4-1', '尽管王鹫看上去鲜艳又欢快，它的工作却挺令人反胃：它吃死去的动物。'],
  ['4-2', '王鹫生活在中美洲和南美洲，它吃掉这些动物尸体，清理了森林地面。'],
  ['4-3', '这有助于防止疾病传播。'],
  ['4-4', '王鹫颜色鲜亮的头上没有羽毛，这让它进食时更容易保持清洁。'],
  ['4-5', '此外，它的喙和爪子非常强壮，进食时也很有用。'],
  ['heading-5', '你猜怎么着！'],
  ['5-0', '鸭嘴兽或许看起来很可爱，但你可要小心！'],
  ['5-1', '雄性鸭嘴兽有毒，被它刺伤可能会致命。'],
]

export function listeningClipsFor(passage: ReadingPassage | undefined): ListeningClip[] {
  if (passage?.key !== '5a-u3l2') return []
  return u3l2.map(([target, chinese, excerpt]) => {
    const [paragraph, sentence] = target.split('-')
    const english = excerpt ?? (target === 'title' ? passage.title
      : paragraph === 'heading' ? passage.paragraphTitles![Number(sentence)]
      : passage.paragraphs[Number(paragraph)].split(/(?<=[.!?])\s+/)[Number(sentence)])
    return { target, english, chinese }
  })
}
