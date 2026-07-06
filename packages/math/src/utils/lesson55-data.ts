import type { Problem, ProblemSet } from '@rosie/core'

export const LESSON_TIP =
  '简单枚举：有序列举、分类讨论、不重不漏；分堆看是否有序、是否相同；组数看首位限制与重复数字。'

export const TYPE_TIP: Record<string, string> = {
  type1: '简单枚举——画表格或树形图，按顺序一一列出所有可能。',
  type2: '无序分堆——相同物品分堆通常不计顺序，用分拆或隔板。',
  type3: '数字排序——组数时注意首位不为 0、重复数字用除法。',
  type4: '有序分堆——分给人/分到天有顺序，用隔板或分类枚举。',
  type5: '综合挑战——多条件叠加，先分类再逐类枚举。',
}

export const PROBLEM_TYPES = [
  { tag: 'type1', color: 'teal', label: '题型1 · 简单枚举', desc: '相邻、选组合、路径等基础计数。', example: '例：4人分两组双打→3种' },
  { tag: 'type2', color: 'blue', label: '题型2 · 无序分堆', desc: '整数分拆、相同物品分堆。', example: '例：三数和10→8种' },
  { tag: 'type3', color: 'green', label: '题型3 · 数字排序', desc: '用给定数字组二/三/四位数。', example: '例：1,2,3组三位数→6个' },
  { tag: 'type4', color: 'orange', label: '题型4 · 有序分堆', desc: '数字和、分物给人/天。', example: '例：7铅笔分3人各≥1→15种' },
  { tag: 'type5', color: 'purple', label: '题型5 · 综合挑战', desc: '附加题多条件枚举。', example: '例：周长20整数长方形→5种' },
]

export const TYPE_STYLE: Record<string, { bg: string; border: string; titleColor: string; textColor: string }> = {
  type1: { bg: 'bg-teal-50', border: 'border-l-teal-500', titleColor: 'text-teal-800', textColor: 'text-teal-900' },
  type2: { bg: 'bg-blue-50', border: 'border-l-blue-500', titleColor: 'text-blue-800', textColor: 'text-blue-900' },
  type3: { bg: 'bg-emerald-50', border: 'border-l-emerald-500', titleColor: 'text-emerald-800', textColor: 'text-emerald-900' },
  type4: { bg: 'bg-orange-50', border: 'border-l-orange-500', titleColor: 'text-orange-800', textColor: 'text-orange-900' },
  type5: { bg: 'bg-purple-50', border: 'border-l-purple-500', titleColor: 'text-purple-800', textColor: 'text-purple-900' },
}

export const TAG_STYLE: Record<string, string> = {
  type1: 'bg-teal-100 text-teal-700',
  type2: 'bg-blue-100 text-blue-700',
  type3: 'bg-emerald-100 text-emerald-700',
  type4: 'bg-orange-100 text-orange-700',
  type5: 'bg-purple-100 text-purple-700',
}

const LESSON: Problem[] = [
  { id: '55-L1', title: '例题1 · 双打分组', tag: 'type1', tagLabel: '简单枚举', difficulty: 2, text: '有甲、乙、丙、丁四个人，现在要把他们分成两组，进行双打比赛，有多少种不同的分法？', analysis: ['无序分组：C(4,2)/2 = <strong>3</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 3 },
  { id: '55-L2', title: '例题2 · 相邻方格', tag: 'type1', tagLabel: '简单枚举', difficulty: 2, text: '从下面的 <strong>2行4列</strong> 方格图中选择两个相邻的小方格（共边），有多少种不同的选法？', analysis: ['横相邻 2×3×2 = 6', '竖相邻 4×1×2 = 4', '共 <strong>10</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 10 },
  { id: '55-L3', title: '例题3 · 圆桌就座', tag: 'type1', tagLabel: '简单枚举', difficulty: 4, text: '甲、乙、丙、丁、戊围坐在圆形桌子边玩扑克，甲有自己的固定座位，如果乙和丁的座位不能相邻，那么共有多少种不同的围坐方法？', analysis: ['甲固定，其余 4! = 24', '减去乙丁相邻 16 种', '24 − 16 = <strong>8</strong>'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 8 },
  { id: '55-L4', title: '例题4 · 搬花顺序', tag: 'type1', tagLabel: '简单枚举', difficulty: 3, text: '纳纳家的左右两侧各摆了 2 盆花。每次先选择左侧或者右侧，然后搬该侧离家最远的一盆。要把所有花搬到家里，共有多少种不同的搬花顺序？', analysis: ['4 次搬运中 2 次选左 2 次选右', 'C(4,2) = <strong>6</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 6 },
  { id: '55-L5', title: '例题5-1 · 两数和10', tag: 'type2', tagLabel: '无序分堆', difficulty: 1, text: '两个正整数相加，和为 <strong>10</strong>，这两个数一共有多少种可能？（不计顺序）', analysis: ['(1,9)(2,8)(3,7)(4,6)(5,5)', '共 <strong>5</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 5 },
  { id: '55-L6', title: '例题5-2 · 三数和10', tag: 'type2', tagLabel: '无序分堆', difficulty: 2, text: '三个正整数相加，和为 <strong>10</strong>，这三个数一共有多少种可能？（不计顺序）', analysis: ['正整数分拆 p(10,3) = <strong>8</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 8 },
  { id: '55-L7', title: '例题5-3 · 四数和10', tag: 'type2', tagLabel: '无序分堆', difficulty: 2, text: '四个正整数相加，和为 <strong>10</strong>，这四个数一共有多少种可能？（不计顺序）', analysis: ['正整数分拆 p(10,4) = <strong>9</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 9 },
  { id: '55-L8', title: '例题6 · 分糖豆', tag: 'type2', tagLabel: '无序分堆', difficulty: 3, text: '妈妈有两袋糖豆，每袋 15 粒。要把这两袋糖豆分成 3 堆，每堆糖最少要有 8 粒。那么一共有多少种不同的分法？', analysis: ['共 30 粒，每堆 ≥8，先各分 8 剩 6', '6 粒分给 3 堆：C(8,2) = <strong>28</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 28 },
  { id: '55-L9', title: '例题7 · 分苹果', tag: 'type2', tagLabel: '无序分堆', difficulty: 3, text: '把 13 个苹果装到 3 个相同的篮子里，每个篮子最多装 6 个。一共有多少种分配方法？', analysis: ['(6,6,1)(6,5,2)(6,4,3)(5,5,3)(5,4,4)', '共 <strong>5</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 5 },
  { id: '55-L10', title: '例题8 · 选7数和33', tag: 'type2', tagLabel: '无序分堆', difficulty: 3, text: '从 1~9 中选取 7 个不同的数字，使得它们的和为 33，一共有多少种取法？', analysis: ['1+…+9=45，缺 2 个数和为 12', '(3,9)(4,8)(5,7) 共 <strong>3</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 3 },
  { id: '55-L11', title: '例题9-1 · 组三位数', tag: 'type3', tagLabel: '数字排序', difficulty: 2, text: '用 <strong>1,2,3</strong> 这三个数字，可以组成多少个不同的三位数？', analysis: ['3!=6 → <strong>6</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 6 },
  { id: '55-L12', title: '例题9-2 · 组三位数', tag: 'type3', tagLabel: '数字排序', difficulty: 2, text: '用 <strong>1,1,2</strong> 这三个数字，可以组成多少个不同的三位数？', analysis: ['4!/2!=3 → <strong>3</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 3 },
  { id: '55-L13', title: '例题9-3 · 组三位数', tag: 'type3', tagLabel: '数字排序', difficulty: 2, text: '用 <strong>1,1,1</strong> 这三个数字，可以组成多少个不同的三位数？', analysis: ['全相同 1 种 → <strong>1</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 1 },
  { id: '55-L14', title: '例题9-4 · 组三位数', tag: 'type3', tagLabel: '数字排序', difficulty: 3, text: '用 <strong>0,1,2</strong> 这三个数字，可以组成多少个不同的三位数？', analysis: ['百位不为0 → <strong>4</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 4 },
  { id: '55-L15', title: '例题9-5 · 组三位数', tag: 'type3', tagLabel: '数字排序', difficulty: 3, text: '用 <strong>0,1,1</strong> 这三个数字，可以组成多少个不同的三位数？', analysis: ['101,110 → <strong>2</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 2 },
  { id: '55-L16', title: '例题9-6 · 组三位数', tag: 'type3', tagLabel: '数字排序', difficulty: 3, text: '用 <strong>0,0,1</strong> 这三个数字，可以组成多少个不同的三位数？', analysis: ['100 → <strong>1</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 1 },
  { id: '55-L17', title: '例题10-1 · 组四位数', tag: 'type3', tagLabel: '数字排序', difficulty: 2, text: '用 <strong>1,2,3,4</strong> 这四个数字，可以组成多少个不同的四位数？', analysis: ['排列数 = <strong>24</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 24 },
  { id: '55-L18', title: '例题10-2 · 组四位数', tag: 'type3', tagLabel: '数字排序', difficulty: 2, text: '用 <strong>1,1,2,3</strong> 这四个数字，可以组成多少个不同的四位数？', analysis: ['排列数 = <strong>12</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 12 },
  { id: '55-L19', title: '例题10-3 · 组四位数', tag: 'type3', tagLabel: '数字排序', difficulty: 2, text: '用 <strong>1,1,2,2</strong> 这四个数字，可以组成多少个不同的四位数？', analysis: ['排列数 = <strong>6</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 6 },
  { id: '55-L20', title: '例题10-4 · 组四位数', tag: 'type3', tagLabel: '数字排序', difficulty: 2, text: '用 <strong>1,1,1,2</strong> 这四个数字，可以组成多少个不同的四位数？', analysis: ['排列数 = <strong>4</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 4 },
  { id: '55-L21', title: '例题10-5 · 组四位数', tag: 'type3', tagLabel: '数字排序', difficulty: 2, text: '用 <strong>1,1,1,1</strong> 这四个数字，可以组成多少个不同的四位数？', analysis: ['排列数 = <strong>1</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 1 },
  { id: '55-L22', title: '例题11-1 · 组四位数(含0)', tag: 'type3', tagLabel: '数字排序', difficulty: 3, text: '用 <strong>0,1,2,3</strong> 这四个数字，可以组成多少个不同的四位数？', analysis: ['百位不为 0 → <strong>18</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 18 },
  { id: '55-L23', title: '例题11-2 · 组四位数(含0)', tag: 'type3', tagLabel: '数字排序', difficulty: 3, text: '用 <strong>0,1,1,2</strong> 这四个数字，可以组成多少个不同的四位数？', analysis: ['百位不为 0 → <strong>9</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 9 },
  { id: '55-L24', title: '例题11-3 · 组四位数(含0)', tag: 'type3', tagLabel: '数字排序', difficulty: 3, text: '用 <strong>0,1,1,1</strong> 这四个数字，可以组成多少个不同的四位数？', analysis: ['百位不为 0 → <strong>3</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 3 },
  { id: '55-L25', title: '例题12-1 · 数字和/排列', tag: 'type4', tagLabel: '有序分堆', difficulty: 3, text: '<strong>不含0的两位数各位和8</strong>，这样的数有多少个？', analysis: ['枚举得 <strong>7</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 7 },
  { id: '55-L26', title: '例题12-2 · 数字和/排列', tag: 'type4', tagLabel: '有序分堆', difficulty: 3, text: '<strong>不含0的三位数各位和8</strong>，这样的数有多少个？', analysis: ['枚举得 <strong>21</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 21 },
  { id: '55-L27', title: '例题12-3 · 数字和/排列', tag: 'type4', tagLabel: '有序分堆', difficulty: 3, text: '<strong>不含0的四位数各位和8</strong>，这样的数有多少个？', analysis: ['枚举得 <strong>35</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 35 },
  { id: '55-L28', title: '例题12-4 · 数字和/排列', tag: 'type4', tagLabel: '有序分堆', difficulty: 2, text: '用 <strong>0,0,1,2</strong> 这四个数字，可以组成多少个不同的四位数？', analysis: ['枚举得 <strong>6</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 6 },
  { id: '55-L29', title: '例题12-5 · 数字和/排列', tag: 'type4', tagLabel: '有序分堆', difficulty: 2, text: '用 <strong>0,0,1,1</strong> 这四个数字，可以组成多少个不同的四位数？', analysis: ['枚举得 <strong>3</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 3 },
  { id: '55-L30', title: '例题12-6 · 数字和/排列', tag: 'type4', tagLabel: '有序分堆', difficulty: 2, text: '用 <strong>0,0,0,1</strong> 这四个数字，可以组成多少个不同的四位数？', analysis: ['枚举得 <strong>1</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 1 },
  { id: '55-L31', title: '例题13-1 · 数字和', tag: 'type4', tagLabel: '有序分堆', difficulty: 3, text: '一个两位数的各位数字之和是8，这样的数有多少个？', analysis: ['逐位枚举共 <strong>9</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 9 },
  { id: '55-L32', title: '例题13-2 · 数字和', tag: 'type4', tagLabel: '有序分堆', difficulty: 3, text: '一个三位数的各位数字之和是7，这样的数有多少个？', analysis: ['逐位枚举共 <strong>36</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 36 },
  { id: '55-L33', title: '例题13-3 · 数字和', tag: 'type4', tagLabel: '有序分堆', difficulty: 3, text: '一个四位数的各位数字之和是6，这样的数有多少个？', analysis: ['逐位枚举共 <strong>56</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 56 },
  { id: '55-L34', title: '例题14 · 分铅笔', tag: 'type4', tagLabel: '有序分堆', difficulty: 2, text: '把 7 支完全相同的铅笔分给甲、乙、丙 3 个人，每人至少 1 支，那么有多少种方法？', analysis: ['隔板法 C(6,2) = <strong>15</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 15 },
  { id: '55-L35', title: '例题15 · 数字和26', tag: 'type4', tagLabel: '有序分堆', difficulty: 4, text: '小于 2000 的正整数中，数字和等于 26 的共有多少个？', analysis: ['枚举 1xxx/19xx 等', '共 <strong>9</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 9 },
]

const HOMEWORK: Problem[] = [
  { id: '55-H1', title: '练习1-1 · 选2地', tag: 'type1', tagLabel: '简单枚举', difficulty: 1, text: '小思准备游览 A、B、C、D 四个地方。若游览其中两个，有多少种不同的选择方式？', analysis: ['C(4,2) = <strong>6</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 6 },
  { id: '55-H2', title: '练习1-2 · 选3地', tag: 'type1', tagLabel: '简单枚举', difficulty: 1, text: '若游览其中三个，有多少种不同的选择方式？', analysis: ['C(4,3) = <strong>4</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 4 },
  { id: '55-H3', title: '练习2 · 三数和偶', tag: 'type1', tagLabel: '简单枚举', difficulty: 2, text: '从 1,2,3,4,5,6 中任意选出三个不同的数，使它们的和为偶数，一共有多少种不同的选法？', analysis: ['三数和偶：两奇一偶或三偶', '共 <strong>10</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 10 },
  { id: '55-H4', title: '练习3 · 构成三角形', tag: 'type1', tagLabel: '简单枚举', difficulty: 2, text: '以正方形的 4 个顶点和中心这 5 个点中的 3 个点为顶点构成三角形，共可构成多少个不同的三角形？', analysis: ['C(5,3) = <strong>10</strong> 个，无三点共线'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 10 },
  { id: '55-H5', title: '练习4 · 凑2元', tag: 'type1', tagLabel: '简单枚举', difficulty: 3, text: '现有 1 角、2 角、5 角各 4 枚，要用这些硬币组成 2 元（20 角），一共有多少种组合方法？', analysis: ['a+2b+5c=20，0≤a,b,c≤4', '共 <strong>5</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 5 },
  { id: '55-H6', title: '练习5 · 两数和16', tag: 'type1', tagLabel: '简单枚举', difficulty: 1, text: '从 1-10 中选择两个数，使得它们的和是 16，共有几种选择？', analysis: ['仅 (6,10)(7,9)', '共 <strong>2</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 2 },
  { id: '55-H7', title: '练习6 · 选8数和40', tag: 'type1', tagLabel: '简单枚举', difficulty: 3, text: '从 1-10 中选择 8 个数，使得它们的和是 40，共有几种选择？', analysis: ['缺 2 个数和为 15：(5,10)(6,9)(7,8)', '共 <strong>3</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 3 },
  { id: '55-H8', title: '练习7 · 拆600', tag: 'type2', tagLabel: '无序分堆', difficulty: 3, text: '将 600 拆成 3 个数的和，要求每个数都大于 197 并且小于 203，求一共有多少种拆法？', analysis: ['各数 198~202', '共 <strong>19</strong> 种有序拆法'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 19 },
  { id: '55-H9', title: '练习8 · 羽毛球桶', tag: 'type2', tagLabel: '无序分堆', difficulty: 3, text: '3 个一模一样的球桶，每个最少 4 个羽毛球，一共 16 个。3 个桶里球的数量有多少种可能？', analysis: ['a+b+c=16，各≥4', '共 <strong>15</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 15 },
  { id: '55-H10', title: '练习9 · 三位偶数', tag: 'type3', tagLabel: '数字排序', difficulty: 2, text: '用 1,2,3,4 这四个数字可以组成多少个三位偶数？', analysis: ['个位为 2 或 4，再排百十位', '共 <strong>12</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 12 },
  { id: '55-H11', title: '练习10 · 积为12', tag: 'type3', tagLabel: '数字排序', difficulty: 3, text: '所有个位数字与十位数字的乘积为 12 的两位数的和是多少？', analysis: ['26+34+43+62 = <strong>165</strong>'], type: 'none', finalQ: '和是', finalUnit: '', finalAns: 165 },
  { id: '55-H12', title: '练习11 · 分礼物', tag: 'type4', tagLabel: '有序分堆', difficulty: 2, text: '6 件相同的礼物分给甲、乙、丙、丁四个小朋友，每人至少一件，求一共有多少种分法？', analysis: ['C(5,3) = <strong>10</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 10 },
  { id: '55-H13', title: '练习12 · 分糖果', tag: 'type4', tagLabel: '有序分堆', difficulty: 3, text: '16 块糖分给三个人，每人不少于 3 块，有几种分法？', analysis: ['先每人 3 剩 7，C(9,2) = <strong>36</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 36 },
  { id: '55-H14', title: '练习13-1 · 分金币', tag: 'type4', tagLabel: '有序分堆', difficulty: 2, text: '纳纳、约约两人分 12 枚金币，每人最少 2 枚，一共有多少种不同的分法？', analysis: ['2~10 共 <strong>9</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 9 },
  { id: '55-H15', title: '练习13-2 · 分金币上限', tag: 'type4', tagLabel: '有序分堆', difficulty: 3, text: '若每人最多 8 枚，一共有多少种不同的分法？', analysis: ['满足 2≤a,b≤8 且 a+b=12', '共 <strong>5</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 5 },
  { id: '55-H16', title: '练习14 · 分景点', tag: 'type4', tagLabel: '有序分堆', difficulty: 4, text: '约约要参观 20 个景点，分四天参观，每天最多 6 个，最少 3 个，有多少种方式？', analysis: ['四数和 20，各 3~6', '共 <strong>31</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 31 },
  { id: '55-H17', title: '练习15 · 订报纸', tag: 'type4', tagLabel: '有序分堆', difficulty: 3, text: '甲、乙、丙三个工厂一共要定 300 份报纸，每个工厂最少 99 份，最多 101 份，求一共有多少种订报纸的方法？', analysis: ['各 99~101 且和 300', '共 <strong>7</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 7 },
  { id: '55-H18', title: '练习16 · 数字和小于4', tag: 'type4', tagLabel: '有序分堆', difficulty: 3, text: '一个四位数，它的数字和小于 4，这样的数有多少个？', analysis: ['和为 1,2,3 枚举', '共 <strong>15</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 15 },
]

const SUPPLEMENT: Problem[] = [
  { id: '55-S1', title: '附加题1 · 长方形', tag: 'type5', tagLabel: '综合挑战', difficulty: 3, text: '长方形的周长是 20 厘米，长和宽都是整数厘米，这个长方形共有多少种可能的形状？', analysis: ['长+宽=10，(1,9)~(5,5)', '共 <strong>5</strong> 种'], type: 'none', finalQ: '形状共有', finalUnit: '种', finalAns: 5 },
  { id: '55-S2', title: '附加题1 · 最大面积', tag: 'type5', tagLabel: '综合挑战', difficulty: 3, text: '其中面积最大的是多少平方厘米？', analysis: ['5×5 = <strong>25</strong> 平方厘米'], type: 'none', finalQ: '面积最大是', finalUnit: '平方厘米', finalAns: 25 },
  { id: '55-S3', title: '附加题2-1 · 四位数', tag: 'type5', tagLabel: '综合挑战', difficulty: 3, text: '用 1 个 3 和 3 个 4 可以排成多少个不同的四位数？', analysis: ['4!/3! = <strong>4</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 4 },
  { id: '55-S4', title: '附加题2-2 · 五位数', tag: 'type5', tagLabel: '综合挑战', difficulty: 3, text: '用 2 个 3 和 3 个 4 可以排成多少个不同的五位数？', analysis: ['5!/(2!×3!) = <strong>10</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 10 },
  { id: '55-S5', title: '附加题3 · 三位数规律', tag: 'type5', tagLabel: '综合挑战', difficulty: 4, text: '在小于 500 的数中，个位数字等于十位数字与百位数字之和的三位数共有多少个？', analysis: ['逐百位枚举', '共 <strong>30</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 30 },
  { id: '55-S6', title: '附加题4 · 数字和6', tag: 'type5', tagLabel: '综合挑战', difficulty: 4, text: '各位数字互不相同，且数字和为 6 的数一共有多少个？', analysis: ['分类枚举', '共 <strong>38</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 38 },
  { id: '55-S7', title: '附加题5 · 分书', tag: 'type5', tagLabel: '综合挑战', difficulty: 4, text: '将 20 本相同的书分成 5 堆，要求每堆的书数都不相同，则一共有多少种不同的分法？', analysis: ['五数之和 20 且互异', '共 <strong>7</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 7 },
  { id: '55-S8', title: '附加题6 · 插入乘号', tag: 'type5', tagLabel: '综合挑战', difficulty: 4, text: '1,2,3,4 四个数字从小到大排成一行，中间任意插入乘号（最少插一个），可以得到多少个不同的乘积？', analysis: ['7 种不同乘积'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 7 },
  { id: '55-S9', title: '附加题7 · 买球', tag: 'type5', tagLabel: '综合挑战', difficulty: 2, text: '妈妈买了一些足球和篮球，两种球的个数不一样多，一共不到 10 个。那么妈妈买的球一共有多少种可能？', analysis: ['f+b<10 且 f≠b', '共 <strong>32</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 32 },
  { id: '55-S10', title: '附加作业1 · 五位数', tag: 'type5', tagLabel: '综合挑战', difficulty: 3, text: '用两个 1，一个 2，一个 3，一个 4 可以组成多少个不同的五位数？', analysis: ['5!/2! = <strong>60</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 60 },
  { id: '55-S11', title: '附加作业2 · 六位数', tag: 'type5', tagLabel: '综合挑战', difficulty: 4, text: '用两个 1，两个 2，一个 3，一个 4 可以组成多少个不同的六位数？', analysis: ['6!/(2!×2!) = <strong>180</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 180 },
  { id: '55-S12', title: '附加作业3 · 数字和', tag: 'type5', tagLabel: '综合挑战', difficulty: 3, text: '小于 1000 的三位数中，数字和小于 24 的有多少个？', analysis: ['100~999 中排除和≥24', '共 <strong>880</strong> 个'], type: 'none', finalQ: '共有', finalUnit: '个', finalAns: 880 },
  { id: '55-S13', title: '附加作业4 · 大小关系', tag: 'type5', tagLabel: '综合挑战', difficulty: 4, text: '1,2,3,4 组成无重复数字的四位数 abcd，若 a&lt;b, b&gt;c, c&lt;d，求一共有多少种方法？', analysis: ['全排列筛选', '共 <strong>5</strong> 种'], type: 'none', finalQ: '共有', finalUnit: '种', finalAns: 5 },
]

export const PROBLEMS: ProblemSet = {
  pretest: [],
  lesson: LESSON,
  homework: HOMEWORK,
  workbook: [],
  supplement: SUPPLEMENT,
}
