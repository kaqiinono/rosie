import type { Problem, ProblemSet } from '@rosie/core'

export const LESSON_TIP = '先看题中给的是头和腿和，还是倍数关系。头和腿和用假设全鸡法；其余题先把关系变成整倍，再按一组来分。'

export const TYPE_TIP: Record<string, string> = {
  hypothesis: '假设全是鸡：算假设腿数，求与实际的总差；再用每只兔多出的 2 条腿求兔数。',
  grouping: '找到倍数关系，必要时先多退少补变整倍；画一组，算每组对应量后求组数。',
  variant: '把硬币、得分或票价看作“鸡兔”：先统一假设一种情况，再用单位差换回来。',
}

const LABELS = { hypothesis: '假设法 · 头和腿和', grouping: '分组法 · 倍数关系', variant: '变型 · 假设与单位差' } as const
type Tag = keyof typeof LABELS

type Input = { id: string; title: string; tag: Tag; text: string; analysis: string[]; answer: number; finalQ: string; finalUnit?: string; difficulty?: Problem['difficulty'] }

function problem({ id, title, tag, text, analysis, answer, finalQ, finalUnit = '只', difficulty = 2 }: Input): Problem {
  return { id: `2-10-${id}`, title, tag, tagLabel: LABELS[tag], difficulty, text: `<strong>${text}</strong>`, analysis, type: 'none', finalQ, finalUnit, finalAns: answer }
}

const LESSON: Problem[] = [
  problem({ id: 'L1', title: '例题1 · 标准鸡兔同笼', tag: 'hypothesis', text: '鸡和兔一共有23只，腿一共有72条，问兔和鸡各有多少只？', analysis: ['假设全是鸡：23×2=46（条）。', '总差：72−46=26（条）；一只兔比一只鸡多 2 条腿。', '兔：26÷2=<strong>13（只）</strong>；鸡：23−13=10（只）。'], answer: 13, finalQ: '兔有多少只？' }),
  problem({ id: 'L2', title: '练一练 · 标准鸡兔同笼', tag: 'hypothesis', text: '鸡和兔关在一个笼子里，数数共有10个头，30条腿，鸡和兔各有多少只？', analysis: ['假设全是鸡有 10×2=20（条）腿。', '总差：30−20=10（条），单位差是 2 条。', '兔：10÷2=<strong>5（只）</strong>；鸡：10−5=5（只）。'], answer: 5, finalQ: '兔有多少只？' }),
  problem({ id: 'L3', title: '例题2 · 腿数差', tag: 'grouping', text: '鸡和兔一共有24只，兔腿比鸡腿多72条，问兔和鸡各有多少只？', analysis: ['把鸡、兔分别看成一组：1 只鸡有 2 条腿，1 只兔有 4 条腿。', '设有 6 组兔腿和鸡腿的比较，腿数差为 72÷(4−2)=36 组腿；结合总头数分组可得鸡 4 只、兔 20 只。', '兔有 <strong>20只</strong>，鸡有 4 只。'], answer: 20, finalQ: '兔有多少只？', difficulty: 3 }),
  problem({ id: 'L4', title: '练一练 · 腿数差', tag: 'grouping', text: '鸡和兔一共30只，兔腿比鸡腿多60条，鸡、兔各有多少只？', analysis: ['设鸡有 c 只、兔有 r 只，r+c=30；兔腿比鸡腿多，即 4r−2c=60。', '把 c=30−r 代入：4r−2(30−r)=60，得 6r=120。', '兔有 <strong>20只</strong>，鸡有 10 只。'], answer: 20, finalQ: '兔有多少只？', difficulty: 3 }),
  problem({ id: 'L5', title: '例题3 · 数量一样多', tag: 'grouping', text: '鸡和兔一样多，腿一共有72条，问兔和鸡各有多少只？', analysis: ['一样多就是一组有 1 只鸡、1 只兔。', '每组腿数：2+4=6（条），组数：72÷6=12（组）。', '鸡、兔各有 <strong>12只</strong>。'], answer: 12, finalQ: '鸡有多少只？' }),
  problem({ id: 'L6', title: '练一练 · 数量一样多', tag: 'grouping', text: '鸡和兔数量一样多，两种动物总腿数90条，鸡、兔各有多少只？', analysis: ['每组 1 只鸡和 1 只兔有 6 条腿。', '90÷6=15（组）。', '鸡、兔各有 <strong>15只</strong>。'], answer: 15, finalQ: '兔有多少只？' }),
  problem({ id: 'L5', title: '例题4 · 兔是鸡的2倍', tag: 'grouping', text: '兔是鸡的2倍，腿一共有70条，问兔和鸡各有多少只？', analysis: ['按 1 只鸡、2 只兔分一组。', '每组腿数：2+4×2=10（条）；70÷10=7（组）。', '鸡 7 只，兔 <strong>14只</strong>。'], answer: 14, finalQ: '兔有多少只？' }),
  problem({ id: 'L6', title: '练一练 · 兔是鸡的3倍', tag: 'grouping', text: '兔的数量是鸡的3倍，腿一共有140条，鸡、兔各多少只？', analysis: ['按 1 只鸡、3 只兔分一组。', '每组腿数：2+4×3=14（条）；140÷14=10（组）。', '鸡 10 只，兔 <strong>30只</strong>。'], answer: 30, finalQ: '兔有多少只？' }),
  problem({ id: 'L7', title: '例题5 · 鸡比兔多', tag: 'grouping', text: '鸡比兔多3个头，腿一共有72条，问兔和鸡各有多少只？', analysis: ['先去掉多出的 3 只鸡，腿数减少 3×2=6（条）。', '剩下鸡兔一样多，腿数为 72−6=66（条）。', '每组 6 条腿，66÷6=11（组）；兔 <strong>11只</strong>，鸡 11+3=14 只。'], answer: 11, finalQ: '兔有多少只？', difficulty: 3 }),
  problem({ id: 'L8', title: '练一练 · 兔比鸡多', tag: 'grouping', text: '兔子比鸡多5只，鸡和兔子一共有110条腿，鸡、兔各有多少只？', analysis: ['先去掉多出的 5 只兔，腿数减少 5×4=20（条）。', '剩下鸡兔一样多，腿数为 110−20=90（条）。', '90÷6=15（组）；鸡 15 只，兔 <strong>20只</strong>。'], answer: 20, finalQ: '兔有多少只？', difficulty: 3 }),
  problem({ id: 'L9', title: '例题6 · 头数倍数有余', tag: 'grouping', text: '鸡的头是兔的头的2倍多4个，腿一共有72条，问兔和鸡各有多少只？', analysis: ['先去掉多出的 4 只鸡，腿数减少 4×2=8（条）。', '余下鸡头 : 兔头 = 2:1；每组腿数为 2×2+4=8（条）。', '64÷8=8（组）；兔 <strong>8只</strong>，鸡 2×8+4=20 只。'], answer: 8, finalQ: '兔有多少只？', difficulty: 3 }),
  problem({ id: 'L10', title: '例题7 · 总腿数倍数', tag: 'grouping', text: '鸡的腿是兔的腿的2倍，头一共有70个，问兔和鸡各有多少只？', analysis: ['鸡腿总数 : 兔腿总数 = 2:1，所以鸡 : 兔 = 4:1。', '每组有 4+1=5 个头，70÷5=14（组）。', '鸡 56 只，兔 <strong>14只</strong>。'], answer: 14, finalQ: '兔有多少只？', difficulty: 3 }),
  problem({ id: 'L13', title: '例题8 · 总腿数倍数有余', tag: 'grouping', text: '鸡的腿是兔的腿的2倍多4条，头一共有72个，问兔和鸡各有多少只？', analysis: ['先减去多出的 4 条鸡腿，相当于先去掉 2 只鸡。', '余下鸡 : 兔 = 4:1，余下头数 72−2=70。', '70÷5=14（组）；兔 <strong>14只</strong>，鸡 4×14+2=58 只。'], answer: 14, finalQ: '兔有多少只？', difficulty: 4 }),
  problem({ id: 'L14', title: '例题9 · 差与倍数', tag: 'grouping', text: '兔比鸡多6只，兔腿是鸡腿的3倍，问兔和鸡各有多少只？', analysis: ['兔腿 : 鸡腿 = 3:1，因此兔 : 鸡 = 3:1。', '每组兔比鸡多 3−1=2 只；6÷2=3（组）。', '鸡 3 只，兔 <strong>9只</strong>。'], answer: 9, finalQ: '兔有多少只？', difficulty: 3 }),
  problem({ id: 'L15', title: '例题10 · 差、倍与余量', tag: 'grouping', text: '鸡比兔多23只，鸡的腿是兔的腿的3倍少4条，问兔和鸡各有多少只？', analysis: ['补上少的 4 条鸡腿，相当于先补 2 只鸡；鸡比兔多变为 25 只。', '鸡腿 : 兔腿 = 3:1，所以鸡 : 兔 = 6:1；每组差 5 只。', '25÷5=5（组）；补后鸡 30 只，退回 2 只得鸡 28 只，兔 <strong>5只</strong>。'], answer: 5, finalQ: '兔有多少只？', difficulty: 4 }),
  problem({ id: 'L16', title: '例题11 · 硬币变型', tag: 'variant', text: '2分和5分的硬币共36枚，总值一共是141分，5分硬币和2分硬币分别有多少枚？', analysis: ['假设全是 2 分硬币，总值 2×36=72（分）。', '总差：141−72=69（分）；每换一枚 5 分硬币多 3 分。', '5 分硬币：69÷3=<strong>23枚</strong>；2 分硬币：36−23=13 枚。'], answer: 23, finalQ: '5分硬币有多少枚？', finalUnit: '枚', difficulty: 3 }),
  problem({ id: 'L17', title: '例题12 · 得分变型', tag: 'variant', text: '期中测试共有10道题，每题10分；答对得10分，没答或答错倒扣4分，最后小明得了58分，答对了几道题？', analysis: ['假设全答对，得分 10×10=100（分）。', '总差：100−58=42（分）；每错一题与答对相差 10+4=14 分。', '错题 42÷14=3（道），答对 10−3=<strong>7道</strong>。'], answer: 7, finalQ: '答对了几道题？', finalUnit: '道', difficulty: 3 }),
  problem({ id: 'L18', title: '例题13 · 票价变型', tag: 'variant', text: '同学们去春游，按团体购票120张，共432元；单程票每张2元，往返票4元，那么单程票和往返票相差多少张？', analysis: ['假设全买单程票，需要 120×2=240（元）。', '总差：432−240=192（元）；每换一张往返票多 2 元。', '往返票 192÷2=96 张，单程票 120−96=24 张；相差 <strong>72张</strong>。'], answer: 72, finalQ: '两种票相差多少张？', finalUnit: '张', difficulty: 3 }),
]

export const PROBLEMS: ProblemSet = { pretest: [], lesson: LESSON, homework: [], workbook: [], supplement: [] }

export const PROBLEM_TYPES = [
  { tag: 'hypothesis', group: 'method', icon: '🐔', label: '假设法·头和腿和', desc: '全假设为鸡，用总差和单位差求兔数', example: '23只、72条腿' },
  { tag: 'grouping', group: 'method', icon: '🧩', label: '分组法·倍数关系', desc: '先多退少补变整倍，再按一组求解', example: '兔是鸡的3倍' },
  { tag: 'variant', group: 'variant', icon: '🪙', label: '鸡兔同笼变型', desc: '硬币、得分、票价中的假设与单位差', example: '2分和5分硬币' },
] as const

export const TAG_STYLE: Record<string, string> = { hypothesis: 'bg-amber-100 text-amber-800', grouping: 'bg-sky-100 text-sky-800', variant: 'bg-violet-100 text-violet-800' }
export const TYPE_STYLE: Record<string, { bg: string; border: string; titleColor: string; textColor: string }> = {
  hypothesis: { bg: 'bg-amber-50', border: 'border-amber-400', titleColor: 'text-amber-800', textColor: 'text-amber-700' },
  grouping: { bg: 'bg-sky-50', border: 'border-sky-400', titleColor: 'text-sky-800', textColor: 'text-sky-700' },
  variant: { bg: 'bg-violet-50', border: 'border-violet-400', titleColor: 'text-violet-800', textColor: 'text-violet-700' },
}
