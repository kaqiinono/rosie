import type { Problem, ProblemSet } from './type'

// 火柴棒题目配图（题面下方），统一样式
const figImg = (src: string, alt: string) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={src}
    alt={alt}
    className="mx-auto my-2 max-h-64 w-auto rounded-lg border border-orange-100 bg-white p-2"
  />
)

const PRETEST: Problem[] = [
  {
    id: '45-P1',
    title: '课前测1 · 移棒使等式成立',
    tag: 'type1',
    tagLabel: '移棒等式',
    difficulty: 3,
    text:
      '请各移动 <strong>一根</strong> 火柴棒，使下列两个算式成立：<br/>① <strong>22 − 17 − 7 = 2</strong><br/>② <strong>17 + 11 + 4 − 4 = 14</strong>',
    analysis: [
      '思路：可以给某个数字加/减一根火柴改变它的大小，或把「＋／−」互相转换。',
      '①式目标：让等号左边算出 2；②式目标：让等号左边算出 14。',
      '提示：先看左右差多少，再决定把火柴移到哪个数字或运算符上。',
      '（火柴棒变形题，具体移法见图示；答案以老师讲解为准。）',
    ],
    type: 'none',
    figureNode: figImg('/img/math/45-P1.png', '火柴棒算式 22-17-7=2 与 17+11+4-4=14'),
    finalQ: '移动后，①式等号右边应等于几？',
    finalUnit: '',
    finalAns: 2,
  },
  {
    id: '45-P2',
    title: '课前测2 · 加棒四等分',
    tag: 'type2',
    tagLabel: '分割图形',
    difficulty: 4,
    text:
      '如图是用 <strong>16</strong> 根火柴棒搭出的图形。请在图形内部加入 <strong>8</strong> 根火柴棒，把这个图形分成 <strong>面积相等的 4 块</strong>。',
    analysis: [
      '先数清图形一共由几个相同的小方格组成。',
      '总面积 ÷ 4 = 每一块应有的小方格数。',
      '再沿着格线，用 8 根火柴把图形分成大小、形状都相同的 4 块。',
      '（分割方式见图示；答案以老师讲解为准。）',
    ],
    type: 'none',
    figureNode: figImg('/img/math/45-P2.png', '16 根火柴棒搭出的图形'),
    finalQ: '要把图形平均分成几块？',
    finalUnit: '块',
    finalAns: 4,
  },
  {
    id: '45-P3',
    title: '课前测3 · 移棒使各行各列相等',
    tag: 'type3',
    tagLabel: '数字变换',
    difficulty: 4,
    text:
      '下面方格里的数字都是用火柴棒摆成的：<br/>第一行 <strong>1 4 5</strong>，第二行 <strong>6 8 2</strong>，第三行 <strong>1 6 3</strong>。<br/>请移动其中 <strong>一根</strong> 火柴棒，使每一横行、每一竖行里的数字相加的和都相等。',
    analysis: [
      '原来每横行的和：10、16、10；每竖行的和：8、18、10，都不相等。',
      '把第二行「8」中间的一根火柴，移到它左边的「6」上：6 变成 8、8 变成 0。',
      '新数阵：1 4 5 / 8 0 2 / 1 6 3。',
      '此时每一横行、每一竖行的和都等于 10。',
    ],
    type: 'none',
    figureNode: figImg('/img/math/45-P3.png', '火柴棒数字方阵 145 / 682 / 163'),
    finalQ: '调整后，每一行（每一列）数字之和都等于几？',
    finalUnit: '',
    finalAns: 10,
  },
  {
    id: '45-P4',
    title: '课前测4 · 412 变最大四位数',
    tag: 'type3',
    tagLabel: '数字变换',
    difficulty: 4,
    text:
      '用火柴棒可以摆出数字 0~9。现在用火柴棒摆出了一个三位数 <strong>412</strong>。请移动 <strong>一根</strong> 火柴棒，把它变成一个新的 <strong>四位数</strong>，这个数最大是多少？',
    analysis: [
      '要让四位数尽量大，最高位的数字要尽量大。',
      '观察 4、1、2 各用了几根火柴，想一想移动哪一根能多出一位数。',
      '（火柴棒变形题，具体移法见图示；答案以老师讲解为准。）',
    ],
    type: 'none',
    figureNode: figImg('/img/math/45-P4.png', '火柴棒三位数 412 及 0~9 摆法'),
    finalQ: '移动后能得到的最大四位数是多少？',
    finalUnit: '',
    finalAns: 7112,
  },
  {
    id: '45-P5',
    title: '课前测5 · 8 根火柴摆两位数',
    tag: 'type4',
    tagLabel: '火柴计数',
    difficulty: 3,
    text:
      '火柴棒可以摆出数字 0~9（摆法如图）。给你 <strong>8</strong> 根火柴棒，要求 <strong>全部用完</strong>，一共可以摆出多少个不同的 <strong>两位数</strong>？',
    analysis: [
      '各数字用的火柴数：1→2，7→3，4→4，2/3/5→5，0/6/9→6，8→7。',
      '两位数 = 首位(1~9) + 个位(0~9)，两位的火柴数相加要等于 8。',
      '2+6：10、16、19；6+2：61、91；3+5：72、73、75；5+3：27、37、57；4+4：44。',
      '一共 3 + 2 + 3 + 3 + 1 = 12 个。',
    ],
    type: 'none',
    figureNode: figImg('/img/math/45-P5.png', '火柴棒数字 0~9 摆法'),
    finalQ: '一共可以摆出多少个不同的两位数？',
    finalUnit: '个',
    finalAns: 12,
  },
]

export const PROBLEMS: ProblemSet = {
  pretest: PRETEST,
  lesson: [],
  homework: [],
  workbook: [],
}

export const PROBLEM_TYPES = [
  {
    tag: 'type1',
    color: 'blue',
    label: '题型1 · 移棒等式',
    desc: '移动一根火柴棒，改变数字或运算符，使算式成立。',
    example: '例：22 − 17 − 7 = 2',
  },
  {
    tag: 'type2',
    color: 'green',
    label: '题型2 · 分割图形',
    desc: '添加火柴棒，把图形分成面积相等的若干块。',
    example: '例：加 8 根四等分',
  },
  {
    tag: 'type3',
    color: 'orange',
    label: '题型3 · 数字变换',
    desc: '移动一根火柴棒改变数字，满足给定条件。',
    example: '例：412 变最大四位数',
  },
  {
    tag: 'type4',
    color: 'purple',
    label: '题型4 · 火柴计数',
    desc: '用规定数量的火柴棒摆数，统计可摆出的个数。',
    example: '例：8 根摆两位数',
  },
]

export const TYPE_STYLE: Record<
  string,
  { bg: string; border: string; titleColor: string; textColor: string }
> = {
  type1: { bg: 'bg-blue-50', border: 'border-l-blue-500', titleColor: 'text-blue-800', textColor: 'text-blue-900' },
  type2: { bg: 'bg-green-50', border: 'border-l-green-500', titleColor: 'text-green-800', textColor: 'text-green-900' },
  type3: { bg: 'bg-orange-50', border: 'border-l-orange-500', titleColor: 'text-orange-800', textColor: 'text-orange-900' },
  type4: { bg: 'bg-purple-50', border: 'border-l-purple-500', titleColor: 'text-purple-800', textColor: 'text-purple-900' },
}

export const TAG_STYLE: Record<string, string> = {
  type1: 'bg-app-blue-light text-app-blue-dark',
  type2: 'bg-app-green-light text-app-green-dark',
  type3: 'bg-orange-100 text-orange-800',
  type4: 'bg-app-purple-light text-app-purple-dark',
}
