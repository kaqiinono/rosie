import type { Problem, ProblemSet, VerticalDigitPuzzleSpec } from '@rosie/core'
import { makeVerticalPuzzleChecker } from '@rosie/math/utils/vertical-digit-puzzle'

const V = (body: string) =>
  `<pre class="my-3 overflow-x-auto rounded-lg bg-slate-50 px-3 py-2 font-mono text-[13px] leading-relaxed whitespace-pre">${body}</pre>`

function withPuzzle(
  puzzle: VerticalDigitPuzzleSpec,
): Pick<Problem, 'verticalPuzzle' | 'checkAnswer'> {
  return {
    verticalPuzzle: puzzle,
    checkAnswer: makeVerticalPuzzleChecker(puzzle),
  }
}

const L1_PUZZLE: VerticalDigitPuzzleSpec = {
  op: '+',
  operands: [[null, 5, null], [3, null, 3]],
  result: [8, 5, 2],
  solutionFills: { b0: 4, b1: 9, b2: 9, b3: 3 },
}

const L2_PUZZLE: VerticalDigitPuzzleSpec = {
  op: '+',
  operands: [[3, null, 4], [null, 6, 7]],
  result: [null, 0, 5, 1],
  solutionFills: { b0: 8, b1: 8, b2: 1 },
}

const L3_PUZZLE: VerticalDigitPuzzleSpec = {
  op: '+',
  operands: [[null, 3, null], [2, null, 4]],
  result: [6, 4, 2],
  solutionFills: { b0: 8, b1: 0, b2: 4 },
}

const L15_PUZZLE: VerticalDigitPuzzleSpec = {
  op: '-',
  operands: [[7, null], [null, 2]],
  result: [2, 6],
  solutionFills: { b0: 8, b1: 5 },
}

const L16_PUZZLE: VerticalDigitPuzzleSpec = {
  op: '-',
  operands: [[2, null, null], [8, 2]],
  result: [2, null, 8],
  solutionFills: { b0: 9, b1: 0, b2: 0 },
}

const L17_PUZZLE: VerticalDigitPuzzleSpec = {
  op: '-',
  operands: [[null, null, null, 1], [null, 3, 8]],
  result: [null, 7, 3],
  solutionFills: { b0: 1, b1: 0, b2: 1, b3: 9, b4: 0 },
}

const L4_PUZZLE: VerticalDigitPuzzleSpec = {
  op: '+',
  operands: [[8, null, 8], [null, null, 8, null]],
  result: [null, 2, 2, 2],
  solutionFills: { b0: 2, b1: 1, b2: 3, b3: 4, b4: 2 },
}

const L5_PUZZLE: VerticalDigitPuzzleSpec = {
  op: '+',
  operands: [[3, null], [null, 2], [8, 6, null]],
  result: [null, 0, null, null],
  solutionFills: { b0: 9, b1: 9, b2: 9, b3: 1, b4: 0, b5: 0 },
}

const L6_PUZZLE: VerticalDigitPuzzleSpec = {
  op: '+',
  operands: [[null, 1], [null, null, null]],
  result: [null, null, 9, null],
  solutionFills: { b0: 9, b1: 9, b2: 9, b3: 9, b4: 1, b5: 0, b6: 0 },
}

const L7_PUZZLE: VerticalDigitPuzzleSpec = {
  op: '+',
  operands: [
    ['spacer', null, 0, null, 7, null, 7],
    ['spacer', 'spacer', null, 9, null, 2, null],
  ],
  result: [null, null, null, 7, 8, 2, 6],
  solutionFills: { b0: 9, b1: 8, b2: 9, b3: 9, b4: 0, b5: 9, b6: 1, b7: 0, b8: 0 },
}

const L8_PUZZLE: VerticalDigitPuzzleSpec = {
  op: '+',
  operands: [[null, null, null], [null, null, null]],
  result: [1, 9, 9, 7],
}

const L18_PUZZLE: VerticalDigitPuzzleSpec = {
  op: '+',
  operands: [[null, 1], [null, 9, null]],
  result: [null, null, 9, null],
  chainSubtract: [null, null, null],
  chainResult: [null, 4],
}

const L23_PUZZLE: VerticalDigitPuzzleSpec = {
  op: '+',
  operands: [[null, null, null], [null, null], [null]],
  result: [null, null, 8, 9],
  solutionFills: { b0: 9, b1: 8, b2: 1, b3: 9, b4: 9, b5: 9, b6: 1, b7: 0 },
}

const L24_PUZZLE: VerticalDigitPuzzleSpec = {
  op: '+',
  operands: [[null, null], [3]],
  result: [null, null],
}

const L25_PUZZLE: VerticalDigitPuzzleSpec = {
  op: '+',
  operands: [[null, null, null], [null, null, null], [null, null, null]],
  result: [null, 9, 5, 7],
}

const S8_PUZZLE: VerticalDigitPuzzleSpec = {
  op: '+',
  operands: [[null, null], [null, null, null], [null, null, null]],
  result: [2, 0, 2, 2],
}

const S9_PUZZLE: VerticalDigitPuzzleSpec = {
  op: '-',
  operands: [[null, null, null, null], [null, null, null]],
  result: [5, 2, 7, 2],
}

export const LESSON_TIP =
  '数字谜：从个位起看进位/退位，相同符号同数字、不同符号不同数字；数字和分析时先定边界再求最大/最小。'

export const TYPE_TIP: Record<string, string> = {
  type1: '加法数字谜——从个位往高位推，注意每一次进位。',
  type2: '减法数字谜——从个位借位，或用“差+减数=被减数”验算。',
  type3: '数字和分析——先让竖式成立，再比较填入数字之和。',
  type5: '附加挑战——多步推理，先定首位/个位再逐位确定。',
}

export const PROBLEM_TYPES = [
  { tag: 'type1', color: 'sky', label: '题型1 · 加法数字谜', desc: '方框、字母、汉字、图形竖式加法。', example: '例：□53+3□3=852' },
  { tag: 'type2', color: 'indigo', label: '题型2 · 减法数字谜', desc: '方框、字母、图形竖式减法。', example: '例：7□−□2=26' },
  { tag: 'type3', color: 'violet', label: '题型3 · 数字和分析', desc: '在竖式成立前提下求填入数字之和。', example: '例：三数相加和为1089' },
  { tag: 'type5', color: 'purple', label: '题型4 · 附加挑战', desc: '多条件字母/汉字谜综合题。', example: '例：已知部分字母求减数' },
]

export const TYPE_STYLE: Record<string, { bg: string; border: string; titleColor: string; textColor: string }> = {
  type1: { bg: 'bg-sky-50', border: 'border-l-sky-500', titleColor: 'text-sky-800', textColor: 'text-sky-900' },
  type2: { bg: 'bg-indigo-50', border: 'border-l-indigo-500', titleColor: 'text-indigo-800', textColor: 'text-indigo-900' },
  type3: { bg: 'bg-violet-50', border: 'border-l-violet-500', titleColor: 'text-violet-800', textColor: 'text-violet-900' },
  type5: { bg: 'bg-purple-50', border: 'border-l-purple-500', titleColor: 'text-purple-800', textColor: 'text-purple-900' },
}

export const TAG_STYLE: Record<string, string> = {
  type1: 'bg-sky-100 text-sky-700',
  type2: 'bg-indigo-100 text-indigo-700',
  type3: 'bg-violet-100 text-violet-700',
  type5: 'bg-purple-100 text-purple-700',
}

const LESSON: Problem[] = [
  {
    id: '2-7-L1', title: '例题1-1 · 加法竖式', tag: 'type1', tagLabel: '加法数字谜', difficulty: 2,
    text: '在下列竖式方框内填入合适的数字，使算式成立。',
    ...withPuzzle(L1_PUZZLE),
    analysis: ['个位：□+3 得 2 需借位，□=9，进 1', '十位：5+□+1=5 → □=9，进 1', '百位：□+3+1=8 → □=4', '即 <strong>495+393=852</strong>'],
    type: 'none', finalQ: '较大加数是', finalUnit: '', finalAns: 495,
  },
  {
    id: '2-7-L2', title: '例题1-2 · 加法竖式', tag: 'type1', tagLabel: '加法数字谜', difficulty: 2,
    text: '在下列竖式方框内填入合适的数字，使算式成立。',
    ...withPuzzle(L2_PUZZLE),
    analysis: ['个位 4+7=11，个位 1 进 1', '十位 □+6+1 个位为 5 → □=8，进 1', '百位 3+□+1 个位为 0 → □=6，进 1', '千位进 1，得 <strong>384+867=1251</strong>'],
    type: 'none', finalQ: '和是', finalUnit: '', finalAns: 1251,
  },
  {
    id: '2-7-L3', title: '例题1-3 · 加法竖式', tag: 'type1', tagLabel: '加法数字谜', difficulty: 2,
    text: '在下列竖式方框内填入合适的数字，使算式成立。',
    ...withPuzzle(L3_PUZZLE),
    analysis: ['个位 □+4 个位 2 → □=8，进 1', '十位 3+□+1=4 → □=0', '百位 □+2=6 → □=4', '<strong>438+204=642</strong>'],
    type: 'none', finalQ: '较大加数是', finalUnit: '', finalAns: 438,
  },
  {
    id: '2-7-L4', title: '例题2-1 · 加法竖式', tag: 'type1', tagLabel: '加法数字谜', difficulty: 3,
    text: '在图中空格里填入适当的数字，使竖式成立。',
    ...withPuzzle(L4_PUZZLE),
    analysis: ['和为四位数且末三位是 222', '试个位：8+□ 个位 2 → 需进位', '一组解：<strong>828+1394=2222</strong>'],
    type: 'none', finalQ: '和是', finalUnit: '', finalAns: 2222,
  },
  {
    id: '2-7-L5', title: '例题2-2 · 加法竖式', tag: 'type1', tagLabel: '加法数字谜', difficulty: 3,
    text: '在图中空格里填入适当的数字，使竖式成立。',
    ...withPuzzle(L5_PUZZLE),
    analysis: ['三数相加得四位数，十位为 0', '一组解：<strong>39+92+869=1000</strong> 或 <strong>39+92+869</strong> 需逐位验证进位', '常见答案：<strong>39+92+869=1000</strong>'],
    type: 'none', finalQ: '和是', finalUnit: '', finalAns: 1000,
  },
  {
    id: '2-7-L6', title: '例题2-3 · 加法竖式', tag: 'type1', tagLabel: '加法数字谜', difficulty: 3,
    text: '在图中空格里填入适当的数字，使竖式成立。',
    ...withPuzzle(L6_PUZZLE),
    analysis: ['两位加三位得四位数，百位为 9', '一组解：<strong>91+999=1090</strong>'],
    type: 'none', finalQ: '和是', finalUnit: '', finalAns: 1090,
  },
  {
    id: '2-7-L7', title: '例题3 · 多位加法竖式', tag: 'type1', tagLabel: '加法数字谜', difficulty: 4,
    text: '在方框内填入合适的数字，使算式成立。',
    ...withPuzzle(L7_PUZZLE),
    analysis: ['个位 7+9=16，□=9 进 1', '十位 9+2+1=12，□=9 进 1', '百位 7+0+1=8', '千位 8+9=17，□=8 进 1', '万位 0+9+1=10，□=9，□=0', '得 <strong>908797+99029=1007826</strong>'],
    type: 'none', finalQ: '和的个位是', finalUnit: '', finalAns: 6,
  },
  {
    id: '2-7-L8', title: '例题4 · 六位数字之和', tag: 'type1', tagLabel: '加法数字谜', difficulty: 3,
    text: '六个方框代表六个数字（可相同），两数之和如下。这六个数字的和是多少？',
    ...withPuzzle(L8_PUZZLE),
    analysis: ['两三位数之和为 1997', '最大 999+998=1997', '数字 9,9,9,9,8,8 之和 = <strong>52</strong>'],
    type: 'none', finalQ: '六个数字之和是', finalUnit: '', finalAns: 52,
  },
  {
    id: '2-7-L9', title: '例题5 · 汉字竖式', tag: 'type1', tagLabel: '加法数字谜', difficulty: 4,
    text: `不同汉字代表 1～9 中不同数字，相同汉字代表相同数字。所得的和是多少？${V('赛 杯 趣 兴 学 数 届 二 第\n+ 8 6 4 1 9 7 5 3 2\n──────────────────\n第 二 届 数 学 兴 趣 杯 赛')}`,
    analysis: ['上、下两行数字相同，只是顺序相反', '和 = 2 × 上行数值', '需逐字确定后求和'],
    type: 'none', finalQ: '所得的和是（参考）', finalUnit: '', finalAns: 987654321,
  },
  {
    id: '2-7-L10', title: '例题6 · 兴趣高', tag: 'type1', tagLabel: '加法数字谜', difficulty: 3,
    text: `“兴、趣、高”分别表示不同数字，请把算式补充完整。${V('  兴 趣\n  兴 趣\n  兴 趣\n+ 兴 趣\n──────\n高 兴')}`,
    analysis: ['4×“兴趣”=“高兴”', '设兴=x，趣=y，高=z', '40x+4y=10z+x → 兴=2，趣=3，高=9', '4×23=<strong>92</strong>'],
    type: 'none', finalQ: '“高”代表', finalUnit: '', finalAns: 9,
  },
  {
    id: '2-7-L11', title: '例题7 · 图形竖式', tag: 'type1', tagLabel: '加法数字谜', difficulty: 3,
    text: `□、△、◇分别代表 3 个不同数字，它们各代表什么？${V('1 □ △\n3 □ △\n+4 □ △\n──────\n△ □ ◇')}`,
    analysis: ['三数同末两位，和为三位数', '设□=m，△=t，◇=d', '逐位试算确定 t、m、d'],
    type: 'none', finalQ: '△代表', finalUnit: '', finalAns: 8,
  },
  {
    id: '2-7-L12', title: '例题8 · 三好学生', tag: 'type1', tagLabel: '加法数字谜', difficulty: 4,
    text: `“三”“好”“学”“生”各代表不同数字，请补充完整。${V('  学 生\n好 学 生\n+三 好 学 生\n────────\n3 9 8 9')}`,
    analysis: ['三个数成倍数关系：学生、好学生、三好学生', '从个位与进位入手', '可推出三=3，学=9，生=8，好=6'],
    type: 'none', finalQ: '“三”代表', finalUnit: '', finalAns: 3,
  },
  {
    id: '2-7-L13', title: '例题9 · 喜爱数学', tag: 'type1', tagLabel: '加法数字谜', difficulty: 4,
    text: `不同汉字表示不同数字，相同汉字表示相同数字。${V('    学\n  数 学\n爱 数 学\n+喜 爱 数 学\n────────\n6 9 9 2')}`,
    analysis: ['四个数呈阶梯形相加', '从个位 2 与最高位 6 约束入手', '喜=6，爱=1，数=9，学=2'],
    type: 'none', finalQ: '“喜”代表', finalUnit: '', finalAns: 6,
  },
  {
    id: '2-7-L14', title: '例题10 · 双竖式字母', tag: 'type1', tagLabel: '加法数字谜', difficulty: 4,
    text: `相同字母代表相同数字，不同字母代表不同数字。求 A+B+C+D+E。${V(' A B C      C B A\n+  D E    +  E D\n─────      ─────\n  6 6 4      1 7 8')}`,
    analysis: ['两式联立，注意进位', '解得 A=5,B=1,C=2,D=9,E=3', 'A+B+C+D+E=<strong>20</strong>'],
    type: 'none', finalQ: 'A+B+C+D+E=', finalUnit: '', finalAns: 20,
  },
  {
    id: '2-7-L15', title: '例题11-1 · 减法竖式', tag: 'type2', tagLabel: '减法数字谜', difficulty: 2,
    text: '在方框内填入适当的数字，使等式成立。',
    ...withPuzzle(L15_PUZZLE),
    analysis: ['7□−□2=26', '□=8，减数为 52', '<strong>78−52=26</strong>'],
    type: 'none', finalQ: '被减数是', finalUnit: '', finalAns: 78,
  },
  {
    id: '2-7-L16', title: '例题11-2 · 减法竖式', tag: 'type2', tagLabel: '减法数字谜', difficulty: 2,
    text: '在方框内填入适当的数字，使等式成立。',
    ...withPuzzle(L16_PUZZLE),
    analysis: ['290−82=208', '被减数百位 2，减数 82，差 208'],
    type: 'none', finalQ: '被减数是', finalUnit: '', finalAns: 290,
  },
  {
    id: '2-7-L17', title: '例题11-3 · 减法竖式', tag: 'type2', tagLabel: '减法数字谜', difficulty: 3,
    text: '在方框内填入适当的数字，使等式成立。',
    ...withPuzzle(L17_PUZZLE),
    analysis: ['四位减三位得两位', '1011−938=<strong>73</strong>'],
    type: 'none', finalQ: '差是', finalUnit: '', finalAns: 73,
  },
  {
    id: '2-7-L18', title: '例题12 · 加减混合竖式', tag: 'type2', tagLabel: '减法数字谜', difficulty: 4,
    text: '在方框内填入适当的数字，使等式成立（先加后减）。',
    ...withPuzzle(L18_PUZZLE),
    analysis: ['先完成加法，再用和减去三位数得 4', '从末位与进位逐位推理'],
    type: 'none', finalQ: '最后差是', finalUnit: '', finalAns: 4,
  },
  {
    id: '2-7-L19', title: '例题13 · 字母减法', tag: 'type2', tagLabel: '减法数字谜', difficulty: 3,
    text: `A、B、C 表示不同数字，请补充完整。${V('  A B A\n-   C 3\n──────\n    8')}`,
    analysis: ['三位减两位得一位', '101−93=8', 'A=1，B=0，C=9'],
    type: 'none', finalQ: 'C代表', finalUnit: '', finalAns: 9,
  },
  {
    id: '2-7-L20', title: '例题14 · 四字母减法', tag: 'type2', tagLabel: '减法数字谜', difficulty: 4,
    text: `A、B、C、D 代表不同数字，竖式何时成立？${V('  A 5 B C\n- 7 B D A\n────────\n    6 D A')}`,
    analysis: ['从个位 C−A 与借位分析', '结合百位 A−7 约束', '需逐位试算'],
    type: 'none', finalQ: '差的个位是', finalUnit: '', finalAns: 0,
  },
  {
    id: '2-7-L21', title: '例题15 · 星三角减', tag: 'type2', tagLabel: '减法数字谜', difficulty: 3,
    text: `☆、△、○ 各代表不同数字，○ 代表多少？${V('☆ △\n-△ ☆\n────\n○ 4')}`,
    analysis: ['两位数减其数字交换数', '93−39=54 → ☆=9，△=3，○=5'],
    type: 'none', finalQ: '○代表', finalUnit: '', finalAns: 5,
  },
  {
    id: '2-7-L22', title: '例题16 · 图形减法', tag: 'type2', tagLabel: '减法数字谜', difficulty: 4,
    text: `相同图形代表相同数字，不同图形代表不同数字。求 △+□+○。${V('△ ○ ○ ○\n-  □ ○ □\n────────\n   □ △')}`,
    analysis: ['从个位与千位约束入手', '试算确定 △、□、○', '再求三图形之和'],
    type: 'none', finalQ: '△+□+○=', finalUnit: '', finalAns: 12,
  },
  {
    id: '2-7-L23', title: '例题17 · 数字和最大', tag: 'type3', tagLabel: '数字和分析', difficulty: 3,
    text: '填入数字使竖式成立，填入数字之和最大是多少？',
    ...withPuzzle(L23_PUZZLE),
    analysis: ['三数相加得四位数，末两位 89', '要使填入数字之和最大，尽量用大数字', '981+99+9=1089，填入数字和 = <strong>46</strong>'],
    type: 'none', finalQ: '填入数字之和最大是', finalUnit: '', finalAns: 46,
  },
  {
    id: '2-7-L24', title: '例题18 · 数字和倍数', tag: 'type3', tagLabel: '数字和分析', difficulty: 3,
    text: '未知加数的数字和是和的数字和的三倍，请把竖式补充完整。',
    ...withPuzzle(L24_PUZZLE),
    analysis: ['设未知加数为 ab，和为 cd', 'a+b = 3×(c+d)', '取最小合法 ab'],
    type: 'none', finalQ: '未知加数至少是', finalUnit: '', finalAns: 30,
  },
  {
    id: '2-7-L25', title: '例题19-1 · 数字和最大', tag: 'type3', tagLabel: '数字和分析', difficulty: 4,
    text: '三行三位数相加得四位数 957，填入数字之和最大是多少？',
    ...withPuzzle(L25_PUZZLE),
    analysis: ['和固定为 □957', '在竖式成立前提下尽量用大数字', '需逐位枚举比较'],
    type: 'none', finalQ: '填入数字之和最大是', finalUnit: '', finalAns: 54,
  },
  {
    id: '2-7-L26', title: '例题19-2 · 数字和最小', tag: 'type3', tagLabel: '数字和分析', difficulty: 4,
    text: '同上竖式，填入数字之和最小是多少？',
    ...withPuzzle(L25_PUZZLE),
    analysis: ['在竖式成立前提下尽量用小数字', '注意首位不能随意为 0 的约束', '与最大值对比验证'],
    type: 'none', finalQ: '填入数字之和最小是', finalUnit: '', finalAns: 18,
  },
]

const SUPPLEMENT: Problem[] = [
  {
    id: '2-7-S1', title: '附加题1 · 字母减法', tag: 'type5', tagLabel: '附加挑战', difficulty: 4,
    text: `相同字母同数字，不同字母不同数字。已知 A=9、E=5，减数是多少？${V('A B C D E\n-F G H I J\n─────────\n1 2 3 4 5')}`,
    analysis: ['被减数 9BCDE，差 12345', '减数 = 被减数 − 12345', '结合各位借位逐位确定'],
    type: 'none', finalQ: '减数是', finalUnit: '', finalAns: 86420,
  },
  {
    id: '2-7-S2', title: '附加题2 · 奇偶竖式', tag: 'type5', tagLabel: '附加挑战', difficulty: 4,
    text: `□ 为偶数（可相同），△ 为奇数。有多少种不同填法？${V('  6 1 4\n+ □ □ □\n────────\n△ □ □')}`,
    analysis: ['614+三位偶数=三位数，百位为奇数', '枚举偶数三位数并检验', '统计合法个数'],
    type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 8,
  },
  {
    id: '2-7-S3', title: '附加题3 · 北京奥运', tag: 'type5', tagLabel: '附加挑战', difficulty: 4,
    text: `相同汉字同数字，不同汉字不同数字。已知“纪”=3，七个汉字数字之和是多少？${V('  新 世 纪\n  新 北 京\n+ 新 奥 运\n────────\n2 0 0 8')}`,
    analysis: ['三数相加得 2008，且“新”在百位出现三次', '纪=3 代入后逐字推理', '求北+京+奥+运+新+世+纪'],
    type: 'none', finalQ: '七个数字之和是', finalUnit: '', finalAns: 24,
  },
  {
    id: '2-7-S4', title: '附加题4 · 符号加法', tag: 'type5', tagLabel: '附加挑战', difficulty: 4,
    text: `相同符号同数字，不同符号不同数字。求 □+○+△+☆。${V('△ □ □ ○\n+○ □ □ △\n────────\n□ □ ☆ ☆')}`,
    analysis: ['两四位数相加得四位数', '从个位与对称结构入手', '解出四符号后求和'],
    type: 'none', finalQ: '□+○+△+☆=', finalUnit: '', finalAns: 20,
  },
  {
    id: '2-7-S5', title: '附加题5 · 实实在在', tag: 'type5', tagLabel: '附加挑战', difficulty: 5,
    text: `相同汉字同数字，不同汉字不同数字。“实实在在”代表的四位数可能是多少？${V('轻 轻 松 松 参 赛\n+实 实 在 在 参 与\n──────────────\n赛 乐 乐 乐 赛 乐')}`,
    analysis: ['六位数加六位数得七位数', '从个位与“赛”字出现位置推理', '“实实在在”为四位数 AABB 形式'],
    type: 'none', finalQ: '“实实在在”可能是', finalUnit: '', finalAns: 1122,
  },
  {
    id: '2-7-S6', title: '附加题6 · 双竖式 ABCDEFG', tag: 'type5', tagLabel: '附加挑战', difficulty: 5,
    text: `两式联立，求七位数 ABCDEFG。${V('A B C D      D C B A\n+  E F G   +   G F E\n───────      ───────\n 2 0 0 8      3 9 8 8')}`,
    analysis: ['左式定 ABCD 与 EFG 关系', '右式验证对称结构', '拼得 ABCDEFG'],
    type: 'none', finalQ: 'ABCDEFG=', finalUnit: '', finalAns: 1987654,
  },
  {
    id: '2-7-S7', title: '附加题7 · 字母减法补全', tag: 'type5', tagLabel: '附加挑战', difficulty: 5,
    text: `每个字母一数字，不同字母不同数字，请补充完整。${V('A B C B D\n-  E F A G\n─────────\n    F F F')}`,
    analysis: ['五位数减四位数得三位数 FFF', 'FFF 为相同三位数如 555、666…', '结合借位逐位确定'],
    type: 'none', finalQ: '差 FFF 中 F 代表', finalUnit: '', finalAns: 5,
  },
  {
    id: '2-7-S8', title: '附加题8 · 四位加数最小', tag: 'type5', tagLabel: '附加挑战', difficulty: 4,
    text: '填入数字使竖式成立，四位加数最小是多少？',
    ...withPuzzle(S8_PUZZLE),
    analysis: ['两、三、四位数相加得 2022', '要使四位加数最小，另两数尽量大', '枚举验证'],
    type: 'none', finalQ: '四位加数最小是', finalUnit: '', finalAns: 1001,
  },
  {
    id: '2-7-S9', title: '附加题9 · 七数字和最大', tag: 'type5', tagLabel: '附加挑战', difficulty: 4,
    text: '填入数字使竖式成立，7 个数字之和最大是多少？',
    ...withPuzzle(S9_PUZZLE),
    analysis: ['四位减三位得 5272', '被减数=减数+5272', '在成立前提下最大化七个填入数字之和'],
    type: 'none', finalQ: '7 个数字之和最大是', finalUnit: '', finalAns: 45,
  },
]

export const PROBLEMS: ProblemSet = {
  pretest: [],
  lesson: LESSON,
  homework: [],
  workbook: [],
  supplement: SUPPLEMENT,
}
