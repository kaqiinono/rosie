import type { Problem, ProblemSet } from './type'

const LESSON: Problem[] = [
  {
    id: '39-L1',
    title: '例1 · 盈盈问题：买铅笔',
    tag: 'type1',
    tagLabel: '盈盈',
    text: '妈妈给了文文一些钱去买铅笔。到了文具店，文文发现如果买 <strong>6 支</strong>铅笔，剩下 <strong>11 元</strong>；如果买 <strong>4 支</strong>同样的铅笔，剩下 <strong>19 元</strong>。请问，妈妈给了文文多少钱？',
    analysis: [
      '两次购买都有剩余（盈盈问题）',
      '买的数量差：6 − 4 = 2（支）',
      '剩余差额：19 − 11 = 8（元）',
      '铅笔单价 = 差额 ÷ 数量差 = 8 ÷ 2 = 4（元）',
      '妈妈的钱 = 单价 × 支数 + 剩余 = 4 × 6 + 11 = 35（元）',
      '验证：4 × 4 + 19 = 16 + 19 = 35（元）✓',
    ],
    type: 'none',
    finalQ: '妈妈给了文文多少钱？',
    finalUnit: '元',
    finalAns: 35,
  },
  {
    id: '39-L2',
    title: '练一练 · 盈盈问题：孙悟空发香蕉',
    tag: 'type1',
    tagLabel: '盈盈',
    text: '孙悟空给小猴子发香蕉，每只小猴子发的香蕉一样多。如果每只小猴子发 <strong>7 根</strong>香蕉，最后还能剩 <strong>4 根</strong>；如果每只小猴子发 <strong>4 根</strong>香蕉，最后能剩 <strong>25 根</strong>。请问孙悟空一共准备了多少根香蕉？',
    analysis: [
      '两次分配都有剩余（盈盈问题）',
      '每份差额：7 − 4 = 3（根）',
      '剩余差额：25 − 4 = 21（根）',
      '小猴子数 = 剩余差额 ÷ 每份差额 = 21 ÷ 3 = 7（只）',
      '香蕉总数 = 7 × 7 + 4 = 53（根）',
      '验证：7 × 4 + 25 = 28 + 25 = 53（根）✓',
    ],
    type: 'none',
    finalQ: '孙悟空一共准备了多少根香蕉？',
    finalUnit: '根',
    finalAns: 53,
  },
  {
    id: '39-L3',
    title: '例2 · 盈恰问题：弹珠放盒子',
    tag: 'type4',
    tagLabel: '盈恰',
    text: '奇奇要把一些弹珠放在盒子里。如果每个盒子放 <strong>2 个</strong>，最后剩下 <strong>9 个</strong>；如果每个盒子放 <strong>5 个</strong>，<strong>正好放完</strong>。那么有多少个盒子？有多少个弹珠？',
    analysis: [
      '一次有剩余（盈），一次正好（恰）→ 盈恰问题',
      '每份差额：5 − 2 = 3（个）',
      '盈的数量：9（个）',
      '盒子数 = 盈的数量 ÷ 每份差额 = 9 ÷ 3 = 3（个）',
      '弹珠总数 = 3 × 2 + 9 = 15（个）',
      '验证：3 × 5 = 15（个）✓',
    ],
    type: 'none',
    finalQ: '弹珠一共有多少个？',
    finalUnit: '个',
    finalAns: 15,
  },
  {
    id: '39-L4',
    title: '练一练 · 亏恰问题：约约做数学题',
    tag: 'type5',
    tagLabel: '亏恰',
    text: '约约在假期中计划做一些数学题。若每天做 <strong>4 道题</strong>，则会剩 <strong>12 道题</strong>做不完；若每天做 <strong>5 道题</strong>，<strong>正好全部做完</strong>。请问假期有多少天？约约一共准备做多少道题？',
    analysis: [
      '一次不足（亏），一次正好（恰）→ 亏恰问题',
      '每份差额：5 − 4 = 1（道）',
      '亏的数量：12（道）',
      '天数 = 亏的数量 ÷ 每份差额 = 12 ÷ 1 = 12（天）',
      '题目总数 = 12 × 4 + 12 = 60（道）',
      '验证：12 × 5 = 60（道）✓',
    ],
    type: 'none',
    finalQ: '约约一共准备做多少道题？',
    finalUnit: '道',
    finalAns: 60,
  },
]

export const PROBLEMS: ProblemSet = {
  pretest: [],
  lesson: LESSON,
  homework: [],
  workbook: [],
}

export const PROBLEM_TYPES = [
  {
    tag: 'type1',
    color: 'blue',
    label: '题型1 · 盈盈问题',
    desc: '两种分法都有剩余。用"剩余差÷每份差=份数"求份数，再求总量。',
    example: '例：买6支剩11元，买4支剩19元',
  },
  {
    tag: 'type2',
    color: 'red',
    label: '题型2 · 亏亏问题',
    desc: '两种分法都不够。用"不足差÷每份差=份数"求份数，再求总量。',
    example: '例：每人3个差5个，每人5个差15个',
  },
  {
    tag: 'type3',
    color: 'purple',
    label: '题型3 · 盈亏问题',
    desc: '一种分法有剩余，一种分法不足。用"(盈+亏)÷每份差=份数"。',
    example: '例：每人3个多2个，每人5个差4个',
  },
  {
    tag: 'type4',
    color: 'green',
    label: '题型4 · 盈恰问题',
    desc: '一种分法有剩余，另一种分法正好。用"盈÷每份差=份数"。',
    example: '例：放2个剩9个，放5个正好',
  },
  {
    tag: 'type5',
    color: 'amber',
    label: '题型5 · 亏恰问题',
    desc: '一种分法不足，另一种分法正好。用"亏÷每份差=份数"。',
    example: '例：做4道剩12道未完，做5道正好完',
  },
]

export const TYPE_STYLE: Record<
  string,
  { bg: string; border: string; titleColor: string; textColor: string }
> = {
  type1: { bg: 'bg-blue-50',   border: 'border-l-blue-500',   titleColor: 'text-blue-800',   textColor: 'text-blue-900' },
  type2: { bg: 'bg-red-50',    border: 'border-l-red-500',    titleColor: 'text-red-800',    textColor: 'text-red-900' },
  type3: { bg: 'bg-purple-50', border: 'border-l-purple-500', titleColor: 'text-purple-800', textColor: 'text-purple-900' },
  type4: { bg: 'bg-green-50',  border: 'border-l-green-500',  titleColor: 'text-green-800',  textColor: 'text-green-900' },
  type5: { bg: 'bg-amber-50',  border: 'border-l-amber-500',  titleColor: 'text-amber-800',  textColor: 'text-amber-900' },
}

export const TAG_STYLE: Record<string, string> = {
  type1: 'bg-blue-100 text-blue-800',
  type2: 'bg-red-100 text-red-800',
  type3: 'bg-purple-100 text-purple-800',
  type4: 'bg-green-100 text-green-800',
  type5: 'bg-amber-100 text-amber-800',
}
