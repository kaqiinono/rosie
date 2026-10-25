import type { Problem, ProblemSet } from '@rosie/core'

export const LESSON_TIP = '头和腿和用假设法；含倍数关系用分组法，几倍多或少先调整余量。变型题也按头、腿的和差倍分类；三类对象、互换题先转化，再选择方法。'

// 关系分类、解题方法、变型标记分别维护；多步题按转化后的主要关系分类。
// “头”也可指件数、人数、天数，“腿”可指轮数、金额、得分等加权量。
// 得分、赔偿题的腿和是带正负的合计；三类对象、互换题同时标明转化步骤。
const LABELS = {
  'head-sum-leg-sum': '头和 · 腿和',
  'head-sum-leg-difference': '头和 · 腿差',
  'head-sum-leg-ratio': '头和 · 腿倍',
  'head-difference-leg-sum': '头差 · 腿和',
  'head-difference-leg-difference': '头差 · 腿差',
  'head-difference-leg-ratio': '头差 · 腿倍',
  'head-ratio-leg-sum': '头倍 · 腿和',
  'head-ratio-leg-difference': '头倍 · 腿差',
  'head-ratio-leg-ratio': '头倍 · 腿倍',
  'head-sum-head-difference': '头和 · 头差',
  'known-head-leg-difference': '已知一类 · 腿差',
  'leg-difference-head-difference': '腿差求头差',
  variant: '待核对',
} as const
type Tag = keyof typeof LABELS

// 这里表示本讲推荐的方法，不限制同一道题采用其他正确解法。
export const METHOD_LABELS: Record<string, string> = {
  'head-sum-leg-sum': '假设法',
  'head-sum-leg-difference': '假设法',
  'head-sum-leg-ratio': '分组法',
  'head-difference-leg-sum': '分组法',
  'head-difference-leg-difference': '分组法',
  'head-difference-leg-ratio': '分组法',
  'head-ratio-leg-sum': '分组法',
  'head-ratio-leg-difference': '分组法',
  'head-ratio-leg-ratio': '分组法',
  'head-sum-head-difference': '和差法',
  'known-head-leg-difference': '单位差法',
  'leg-difference-head-difference': '单位差法',
  variant: '',
} satisfies Record<Tag, string>

// 非标准鸡兔情境也保留变型标记，不能因归入和差倍组合而丢失。
const VARIANT_IDS = new Set([
  'P6', 'P7', 'P8', 'P10',
  'L16', 'L17', 'L18', 'L19', 'L20', 'L21', 'L22', 'L23', 'L24', 'L25',
  'L26', 'L27', 'L28', 'L29', 'L30', 'L31', 'L32', 'L33', 'L34', 'L35',
  'H2', 'H3', 'H4', 'H5', 'H9', 'H10', 'H11', 'H12', 'H13', 'H14', 'H15',
  'H16', 'H18', 'H20', 'H21', 'H22', 'H23', 'H24',
  'S1', 'S2', 'S3', 'S4', 'S7', 'S8',
])

type Transformation = { label: string; tip: string; method?: string }
const TRANSFORMATIONS: Record<string, Transformation> = {
  L28: { label: '三类对象', tip: '先求出老北京冰棍的数量和收入，扣除后，另两种雪糕转为头和·腿和。' },
  L29: { label: '三类对象', tip: '先扣除已知猪肉的费用，牛肉和羊肉转为头差·腿和。' },
  L30: { label: '三类对象', tip: '先扣除已知甲商品的收入，乙、丙转为头差·腿和。' },
  L31: { label: '三类对象', tip: '先扣除一班领取的数量，二班和三班转为头倍·腿和。' },
  L32: { label: '三类对象', tip: '先把三班人数统一成4∶2∶1，每组按4人、2人、1人配组，再用苹果总数求组数。' },
  L33: { label: '三类对象', tip: '先去掉多出的1只兔，再把鸡、鸭、兔按2∶1∶1分组，用总腿数求组数，最后还原兔数。' },
  L34: { label: '三类对象', tip: '先把载重相同的乙、丙两车合为一类，按头和·腿和求甲车次数；再用和差法分出乙、丙次数。', method: '假设法＋和差法' },
  L35: { label: '三类对象', tip: '把等量的苹果和梨配对，每对2千克共8元，相当于每千克4元；与每千克3元的香蕉转为头和·腿和。', method: '假设法＋分组法' },
  H4: { label: '', tip: '本题题干的A、B倍数关系与现有解析不一致，需核对原题后再确定分类和方法。' },
  H23: { label: '', tip: '先算出16位成人共节省128元，再与实际节省120元比较，差8元；每名儿童使节省额减少2元，按单位差求儿童数，再加上成人数。' },
  H24: { label: '', tip: '先合并两种券：每人共5张，200张对应40人；两种券相差20张，对应两部门人数差20人，转为头和·头差。' },
  S2: { label: '互换', tip: '把互换前后的总腿数相加，每只动物合计贡献6条腿，先求出总头数，再按原来的总腿数转为头和·腿和。' },
  S3: { label: '三类对象', tip: '先把腿数相同的蜻蜓和蝉合为一类，按头和·腿和求蜘蛛数；再把翅膀对数当作腿数，继续用假设法区分蜻蜓和蝉。' },
  S4: { label: '三类对象·互换', tip: '每次互换的产值变化÷两种产品的单价差，得到两种产品的件数差；再比较两个件数差，求甲、丙件数差及互换产值。' },
  S7: { label: '四类对象', tip: '把第一、二组合并，每名第二组成员对应10个苹果；把第三、四组合并，每名第三组成员对应11个苹果。第二、三组共19人，转为头和·腿和，最后还原四组人数。', method: '假设法＋分组法' },
  S8: { label: '三类对象', tip: '把1道不答与1道答错配对：每组2题共扣1分，相当于每题扣半分；再与答对题转为头和·腿和，假设全对后按每组损失7分求组数。', method: '假设法＋分组法' },
}

export function isLesson10Variant(problem: Problem): boolean {
  return VARIANT_IDS.has(problem.id.replace(/^2-10-/, ''))
}

export function lesson10ProblemTip(problem: Problem): string {
  const transformation = TRANSFORMATIONS[problem.id.replace(/^2-10-/, '')]
  const method = transformation?.method ?? METHOD_LABELS[problem.tag]
  return [method ? `推荐${method}。` : '', transformation?.tip, TYPE_TIP[problem.tag]].filter(Boolean).join('')
}

export const TYPE_TIP: Record<string, string> = {
  'head-sum-leg-sum': '已知总数量和总腿数（或总金额、总得分），先假设全是一种，再用总差除以单位差。扣分、赔偿要按负数计算，单位差要把得与失相加。',
  'head-sum-leg-difference': '已知总头数和两类腿数的差，先看清哪类腿多。假设全是一类，每换一只，两类腿数的差会改变两种单只腿数之和。',
  'head-sum-leg-ratio': '已知总头数和腿数倍数，先按每只的腿数把腿数比换成只数比，再按每组头数求组数；几倍多或少要先调整余量，最后还原。',
  'head-difference-leg-sum': '已知只数差和总腿数，先去掉多出的动物及其腿数，使两类一样多，再按一只配一只分组。一样多就是头差为0，可直接分组。',
  'head-difference-leg-difference': '已知只数差和两类腿数（或金额）的差，先去掉数量多出的部分，同时调整腿数差；两类一样多后，按每对的腿数差求组数，注意比较方向。',
  'head-difference-leg-ratio': '先将腿数比换成只数比，再用已知头差除以每组只数差求组数；倍数关系有余量时，先补齐或去掉余量，同步调整头差，最后还原。',
  'head-ratio-leg-sum': '按头数倍数配成一组，用总腿数（或总金额）除以每组对应量求组数；几倍多或少先去掉或补齐多余、缺少的部分，最后还原。',
  'head-ratio-leg-difference': '按头数倍数配组，分别算出每组两类的腿数，用题目给出的腿数差除以每组腿数差求组数；有余量时先调整，并看清哪类腿多。',
  'head-ratio-leg-ratio': '先检查头数倍数与腿数倍数是否相容。只有两个纯倍数关系通常不能确定具体只数，还需要总数、差值或其他数量条件。',
  'head-sum-head-difference': '先用（总数量−数量差）÷2求较少的一类，再加上数量差求较多的一类；需要求金额时，分别乘单价后相加。',
  'known-head-leg-difference': '先算出数量已知的一类对总差额的贡献，扣除后，用剩余差额除以另一类每单位造成的差额，求其数量。',
  'leg-difference-head-difference': '互换前后的金额差等于单价差乘数量差。先用金额差除以单价差求数量差，再按所求对象比较、换算。',
  variant: '',
} satisfies Record<Tag, string>

type Input = { id: string; displayId?: string; title: string; tag: Tag; text: string; analysis: string[]; answer: number; finalQ: string; finalUnit?: string; difficulty?: Problem['difficulty'] }

function problem({ id, displayId, title, tag, text, analysis, answer, finalQ, finalUnit = '只', difficulty = 2 }: Input): Problem {
  const transformation = TRANSFORMATIONS[id]
  const tagLabel = [LABELS[tag], transformation?.method ?? METHOD_LABELS[tag], VARIANT_IDS.has(id) ? '变型题' : '', transformation?.label].filter(Boolean).join('｜')
  return { id: `2-10-${id}`, ...(displayId !== undefined ? { displayId } : {}), title, tag, tagLabel, difficulty, text: `<strong>${text}</strong>`, analysis, type: 'none', finalQ, finalUnit, finalAns: answer }
}

const PRETEST: Problem[] = [
  problem({ id: 'P1', title: '课前测1 · 头和腿和', tag: 'head-sum-leg-sum', text: '鸡和兔一共有33只，腿一共有84条，兔有多少只？', analysis: ['假设全是鸡，有 33×2=66（条）腿。', '实际多出 84−66=18（条）腿，每只兔比鸡多 2 条腿。', '兔有 18÷2=<strong>9（只）</strong>。'], answer: 9, finalQ: '兔有多少只？' }),
  problem({ id: 'P2', title: '课前测2 · 兔腿比鸡腿多', tag: 'head-sum-leg-difference', text: '鸡和兔一共有33个头，兔腿比鸡腿多84条，鸡有多少只？', analysis: ['设兔有 r 只，则鸡有 33−r 只。', '兔腿比鸡腿多：4r−2×(33−r)=84，得到 6r=150，所以兔有 25 只。', '鸡有 33−25=<strong>8（只）</strong>。'], answer: 8, finalQ: '鸡有多少只？', difficulty: 3 }),
  problem({ id: 'P3', title: '课前测3 · 鸡兔一样多', tag: 'head-difference-leg-sum', text: '鸡和兔一样多，腿一共有84条，兔和鸡各有多少只？', analysis: ['一组有 1 只鸡和 1 只兔，共有 2+4=6（条）腿。', '84÷6=14（组）。', '兔和鸡各有 <strong>14（只）</strong>。'], answer: 14, finalQ: '兔有多少只？' }),
  problem({ id: 'P4', title: '课前测4 · 鸡比兔多', tag: 'head-difference-leg-sum', text: '鸡比兔多3只，腿一共有84条，兔和鸡各有多少只？', analysis: ['先去掉多出的 3 只鸡，腿数减少 3×2=6（条）。', '余下鸡兔一样多，有 84−6=78（条）腿；78÷6=13（组）。', '兔有 <strong>13（只）</strong>，鸡有 13+3=16（只）。'], answer: 13, finalQ: '兔有多少只？', difficulty: 3 }),
  problem({ id: 'P5', title: '课前测5 · 腿数倍数有余', tag: 'head-sum-leg-ratio', text: '鸡的腿是兔的腿的2倍多8条，头一共有84个，兔和鸡各有多少只？', analysis: ['先去掉多出的 8 条鸡腿，相当于去掉 4 只鸡，余下 80 个头。', '鸡腿是兔腿的 2 倍时，鸡数是兔数的 4 倍；每组有 4 只鸡、1 只兔。', '80÷5=16（组），所以兔有 <strong>16（只）</strong>，鸡有 4×16+4=68（只）。'], answer: 16, finalQ: '兔有多少只？', difficulty: 3 }),
  problem({ id: 'P6', title: '课前测6 · 黄鼠狼和鸡', tag: 'head-ratio-leg-difference', text: '一群黄鼠狼在追一群鸡，鸡的数量是黄鼠狼的5倍，鸡的总腿数比黄鼠狼的总腿数多60条，一共有多少只鸡？', analysis: ['按 1 只黄鼠狼和 5 只鸡分一组。', '每组鸡腿比黄鼠狼腿多 5×2−4=6（条），所以有 60÷6=10（组）。', '鸡有 5×10=<strong>50（只）</strong>。'], answer: 50, finalQ: '一共有多少只鸡？', difficulty: 3 }),
  problem({ id: 'P7', title: '小测验（二）1 · 自行车和三轮车', tag: 'head-sum-leg-sum', text: '车棚停有自行车和三轮车共28辆，总轮子数为60个。自行车和三轮车各有多少辆？', analysis: ['假设全是自行车，有 28×2=56（个）轮子。', '实际多出 60−56=4（个）轮子，每辆三轮车比自行车多 1 个轮子，所以三轮车有 4÷1=4（辆）。', '自行车有 28−4=<strong>24（辆）</strong>。'], answer: 24, finalQ: '自行车有多少辆？', finalUnit: '辆' }),
  problem({ id: 'P8', title: '小测验（二）2 · 猜灯谜', tag: 'head-sum-leg-sum', text: '学校组织猜灯谜活动，猜对一道题目得5分，猜错一道扣2分。纳纳共答12道题，最后得分39分。他猜对和猜错的题目分别有多少道？', analysis: ['假设 12 道全对，可得 12×5=60（分）。', '比实际多 60−39=21（分），每猜错一道比猜对一道少 5+2=7（分），所以猜错 21÷7=3（道）。', '猜对 12−3=<strong>9（道）</strong>。'], answer: 9, finalQ: '猜对了多少道？', finalUnit: '道', difficulty: 3 }),
  problem({ id: 'P9', title: '小测验（二）3 · 兔腿比鸡腿多', tag: 'head-sum-leg-difference', text: '笼子里鸡和兔一共有35只，兔的总腿数比鸡的总腿数多20条。鸡和兔分别有多少只？', analysis: ['假设全是鸡，兔腿比鸡腿少 35×2=70（条）。', '每把 1 只鸡换为兔，兔腿增加 4 条，鸡腿减少 2 条，差额增加 6 条。', '兔有 (20+70)÷6=15（只），鸡有 35−15=<strong>20（只）</strong>。'], answer: 20, finalQ: '鸡有多少只？', difficulty: 3 }),
  problem({ id: 'P10', title: '小测验（二）4 · 大小宿舍', tag: 'head-ratio-leg-sum', text: '某学校有大、小两种宿舍，大宿舍能住6人，小宿舍能住4人，且小宿舍数量比大宿舍数量的2倍多4间。当宿舍住满时一共能住128人，两种宿舍各有多少间？', analysis: ['先去掉多出的 4 间小宿舍，余下能住 128−4×4=112（人）。', '此时按 1 间大宿舍、2 间小宿舍分一组，每组能住 6+2×4=14（人）。', '大宿舍有 112÷14=<strong>8（间）</strong>，小宿舍有 8×2+4=20（间）。'], answer: 8, finalQ: '大宿舍有多少间？', finalUnit: '间', difficulty: 3 }),
  problem({ id: 'P11', title: '小测验（二）5 · 兔比鸡多', tag: 'head-difference-leg-ratio', text: '鸡兔同笼，兔比鸡多5只，兔子的总腿数比鸡的总腿数的3倍少8条。兔子有多少只？', analysis: ['先补上 8 条兔腿，相当于补 2 只兔；此时兔比鸡多 5+2=7（只）。', '补后兔腿是鸡腿的 3 倍，所以兔与鸡的数量比是 3:2，每组多 1 只兔，共有 7 组。', '实际兔有 3×7−2=<strong>19（只）</strong>。'], answer: 19, finalQ: '兔子有多少只？', difficulty: 4 }),
]

const LESSON: Problem[] = [
  problem({ id: 'L1', title: '例题1 · 标准鸡兔同笼', tag: 'head-sum-leg-sum', text: '鸡和兔一共有23只，腿一共有72条，问兔和鸡各有多少只？', analysis: ['假设全是鸡：23×2=46（条）。', '总差：72−46=26（条）；一只兔比一只鸡多 2 条腿。', '兔：26÷2=<strong>13（只）</strong>；鸡：23−13=10（只）。'], answer: 13, finalQ: '兔有多少只？' }),
  problem({ id: 'L2', displayId: 'L1-1', title: '练一练 · 标准鸡兔同笼', tag: 'head-sum-leg-sum', text: '鸡和兔关在一个笼子里，数数共有10个头，30条腿，鸡和兔各有多少只？', analysis: ['假设全是鸡有 10×2=20（条）腿。', '总差：30−20=10（条），单位差是 2 条。', '兔：10÷2=<strong>5（只）</strong>；鸡：10−5=5（只）。'], answer: 5, finalQ: '兔有多少只？' }),
  problem({ id: 'L3', displayId: 'L2', title: '例题2 · 腿数差', tag: 'head-sum-leg-difference', text: '鸡和兔一共有24只，兔腿比鸡腿多72条，问兔和鸡各有多少只？', analysis: ['把鸡、兔分别看成一组：1 只鸡有 2 条腿，1 只兔有 4 条腿。', '设有 6 组兔腿和鸡腿的比较，腿数差为 72÷(4−2)=36 组腿；结合总头数分组可得鸡 4 只、兔 20 只。', '兔有 <strong>20只</strong>，鸡有 4 只。'], answer: 20, finalQ: '兔有多少只？', difficulty: 3 }),
  problem({ id: 'L4', displayId: 'L2-1', title: '练一练 · 腿数差', tag: 'head-sum-leg-difference', text: '鸡和兔一共30只，兔腿比鸡腿多60条，鸡、兔各有多少只？', analysis: ['设鸡有 c 只、兔有 r 只，r+c=30；兔腿比鸡腿多，即 4r−2c=60。', '把 c=30−r 代入：4r−2(30−r)=60，得 6r=120。', '兔有 <strong>20只</strong>，鸡有 10 只。'], answer: 20, finalQ: '兔有多少只？', difficulty: 3 }),
  problem({ id: 'L5', displayId: 'L3', title: '例题3 · 数量一样多', tag: 'head-difference-leg-sum', text: '鸡和兔一样多，腿一共有72条，问兔和鸡各有多少只？', analysis: ['一样多就是一组有 1 只鸡、1 只兔。', '每组腿数：2+4=6（条），组数：72÷6=12（组）。', '鸡、兔各有 <strong>12只</strong>。'], answer: 12, finalQ: '鸡有多少只？' }),
  problem({ id: 'L6', displayId: 'L3-1', title: '练一练 · 数量一样多', tag: 'head-difference-leg-sum', text: '鸡和兔数量一样多，两种动物总腿数90条，鸡、兔各有多少只？', analysis: ['每组 1 只鸡和 1 只兔有 6 条腿。', '90÷6=15（组）。', '鸡、兔各有 <strong>15只</strong>。'], answer: 15, finalQ: '兔有多少只？' }),
  problem({ id: 'L11', displayId: 'L4', title: '例题4 · 兔是鸡的2倍', tag: 'head-ratio-leg-sum', text: '兔是鸡的2倍，腿一共有70条，问兔和鸡各有多少只？', analysis: ['按 1 只鸡、2 只兔分一组。', '每组腿数：2+4×2=10（条）；70÷10=7（组）。', '鸡 7 只，兔 <strong>14只</strong>。'], answer: 14, finalQ: '兔有多少只？' }),
  problem({ id: 'L12', displayId: 'L4-1', title: '练一练 · 兔是鸡的3倍', tag: 'head-ratio-leg-sum', text: '兔的数量是鸡的3倍，腿一共有140条，鸡、兔各多少只？', analysis: ['按 1 只鸡、3 只兔分一组。', '每组腿数：2+4×3=14（条）；140÷14=10（组）。', '鸡 10 只，兔 <strong>30只</strong>。'], answer: 30, finalQ: '兔有多少只？' }),
  problem({ id: 'L7', displayId: 'L5', title: '例题5 · 鸡比兔多', tag: 'head-difference-leg-sum', text: '鸡比兔多3个头，腿一共有72条，问兔和鸡各有多少只？', analysis: ['先去掉多出的 3 只鸡，腿数减少 3×2=6（条）。', '剩下鸡兔一样多，腿数为 72−6=66（条）。', '每组 6 条腿，66÷6=11（组）；兔 <strong>11只</strong>，鸡 11+3=14 只。'], answer: 11, finalQ: '兔有多少只？', difficulty: 3 }),
  problem({ id: 'L8', displayId: 'L5-1', title: '练一练 · 兔比鸡多', tag: 'head-difference-leg-sum', text: '兔子比鸡多5只，鸡和兔子一共有110条腿，鸡、兔各有多少只？', analysis: ['先去掉多出的 5 只兔，腿数减少 5×4=20（条）。', '剩下鸡兔一样多，腿数为 110−20=90（条）。', '90÷6=15（组）；鸡 15 只，兔 <strong>20只</strong>。'], answer: 20, finalQ: '兔有多少只？', difficulty: 3 }),
  problem({ id: 'L9', displayId: 'L6', title: '例题6 · 头数倍数有余', tag: 'head-ratio-leg-sum', text: '鸡的头是兔的头的2倍多4个，腿一共有72条，问兔和鸡各有多少只？', analysis: ['先去掉多出的 4 只鸡，腿数减少 4×2=8（条）。', '余下鸡头 : 兔头 = 2:1；每组腿数为 2×2+4=8（条）。', '64÷8=8（组）；兔 <strong>8只</strong>，鸡 2×8+4=20 只。'], answer: 8, finalQ: '兔有多少只？', difficulty: 3 }),
  problem({ id: 'L10', displayId: 'L7', title: '例题7 · 总腿数倍数', tag: 'head-sum-leg-ratio', text: '鸡的腿是兔的腿的2倍，头一共有70个，问兔和鸡各有多少只？', analysis: ['鸡腿总数 : 兔腿总数 = 2:1，所以鸡 : 兔 = 4:1。', '每组有 4+1=5 个头，70÷5=14（组）。', '鸡 56 只，兔 <strong>14只</strong>。'], answer: 14, finalQ: '兔有多少只？', difficulty: 3 }),
  problem({ id: 'L13', displayId: 'L8', title: '例题8 · 总腿数倍数有余', tag: 'head-sum-leg-ratio', text: '鸡的腿是兔的腿的2倍多4条，头一共有72个，问兔和鸡各有多少只？', analysis: ['先减去多出的 4 条鸡腿，相当于先去掉 2 只鸡。', '余下鸡 : 兔 = 4:1，余下头数 72−2=70。', '70÷5=14（组）；兔 <strong>14只</strong>，鸡 4×14+2=58 只。'], answer: 14, finalQ: '兔有多少只？', difficulty: 4 }),
  problem({ id: 'L14', displayId: 'L9', title: '例题9 · 差与倍数', tag: 'head-difference-leg-ratio', text: '兔比鸡多6只，兔腿是鸡腿的3倍，问兔和鸡各有多少只？', analysis: ['兔腿 : 鸡腿 = 3:1。因为兔有 4 条腿、鸡有 2 条腿，所以兔数 : 鸡数 = 3:2。', '每组兔比鸡多 3−2=1（只）；6÷1=6（组）。', '鸡有 2×6=12（只），兔有 <strong>3×6=18（只）</strong>。'], answer: 18, finalQ: '兔有多少只？', difficulty: 3 }),
  problem({ id: 'L15', displayId: 'L10', title: '例题10 · 差、倍与余量', tag: 'head-difference-leg-ratio', text: '鸡比兔多23只，鸡的腿是兔的腿的3倍少4条，问兔和鸡各有多少只？', analysis: ['补上少的 4 条鸡腿，相当于先补 2 只鸡；鸡比兔多变为 25 只。', '鸡腿 : 兔腿 = 3:1，所以鸡 : 兔 = 6:1；每组差 5 只。', '25÷5=5（组）；补后鸡 30 只，退回 2 只得鸡 28 只，兔 <strong>5只</strong>。'], answer: 5, finalQ: '兔有多少只？', difficulty: 4 }),
  problem({ id: 'L16', displayId: 'L11', title: '例题11 · 硬币变型', tag: 'head-sum-leg-sum', text: '2分和5分的硬币共36枚，总值一共是141分，5分硬币和2分硬币分别有多少枚？', analysis: ['假设全是 2 分硬币，总值 2×36=72（分）。', '总差：141−72=69（分）；每换一枚 5 分硬币多 3 分。', '5 分硬币：69÷3=<strong>23枚</strong>；2 分硬币：36−23=13 枚。'], answer: 23, finalQ: '5分硬币有多少枚？', finalUnit: '枚', difficulty: 3 }),
  problem({ id: 'L17', displayId: 'L12', title: '例题12 · 得分变型', tag: 'head-sum-leg-sum', text: '期中测试共有10道题，每题10分；答对得10分，没答或答错倒扣4分，最后小明得了58分，答对了几道题？', analysis: ['假设全答对，得分 10×10=100（分）。', '总差：100−58=42（分）；每错一题与答对相差 10+4=14 分。', '错题 42÷14=3（道），答对 10−3=<strong>7道</strong>。'], answer: 7, finalQ: '答对了几道题？', finalUnit: '道', difficulty: 3 }),
  problem({ id: 'L18', displayId: 'L13', title: '例题13 · 票价变型', tag: 'head-sum-leg-sum', text: '同学们去春游，按团体购票120张，共432元；单程票每张2元，往返票4元，那么单程票和往返票相差多少张？', analysis: ['假设全买单程票，需要 120×2=240（元）。', '总差：432−240=192（元）；每换一张往返票多 2 元。', '往返票 192÷2=96 张，单程票 120−96=24 张；相差 <strong>72张</strong>。'], answer: 72, finalQ: '两种票相差多少张？', finalUnit: '张', difficulty: 3 }),
  problem({ id: 'L19', displayId: 'L14', title: '例题14 · 看书天数', tag: 'head-sum-leg-sum', text: '纳纳从9月12日开始看一本214页的书，用20天看完。开始时每天看10页，后来每天看12页，纳纳从几月几号开始每天看12页？', analysis: ['假设 20 天都每天看 10 页，共看 10×20=200（页）。', '还差 214−200=14（页）；改为每天看 12 页后，每天多看 2 页，所以后来共看 14÷2=7（天）。', '开始的 20−7=13 天是 9 月 12 日至 24 日，因此从 <strong>9月25日</strong>开始每天看 12 页。'], answer: 25, finalQ: '从9月几日开始每天看12页？', finalUnit: '日', difficulty: 3 }),
  problem({ id: 'L20', displayId: 'L15', title: '例题15 · 硬币数量差', tag: 'head-difference-leg-sum', text: '5分硬币的枚数比2分硬币的枚数多3枚，总值一共是141分。5分硬币和2分硬币各有多少枚？', analysis: ['先去掉多出的 3 枚 5 分硬币，钱数减少 3×5=15（分），余下 141−15=126（分）。', '余下两种硬币一样多，每组总值 5+2=7（分），所以有 126÷7=18（组）。', '2 分硬币有 18 枚，5 分硬币有 18+3=<strong>21（枚）</strong>。'], answer: 21, finalQ: '5分硬币有多少枚？', finalUnit: '枚', difficulty: 3 }),
  problem({ id: 'L21', displayId: 'L16', title: '例题16 · 5角和1元硬币', tag: 'head-sum-head-difference', text: '喜羊羊的存钱罐中只有5角和1元硬币，共100枚，其中5角硬币比1元硬币多20枚。存钱罐中一共有多少钱？', analysis: ['先去掉多出的 20 枚 5 角硬币，余下 80 枚，两种硬币一样多。', '80÷2=40（组），所以有 1 元硬币 40 枚、5 角硬币 60 枚。', '总钱数为 40×1+60×0.5=<strong>70（元）</strong>。'], answer: 70, finalQ: '存钱罐中一共有多少钱？', finalUnit: '元', difficulty: 3 }),
  problem({ id: 'L22', displayId: 'L17', title: '例题17 · 搬运花瓶', tag: 'head-sum-leg-sum', text: '百货商店委托搬运站运送100只花瓶。每只运费1元；每打破一只不但不给运费，还要赔偿1元。结果搬运站共得运费92元，搬运过程中打破了几只花瓶？', analysis: ['假设 100 只都完好，可得 100×1=100（元）。', '实际少得 100−92=8（元）；每打破 1 只与完好相比少 1+1=2（元）。', '打破了 8÷2=<strong>4（只）</strong>花瓶。'], answer: 4, finalQ: '打破了几只花瓶？', difficulty: 3 }),
  problem({ id: 'L23', displayId: 'L18', title: '例题18 · 男女生与本子', tag: 'head-ratio-leg-sum', text: '一班男生人数是女生人数的2倍多2人。老师给每个男生分2个本子，给每个女生分3个本子，一共发了74个本子。一班共有多少人？', analysis: ['先去掉多出的 2 名男生及其 2×2=4（个）本子，余下 70 个本子。', '按 2 名男生、1 名女生分一组，每组分到 2×2+3=7（个）本子，所以有 70÷7=10（组）。', '女生 10 人，男生 2×10+2=22 人，全班共有 <strong>32（人）</strong>。'], answer: 32, finalQ: '一班共有多少人？', finalUnit: '人', difficulty: 3 }),
  problem({ id: 'L24', displayId: 'L19', title: '例题19 · 狗和鸭子', tag: 'head-ratio-leg-difference', text: '河边有一群狗追一群鸭子，鸭子的只数是狗的5倍，鸭子的总腿数比狗的总腿数多36条。狗和鸭子各有多少只？', analysis: ['按 1 只狗和 5 只鸭子分一组。', '每组鸭腿比狗腿多 5×2−4=6（条），所以有 36÷6=6（组）。', '狗有 6 只，鸭子有 <strong>5×6=30（只）</strong>。'], answer: 30, finalQ: '鸭子有多少只？', difficulty: 3 }),
  problem({ id: 'L25', displayId: 'L20', title: '例题20 · 大班和小班', tag: 'head-ratio-leg-sum', text: '幼儿园给大班和小班的同学发桔子，大班每人2个，小班每人3个。大班人数比小班人数的3倍多1人，一共发出92个桔子。大班和小班各有多少人？', analysis: ['先去掉多出的 1 名大班同学及 2 个桔子，余下 92−2=90（个）。', '按 3 名大班同学、1 名小班同学分一组，每组需要 3×2+3=9（个）桔子，所以有 90÷9=10（组）。', '小班 10 人，大班 3×10+1=<strong>31（人）</strong>。'], answer: 31, finalQ: '大班有多少人？', finalUnit: '人', difficulty: 3 }),
  problem({ id: 'L26', displayId: 'L21', title: '例题21 · 硬币面值差', tag: 'head-difference-leg-difference', text: '5分硬币的枚数比2分硬币的枚数多3枚，5分硬币的总面值比2分硬币的总面值多48分。5分硬币和2分硬币各有多少枚？', analysis: ['先去掉多出的 3 枚 5 分硬币，面值差减少 3×5=15（分），余下差 48−15=33（分）。', '余下两种硬币一样多，每组面值相差 5−2=3（分），所以有 33÷3=11（组）。', '2 分硬币有 11 枚，5 分硬币有 11+3=<strong>14（枚）</strong>。'], answer: 14, finalQ: '5分硬币有多少枚？', finalUnit: '枚', difficulty: 3 }),
  problem({ id: 'L27', displayId: 'L22', title: '例题22 · 工作与休息', tag: 'head-sum-leg-sum', text: '某工人与老板签订30天的劳务合同：工作一天得48元，休息一天扣12元。合同到期后他没有拿到报酬，最多工作了多少天？', analysis: ['假设 30 天都工作，可得 48×30=1440（元）。', '每把 1 个工作日换成休息日，报酬减少 48+12=60（元）。', '需要换 1440÷60=24（天）为休息日，所以最多工作 30−24=<strong>6（天）</strong>。'], answer: 6, finalQ: '最多工作了多少天？', finalUnit: '天', difficulty: 3 }),
  problem({ id: 'L28', displayId: 'L23', title: '例题23 · 三种雪糕', tag: 'head-sum-leg-sum', text: '老北京冰棍每根2元，巧乐兹雪糕每根6元，梦龙雪糕每根10元。三种雪糕一共卖了12根，总收入60元；巧乐兹和梦龙共卖了50元。巧乐兹卖了多少根？', analysis: ['老北京冰棍收入为 60−50=10（元），卖出 10÷2=5（根），所以巧乐兹和梦龙共卖 12−5=7（根）。', '假设这 7 根全是梦龙，收入为 7×10=70（元），比实际多 70−50=20（元）。', '每把 1 根梦龙换成巧乐兹少 10−6=4（元），所以巧乐兹卖出 20÷4=<strong>5（根）</strong>。'], answer: 5, finalQ: '巧乐兹卖了多少根？', finalUnit: '根', difficulty: 4 }),
  problem({ id: 'L29', displayId: 'L24', title: '例题24 · 三种肉', tag: 'head-difference-leg-sum', text: '猪肉、牛肉和羊肉每斤分别为7元、9元和8元，一共花143元。猪肉买了6斤，羊肉比牛肉多2斤。羊肉买了多少斤？', analysis: ['猪肉花 6×7=42（元），牛肉和羊肉共花 143−42=101（元）。', '先去掉多出的 2 斤羊肉，余下钱数 101−2×8=85（元）；此时牛肉和羊肉一样多。', '每组 1 斤牛肉和 1 斤羊肉共 9+8=17（元），85÷17=5（组）；羊肉有 5+2=<strong>7（斤）</strong>。'], answer: 7, finalQ: '羊肉买了多少斤？', finalUnit: '斤', difficulty: 4 }),
  problem({ id: 'L30', displayId: 'L25', title: '例题25 · 三种商品', tag: 'head-difference-leg-sum', text: '甲、乙、丙三种商品每件分别卖3元、4元、6元。甲卖出14件，乙比丙多卖21件，一共卖526元。乙卖出了多少件？', analysis: ['甲商品收入为 14×3=42（元），乙、丙共收入 526−42=484（元）。', '先去掉乙多出的 21 件，余下收入 484−21×4=400（元）；此时乙、丙件数一样多。', '每组 1 件乙和 1 件丙共 4+6=10（元），400÷10=40（组）；乙卖出 40+21=<strong>61（件）</strong>。'], answer: 61, finalQ: '乙商品卖出了多少件？', finalUnit: '件', difficulty: 4 }),
  problem({ id: 'L31', displayId: 'L26', title: '例题26 · 三个班分可爱多', tag: 'head-ratio-leg-sum', text: '老师给一班每人2个可爱多，二班每人1个，三班每人2个，一共发146个。一班有32人，二班人数比三班的2倍多2人。二班有多少人？', analysis: ['一班用了 32×2=64（个），二、三班共用 146−64=82（个）。', '先去掉二班多出的 2 人及 2 个可爱多，余下 80 个。按 2 名二班同学、1 名三班同学分一组，每组用 2×1+2=4（个）。', '80÷4=20（组），所以二班有 2×20+2=<strong>42（人）</strong>。'], answer: 42, finalQ: '二班有多少人？', finalUnit: '人', difficulty: 4 }),
  problem({ id: 'L32', displayId: 'L27', title: '例题27 · 三个班发苹果', tag: 'head-ratio-leg-sum', text: 'A班每人得1个苹果，B班每人得2个，C班每人得3个。A班人数是B班的2倍，B班人数是C班的2倍，一共发了132个苹果。A、B、C三班分别有多少人？', analysis: ['按 4 名 A 班、2 名 B 班、1 名 C 班分一组。', '每组需要 4×1+2×2+1×3=11（个）苹果，所以有 132÷11=12（组）。', 'A班有 <strong>48人</strong>，B班有 24 人，C班有 12 人。'], answer: 48, finalQ: 'A班有多少人？', finalUnit: '人', difficulty: 4 }),
  problem({ id: 'L33', displayId: 'L28', title: '例题28 · 鸡鸭兔三种动物', tag: 'head-ratio-leg-sum', text: '鸡、鸭和兔同处一个棚子里，鸡的只数是鸭的2倍，兔比鸭多1只，一共有84条腿。兔有多少只？', analysis: ['先去掉多出的 1 只兔及 4 条腿，余下 84−4=80（条）腿。', '按 2 只鸡、1 只鸭、1 只兔分一组，每组有 2×2+1×2+1×4=10（条）腿。', '80÷10=8（组），所以兔有 8+1=<strong>9（只）</strong>。'], answer: 9, finalQ: '兔有多少只？', difficulty: 4 }),
  problem({ id: 'L34', displayId: 'L29', title: '例题29 · 三辆卡车运货', tag: 'head-sum-leg-sum', text: '甲、乙、丙三辆卡车要运走287吨货物，甲车每次可运5吨，乙车每次可运7吨，丙车每次可运7吨。三辆车共运了43次把所有货物运完，乙车比丙车多运4次。乙车运了多少次？', analysis: ['假设 43 次都用载重 7 吨的车，可运 43×7=301（吨），比实际多 301−287=14（吨）。', '甲车每次比另两辆车少运 2 吨，所以甲运了 14÷2=7（次），乙和丙共运 43−7=36（次）。', '乙比丙多 4 次，丙运 (36−4)÷2=16（次），乙运 16+4=<strong>20（次）</strong>。'], answer: 20, finalQ: '乙车运了多少次？', finalUnit: '次', difficulty: 4 }),
  problem({ id: 'L35', displayId: 'L30', title: '例题30 · 三种水果', tag: 'head-sum-leg-sum', text: '香蕉、苹果和梨三种水果共40千克，其中苹果和梨的重量相等。如果香蕉每千克3元，苹果每千克2元，梨每千克6元，买这些水果共花了146元。三种水果各多少千克？', analysis: ['假设 40 千克全是香蕉，要花 40×3=120（元），比实际少 146−120=26（元）。', '每用 1 千克苹果和 1 千克梨替换 2 千克香蕉，价钱增加 2+6−2×3=2（元），所以苹果和梨各有 26÷2=13（千克）。', '香蕉有 40−13−13=<strong>14（千克）</strong>。'], answer: 14, finalQ: '香蕉有多少千克？', finalUnit: '千克', difficulty: 4 }),
]

const HOMEWORK: Problem[] = [
  problem({ id: 'H1', title: '练习1 · 标准鸡兔同笼', tag: 'head-sum-leg-sum', text: '鸡和兔一共有36只，腿一共有100条，问兔和鸡各有多少只？', analysis: ['假设全是鸡，有 36×2=72（条）腿。', '总差：100−72=28（条）；每只兔比鸡多 2 条腿。', '兔：28÷2=<strong>14（只）</strong>；鸡：36−14=22（只）。'], answer: 14, finalQ: '兔有多少只？' }),
  problem({ id: 'H2', title: '练习2 · 植树人数', tag: 'head-sum-leg-sum', text: '二年级和五年级的同学去参加义务植树活动，一共有44人。五年级每人植5棵，二年级每人植2棵，正好一共植了100棵。参加植树的五年级和二年级学生各有多少人？', analysis: ['假设全是二年级学生，植树 44×2=88（棵）。', '总差：100−88=12（棵）；每换 1 名五年级学生多植 5−2=3（棵）。', '五年级：12÷3=<strong>4（人）</strong>；二年级：44−4=40（人）。'], answer: 4, finalQ: '五年级学生有多少人？', finalUnit: '人' }),
  problem({ id: 'H3', title: '练习3 · 鸵鸟和大象', tag: 'head-sum-leg-sum', text: '动物园里有一群鸵鸟和大象，它们共有36只眼睛和52只脚，问鸵鸟和大象各有多少只？', analysis: ['36 只眼睛表示共有 36÷2=18（只）动物。假设全是鸵鸟，有 18×2=36（只）脚。', '总差：52−36=16（只）脚；每只大象比鸵鸟多 2 只脚。', '大象：16÷2=<strong>8（只）</strong>；鸵鸟：18−8=10（只）。'], answer: 8, finalQ: '大象有多少只？' }),
  // 待核对原题：题干为 A 大于 B 的4倍，解析却按 B 是 A 的4倍；暂列待核对，不推断解题方法。
  problem({ id: 'H4', title: '练习4 · 变色龙分组', tag: 'variant', text: 'A种变色龙5分钟可以变4种颜色，B种变色龙5分钟可以变7种颜色。现有A种变色龙大于B种变色龙的4倍，在一个小时内一共变产生了1920次变色，请问一共有多少只A种变色龙？', analysis: ['1 小时有 60÷5=12 个 5 分钟，所以每个 5 分钟共变色 1920÷12=160（次）。', '按 1 只 A 种、4 只 B 种分一组，每组 5 分钟变色 4+4×7=32（次）。', '160÷32=<strong>5（组）</strong>，所以 A 种有 5 只。'], answer: 5, finalQ: 'A种变色龙有多少只？' }),
  problem({ id: 'H5', title: '练习5 · 射击得分', tag: 'head-sum-leg-sum', text: '立立参加射击比赛，规定每射中一发得20分，脱靶一发扣12分。他一共射了20发，共得208分。立立一共射中了几发？', analysis: ['假设 20 发全中，得 20×20=400（分）。', '总差：400−208=192（分）；每脱靶 1 发与射中相比少 20+12=32（分）。', '脱靶：192÷32=6（发）；射中：20−6=<strong>14（发）</strong>。'], answer: 14, finalQ: '射中了几发？', finalUnit: '发' }),
  problem({ id: 'H6', title: '练习6 · 兔腿多', tag: 'head-sum-leg-difference', text: '鸡和兔一共有107只，兔腿比鸡腿多56只，问鸡、兔各有多少只？', analysis: ['去掉兔腿多出的 56 只脚，相当于去掉 56÷4=14（只）兔。', '余下鸡兔一样多，共有 107−14=93（只）；每组有 2 只鸡、1 只兔，共 3 只。', '93÷3=31（组）；鸡 31×2=62（只），兔 31+14=<strong>45（只）</strong>。'], answer: 45, finalQ: '兔有多少只？', difficulty: 3 }),
  problem({ id: 'H7', title: '练习7 · 鸡脚多', tag: 'head-sum-leg-difference', text: '鸡、兔共60只，鸡脚比兔脚多60只。问鸡、兔各多少只？', analysis: ['去掉鸡脚多出的 60 只脚，相当于去掉 60÷2=30（只）鸡。', '余下鸡兔一样多，共有 60−30=30（只）；每组有 2 只鸡、1 只兔，共 3 只。', '30÷3=10（组）；鸡 10×2+30=<strong>50（只）</strong>，兔 10 只。'], answer: 50, finalQ: '鸡有多少只？', difficulty: 3 }),
  problem({ id: 'H8', title: '练习8 · 养殖园', tag: 'head-difference-leg-sum', text: '一个养殖园内，鸡比兔多36只，共有脚792只，鸡兔各几只？', analysis: ['去掉多出的 36 只鸡，脚数减少 36×2=72（只），余下有 792−72=720（只）脚。', '余下鸡兔一样多，每组有 2+4=6（只）脚。', '720÷6=120（组）；鸡 120+36=<strong>156（只）</strong>，兔 120 只。'], answer: 156, finalQ: '鸡有多少只？', difficulty: 3 }),
  problem({ id: 'H9', title: '练习9 · 汽车和摩托车', tag: 'head-difference-leg-sum', text: '停车场上停放有小汽车和摩托车，摩托车2个轮子。其中摩托车比小汽车多26辆，一共有274个轮子，问小汽车和摩托车各有多少辆？', analysis: ['去掉多出的 26 辆摩托车，轮子减少 26×2=52（个），余下有 274−52=222（个）轮子。', '余下小汽车和摩托车一样多，每组有 4+2=6（个）轮子。', '222÷6=37（组）；小汽车 37 辆，摩托车 37+26=<strong>63（辆）</strong>。'], answer: 63, finalQ: '摩托车有多少辆？', finalUnit: '辆', difficulty: 3 }),
  problem({ id: 'H10', title: '练习10 · 陶瓷花瓶', tag: 'head-sum-leg-sum', text: '工人运陶瓷花瓶250个，规定完整运到目的地一个给运费20元，损坏一个倒赔100元。运完这批花瓶后，工人共得4400元，问损坏了多少个？', analysis: ['假设全完好，可得 250×20=5000（元）。', '总差：5000−4400=600（元）；每损坏 1 个与完好相比相差 20+100=120（元）。', '损坏：600÷120=<strong>5（个）</strong>。'], answer: 5, finalQ: '损坏了多少个？', finalUnit: '个', difficulty: 3 }),
  problem({ id: 'H11', title: '练习11 · 梅花鹿和鸵鸟', tag: 'head-difference-leg-sum', text: '动物园里养了一些梅花鹿和鸵鸟，一共有208只脚，其中鸵鸟比梅花鹿多20只。梅花鹿和鸵鸟各有多少只？', analysis: ['去掉多出的 20 只鸵鸟，脚数减少 20×2=40（只），余下有 208−40=168（只）脚。', '余下梅花鹿和鸵鸟一样多，每组有 4+2=6（只）脚。', '168÷6=28（组）；梅花鹿 28 只，鸵鸟 28+20=<strong>48（只）</strong>。'], answer: 48, finalQ: '鸵鸟有多少只？', difficulty: 3 }),
  problem({ id: 'H12', title: '练习12 · 数学竞赛得分', tag: 'head-sum-leg-sum', text: '纳约小学3名参加数学竞赛，共10道题，答对一道题得10分，答错或不答一道题扣3分。立立得了87分，思思得了74分，辰辰得了9分，问他们三人一共答对了几道题？', analysis: ['假设每人 10 题全对，都是 100 分；每错 1 题与答对相比相差 10+3=13（分）。', '立立错 (100−87)÷13=1（题），答对 9 题；思思错 2 题，答对 8 题；辰辰错 7 题，答对 3 题。', '三人一共答对 9+8+3=<strong>20（题）</strong>。'], answer: 20, finalQ: '三人一共答对了几道题？', finalUnit: '道', difficulty: 3 }),
  problem({ id: 'H13', title: '练习13 · 鸵鸟和大象一样多', tag: 'head-difference-leg-sum', text: '动物园里鸵鸟和大象的数量一样，一共有96条腿。鸵鸟和大象各有多少只？', analysis: ['一组有 1 只鸵鸟和 1 只大象，共有 2+4=6（条）腿。', '96÷6=16（组）。', '鸵鸟和大象各有 <strong>16（只）</strong>。'], answer: 16, finalQ: '鸵鸟有多少只？' }),
  problem({ id: 'H14', title: '练习14 · 大小宿舍', tag: 'head-difference-leg-sum', text: '某学校有大、小两种宿舍，大宿舍住6人，小宿舍住4人，两种宿舍数量一样多。住满时一共能住130人，两种宿舍各有多少间？', analysis: ['一组有 1 间大宿舍和 1 间小宿舍，共住 6+4=10（人）。', '130÷10=13（组）。', '大宿舍和小宿舍各有 <strong>13（间）</strong>。'], answer: 13, finalQ: '大宿舍有多少间？', finalUnit: '间' }),
  problem({ id: 'H15', title: '练习15 · 乌龟和鸭子', tag: 'head-difference-leg-sum', text: '池塘里有乌龟和鸭子，鸭子比乌龟多36只，它们共有792只脚。鸭子和乌龟各有多少只？', analysis: ['先去掉多出的 36 只鸭子及 36×2=72（只）脚，余下 792−72=720（只）脚。', '余下鸭子和乌龟一样多，每组有 2+4=6（只）脚，所以有 720÷6=120（组）。', '乌龟 120 只，鸭子 120+36=<strong>156（只）</strong>。'], answer: 156, finalQ: '鸭子有多少只？', difficulty: 3 }),
  problem({ id: 'H16', title: '练习16 · 彩色气球', tag: 'head-ratio-leg-sum', text: '学校买了白气球和彩色气球，白气球2角一个，彩色气球5角一个。彩色气球的数量是白气球的3倍，共花44元2角。彩色气球买了多少个？', analysis: ['44 元 2 角等于 442 角。按 1 个白气球、3 个彩色气球分一组。', '每组花 2+3×5=17（角），所以有 442÷17=26（组）。', '彩色气球有 26×3=<strong>78（个）</strong>。'], answer: 78, finalQ: '彩色气球买了多少个？', finalUnit: '个', difficulty: 3 }),
  problem({ id: 'H17', title: '练习17 · 兔比鸡的3倍少6', tag: 'head-ratio-leg-sum', text: '立立奶奶养了一些鸡和兔，兔比鸡的3倍少6只，鸡和兔共有116条腿。鸡、兔各有多少只？', analysis: ['先补上 6 只兔，腿数变为 116+6×4=140（条）。', '此时兔是鸡的 3 倍，按 1 只鸡、3 只兔分一组，每组有 2+3×4=14（条）腿。', '140÷14=10（组），鸡有 10 只，兔有 3×10−6=<strong>24（只）</strong>。'], answer: 24, finalQ: '兔有多少只？', difficulty: 3 }),
  problem({ id: 'H18', title: '练习18 · 白菜和黄瓜', tag: 'head-ratio-leg-sum', text: '叔叔买了白菜和黄瓜若干千克，黄瓜每千克3元，白菜每千克4元。白菜的数量是黄瓜数量的2倍多1千克，一共花37元。黄瓜买了多少千克？', analysis: ['先去掉多出的 1 千克白菜，余下钱数 37−4=33（元）。', '按 2 千克白菜、1 千克黄瓜分一组，每组花 2×4+3=11（元）。', '黄瓜买了 33÷11=<strong>3（千克）</strong>。'], answer: 3, finalQ: '黄瓜买了多少千克？', finalUnit: '千克', difficulty: 3 }),
  problem({ id: 'H19', title: '练习19 · 腿数3倍少320', tag: 'head-difference-leg-ratio', text: '鸡兔同笼，鸡比兔多23只，兔的总腿数比鸡的总腿数的3倍少320条。兔有多少只？', analysis: ['设兔有 r 只，则鸡有 r+23 只。', '根据题意，4r=3×2×(r+23)−320，即 4r=6r−182。', '2r=182，所以兔有 <strong>91（只）</strong>。'], answer: 91, finalQ: '兔有多少只？', difficulty: 4 }),
  problem({ id: 'H20', title: '练习20 · 篮球和足球', tag: 'head-difference-leg-difference', text: '学校买了一批篮球和足球，篮球比足球多10个，篮球比足球多花450元。篮球每个24元，足球每个18元。篮球和足球各买了多少个？', analysis: ['先算多出的 10 个篮球花 24×10=240（元），余下价差为 450−240=210（元）。', '余下篮球和足球一样多，每一组的价差为 24−18=6（元），所以足球有 210÷6=35（个）。', '篮球有 35+10=<strong>45（个）</strong>。'], answer: 45, finalQ: '篮球买了多少个？', finalUnit: '个', difficulty: 3 }),
  problem({ id: 'H21', title: '练习21 · 黄瓜和西红柿装盒', tag: 'head-difference-leg-sum', text: '超市把黄瓜和西红柿装盒，黄瓜2根一盒，西红柿4个一盒。一共装了110个，西红柿比黄瓜多装5盒。黄瓜和西红柿各装了几盒？', analysis: ['先去掉多出的 5 盒西红柿及 5×4=20（个），余下 110−20=90（个）。', '此时两种盒数一样多，每组 1 盒黄瓜和 1 盒西红柿，共装 2+4=6（个）。', '90÷6=15（组），黄瓜装 15 盒，西红柿装 <strong>20（盒）</strong>。'], answer: 15, finalQ: '黄瓜装了几盒？', finalUnit: '盒', difficulty: 3 }),
  problem({ id: 'H22', title: '练习22 · 独轮车和三轮车', tag: 'head-ratio-leg-sum', text: '马戏团里有独轮车和三轮车，每辆独轮车1个轮子，每辆三轮车3个轮子。三轮车数量是独轮车的2倍，所有车一共有56个轮子。独轮车和三轮车各有多少辆？', analysis: ['按 1 辆独轮车、2 辆三轮车分一组。', '每组有 1+2×3=7（个）轮子，所以有 56÷7=8（组）。', '独轮车有 8 辆，三轮车有 <strong>16（辆）</strong>。'], answer: 16, finalQ: '三轮车有多少辆？', finalUnit: '辆', difficulty: 3 }),
  problem({ id: 'H23', title: '练习23 · 团体票', tag: 'known-head-leg-difference', text: '某景点儿童票30元、成人票40元，团体票平均32元一位。一个由8个家庭组成的旅游团，每个家庭有2位大人，有的家庭还有1个小孩。买团体票比各买各的少花120元。旅游团一共有多少人？', analysis: ['8 个家庭共有 8×2=16（位）成人。成人各自买票比团体票每人多 40−32=8（元），共多 16×8=128（元）。', '每名儿童各自买票比团体票少 32−30=2（元）。要使总价差从 128 元变为 120 元，需要 8÷2=4（名）儿童。', '旅游团共有 16+4=<strong>20（人）</strong>。'], answer: 20, finalQ: '旅游团一共有多少人？', finalUnit: '人', difficulty: 4 }),
  problem({ id: 'H24', title: '练习24 · 两部门发券', tag: 'head-sum-head-difference', text: '中秋节前夕，公司给员工发购物券。市场部每人3张月饼券和2张水果券，技术部每人2张月饼券和3张水果券。一共发了110张月饼券和90张水果券。市场部和技术部各有多少人？', analysis: ['月饼券比水果券多 110−90=20（张）。市场部每人使月饼券比水果券多 1 张，技术部每人则少 1 张，所以市场部比技术部多 20 人。', '先去掉市场部多出的 20 人及 20×3=60（张）月饼券，余下月饼券 110−60=50（张）。', '此时两部门人数一样多，每组发 3+2=5（张）月饼券，所以技术部有 50÷5=10 人，市场部有 <strong>30（人）</strong>。'], answer: 30, finalQ: '市场部有多少人？', finalUnit: '人', difficulty: 4 }),
]

const SUPPLEMENT: Problem[] = [
  problem({ id: 'S1', title: '附加题1 · 大人小孩吃面包', tag: 'head-sum-leg-sum', text: '一个大人一餐可以吃2个面包，两个小孩一餐可以吃1个面包。现有大人小孩共99人，一餐刚好吃99个面包，那么大人有多少人，小孩有多少人？', analysis: ['按 1 个大人、2 个小孩分一组，每组有 3 人，吃 2+1=3（个）面包。', '99÷3=33（组）。', '大人有 <strong>33（人）</strong>，小孩有 33×2=66（人）。'], answer: 33, finalQ: '大人有多少人？', finalUnit: '人', difficulty: 4 }),
  problem({ id: 'S2', title: '附加题2 · 鸡兔互换', tag: 'head-sum-leg-sum', text: '鸡兔同笼，共有腿220只。如果将鸡换成兔、兔换成鸡，则共有腿212只。求鸡、兔各有多少只？', analysis: ['每只动物在互换前后分别有 2 条腿和 4 条腿，两次合计 6 条腿，所以鸡兔共有 (220+212)÷6=72（只）。', '假设原来全是鸡，有 72×2=144（条）腿；每只兔比鸡多 2 条腿。', '原来兔有 (220−144)÷2=<strong>38（只）</strong>，鸡有 72−38=34（只）。'], answer: 38, finalQ: '原来兔有多少只？', difficulty: 4 }),
  problem({ id: 'S3', title: '附加题3 · 腿和翅膀', tag: 'head-sum-leg-sum', text: '蜘蛛、蜻蜓和蝉三种动物一共有18只。蜘蛛有8条腿但没有翅膀，蜻蜓有6条腿和2对翅膀，蝉有6条腿和1对翅膀。三种动物一共有118条腿、20对翅膀。三种动物各有多少只？', analysis: ['假设 18 只动物都有 6 条腿，共有 18×6=108（条）腿；蜘蛛每只多 2 条腿，所以蜘蛛有 (118−108)÷2=5（只）。', '蜻蜓和蝉共 18−5=13（只）。假设它们都有 1 对翅膀，还差 20−13=7（对），所以蜻蜓有 7 只。', '蝉有 13−7=<strong>6（只）</strong>。'], answer: 6, finalQ: '蝉有多少只？', difficulty: 4 }),
  problem({ id: 'S4', title: '附加题4 · 产品件数互换', tag: 'leg-difference-head-difference', text: '某工厂生产甲、乙、丙3种产品，单价分别是11元、7元和2元。把甲产品与乙产品的件数互换，产值增加28000元；把乙产品与丙产品的件数互换，产值减少30000元。如果把甲产品与丙产品的件数互换，产值变化多少元？', analysis: ['甲、乙单价差为 11−7=4（元），所以乙比甲多 28000÷4=7000（件）。', '乙、丙单价差为 7−2=5（元），所以乙比丙多 30000÷5=6000（件）；丙比甲多 7000−6000=1000（件）。', '互换甲、丙后，单价高的甲产品多 1000 件，产值增加 1000×(11−2)=<strong>9000（元）</strong>。'], answer: 9000, finalQ: '产值增加多少元？', finalUnit: '元', difficulty: 4 }),
  problem({ id: 'S7', title: '附加题7 · 四组分苹果', tag: 'head-sum-leg-sum', text: '给某班的小朋友分苹果，第一组每人3个，第二组每人4个，第三组每人5个，第四组每人6个。第二组和第三组共有19人，第一组人数是第二组的2倍，第三组和第四组人数相等。总共分出去201个苹果。该班一共有多少名小朋友？', analysis: ['设第二组有 x 人，则第一组有 2x 人，第三组和第四组各有 19−x 人。', '苹果总数为 3×2x+4x+5×(19−x)+6×(19−x)=201，即 209−x=201，得 x=8。', '四组人数分别为 16、8、11、11，共有 <strong>46（人）</strong>。'], answer: 46, finalQ: '该班一共有多少名小朋友？', finalUnit: '人', difficulty: 4 }),
  problem({ id: 'S8', title: '附加题8 · 选择题得分', tag: 'head-sum-leg-sum', text: '一次考试共有100道选择题，答对一题得3分，不答不得分，答错一题倒扣1分。纳纳最后得244分，而且他不答的题目数量和答错的题目数量一样多。他答对了几道题？', analysis: ['假设 100 题全对，可得 100×3=300（分），比实际多 300−244=56（分）。', '把 1 道不答和 1 道答错合为一组，比 2 道答对少 3+(3+1)=7（分），所以有 56÷7=8（组）。', '不答和答错各 8 道，答对 100−8−8=<strong>84（道）</strong>。'], answer: 84, finalQ: '答对了几道题？', finalUnit: '道', difficulty: 4 }),
]

export const PROBLEMS: ProblemSet = { pretest: PRETEST, lesson: LESSON, homework: HOMEWORK, workbook: [], supplement: SUPPLEMENT }

export const PROBLEM_TYPES = [
  { tag: 'head-sum-leg-sum', group: 'head-sum', icon: '🐔', label: LABELS['head-sum-leg-sum'], desc: '总数量 + 总腿数、金额或得分', example: '鸡兔共23只，腿共72条' },
  { tag: 'head-sum-leg-difference', group: 'head-sum', icon: '🐔', label: LABELS['head-sum-leg-difference'], desc: '总数量 + 两类腿数差', example: '鸡兔共24只，兔腿比鸡腿多72条' },
  { tag: 'head-sum-leg-ratio', group: 'head-sum', icon: '🐔', label: LABELS['head-sum-leg-ratio'], desc: '总数量 + 腿数倍数，含几倍多或少', example: '共70个头，鸡腿是兔腿的2倍' },
  { tag: 'head-difference-leg-sum', group: 'head-difference', icon: '🐇', label: LABELS['head-difference-leg-sum'], desc: '数量差 + 总腿数；一样多按头差为0归类', example: '鸡比兔多3只，腿共72条' },
  { tag: 'head-difference-leg-difference', group: 'head-difference', icon: '🐇', label: LABELS['head-difference-leg-difference'], desc: '数量差 + 两类腿数或金额差', example: '5分硬币多3枚，总面值多48分' },
  { tag: 'head-difference-leg-ratio', group: 'head-difference', icon: '🐇', label: LABELS['head-difference-leg-ratio'], desc: '数量差 + 腿数倍数，含几倍多或少', example: '兔比鸡多6只，兔腿是鸡腿的3倍' },
  { tag: 'head-ratio-leg-sum', group: 'head-ratio', icon: '🧩', label: LABELS['head-ratio-leg-sum'], desc: '数量倍数 + 总腿数，含几倍多或少', example: '兔是鸡的2倍，腿共70条' },
  { tag: 'head-ratio-leg-difference', group: 'head-ratio', icon: '🧩', label: LABELS['head-ratio-leg-difference'], desc: '数量倍数 + 两类腿数差', example: '鸭是狗的5倍，鸭腿比狗腿多36条' },
  { tag: 'head-ratio-leg-ratio', group: 'head-ratio', icon: '🧩', label: LABELS['head-ratio-leg-ratio'], desc: '数量倍数 + 腿数倍数；纯倍数还需数量条件', example: '先检查两个倍数是否相容、条件是否充分' },
  { tag: 'head-sum-head-difference', group: 'head-sum', icon: '🪙', label: LABELS['head-sum-head-difference'], desc: '总数量 + 数量差，再求各类数量或总值', example: '共100枚硬币，5角硬币比1元硬币多20枚' },
  { tag: 'known-head-leg-difference', group: 'variant', icon: '🎟️', label: LABELS['known-head-leg-difference'], desc: '已知一类数量，从总差额求另一类数量', example: '已知16位成人，团体购票共节省120元' },
  { tag: 'leg-difference-head-difference', group: 'variant', icon: '🔄', label: LABELS['leg-difference-head-difference'], desc: '由互换产值差和单价差求件数差', example: '甲乙互换产值增加28000元，单价相差4元' },
  { tag: 'variant', group: 'variant', icon: '📝', label: LABELS.variant, desc: '题干与解析存在冲突，暂不确定关系和方法', example: 'H4变色龙：需核对A、B的倍数关系' },
] as const

export const TAG_STYLE: Record<string, string> = {
  'head-sum-leg-sum': 'bg-amber-100 text-amber-800',
  'head-sum-leg-difference': 'bg-amber-100 text-amber-800',
  'head-sum-leg-ratio': 'bg-amber-100 text-amber-800',
  'head-difference-leg-sum': 'bg-sky-100 text-sky-800',
  'head-difference-leg-difference': 'bg-sky-100 text-sky-800',
  'head-difference-leg-ratio': 'bg-sky-100 text-sky-800',
  'head-ratio-leg-sum': 'bg-emerald-100 text-emerald-800',
  'head-ratio-leg-difference': 'bg-emerald-100 text-emerald-800',
  'head-ratio-leg-ratio': 'bg-emerald-100 text-emerald-800',
  'head-sum-head-difference': 'bg-amber-100 text-amber-800',
  'known-head-leg-difference': 'bg-violet-100 text-violet-800',
  'leg-difference-head-difference': 'bg-violet-100 text-violet-800',
  variant: 'bg-violet-100 text-violet-800',
}

const GROUP_STYLE = {
  'head-sum': { bg: 'bg-amber-50', border: 'border-amber-400', titleColor: 'text-amber-800', textColor: 'text-amber-700' },
  'head-difference': { bg: 'bg-sky-50', border: 'border-sky-400', titleColor: 'text-sky-800', textColor: 'text-sky-700' },
  'head-ratio': { bg: 'bg-emerald-50', border: 'border-emerald-400', titleColor: 'text-emerald-800', textColor: 'text-emerald-700' },
  variant: { bg: 'bg-violet-50', border: 'border-violet-400', titleColor: 'text-violet-800', textColor: 'text-violet-700' },
}

export const TYPE_STYLE: Record<string, { bg: string; border: string; titleColor: string; textColor: string }> =
  Object.fromEntries(PROBLEM_TYPES.map(type => [type.tag, GROUP_STYLE[type.group]]))
