// 二年级第六讲 lesson6-data.ts 全题暴力验证脚本
// 用法: node scripts/verify-g2-lesson6.mjs（一次性验证脚本，验证后可删除）

const C = (n, k) => {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1)
  return Math.round(r)
}
const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1))

// 无序分拆：n 拆成恰好 k 个正整数（不计顺序）
const pExact = (n, k, min = 1) => {
  let cnt = 0
  const rec = (rem, parts, lo) => {
    if (parts === 0) {
      if (rem === 0) cnt++
      return
    }
    for (let x = lo; x <= rem; x++) rec(rem - x, parts - 1, x)
  }
  rec(n, k, min)
  return cnt
}

// 组数：用给定数字（每个用一次）组成 len 位数，首位不为 0
const countNumbers = (digits, len = digits.length) => {
  const perms = new Set()
  const used = new Array(digits.length).fill(false)
  const rec = (cur) => {
    if (cur.length === len) {
      if (cur[0] !== 0) perms.add(cur.join(''))
      return
    }
    for (let i = 0; i < digits.length; i++) {
      if (used[i]) continue
      used[i] = true
      cur.push(digits[i])
      rec(cur)
      cur.pop()
      used[i] = false
    }
  }
  rec([])
  return perms.size
}

// 数字和为 s 的 n 位数个数
const digitSumCount = (nDigits, s) => {
  let cnt = 0
  const rec = (pos, rem, first) => {
    if (pos === nDigits) {
      if (rem === 0) cnt++
      return
    }
    for (let d = first ? 1 : 0; d <= 9; d++) {
      if (d > rem) break
      rec(pos + 1, rem - d, false)
    }
  }
  rec(0, s, true)
  return cnt
}

// 数字和为 s 且各位互不相同的数（1~4 位）
const distinctDigitSumCount = (s) => {
  let total = 0
  for (let len = 1; len <= 4; len++) {
    const rec = (pos, rem, used, first) => {
      if (rem < 0) return 0
      if (pos === len) return rem === 0 ? 1 : 0
      let c = 0
      for (let d = first ? 1 : 0; d <= 9; d++) {
        if (used.has(d) || d > rem) continue
        used.add(d)
        c += rec(pos + 1, rem - d, used, false)
        used.delete(d)
      }
      return c
    }
    total += rec(0, s, new Set(), true)
  }
  return total
}

const checks = []
const add = (id, expected, actual, note = '') =>
  checks.push({ id, expected, actual, note, ok: expected === actual })

// ---- LESSON ----
add('2-6-L1', 3, C(4, 2) / 2, '4人分两组双打')
add('2-6-L2', 10, 2 * 3 + 1 * 4, '2行4列相邻方格：横(2行×3对)+竖(3列…实为1×4列→(2-1)×4)')
add('2-6-L3', 12, (() => {
  // 甲固定座位，其余 4 人在剩余 4 个（线性）座位上排列，乙丁不相邻
  const people = ['乙', '丙', '丁', '戊']
  let total = 0
  let bad = 0
  const rec = (arr, used) => {
    if (arr.length === 4) {
      total++
      const iB = arr.indexOf('乙')
      const iD = arr.indexOf('丁')
      if (Math.abs(iB - iD) === 1) bad++
      return
    }
    for (const p of people) {
      if (used.has(p)) continue
      used.add(p)
      rec([...arr, p], used)
      used.delete(p)
    }
  }
  rec([], new Set())
  console.log('  L3 总排列:', total, '乙丁相邻:', bad, '不相邻:', total - bad)
  return total - bad
})(), '圆桌甲固定，乙丁不相邻')
add('2-6-L4', 6, C(4, 2), '搬花顺序')
add('2-6-L5', 5, pExact(10, 2), '两数和10无序')
add('2-6-L6', 8, pExact(10, 3), '三数和10无序')
add('2-6-L7', 9, pExact(10, 4), '四数和10无序')
add('2-6-L8', 7, pExact(30, 3, 8), '30粒分3堆每堆≥8')
add('2-6-L9', 5, (() => {
  // 13 苹果 3 相同篮子，每篮 ≤6：直接枚举无序三元组
  let c = 0
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) {
    const cc = 13 - a - b
    if (cc >= b && cc <= 6) c++
  }
  return c
})(), '13苹果3相同篮每篮≤6')
add('2-6-L10', 3, (() => {
  // 1~9选7个和33 ⇔ 去掉2个和12
  let c = 0
  for (let a = 1; a <= 9; a++) for (let b = a + 1; b <= 9; b++) if (a + b === 12) c++
  return c
})(), '1~9选7个和33')
add('2-6-L11', 6, countNumbers([1, 2, 3]))
add('2-6-L12', 3, countNumbers([1, 1, 2]))
add('2-6-L13', 1, countNumbers([1, 1, 1]))
add('2-6-L14', 4, countNumbers([0, 1, 2]))
add('2-6-L15', 2, countNumbers([0, 1, 1]))
add('2-6-L16', 1, countNumbers([0, 0, 1]))
add('2-6-L17', 24, countNumbers([1, 2, 3, 4]))
add('2-6-L18', 12, countNumbers([1, 1, 2, 3]))
add('2-6-L19', 6, countNumbers([1, 1, 2, 2]))
add('2-6-L20', 4, countNumbers([1, 1, 1, 2]))
add('2-6-L21', 1, countNumbers([1, 1, 1, 1]))
add('2-6-L22', 18, countNumbers([0, 1, 2, 3]))
add('2-6-L23', 9, countNumbers([0, 1, 1, 2]))
add('2-6-L24', 3, countNumbers([0, 1, 1, 1]))
// L25-27: 不含0 且各位和8
{
  const noZero = (len) => {
    let c = 0
    const rec = (pos, rem) => {
      if (pos === len) return rem === 0 ? 1 : 0
      let s = 0
      for (let d = 1; d <= Math.min(9, rem); d++) s += rec(pos + 1, rem - d)
      return s
    }
    return rec(0, 8)
  }
  add('2-6-L25', 7, noZero(2))
  add('2-6-L26', 21, noZero(3))
  add('2-6-L27', 35, noZero(4))
}
add('2-6-L28', 6, countNumbers([0, 0, 1, 2]))
add('2-6-L29', 3, countNumbers([0, 0, 1, 1]))
add('2-6-L30', 1, countNumbers([0, 0, 0, 1]))
add('2-6-L31', 8, digitSumCount(2, 8), '两位数各位和8')
add('2-6-L32', 28, digitSumCount(3, 7), '三位数各位和7')
add('2-6-L33', 56, digitSumCount(4, 6), '四位数各位和6')
add('2-6-L34', 15, C(6, 2), '7铅笔分3人各≥1')
add('2-6-L35', 9, (() => {
  // <2000 数字和26：千位=1，b+c+d=25 各≤9（3位数最大数字和27=999，单独检查）
  let c = 0
  for (let b = 0; b <= 9; b++) for (let d2 = 0; d2 <= 9; d2++) for (let d3 = 0; d3 <= 9; d3++) if (b + d2 + d3 === 25) c++
  let c3 = 0
  for (let a = 1; a <= 9; a++) for (let b = 0; b <= 9; b++) for (let d2 = 0; d2 <= 9; d2++) if (a + b + d2 === 26) c3++
  console.log('  L35 四位数(千位1):', c, '三位数:', c3)
  return c + c3
})(), '<2000 数字和26（含3位数999情形检查）')

// ---- HOMEWORK ----
add('2-6-H1', 6, C(4, 2))
add('2-6-H2', 4, C(4, 3))
add('2-6-H3', 10, (() => {
  const nums = [1, 2, 3, 4, 5, 6]
  let c = 0
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) for (let k = j + 1; k < 6; k++)
    if ((nums[i] + nums[j] + nums[k]) % 2 === 0) c++
  return c
})(), '1-6选3个和为偶')
add('2-6-H4', 10, C(5, 3), '5点取3，中心+4顶点无三点共线')
add('2-6-H5', 5, (() => {
  let c = 0
  for (let a = 0; a <= 4; a++) for (let b = 0; b <= 4; b++) for (let cc = 0; cc <= 4; cc++)
    if (a + 2 * b + 5 * cc === 20) c++
  return c
})(), '1角2角5角各4枚凑20角')
add('2-6-H6', 2, (() => {
  let c = 0
  for (let a = 1; a <= 10; a++) for (let b = a + 1; b <= 10; b++) if (a + b === 16) c++
  return c
})(), '1-10选两个和16')
add('2-6-H7', 3, (() => {
  // 1-10选8个和40 ⇔ 去掉2个和 55-40=15
  let c = 0
  for (let a = 1; a <= 10; a++) for (let b = a + 1; b <= 10; b++) if (a + b === 15) c++
  return c
})(), '1-10选8个和40')
add('2-6-H8', 19, (() => {
  // 600 拆 3 个数，各 198~202。题目 analysis 说"有序拆法"
  let c = 0
  for (let a = 198; a <= 202; a++) for (let b = 198; b <= 202; b++) for (let cc = 198; cc <= 202; cc++)
    if (a + b + cc === 600) c++
  return c
})(), '600拆3数各198~202(有序)')
add('2-6-H9', 4, (() => {
  let c = 0
  for (let a = 4; a <= 16; a++) for (let b = a; b <= 16; b++) {
    const cc = 16 - a - b
    if (cc >= b && cc >= 4) c++
  }
  return c
})(), '16球3相同桶各≥4')
add('2-6-H10', 12, (() => {
  let c = 0
  for (const u of [1, 2, 3, 4]) for (const t of [1, 2, 3, 4]) if (u !== t)
    for (const h of [1, 2, 3, 4]) if (h !== u && h !== t && u % 2 === 0) c++
  return c
})(), '1,2,3,4组三位偶数(不重复)')
add('2-6-H11', 165, (() => {
  let sum = 0
  for (let a = 1; a <= 9; a++) for (let b = 0; b <= 9; b++) if (a * b === 12) sum += a * 10 + b
  return sum
})(), '个位×十位=12的两位数和')
add('2-6-H12', 10, C(5, 3), '6礼物分4人各≥1')
add('2-6-H13', 36, (() => {
  let c = 0
  for (let a = 3; a <= 16; a++) for (let b = 3; b <= 16; b++) {
    const cc = 16 - a - b
    if (cc >= 3) c++
  }
  return c
})(), '16糖分3人各≥3')
add('2-6-H14', 9, (() => {
  let c = 0
  for (let a = 2; a <= 10; a++) {
    const b = 12 - a
    if (b >= 2) c++
  }
  return c
})(), '两人分12金币各≥2(有序)')
add('2-6-H15', 5, (() => {
  let c = 0
  for (let a = 2; a <= 8; a++) {
    const b = 12 - a
    if (b >= 2 && b <= 8) c++
  }
  return c
})(), '两人分12各2~8(有序)')
add('2-6-H16', 31, (() => {
  let c = 0
  for (let a = 3; a <= 6; a++) for (let b = 3; b <= 6; b++) for (let cc = 3; cc <= 6; cc++) for (let d = 3; d <= 6; d++)
    if (a + b + cc + d === 20) c++
  return c
})(), '20景点4天各3~6')
add('2-6-H17', 7, (() => {
  let c = 0
  for (let a = 99; a <= 101; a++) for (let b = 99; b <= 101; b++) {
    const cc = 300 - a - b
    if (cc >= 99 && cc <= 101) c++
  }
  return c
})(), '300报纸3厂各99~101(有序)')
add('2-6-H18', 15, (() => {
  let c = 0
  for (let s = 1; s <= 3; s++) c += digitSumCount(4, s)
  return c
})(), '四位数数字和<4')

// ---- PRETEST ----
add('2-6-P1', 4, 4, '乒乓球过程：甲甲、乙乙、甲乙甲、乙甲乙')
add('2-6-P2', 5, (() => {
  let c = 0
  const perms = []
  const rec = (arr, used) => {
    if (arr.length === 4) {
      if (arr[0] < arr[1] && arr[1] > arr[2] && arr[2] < arr[3]) c++
      return
    }
    for (let d = 1; d <= 4; d++) {
      if (used.has(d)) continue
      used.add(d)
      rec([...arr, d], used)
      used.delete(d)
    }
  }
  rec([], new Set())
  return c
})(), 'abcd互异 a<b,b>c,c<d')
add('2-6-P3', 4, countNumbers([0, 1, 2]))
add('2-6-P4', 3, countNumbers([1, 2, 2]))
add('2-6-P5', 8, digitSumCount(2, 11))
add('2-6-P6', 5, pExact(8, 3))
add('2-6-P7', 11, pExact(11, 4))
add('2-6-P8', 9, countNumbers([3, 0, 8, 3]))
add('2-6-P9', 6, digitSumCount(2, 13))
add('2-6-P10', 15, C(6, 2))
add('2-6-P11', 10, digitSumCount(3, 24))
add('2-6-P12', 20, C(6, 3), '7苹果4天每天≥1')
add('2-6-P13', 35, digitSumCount(4, 5))

// ---- SUPPLEMENT ----
add('2-6-S1', 5, 5, '长+宽=10，(1,9)~(5,5)')
add('2-6-S2', 25, 25, '5×5')
add('2-6-S3', 4, countNumbers([3, 4, 4, 4]))
add('2-6-S4', 10, countNumbers([3, 3, 4, 4, 4]))
add('2-6-S5', 30, (() => {
  // <500 三位数，个位=十位+百位
  let c = 0
  for (let h = 1; h <= 4; h++) for (let t = 0; t <= 9; t++) {
    const u = h + t
    if (u <= 9) c++
  }
  return c
})(), '<500 个位=十+百')
add('2-6-S6', 38, distinctDigitSumCount(6), '各位互异数字和6')
add('2-6-S7', 7, (() => {
  // 20 拆 5 个互异正整数，无序
  let c = 0
  const rec = (rem, parts, lo) => {
    if (parts === 0) {
      if (rem === 0) c++
      return
    }
    for (let x = lo; x <= rem; x++) rec(rem - x, parts - 1, x + 1)
  }
  rec(20, 5, 1)
  return c
})(), '20拆5堆互异')
add('2-6-S8', 7, (() => {
  // 1,2,3,4 一行插入乘号（至少一个），不同乘积
  const products = new Set()
  for (let mask = 1; mask < 8; mask++) {
    // mask bit i 表示 i 与 i+1 之间是否连接（合并为一个因子）
    const nums = [1, 2, 3, 4]
    let prod = 1
    let cur = nums[0]
    for (let i = 0; i < 3; i++) {
      if (mask & (1 << i)) cur = cur * 10 + nums[i + 1]
      else {
        prod *= cur
        cur = nums[i + 1]
      }
    }
    prod *= cur
    products.add(prod)
  }
  return products.size
})(), '1234插乘号不同乘积')
add('2-6-S9', 32, (() => {
  // 足球f、篮球b，f≠b，f+b<10。f,b≥? "买了一些"通常各≥1
  let c = 0
  const pairs = []
  for (let f = 1; f <= 9; f++) for (let b = 1; b <= 9; b++)
    if (f !== b && f + b < 10) {
      c++
      pairs.push(`${f}+${b}`)
    }
  console.log('  S9 有序对(f,b):', pairs.join(' '), '→', c)
  return c
})(), '足球篮球 f≠b 且 f+b<10 (有序对)')
add('2-6-S10', 60, countNumbers([1, 1, 2, 3, 4], 5))
add('2-6-S11', 180, countNumbers([1, 1, 2, 2, 3, 4], 6))
add('2-6-S12', 880, (() => {
  // 100~999 数字和 < 24
  let c = 0
  for (let n = 100; n <= 999; n++) {
    const s = [...String(n)].reduce((a, d) => a + +d, 0)
    if (s < 24) c++
  }
  return c
})(), '三位数数字和<24')
add('2-6-S13', 5, (() => {
  let c = 0
  const rec = (arr, used) => {
    if (arr.length === 4) {
      if (arr[0] < arr[1] && arr[1] > arr[2] && arr[2] < arr[3]) c++
      return
    }
    for (let d = 1; d <= 4; d++) {
      if (used.has(d)) continue
      used.add(d)
      rec([...arr, d], used)
      used.delete(d)
    }
  }
  rec([], new Set())
  return c
})(), '1234无重复 a<b,b>c,c<d')

// ---- 输出 ----
let fail = 0
for (const { id, expected, actual, note, ok } of checks) {
  if (!ok) {
    fail++
    console.log(`❌ ${id}: 数据=${expected} 暴力验证=${actual}  ${note}`)
  } else {
    console.log(`✅ ${id}: ${expected}`)
  }
}
console.log(fail === 0 ? '\n全部通过' : `\n共 ${fail} 处不一致`)
