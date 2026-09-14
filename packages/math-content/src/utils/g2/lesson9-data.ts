import type { Problem, ProblemSet } from '@rosie/core'

export const LESSON_TIP =
  '先看数的结构再动笔：循环数用“走马灯”，12345679 用“缺8数”，全是1用“宝塔数”；乘11用“两边一拉，中间相加”，重复的 01/001 用“椅子数”；再识别 37、1001，以及头同尾合十、尾同头合十。没有这些特征时，再用凑整、分配律或提取公因数。'

export const TYPE_TIP: Record<string, string> = {
  type1: '乘法凑整：2×5=10，4×25=100，8×125=1000，16×625=10000。',
  type2: '乘除抵消：同级运算可带着乘、除号调整顺序；去括号时，括号前是除号，括号里的乘除号要互换。',
  type3: '分配律：a×(b±c)=a×b±a×c；除法只能拆被除数，如 (a+b)÷c=a÷c+b÷c。',
  type4: '提取公因数：先把相同乘数圈出来；没有直接公因数时，利用倍数关系或相近数构造。',
  type5: '走马灯：末位乘几，结果最后就是几；其余数字按 142857 的循环顺序移动。',
  type6: '缺8数：12345679×9=111111111；先凑乘9，再结合重复数字或乘11规律。',
  type7: '头同尾合十：前半=头×(头+1)，后半=尾×尾；后半不足两位补0。',
  type8: '特殊数：牢记 3×37=111、27×37=999、7×11×13=1001，再分解重组。',
  type9: '椅子数：从个位向左找重复的01、001；单把椅子的长度要和被重复数的位数相同。',
  type10: '乘11：两边一拉，中间相加；从右向左处理进位。',
  type11: '平方巧算：观察相同因数与整十、整百的距离，选择直接平方或平方差。',
}

type ProblemInput = {
  id: string
  title: string
  tag: keyof typeof TYPE_TIP
  text: string
  analysis: string[]
  answer: number
  difficulty?: Problem['difficulty']
}

const TAG_LABELS: Record<keyof typeof TYPE_TIP, string> = {
  type1: '乘法凑整',
  type2: '乘除抵消',
  type3: '乘法与除法分配律',
  type4: '提取与构造公因数',
  type5: '走马灯',
  type6: '缺8数',
  type7: '头同尾合十',
  type8: '特殊数111·999·1001',
  type9: '椅子数',
  type10: '乘11',
  type11: '平方巧算',
}

function problem({ id, title, tag, text, analysis, answer, difficulty = 2 }: ProblemInput): Problem {
  return {
    id: `2-9-${id}`,
    title,
    tag,
    tagLabel: TAG_LABELS[tag],
    difficulty,
    text: `<strong>${text}</strong>`,
    analysis,
    type: 'none',
    finalQ: '结果是多少？',
    finalUnit: '',
    finalAns: answer,
  }
}

function sourcedProblem(
  id: string,
  title: string,
  tag: keyof typeof TYPE_TIP,
  text: string,
  answer: number,
  analysis = '先观察数的结构，选择对应的巧算方法。',
): Problem {
  return problem({
    id,
    title,
    tag,
    text,
    analysis: [analysis, '<strong>结果为 ' + answer + '。</strong>'],
    answer,
  })
}

const LESSON: Problem[] = [
  problem({ id: 'L1', title: '例题1(1) · 25与4凑整', tag: 'type1', text: '17 × 25 × 4', analysis: ['交换顺序，先算 25×4=100', '17×100=<strong>1700</strong>'], answer: 1700 }),
  problem({ id: 'L2', title: '例题1(2) · 125与8凑整', tag: 'type1', text: '125 × 19 × 8', analysis: ['先算 125×8=1000', '19×1000=<strong>19000</strong>'], answer: 19000 }),
  problem({ id: 'L3', title: '例题1(3) · 拆出8', tag: 'type1', text: '125 × 72', analysis: ['把 72 拆成 8×9', '125×8×9=1000×9=<strong>9000</strong>'], answer: 9000 }),
  problem({ id: 'L4', title: '例题1(4) · 两组凑整', tag: 'type1', text: '25 × 125 × 16', analysis: ['把 16 改写成 4×8÷2', '(25×4)×(125×8)÷2=100×1000÷2=<strong>50000</strong>'], answer: 50000 }),
  problem({ id: 'L5', title: '例题2(1) · 构造整十', tag: 'type1', text: '24068 × 5', analysis: ['写成 24068×10÷2', '240680÷2=<strong>120340</strong>'], answer: 120340 }),
  problem({ id: 'L6', title: '例题2(2) · 构造整百', tag: 'type1', text: '1248 × 25', analysis: ['写成 1248×100÷4', '124800÷4=<strong>31200</strong>'], answer: 31200 }),
  problem({ id: 'L7', title: '例题2(3) · 构造整千', tag: 'type1', text: '4032 × 125', analysis: ['写成 4032×1000÷8', '4032000÷8=<strong>504000</strong>'], answer: 504000 }),
  problem({ id: 'L8', title: '练一练 · 乘25', tag: 'type1', text: '2004 × 25', analysis: ['写成 2004×100÷4', '200400÷4=<strong>50100</strong>'], answer: 50100 }),
  problem({ id: 'L9', title: '练一练 · 乘125', tag: 'type1', text: '125 × 792', analysis: ['把 792 拆成 8×99', '125×8×99=1000×99=<strong>99000</strong>'], answer: 99000 }),

  problem({ id: 'L10', title: '例题3(1) · 调序抵消', tag: 'type2', text: '100 ÷ 17 × 34 ÷ 25', analysis: ['带着符号调序：(100÷25)×(34÷17)', '4×2=<strong>8</strong>'], answer: 8, difficulty: 3 }),
  problem({ id: 'L11', title: '例题3(2) · 调序抵消', tag: 'type2', text: '55 ÷ 25 × 150 ÷ 5', analysis: ['调整为 (55÷5)×(150÷25)', '11×6=<strong>66</strong>'], answer: 66, difficulty: 3 }),
  problem({ id: 'L12', title: '例题4(1) · 拆括号', tag: 'type2', text: '54 × 24 ÷ (9 × 4)', analysis: ['除以括号内的乘积，等于依次除以 9、4', '(54÷9)×(24÷4)=6×6=<strong>36</strong>'], answer: 36, difficulty: 3 }),
  problem({ id: 'L13', title: '例题4(2) · 除号前拆括号', tag: 'type2', text: '760 ÷ (38 ÷ 125) × 80', analysis: ['括号前是除号，去括号后 ÷38、×125', '(760÷38)×(125×80)=20×10000=<strong>200000</strong>'], answer: 200000, difficulty: 4 }),
  problem({ id: 'L14', title: '例题5 · 连续抵消', tag: 'type2', text: '6 ÷ (7 ÷ 11) ÷ (11 ÷ 13) ÷ (18 ÷ 21)', analysis: ['去括号：6÷7×11÷11×13÷18×21', '约去 11，且 6÷18×21÷7=1，所以结果为 <strong>13</strong>'], answer: 13, difficulty: 4 }),
  problem({ id: 'L15', title: '例题6 · 连锁抵消', tag: 'type2', text: '1 ÷ (3 ÷ 5) ÷ (5 ÷ 7) ÷ (7 ÷ 9) ÷……÷ (37 ÷ 39)', analysis: ['去括号后得到 1÷3×5÷5×7÷7×9÷……÷37×39', '中间因数依次抵消，只剩 39÷3=<strong>13</strong>'], answer: 13, difficulty: 5 }),

  problem({ id: 'L16', title: '例题7(1) · 和的分配律', tag: 'type3', text: '125 × (100 + 8)', analysis: ['125×100+125×8', '12500+1000=<strong>13500</strong>'], answer: 13500 }),
  problem({ id: 'L17', title: '例题7(2) · 差的分配律', tag: 'type3', text: '25 × (200 − 4)', analysis: ['25×200−25×4', '5000−100=<strong>4900</strong>'], answer: 4900 }),
  problem({ id: 'L18', title: '例题8(1) · 乘99', tag: 'type3', text: '73 × 99', analysis: ['99=100−1', '73×100−73=<strong>7227</strong>'], answer: 7227 }),
  problem({ id: 'L19', title: '例题8(2) · 乘999', tag: 'type3', text: '473 × 999', analysis: ['999=1000−1', '473000−473=<strong>472527</strong>'], answer: 472527, difficulty: 3 }),
  problem({ id: 'L20', title: '例题8(4) · 构造999', tag: 'type3', text: '333 × 666', analysis: ['333×3=999，666÷3=222，所以原式=999×222', '(1000−1)×222=222000−222=<strong>221778</strong>'], answer: 221778, difficulty: 4 }),
  problem({ id: 'L21', title: '练一练 · 乘9999', tag: 'type3', text: '256 × 9999', analysis: ['9999=10000−1', '2560000−256=<strong>2559744</strong>'], answer: 2559744, difficulty: 3 }),
  problem({ id: 'L22', title: '例题9(1) · 除法分配律', tag: 'type3', text: '4175 ÷ 25', analysis: ['把被除数拆成 4000+175', '4000÷25+175÷25=160+7=<strong>167</strong>'], answer: 167 }),
  problem({ id: 'L23', title: '例题9(2) · 除法分配律', tag: 'type3', text: '8875 ÷ 125', analysis: ['把被除数拆成 8000+875', '8000÷125+875÷125=64+7=<strong>71</strong>'], answer: 71 }),
  problem({ id: 'L24', title: '练一练(1) · 除以25', tag: 'type3', text: '825 ÷ 25', analysis: ['拆成 800+25', '800÷25+25÷25=32+1=<strong>33</strong>'], answer: 33 }),
  problem({ id: 'L25', title: '练一练(2) · 除以125', tag: 'type3', text: '3625 ÷ 125', analysis: ['拆成 2500+1125', '2500÷125+1125÷125=20+9=<strong>29</strong>'], answer: 29 }),

  problem({ id: 'L26', title: '例题10(1) · 直接提取公因数', tag: 'type4', text: '11 × 18 − 23 × 11 + 11 × 17', analysis: ['提取公因数 11：11×(18−23+17)', '11×12=<strong>132</strong>'], answer: 132 }),
  problem({ id: 'L27', title: '例题10(2) · 直接提取公因数', tag: 'type4', text: '7 × 22 + 7 × 35 − 7 × 17', analysis: ['提取公因数 7：7×(22+35−17)', '7×40=<strong>280</strong>'], answer: 280 }),
  problem({ id: 'L28', title: '例题11(1) · 两次提取', tag: 'type4', text: '28 × 7 + 36 × 7 + 64 × 13', analysis: ['前两项提取 7：(28+36)×7+64×13', '得到 64×7+64×13=64×20=<strong>1280</strong>'], answer: 1280, difficulty: 3 }),
  problem({ id: 'L29', title: '例题11(2) · 两次提取', tag: 'type4', text: '33 × 17 + 40 × 17 − 7 × 73', analysis: ['前两项提取 17：(33+40)×17−7×73=73×17−7×73', '提取 73：73×(17−7)=<strong>730</strong>'], answer: 730, difficulty: 3 }),
  problem({ id: 'L30', title: '例题12(1) · 倍数构造公因数', tag: 'type4', text: '13 × 58 − 26 × 11 + 39 × 21', analysis: ['26=13×2，39=13×3', '13×(58−2×11+3×21)=13×99=<strong>1287</strong>'], answer: 1287, difficulty: 4 }),
  problem({ id: 'L31', title: '例题12(2) · 倍数构造公因数', tag: 'type4', text: '26 × 44 + 37 × 88', analysis: ['88=44×2，所以 37×88=74×44', '(26+74)×44=100×44=<strong>4400</strong>'], answer: 4400, difficulty: 3 }),
  problem({ id: 'L32', title: '例题13(1) · 单倍数构造', tag: 'type4', text: '80 × 1995 − 3990 + 1995 × 22', analysis: ['3990=1995×2', '1995×(80−2+22)=1995×100=<strong>199500</strong>'], answer: 199500, difficulty: 4 }),
  problem({ id: 'L33', title: '例题13(2) · 分开提取', tag: 'type4', text: '88 × 22 + 55 × 73 − 44 × 44 − 33 × 55', analysis: ['88×22=44×44，两项抵消', '55×(73−33)=55×40=<strong>2200</strong>'], answer: 2200, difficulty: 4 }),
  problem({ id: 'L34', title: '例题14(1) · 相近数构造', tag: 'type4', text: '53 × 46 + 71 × 54 + 82 × 54', analysis: ['53=54−1，将 53×46 改写为 54×46−46', '54×(46+71+82)−46=54×199−46=<strong>10700</strong>'], answer: 10700, difficulty: 4 }),
  problem({ id: 'L35', title: '例题14(2) · 相近数构造', tag: 'type4', text: '126 × 3 + 12 × 125 − 124 × 7', analysis: ['126=125+1，124=125−1', '125×(3+12−7)+(3+7)=1000+10=<strong>1010</strong>'], answer: 1010, difficulty: 4 }),
  problem({ id: 'L36', title: '例题15(1) · 除法提公因数', tag: 'type4', text: '48 ÷ 7 + 40 ÷ 7 + 24 ÷ 7', analysis: ['合并相同除数：(48+40+24)÷7', '112÷7=<strong>16</strong>'], answer: 16 }),
  problem({ id: 'L37', title: '例题15(2) · 除法提公因数', tag: 'type4', text: '27 ÷ 8 + 51 ÷ 8 − 14 ÷ 8', analysis: ['合并相同除数：(27+51−14)÷8', '64÷8=<strong>8</strong>'], answer: 8 }),
]

const HOMEWORK: Problem[] = [
  problem({ id: 'H1', title: '练习1(1) · 25与4凑整', tag: 'type1', text: '25 × 59 × 4', analysis: ['先算 25×4=100', '59×100=<strong>5900</strong>'], answer: 5900 }),
  problem({ id: 'H2', title: '练习1(2) · 125与8凑整', tag: 'type1', text: '125 × 3 × 32', analysis: ['32=8×4', '125×8×3×4=1000×12=<strong>12000</strong>'], answer: 12000 }),
  problem({ id: 'H3', title: '练习2(1) · 多组凑整', tag: 'type1', text: '173 × 32 × 125 × 25', analysis: ['32=4×8', '173×(4×25)×(8×125)=173×100×1000=<strong>17300000</strong>'], answer: 17300000, difficulty: 3 }),
  problem({ id: 'H4', title: '练习2(2) · 多组凑整', tag: 'type1', text: '456 × 2 × 125 × 25 × 5 × 4 × 8', analysis: ['分别凑成 2×5=10、25×4=100、125×8=1000', '456×10×100×1000=<strong>456000000</strong>'], answer: 456000000, difficulty: 3 }),
  problem({ id: 'H5', title: '练习3(1) · 括号抵消', tag: 'type2', text: '(21 ÷ 7) × (7 ÷ 2) ÷ (3 ÷ 2)', analysis: ['去括号：21÷7×7÷2÷3×2', '约去 7、2，得 21÷3=<strong>7</strong>'], answer: 7, difficulty: 3 }),
  problem({ id: 'H6', title: '练习3(2) · 连续抵消', tag: 'type2', text: '19 × 700 × 26 ÷ 13 ÷ 7 ÷ 4 ÷ 25', analysis: ['26÷13=2，700÷7÷4÷25=1', '19×2=<strong>38</strong>'], answer: 38, difficulty: 3 }),
  problem({ id: 'H7', title: '练习4 · 连锁抵消', tag: 'type2', text: '3 ÷ (5 ÷ 7) ÷ (7 ÷ 11) ÷ (11 ÷ 30)', analysis: ['去括号：3÷5×7÷7×11÷11×30', '中间抵消，3×30÷5=<strong>18</strong>'], answer: 18, difficulty: 4 }),
  problem({ id: 'H8', title: '练习5(1) · 乘19', tag: 'type3', text: '25 × 19', analysis: ['19=20−1', '25×20−25=<strong>475</strong>'], answer: 475 }),
  problem({ id: 'H9', title: '练习5(2) · 拆数分配', tag: 'type3', text: '125 × 67', analysis: ['67=64+3，64=8×8', '125×64+125×3=8000+375=<strong>8375</strong>'], answer: 8375 }),
  problem({ id: 'H10', title: '练习6(1) · 乘9999', tag: 'type3', text: '135 × 9999', analysis: ['9999=10000−1', '1350000−135=<strong>1349865</strong>'], answer: 1349865, difficulty: 3 }),
  problem({ id: 'H11', title: '练习6(2) · 构造999', tag: 'type3', text: '333 × 456', analysis: ['333×3=999，456÷3=152', '999×152=(1000−1)×152=<strong>151848</strong>'], answer: 151848, difficulty: 3 }),
  problem({ id: 'H12', title: '练习7 · 综合分配律', tag: 'type3', text: '99 × 37 + 4599 + 83', analysis: ['99×37=3700−37，4599=4600−1', '3700+4600−37−1+83=8300+45=<strong>8345</strong>'], answer: 8345, difficulty: 3 }),
  problem({ id: 'H13', title: '练习8(1) · 直接提取公因数', tag: 'type4', text: '71 × 23 + 42 × 71 + 71 × 34', analysis: ['提取 71：71×(23+42+34)', '71×99=7100−71=<strong>7029</strong>'], answer: 7029, difficulty: 3 }),
  problem({ id: 'H14', title: '练习8(2) · 构造公因数', tag: 'type4', text: '34 × 28 + 36 × 68', analysis: ['68=34×2，所以 36×68=72×34', '34×(28+72)=34×100=<strong>3400</strong>'], answer: 3400, difficulty: 3 }),
  problem({ id: 'H15', title: '练习9(1) · 倍数构造公因数', tag: 'type4', text: '11 × 13 + 22 × 8 + 33 × 7', analysis: ['22=11×2，33=11×3', '11×(13+2×8+3×7)=11×50=<strong>550</strong>'], answer: 550, difficulty: 3 }),
  problem({ id: 'H16', title: '练习9(2) · 倍数构造公因数', tag: 'type4', text: '26 × 44 + 37 × 88', analysis: ['88=44×2', '44×(26+74)=44×100=<strong>4400</strong>'], answer: 4400, difficulty: 3 }),
  problem({ id: 'H17', title: '练习10 · 相近数构造', tag: 'type4', text: '41 × 74 + 42 × 26', analysis: ['42=41+1，所以 42×26=41×26+26', '41×(74+26)+26=4100+26=<strong>4126</strong>'], answer: 4126, difficulty: 4 }),
]

const PRETEST: Problem[] = [
  sourcedProblem('P1', '小测验1 · 乘法凑整', 'type1', '125 × 17 × 32 × 25', 1700000, '32=8×4，分别凑成 125×8=1000、25×4=100。'),
  sourcedProblem('P2', '小测验2 · 去括号抵消', 'type2', '111 ÷ (37 ÷ 125) × 8', 3000, '去括号后为 111÷37×125×8。'),
  sourcedProblem('P3', '小测验3 · 连续抵消', 'type2', '1 ÷ (4 ÷ 7) ÷ (7 ÷ 10) ÷ (10 ÷ 13) ÷ …… ÷ (97 ÷ 100)', 25, '连续相邻因数抵消，只剩 100÷4。'),
  sourcedProblem('P4', '小测验4 · 分配律', 'type3', '125 × (200 + 8)', 26000, '分别计算 125×200 和 125×8。'),
  sourcedProblem('P5', '小测验5 · 乘999', 'type3', '357 × 999', 356643, '把 999 写成 1000−1。'),
  sourcedProblem('P6', '小测验6 · 除以125', 'type3', '9375 ÷ 125', 75, '把被除数拆为 9000+375。'),
  sourcedProblem('P7', '小测验7 · 提取公因数', 'type4', '17 × 446 − 34 × 119 + 51 × 264', 17000, '提取 17，括号内为 446−238+792=1000。'),
]

const SOURCE_LESSON: Problem[] = [
  sourcedProblem('L38', '例题16 · 同除数合并', 'type2', '18 ÷ 4 + 45 ÷ 17 + 14 ÷ 4 + 23 ÷ 17', 12, '按相同除数合并为 (18+14)÷4+(45+23)÷17。'),
  ...[11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((n, index) =>
    sourcedProblem('L' + (39 + index), '例题17(' + (index + 1) + ') · 平方', 'type11', n + '²', n * n),
  ),
  ...[1, 2, 3, 4, 5, 6, 7].map((n, index) =>
    sourcedProblem('L' + (49 + index), '例题18(' + (index + 1) + ') · 走马灯', 'type5', '142857 × ' + n, 142857 * n, '走马灯口诀：末位乘几，结果最后就是几；其余数字按 142857 的循环顺序走马灯。'),
  ),
  sourcedProblem('L56', '例题19(1) · 缺8数', 'type6', '12345679 × 9', 111111111, '缺8数口诀：12345679 乘几，答案就写几个 111；乘9得 9 个 1。'),
  sourcedProblem('L57', '例题19(2) · 缺8数', 'type6', '12345679 × 81', 999999999, '先拆成 12345679×9×9；第一次得到 9 个1，再乘9得到 9 个9。'),
  sourcedProblem('L58', '例题19(3) · 缺8数', 'type6', '12345679 × 99', 1222222221, '先拆成 12345679×9×11；先得 111111111，再用乘11的“两边一拉，中间相加”。'),
  ...[
    ['73 × 77', 5621],
    ['84 × 86', 7224],
    ['61 × 69', 4209],
    ['52 × 58', 3016],
    ['103 × 107', 11021],
    ['101 × 109', 11009],
  ].map(([text, answer], index) =>
    sourcedProblem('L' + (59 + index), '例题20(' + (index + 1) + ') · 头同尾合十', 'type7', String(text), Number(answer), '头同尾合十口诀：前半部分=头×(头+1)，后半部分=尾×尾；后半不足两位补0。'),
  ),
  ...[25, 35, 45, 55, 65, 75, 85, 95, 205, 995].map((n, index) =>
    sourcedProblem('L' + (65 + index), '例题21(' + (index + 1) + ') · 平方', 'type11', n + ' × ' + n, n * n, '把相同的两个数相乘，按平方计算；必要时可拆成整十（整百）加减一个数。'),
  ),
  sourcedProblem('L75', '例题22(1) · 特殊数1001', 'type8', '3 × 7 × 11 × 13 × 15 × 17', 765765, '特殊数口诀：7×11×13=1001；先凑出1001，再算剩下的 3×15×17。'),
  sourcedProblem('L76', '例题22(2) · 特殊数111', 'type8', '37 × 3', 111, '特殊数口诀：3×37=111。'),
  sourcedProblem('L77', '例题22(3) · 特殊数999', 'type8', '27 × 37', 999, '把27拆成9×3，利用3×37=111，得到9×111=999。'),
  sourcedProblem('L78', '例题22(4) · 构造999', 'type8', '81 × 74 × 13', 77922, '分解后构造 999×78。'),
  sourcedProblem('L79', '例题22(5) · 构造1001', 'type8', '5 × 7 × 22 × 39 × 49', 1471470, '分解、重组后构造 1001×10。'),
  sourcedProblem('L80', '例题23(1) · 椅子数', 'type9', '56 × 101', 5656, '椅子数口诀：101=01 01，是两把椅子；56有两位，刚好每把椅子放一次56，得到5656。'),
  sourcedProblem('L81', '例题23(2) · 椅子数', 'type9', '357 × 1001001', 357357357, '把1001001看作三个001组成的椅子数；357是三位数，每把椅子对应一组357。'),
  sourcedProblem('L82', '例题23(3) · 椅子数', 'type9', '4869 × 10001', 48694869, '10001相当于两个0001组成的椅子数；4869有四位，结果重复两次4869。'),
  sourcedProblem('L83', '例题23(4) · 特殊因数', 'type3', '1234 × 10002', 12342468),
  sourcedProblem('L84', '例题24(1) · 两边一拉中间相加', 'type10', '123 × 11', 1353, '乘11口诀：两边一拉，中间相加；写两端1、3，中间写1+2=3、2+3=5。'),
  sourcedProblem('L85', '例题24(2) · 两边一拉中间相加', 'type10', '1254 × 11', 13794, '乘11口诀：两边一拉，中间相加；从右向左处理进位。'),
  sourcedProblem('L86', '例题24(3) · 两边一拉中间相加', 'type10', '456 × 11', 5016, '乘11口诀：两边一拉，中间相加；4、5、6两端保留，中间是4+5=9、5+6=11，需要进位。'),
]

const SOURCE_HOMEWORK: Problem[] = [
  sourcedProblem('H18', '练习11 · 巧算', 'type4', '54 × 67 + 46 × 69 − 92', 6700, '69=67+2，凑出 67×100。'),
  sourcedProblem('H19', '练习12 · 凑整', 'type3', '98 × 4 + 101 × 3 + 103 × 2 + 100', 1001, '把各数向 100 凑整。'),
  sourcedProblem('H20', '练习13 · 提取公因数', 'type4', '53 × 38 + 71 × 62 + 82 × 62', 11500, '先合并含 62 的两项，再凑整。'),
  sourcedProblem('H21', '练习14(1) · 提取公因数', 'type4', '29 × 36 + 11 × 65 − 40 × 11 − 11 × 29', 1000, '重组为 29×25+11×25。'),
  sourcedProblem('H22', '练习14(2) · 相近数', 'type4', '75 × 36 − 74 × 24 − 73 × 12', 48, '将 75、73 分别写成 74+1、74−1。'),
  sourcedProblem('H23', '练习15(1) · 同除数合并', 'type2', '13 ÷ 6 + 15 ÷ 7 + 35 ÷ 6 + 27 ÷ 7', 14),
  sourcedProblem('H24', '练习15(2) · 同除数合并', 'type2', '25 ÷ 13 + 54 ÷ 26', 4, '54÷26 可化为 27÷13。'),
  ...[21, 22, 23, 24, 25].map((n, index) =>
    sourcedProblem('H' + (25 + index), '练习16(' + (index + 1) + ') · 平方', 'type11', n + ' × ' + n, n * n),
  ),
  sourcedProblem('H30', '练习17(1) · 头同尾合十', 'type7', '63 × 67', 4221, '头同尾合十：前半=6×7=42，后半=3×7=21，拼成4221。'),
  sourcedProblem('H31', '练习17(2) · 头同尾合十', 'type7', '142 × 148', 21016, '头同尾合十：前半=14×15=210，后半=2×8=16，拼成21016。'),
  ...[
    ['68 × 101', 6868],
    ['74 × 201', 14874],
    ['256 × 1002', 256512],
    ['154 × 601', 92554],
  ].map(([text, answer], index) =>
    sourcedProblem('H' + (32 + index), '练习18(' + (index + 1) + ') · 特殊因数', 'type3', String(text), Number(answer), '先识别101、201、1002、601等接近整百整千的特殊因数，再用分配律拆算。'),
  ),
  ...[
    ['345 × 11', 3795],
    ['2451 × 11', 26961],
    ['268 × 11', 2948],
  ].map(([text, answer], index) =>
    sourcedProblem('H' + (36 + index), '练习19(' + (index + 1) + ') · 两边一拉中间相加', 'type10', String(text), Number(answer), '乘11口诀：两边一拉，中间相加；相加满十时从右向左进位。'),
  ),
  sourcedProblem('H39', '练习20(1) · 特殊数111', 'type8', '18 × 37', 666, '把18拆成6×3，利用3×37=111，得到6×111。'),
  sourcedProblem('H40', '练习20(2) · 特殊数999', 'type8', '54 × 74 × 8', 31968, '先把54×8变成432；再将432×74拆为32×(27×37)，利用27×37=999。'),
  sourcedProblem('H41', '练习20(3) · 特殊数1001', 'type8', '14 × 22 × 65 × 9', 180180, '分解为2×7×2×11×5×13×3×3，先凑7×11×13=1001，余下为180。'),
]

export const PROBLEM_TIP: Record<string, string> = {
  ...Object.fromEntries(
    ['L49', 'L50', 'L51', 'L52', 'L53', 'L54', 'L55'].map((id) => [
      '2-9-' + id,
      '走马灯：末位乘几，结果最后就是几；其余数字按 142857 的循环顺序依次移动。',
    ]),
  ),
  ...Object.fromEntries(
    ['L56', 'L57', 'L58'].map((id) => [
      '2-9-' + id,
      '缺8数：先把 12345679 凑出乘9的结果；再继续用乘9或乘11的规律。',
    ]),
  ),
  ...Object.fromEntries(
    ['L59', 'L60', 'L61', 'L62', 'L63', 'L64', 'H30', 'H31'].map((id) => [
      '2-9-' + id,
      '头同尾合十：前半=头×(头+1)，后半=尾×尾；后半不足两位要补0。',
    ]),
  ),
  ...Object.fromEntries(
    ['L75', 'L76', 'L77', 'L78', 'L79', 'H39', 'H40', 'H41'].map((id) => [
      '2-9-' + id,
      '特殊数：牢记 3×37=111、27×37=999、7×11×13=1001，再分解重组来凑。',
    ]),
  ),
  ...Object.fromEntries(
    ['L80', 'L81', 'L82'].map((id) => [
      '2-9-' + id,
      '椅子数：从个位向左找重复的 01、001 等；单把椅子的长度要和重复数位数相同。',
    ]),
  ),
  ...Object.fromEntries(
    ['L84', 'L85', 'L86', 'H36', 'H37', 'H38'].map((id) => [
      '2-9-' + id,
      '乘11：两边一拉，中间相加；从右向左处理进位。',
    ]),
  ),
}

export const PROBLEMS: ProblemSet = {
  pretest: PRETEST,
  lesson: [...LESSON, ...SOURCE_LESSON],
  homework: [...HOMEWORK, ...SOURCE_HOMEWORK],
  workbook: [],
  supplement: [],
}

export const PROBLEM_TYPES = [
  { tag: 'type1', group: 'foundation', icon: '🧩', label: '乘法凑整', desc: '寻找2×5、4×25、8×125等搭档', example: '125×72' },
  { tag: 'type2', group: 'foundation', icon: '🔗', label: '乘除抵消', desc: '调序、去括号，让连续因数约掉', example: '6÷(7÷11)÷…' },
  { tag: 'type3', group: 'foundation', icon: '↔️', label: '分配律拆算', desc: '把整百、整千附近的数拆开计算', example: '473×999' },
  { tag: 'type4', group: 'foundation', icon: '🎯', label: '提取公因数', desc: '直接提取，或用倍数和相近数构造', example: '26×44+37×88' },
  { tag: 'type5', group: 'pattern', icon: '🎠', label: '走马灯', desc: '142857乘1至6，数字循环移动', example: '142857×4' },
  { tag: 'type6', group: 'pattern', icon: '8️⃣', label: '缺8数', desc: '12345679先乘9，得到重复的1', example: '12345679×81' },
  { tag: 'type9', group: 'pattern', icon: '🪑', label: '椅子数', desc: '识别重复的01、001，整组复制数字', example: '357×1001001' },
  { tag: 'type10', group: 'pattern', icon: '👐', label: '乘11', desc: '两边一拉，中间相加，注意进位', example: '456×11' },
  { tag: 'type7', group: 'structure', icon: '🔟', label: '头同尾合十', desc: '前算头×(头+1)，后算尾×尾', example: '63×67' },
  { tag: 'type8', group: 'structure', icon: '💡', label: '特殊数', desc: '识记111、999、1001并分解重组', example: '7×11×13=1001' },
  { tag: 'type11', group: 'structure', icon: '◻️', label: '平方巧算', desc: '相同因数直接平方或利用平方差', example: '95×95' },
] as const

export const TAG_STYLE: Record<string, string> = {
  type1: 'bg-amber-100 text-amber-800',
  type2: 'bg-cyan-100 text-cyan-800',
  type3: 'bg-violet-100 text-violet-800',
  type4: 'bg-rose-100 text-rose-800',
  type5: 'bg-sky-100 text-sky-800',
  type6: 'bg-yellow-100 text-yellow-800',
  type7: 'bg-emerald-100 text-emerald-800',
  type8: 'bg-indigo-100 text-indigo-800',
  type9: 'bg-lime-100 text-lime-800',
  type10: 'bg-orange-100 text-orange-800',
  type11: 'bg-fuchsia-100 text-fuchsia-800',
}

export const TYPE_STYLE: Record<string, { bg: string; border: string; titleColor: string; textColor: string }> = {
  type1: { bg: 'bg-amber-50', border: 'border-amber-400', titleColor: 'text-amber-800', textColor: 'text-amber-700' },
  type2: { bg: 'bg-cyan-50', border: 'border-cyan-400', titleColor: 'text-cyan-800', textColor: 'text-cyan-700' },
  type3: { bg: 'bg-violet-50', border: 'border-violet-400', titleColor: 'text-violet-800', textColor: 'text-violet-700' },
  type4: { bg: 'bg-rose-50', border: 'border-rose-400', titleColor: 'text-rose-800', textColor: 'text-rose-700' },
  type5: { bg: 'bg-sky-50', border: 'border-sky-400', titleColor: 'text-sky-800', textColor: 'text-sky-700' },
  type6: { bg: 'bg-yellow-50', border: 'border-yellow-400', titleColor: 'text-yellow-800', textColor: 'text-yellow-700' },
  type7: { bg: 'bg-emerald-50', border: 'border-emerald-400', titleColor: 'text-emerald-800', textColor: 'text-emerald-700' },
  type8: { bg: 'bg-indigo-50', border: 'border-indigo-400', titleColor: 'text-indigo-800', textColor: 'text-indigo-700' },
  type9: { bg: 'bg-lime-50', border: 'border-lime-400', titleColor: 'text-lime-800', textColor: 'text-lime-700' },
  type10: { bg: 'bg-orange-50', border: 'border-orange-400', titleColor: 'text-orange-800', textColor: 'text-orange-700' },
  type11: { bg: 'bg-fuchsia-50', border: 'border-fuchsia-400', titleColor: 'text-fuchsia-800', textColor: 'text-fuchsia-700' },
}
