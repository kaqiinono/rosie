import type { Problem, ProblemSet, BlockScene, DualSceneConfig } from './type'

function numOf(s: string | object): number {
  if (typeof s !== 'string') {
    if (s && typeof s === 'object' && 'ans' in s) return (s as { ans: number }).ans
    return 1
  }
  const m = s.match(/\d+/)
  return m ? parseInt(m[0]) : 1
}

function unitOf(s: string | object): string {
  if (typeof s !== 'string') {
    if (s && typeof s === 'object' && 'unit' in s) return (s as { unit: string }).unit
    return ''
  }
  return s.replace(/\d+/g, '').trim() || '份'
}

function ensureBlockScene(prob: Problem): void {
  const rows = prob.rows || []
  const rows2 = prob.rows2 || []
  const rcols = prob.rcols || []

  if (prob.type === 'ratio3b') {
    if (prob.dualSc) return
    const safeNum = (s: string | object, fallback: number) => {
      const n = numOf(s)
      return n && n > 0 ? Math.min(n, 12) : fallback
    }
    const initA = safeNum(rows[0], 2)
    const targetA = safeNum(rows[2], 4)
    const initB = safeNum(typeof rows2[0] === 'string' ? rows2[0] : '3', 3)
    const targetBRaw = rows2[2]
    const targetB =
      typeof targetBRaw === 'object'
        ? Math.min((targetBRaw as { ans: number }).ans || 5, 12)
        : safeNum(typeof targetBRaw === 'string' ? targetBRaw : String(targetBRaw || 5), 5)
    const totalBaseRaw = typeof rcols[0] === 'string' ? numOf(rcols[0]) : 0
    const totalBase = totalBaseRaw > 0 ? totalBaseRaw : prob.finalAns || 60
    const uA = unitOf(rows[0]) || '个'
    const uB = unitOf(typeof rows2[0] === 'string' ? rows2[0] : '') || '时'
    const uC = prob.finalUnit || '个'
    prob.dualSc = {
      initA, unitA: uA, targetA,
      initB, unitB: uB, targetB: Math.min(targetB, 12),
      totalBase, unitC: uC,
      labelA: uA, labelB: uB, labelC: uC,
    }
    return
  }

  if (prob.blockScene) return
  const safeN = (s: string | object, fb: number) => {
    const n = numOf(s)
    return n && n > 0 ? n : fb
  }
  const init = safeN(rows[0], 2)
  const target = safeN(rows[2], 5)
  const unitAns = typeof rcols[1] === 'object' ? (rcols[1] as { ans: number }).ans : null
  const perPart = Math.max(1, unitAns || Math.round((prob.finalAns || 6) / (target || 5)) || 1)
  const rightUnit = prob.finalUnit || '个'
  const leftUnit = unitOf(rows[0]) || '份'
  const rawTotal = typeof rcols[0] === 'string' ? numOf(rcols[0]) : 0
  const total = rawTotal > 1 ? rawTotal : (init * perPart) || prob.finalAns || 1
  prob.blockScene = {
    init,
    unit: 1,
    target,
    perPart,
    total,
    rightUnit,
    leftUnit,
    leftLabel: `份数（初始${init}${leftUnit}）`,
    rightLabel: `结果（共${total}${rightUnit}）`,
    hint: `${init}${leftUnit}/${total}${rightUnit} → 归一 → 扩展到${target}${leftUnit}`,
  }
}

const RAW_PROBLEMS: ProblemSet = {
  pretest: [
    {
      id: 'P1', title: '测1 · 打字员', tag: 'type2', tagLabel: '直接倍比',
      text: '一个打字员30分钟打了<strong>1800个字</strong>，照这样的速度，<strong>1小时</strong>能打多少字？',
      analysis: [
        '题型：直接倍比 → 30能被60整除，可直接计算',
        '关键：1小时=60分钟，60÷30=2，存在整数倍关系',
        '步骤：1800×2=3600（60分钟是30分钟的2倍）',
        '⚠️ 当份数成整数倍关系时，不需要归一，直接×倍数即可！',
      ],
      type: 'ratio3',
      rows: ['30分钟', '60分钟'],
      rcols: ['1800字', { id: 'r2', ans: 3600 }],
      ops: [{ id: 'ob1', ans: '×2' }, { id: 'oc2', ans: '×2' }],
      hasBlocks: true,
      blockScene: {
        init: 1, perPart: 1800, unit: 1, target: 2, answer: 3600, total: 1800,
        rightUnit: '字', leftUnit: '份',
        leftLabel: '份数（每份30分钟）',
        rightLabel: '结果（每份1800字）',
        hint: '30分钟为1份，60分钟=2份 → 直接×2',
        expandUnit: '30分钟',
      },
      finalQ: '1小时能打', finalUnit: '个字', finalAns: 3600,
    },
    {
      id: 'P2', title: '测2 · 圆珠笔', tag: 'type1', tagLabel: '求中间量',
      text: '买<strong>9支</strong>相同的圆珠笔需要<strong>30元</strong>，照这样计算，买<strong>12支</strong>相同的圆珠笔需要多少元？',
      analysis: ['题型：归一 → 先求1支的价格', '步骤：30÷9≈ 不整除，先归一：30÷3=10（3支）→ 10÷3≈ 实际用：30÷9→12支', '更好的方法：30÷9×12=40元', '⚠️ 也可以找公约数3：30÷3=10（3支）→ 10×4=40（12支）'],
      type: 'ratio3',
      rows: ['9支', { id: 'rA1', ans: 3, unit: '支' }, '12支'],
      rcols: ['30元', { id: 'r1', ans: 10 }, { id: 'r2', ans: 40 }],
      ops: [{ id: 'ot1', ans: '÷3' }, { id: 'ob1', ans: '×4' }, { id: 'oc1', ans: '÷3' }, { id: 'oc2', ans: '×4' }],
      hasBlocks: false, finalQ: '买12支需要', finalUnit: '元', finalAns: 40,
    },
    {
      id: 'P3', title: '测3 · 植树（双归一）', tag: 'type3', tagLabel: '双归一',
      text: '已知<strong>5个人2小时</strong>可以种<strong>100棵</strong>树，照此计算，<strong>6个人3小时</strong>可以种多少棵树？',
      analysis: ['题型：双归一 → 先归一到1人1时', '步骤：100÷5÷2=10（1人1时）→ 10×6×3=180棵', '⚠️ 两个变量（人数+时间）都要归到1！'],
      type: 'ratio3b',
      rows: ['5人', { id: 'rA1', ans: 1, unit: '人' }, '6人'],
      rows2: ['2时', { id: 'rB1', ans: 1, unit: '时' }, '3时'],
      rcols: ['100棵', { id: 'r1', ans: 10 }, { id: 'r2', ans: 180 }],
      ops: [
        { id: 'oA1', ans: '÷5' }, { id: 'oA2', ans: '×6' },
        { id: 'oB1', ans: '÷2' }, { id: 'oB2', ans: '×3' },
        { id: 'oC1', ans: '÷10' }, { id: 'oC2', ans: '×18' },
      ],
      hasBlocks: false, finalQ: '6人3时能种', finalUnit: '棵树', finalAns: 180,
    },
    {
      id: 'P4', title: '测4 · 加工零件（双归一）', tag: 'type3', tagLabel: '双归一',
      text: '9个人6天可以加工<strong>126个</strong>零件，照这样的速度，<strong>6个人4天</strong>可以加工多少个零件？',
      analysis: ['题型：双归一', '步骤：126÷9÷6→126÷9=14（1人6天）→14÷6≈ 实际用公约数', '更好：126÷9÷6=126÷54=7/3≈ 用整体：126×6×4÷9÷6=56', '步骤：1人1天=126÷9÷6=14/6=7/3，6人4天=7/3×6×4=56', '⚠️ 先求1人1天的量，得分数也没关系，最后×会变整数'],
      type: 'ratio3b',
      rows: ['9人', { id: 'rA1', ans: 1, unit: '人' }, '6人'],
      rows2: ['6天', { id: 'rB1', ans: 1, unit: '天' }, '4天'],
      rcols: ['126个', { id: 'r1', ans: 14 }, { id: 'r2', ans: 56 }],
      ops: [
        { id: 'oA1', ans: '÷9' }, { id: 'oA2', ans: '×6' },
        { id: 'oB1', ans: '÷6' }, { id: 'oB2', ans: '×4' },
        { id: 'oC1', ans: '÷54' }, { id: 'oC2', ans: '×24' },
      ],
      hasBlocks: false, finalQ: '6人4天加工', finalUnit: '个零件', finalAns: 56,
    },
    {
      id: 'P5', title: '测5 · 路灯（变化双归一）', tag: 'type5', tagLabel: '变化双归一',
      text: '若干盏相同的路灯打开<strong>6小时</strong>要用电<strong>60千瓦</strong>，如果把其中<strong>一半的路灯关掉</strong>，那么<strong>80千瓦</strong>的电可供剩下的路灯用多少小时？',
      analysis: [
        '题型：变化双归一 → 设备减半，求新时间',
        '步骤①：归一到1灯·1时 = 60÷全部÷6',
        '步骤②：一半灯·?时 = 80 → (60÷全部÷6)×(全部÷2)×? = 80',
        '化简：60÷6÷2×? = 80 → 5×? = 80 → ?=16小时',
        '⚠️ 路灯减半，每小时用电减半，时间变长',
      ],
      type: 'ratio3b',
      rows: ['全部', '全部', '一半'],
      rows2: ['6时', { id: 'rB1', ans: 1, unit: '时' }, { id: 'rB2', ans: 16 }],
      rcols: ['60千瓦', { id: 'r1', ans: 10 }, '80千瓦'],
      ops: [
        { id: 'oA1', ans: '×1' }, { id: 'oA2', ans: '÷2' },
        { id: 'oB1', ans: '÷6' }, { id: 'oB2', ans: '×16' },
        { id: 'oC1', ans: '÷6' }, { id: 'oC2', ans: '×8' },
      ],
      dualSc: {
        initA: 2, unitA: '份路灯', targetA: 1,
        initB: 6, unitB: '时', targetB: 12,
        totalBase: 60, unitC: '千瓦',
        labelA: '路灯数量', labelB: '使用时间', labelC: '用电量',
        guiALabel: '÷2 关掉一半', guiBLabel: '÷6 归到1时',
        expALabel: '当前：一半(÷2)', expBLabel: '×? 扩展到?时',
      },
      hasBlocks: false, finalQ: '一半路灯80千瓦用', finalUnit: '小时', finalAns: 16,
    },
  ],
  lesson: [
    {
      id: 'L1', title: '例题1 · 折纸鹤', tag: 'type1', tagLabel: '基础归一',
      text: '苗苗2分钟折了<strong>6只</strong>千纸鹤，照这样计算，她<strong>1分钟</strong>折了多少只？<strong>5分钟</strong>呢？',
      analysis: ['题型：基础归一 → 先求1份，再求多份', '关键词："照这样计算"代表速度不变', '步骤：6÷2=3（1分钟）→ 3×5=15（5分钟）', '⚠️ 注意：必须先求1份，不能直接跳到5份'],
      type: 'ratio3',
      rows: ['2分钟', '1分钟', '5分钟'],
      rcols: ['6只', { id: 'r1', ans: 3 }, { id: 'r2', ans: 15 }],
      ops: [{ id: 'ot1', ans: '÷2' }, { id: 'ob1', ans: '×5' }, { id: 'oc1', ans: '÷2' }, { id: 'oc2', ans: '×5' }],
      hasBlocks: true, blockScene: { init: 2, perPart: 3, unit: 1, target: 5, answer: 15, total: 6, leftUnit: '分钟' },
      finalQ: '5分钟一共能折', finalUnit: '只纸鹤', finalAns: 15,
    },
    {
      id: 'L2', title: '例题1b · 装订书', tag: 'type1', tagLabel: '求中间量',
      text: '装订小组3小时装订书<strong>120本</strong>，照这样的速度，<strong>7小时</strong>可以装订多少本？装订<strong>200本</strong>需要几个小时？',
      analysis: ['题型：归一 → 求多份 / 求份数（双问）', '关键词："照这样的速度"速度不变', '步骤①：120÷3=40（1小时）→ 40×7=280（7小时）', '步骤②：200÷40=5（需要5小时）', '⚠️ 第二问是反向求份数，用除法！'],
      type: 'ratio3',
      rows: ['3小时', { id: 'rA1', ans: 1, unit: '小时' }, '7小时'],
      rcols: ['120本', { id: 'r1', ans: 40 }, { id: 'r2', ans: 280 }],
      ops: [{ id: 'ot1', ans: '÷3' }, { id: 'ob1', ans: '×7' }, { id: 'oc1', ans: '÷3' }, { id: 'oc2', ans: '×7' }],
      hasBlocks: false, finalQ: '装订200本书需要', finalUnit: '小时', finalAns: 5,
    },
    {
      id: 'L3', title: '例题2 · 挖土豆', tag: 'type1', tagLabel: '非整除归一',
      text: '奇奇挖土豆，9分钟挖了<strong>21个</strong>土豆，照此速度，他<strong>30分钟</strong>可以挖多少个土豆？',
      analysis: ['题型：归一 → 中间用÷3过渡到3分钟', '关键词："照此速度"速度不变', '步骤：21÷3=7（3分钟）→ 7×10=70（30分钟）', '⚠️ 9÷3=3，先归到3分钟再×10，比直接归到1分钟更简便！'],
      type: 'ratio3',
      rows: ['9分钟', { id: 'rA1', ans: 3, unit: '分钟' }, '30分钟'],
      rcols: ['21个', { id: 'r1', ans: 7 }, { id: 'r2', ans: 70 }],
      ops: [{ id: 'ot1', ans: '÷3' }, { id: 'ob1', ans: '×10' }, { id: 'oc1', ans: '÷3' }, { id: 'oc2', ans: '×10' }],
      hasBlocks: false, finalQ: '30分钟可以挖', finalUnit: '个土豆', finalAns: 70,
    },
    {
      id: 'L4', title: '例题3 · 搬大米（双归一）', tag: 'type3', tagLabel: '双归一',
      text: '2个工人3小时搬运<strong>60袋</strong>大米，按照这样的速度，<strong>1个工人1小时</strong>搬运多少袋？<strong>4个工人5小时</strong>搬运多少袋？',
      analysis: ['题型：双归一 → 两个量同时归一', '关键：60÷2÷3=10（1人1时）', '步骤：先÷人数再÷时间，得每人每时的量', '再×4×5=200（4人5时）', '⚠️ 双归一要把两个维度都归到1！'],
      type: 'ratio3b',
      rows: ['2人', '1人', '4人'],
      rows2: ['3时', '1时', '5时'],
      rcols: ['60袋', { id: 'r1', ans: 10 }, { id: 'r2', ans: 200 }],
      ops: [
        { id: 'oA1', ans: '÷2' }, { id: 'oA2', ans: '×4' },
        { id: 'oB1', ans: '÷3' }, { id: 'oB2', ans: '×5' },
        { id: 'oC1', ans: '÷6' }, { id: 'oC2', ans: '×20' },
      ],
      dualSc: {
        initA: 2, unitA: '人', targetA: 4,
        initB: 3, unitB: '时', targetB: 5,
        totalBase: 60, unitC: '袋',
        labelA: '人数', labelB: '时间', labelC: '袋数',
      },
      hasBlocks: false, finalQ: '4人5时搬运', finalUnit: '袋大米', finalAns: 200,
    },
    {
      id: 'L5', title: '例题5 · 运钢材（反向双归一）', tag: 'type4', tagLabel: '反向双归一',
      text: '5辆汽车4次可以运送<strong>100吨</strong>钢材，如果用<strong>7辆汽车</strong>运送<strong>105吨</strong>钢材，需要运几次？',
      analysis: ['题型：反向双归一 → 已知总量反推份数', '步骤①：100÷5÷4=5（1车1次运多少）', '步骤②：7辆×?次×5=105 → ?=3次', '⚠️ 先求1车1次运多少，再用目标量反推次数'],
      type: 'ratio3b',
      rows: ['5车', { id: 'rA1', ans: 1, unit: '车' }, '7车'],
      rows2: ['4次', { id: 'rB1', ans: 1, unit: '次' }, { id: 'rB2', ans: 3 }],
      rcols: ['100吨', { id: 'r1', ans: 5 }, '105吨'],
      ops: [
        { id: 'oA1', ans: '÷5' }, { id: 'oA2', ans: '×7' },
        { id: 'oB1', ans: '÷4' }, { id: 'oB2', ans: '×3' },
        { id: 'oC1', ans: '÷20' }, { id: 'oC2', ans: '×21' },
      ],
      dualSc: {
        initA: 5, unitA: '车', targetA: 7,
        initB: 4, unitB: '次', targetB: 3,
        totalBase: 100, unitC: '吨',
        labelA: '汽车数量', labelB: '运送次数', labelC: '运送量',
        isReverse: true, targetTotal: 105,
        guiALabel: '÷5 归一到1车', guiBLabel: '÷4 归一到1次',
        expALabel: '×7 扩展到7车', expBLabel: '×? 反推次数',
      },
      hasBlocks: false, finalQ: '7辆汽车需要运', finalUnit: '次', finalAns: 3,
    },
    {
      id: 'L6', title: '例题6 · 水龙头（变化双归一）', tag: 'type5', tagLabel: '变化双归一',
      text: '若干水龙头开放<strong>4小时</strong>流出<strong>32吨</strong>水，如果关闭<strong>一半</strong>水龙头，流出<strong>48吨</strong>水需要几个小时？',
      analysis: [
        '题型：变化双归一 → 设备数量和时间同时变化',
        '步骤①：先归一到「1个水龙头·1小时」= 32÷全部÷4',
        '步骤②：一半水龙头 = 全部÷2，列式：(32÷全部÷4) × (全部÷2) × ?时 = 48',
        '化简：32÷4÷2 × ? = 48 → 4×? = 48 → ?=12小时',
        '⚠️ 设备减半（A轴÷2），时间反向增大！',
      ],
      type: 'ratio3b',
      rows: ['全部', '全部', '一半'],
      rows2: ['4时', { id: 'rB1', ans: 1, unit: '时' }, { id: 'rB2', ans: 12 }],
      rcols: ['32吨', { id: 'r1', ans: 8 }, '48吨'],
      ops: [
        { id: 'oA1', ans: '×1' }, { id: 'oA2', ans: '÷2' },
        { id: 'oB1', ans: '÷4' }, { id: 'oB2', ans: '×12' },
        { id: 'oC1', ans: '÷4' }, { id: 'oC2', ans: '×?' },
      ],
      dualSc: {
        initA: 2, unitA: '份水龙头', targetA: 1,
        initB: 4, unitB: '时', targetB: 12,
        totalBase: 32, unitC: '吨',
        labelA: '水龙头数量', labelB: '开放时间', labelC: '流水量',
        guiALabel: '÷2 关闭一半', guiBLabel: '÷4 归到1时',
        expALabel: '当前：一半(÷2)', expBLabel: '×? 扩展到?时',
      },
      hasBlocks: false, finalQ: '一半水龙头需要', finalUnit: '小时', finalAns: 12,
    },
  ],
  homework: [
    {
      id: 'H1', title: '巩固1 · 种树', tag: 'type1', tagLabel: '基础归一',
      text: '一年级同学4小时种树<strong>100棵</strong>，照这样计算，<strong>1小时</strong>种多少棵？<strong>6小时</strong>呢？',
      analysis: ['题型：基础归一 两步问', '步骤：100÷4=25（1小时）→ 25×6=150（6小时）', '⚠️ 先求1小时，再求6小时'],
      type: 'ratio3',
      rows: ['4小时', '1小时', '6小时'],
      rcols: ['100棵', { id: 'r1', ans: 25 }, { id: 'r2', ans: 150 }],
      ops: [{ id: 'ot1', ans: '÷4' }, { id: 'ob1', ans: '×6' }, { id: 'oc1', ans: '÷4' }, { id: 'oc2', ans: '×6' }],
      hasBlocks: false, finalQ: '6小时能种', finalUnit: '棵树', finalAns: 150,
    },
    {
      id: 'H2', title: '巩固2 · 背单词', tag: 'type1', tagLabel: '基础归一',
      text: '纳纳6分钟可以背<strong>22个</strong>单词，照这样的速度，他<strong>15分钟</strong>可以背多少个单词？',
      analysis: ['题型：归一 → 中间过渡到3分钟', '步骤：22÷2=11（3分钟）→ 11×5=55（15分钟）', '⚠️ 6和15的公约数是3，先归到3分钟'],
      type: 'ratio3',
      rows: ['6分钟', { id: 'rA1', ans: 3, unit: '分钟' }, '15分钟'],
      rcols: ['22个', { id: 'r1', ans: 11 }, { id: 'r2', ans: 55 }],
      ops: [{ id: 'ot1', ans: '÷2' }, { id: 'ob1', ans: '×5' }, { id: 'oc1', ans: '÷2' }, { id: 'oc2', ans: '×5' }],
      hasBlocks: false, finalQ: '15分钟能背', finalUnit: '个单词', finalAns: 55,
    },
    {
      id: 'H3', title: '巩固3 · 汽车零件', tag: 'type3', tagLabel: '双归一',
      text: '汽车厂8名工人每天生产汽车零件<strong>48个</strong>，按照这样的速度，<strong>10名工人3天</strong>能生产多少个零件？',
      analysis: ['题型：双归一 → 先归到1人1天', '步骤：48÷8=6（1人1天）→ 6×10×3=180', '⚠️ 先求1人每天的量，再×人数×天数'],
      type: 'ratio3b',
      rows: ['8人', { id: 'rA1', ans: 1, unit: '人' }, '10人'],
      rows2: ['1天', '1天', '3天'],
      rcols: ['48个', { id: 'r1', ans: 6 }, { id: 'r2', ans: 180 }],
      ops: [
        { id: 'oA1', ans: '÷8' }, { id: 'oA2', ans: '×10' },
        { id: 'oB1', ans: '×1' }, { id: 'oB2', ans: '×3' },
        { id: 'oC1', ans: '÷8' }, { id: 'oC2', ans: '×30' },
      ],
      hasBlocks: false, finalQ: '10人3天生产', finalUnit: '个零件', finalAns: 180,
    },
    {
      id: 'H4', title: '巩固4 · 运沙石', tag: 'type3', tagLabel: '双归一',
      text: '20辆卡车12趟可以运走沙石<strong>16吨</strong>，那么同样的<strong>15辆卡车9趟</strong>可以运走沙石多少吨？',
      analysis: ['题型：双归一', '步骤：16÷20÷12→用公约数4简化：16÷4÷4×3×3=9吨', '⚠️ 先找公约数简化，再计算'],
      type: 'ratio3b',
      rows: ['20车', { id: 'rA1', ans: 1, unit: '车' }, '15车'],
      rows2: ['12趟', { id: 'rB1', ans: 1, unit: '趟' }, '9趟'],
      rcols: ['16吨', { id: 'r1', ans: 1 }, { id: 'r2', ans: 9 }],
      ops: [
        { id: 'oA1', ans: '÷20' }, { id: 'oA2', ans: '×15' },
        { id: 'oB1', ans: '÷12' }, { id: 'oB2', ans: '×9' },
        { id: 'oC1', ans: '÷240' }, { id: 'oC2', ans: '×135' },
      ],
      hasBlocks: false, finalQ: '15车9趟运走', finalUnit: '吨沙石', finalAns: 9,
    },
    {
      id: 'H5', title: '巩固5 · 缝纫师', tag: 'type4', tagLabel: '反向双归一',
      text: '3位缝纫师3天制作了<strong>54件</strong>衣服，照这样的速度，<strong>7位缝纫师制作84件</strong>衣服需要多少天？',
      analysis: ['题型：反向双归一 → 求天数', '步骤：54÷3÷3=6（1人1天）→ 84÷7=12（7人1天）→ 12÷6=2天', '⚠️ 先求1人1天的量，再反推天数'],
      type: 'ratio3b',
      rows: ['3人', { id: 'rA1', ans: 1, unit: '人' }, '7人'],
      rows2: ['3天', { id: 'rB1', ans: 1, unit: '天' }, { id: 'rB2', ans: 2, unit: '天' }],
      rcols: ['54件', { id: 'r1', ans: 6 }, '84件'],
      ops: [
        { id: 'oA1', ans: '÷3' }, { id: 'oA2', ans: '×7' },
        { id: 'oB1', ans: '÷3' }, { id: 'oB2', ans: '×2' },
        { id: 'oC1', ans: '÷9' }, { id: 'oC2', ans: '×14' },
      ],
      hasBlocks: false, finalQ: '7位缝纫师需要', finalUnit: '天', finalAns: 2,
    },
    {
      id: 'H6', title: '巩固6 · 电灯（变化双归一）', tag: 'type5', tagLabel: '变化双归一',
      text: '若干盏一样的电灯5小时要用<strong>40度</strong>电，如果把其中<strong>一半的电灯关掉</strong>，那么<strong>120度</strong>电可以用多少个小时？',
      analysis: [
        '题型：变化双归一 → 设备减半，求新时间',
        '步骤①：归一到1灯·1时 = 40÷全部÷5',
        '步骤②：一半灯·?时 = 120 → (40÷全部÷5)×(全部÷2)×? = 120',
        '化简：40÷5÷2×? = 120 → 4×? = 120 → ?=30小时',
        '⚠️ 灯减半，每小时用电减半，所以时间是原来的2×3=6倍！',
      ],
      type: 'ratio3b',
      rows: ['全部', '全部', '一半'],
      rows2: ['5时', { id: 'rB1', ans: 1, unit: '时' }, { id: 'rB2', ans: 30 }],
      rcols: ['40度', { id: 'r1', ans: 8 }, '120度'],
      ops: [
        { id: 'oA1', ans: '×1' }, { id: 'oA2', ans: '÷2' },
        { id: 'oB1', ans: '÷5' }, { id: 'oB2', ans: '×30' },
        { id: 'oC1', ans: '÷5' }, { id: 'oC2', ans: '×?' },
      ],
      dualSc: {
        initA: 2, unitA: '份电灯', targetA: 1,
        initB: 5, unitB: '时', targetB: 12,
        totalBase: 40, unitC: '度',
        labelA: '电灯数量', labelB: '使用时间', labelC: '用电量',
        guiALabel: '÷2 关掉一半', guiBLabel: '÷5 归到1时',
        expALabel: '当前：一半(÷2)', expBLabel: '×? 扩展到?时',
      },
      hasBlocks: false, finalQ: '一半电灯120度能用', finalUnit: '小时', finalAns: 30,
    },
  ],
  workbook: [
    {
      id: 'W1', title: '闯关1 · 磨面粉', tag: 'type1', tagLabel: '基础归一+加法',
      text: '磨面工人3小时磨了<strong>75千克</strong>面粉，照这样的速度，他再磨<strong>4小时</strong>，共磨面粉多少千克？',
      analysis: ['题型：归一 + 加法综合', '步骤：75÷3=25（1小时）→ 25×4=100（再磨4小时）→ 100+75=175千克', '⚠️ "共磨"要把之前的75也加上！'],
      type: 'ratio3',
      rows: ['3小时', { id: 'rA1', ans: 1, unit: '小时' }, '4小时'],
      rcols: ['75千克', { id: 'r1', ans: 25 }, { id: 'r2', ans: 100 }],
      ops: [{ id: 'ot1', ans: '÷3' }, { id: 'ob1', ans: '×4' }, { id: 'oc1', ans: '÷3' }, { id: 'oc2', ans: '×4' }],
      hasBlocks: false, finalQ: '共磨面粉', finalUnit: '千克', finalAns: 175,
    },
    {
      id: 'W2', title: '闯关2 · 做练习题', tag: 'type1', tagLabel: '直接倍比',
      text: '立立做练习题，5分钟做了<strong>13道</strong>题，照这样的速度计算，他<strong>20分钟</strong>可以做多少道题？',
      analysis: ['题型：直接倍比（初始量与目标量呈倍数关系）', '步骤：20÷5=4，所以×4', '13×4=52道题', '⚠️ 不需要归一，直接找倍数关系'],
      type: 'ratio3',
      rows: ['5分钟', '20分钟'],
      rcols: ['13道', { id: 'r2', ans: 52 }],
      ops: [{ id: 'ob1', ans: '×4' }, { id: 'oc2', ans: '×4' }],
      hasBlocks: false, finalQ: '20分钟能做', finalUnit: '道题', finalAns: 52,
    },
    {
      id: 'W3', title: '闯关3 · 蜂箱', tag: 'type2', tagLabel: '直接倍比+增加',
      text: '4箱蜜蜂可以酿蜂蜜<strong>60千克</strong>，照这样计算，如果要酿<strong>300千克</strong>蜂蜜，需要<strong>增加</strong>多少箱同样的蜜蜂？',
      analysis: ['题型：直接倍比 + 求增加量', '步骤：300÷60=5，所以×5', '4×5=20（箱）→ 20-4=16（增加）', '⚠️ "增加多少"要用总数减原有数！'],
      type: 'ratio3',
      rows: ['4箱', { id: 'rA1', ans: 20, unit: '箱' }],
      rcols: ['60千克', '300千克'],
      ops: [{ id: 'ob1', ans: '×5' }, { id: 'oc2', ans: '×5' }],
      hasBlocks: false, finalQ: '需要增加', finalUnit: '箱蜜蜂', finalAns: 16,
    },
    {
      id: 'W4', title: '闯关4 · 加工零件', tag: 'type3', tagLabel: '双归一+反向',
      text: '3名工人5小时加工零件<strong>90个</strong>，照这样计算，<strong>10名工人10小时</strong>可以加工零件多少个？如果10小时要加工<strong>360个</strong>零件，需要工人多少名？',
      analysis: ['题型：双归一 + 反向求人数', '步骤①：90÷3÷5=6（1人1时）→ 6×10×10=600个', '步骤②：360÷10÷6=6名工人', '⚠️ 第二问反向除，先÷时间再÷每人每时'],
      type: 'ratio3b',
      rows: ['3人', { id: 'rA1', ans: 1, unit: '人' }, '10人', { id: 'rA3', ans: 6, unit: '人' }],
      rows2: ['5时', { id: 'rB1', ans: 1, unit: '时' }, '10时', '10时'],
      rcols: ['90个', { id: 'r1', ans: 6 }, { id: 'r2', ans: 600 }, '360个'],
      ops: [
        { id: 'oA1', ans: '÷3' }, { id: 'oA2', ans: '×10' },
        { id: 'oB1', ans: '÷5' }, { id: 'oB2', ans: '×10' },
        { id: 'oC1', ans: '÷15' }, { id: 'oC2', ans: '×100' },
      ],
      hasBlocks: false, finalQ: '10人10时加工', finalUnit: '个零件', finalAns: 600,
    },
    {
      id: 'W5', title: '闯关5 · 摘桃子', tag: 'type4', tagLabel: '归一+增加人数',
      text: '美猴王组织小猴摘桃子。16只小猴每小时摘<strong>64个</strong>桃子，照这样计算，想要每小时摘桃子<strong>96个</strong>，需要<strong>增加</strong>多少只小猴？',
      analysis: ['题型：归一 + 求增加量', '步骤：64÷16=4（每只猴每时）→ 96÷4=24（需要猴）→ 24-16=8（增加）', '⚠️ "增加多少"= 总需 - 已有'],
      type: 'ratio3',
      rows: ['16只猴', { id: 'rA1', ans: 1, unit: '只猴' }, { id: 'rA2', ans: 24, unit: '只猴' }],
      rcols: ['64个/时', { id: 'r1', ans: 4 }, '96个/时'],
      ops: [{ id: 'ot1', ans: '÷16' }, { id: 'ob1', ans: '×24' }, { id: 'oc1', ans: '÷16' }, { id: 'oc2', ans: '×24' }],
      hasBlocks: false, finalQ: '需要增加', finalUnit: '只小猴', finalAns: 8,
    },
    {
      id: 'W6', title: '闯关6 · 奶牛产奶', tag: 'type3', tagLabel: '双归一',
      text: '罗奶奶养了6头奶牛，<strong>两周（14天）</strong>可以产奶<strong>720千克</strong>，照这样计算，同样的<strong>9头奶牛21天</strong>可以产多少千克牛奶？',
      analysis: ['题型：双归一', '步骤：720÷6÷14=... 先÷6÷14再×9×21', '720÷6÷14×9×21=1620', '⚠️ 找最大公约数化简计算'],
      type: 'ratio3b',
      rows: ['6头', { id: 'rA1', ans: 1, unit: '头' }, '9头'],
      rows2: ['14天', { id: 'rB1', ans: 1, unit: '天' }, '21天'],
      rcols: ['720千克', { id: 'r1', ans: 120 }, { id: 'r2', ans: 1620 }],
      ops: [
        { id: 'oA1', ans: '÷6' }, { id: 'oA2', ans: '×9' },
        { id: 'oB1', ans: '÷14' }, { id: 'oB2', ans: '×21' },
        { id: 'oC1', ans: '÷84' }, { id: 'oC2', ans: '×189' },
      ],
      hasBlocks: false, finalQ: '9头牛21天产奶', finalUnit: '千克', finalAns: 1620,
    },
    {
      id: 'W7', title: '闯关7 · 修路', tag: 'type3', tagLabel: '反向双归一',
      text: '8个人10天修路<strong>800米</strong>，照这样计算，<strong>20人修6000米</strong>，需要多少天？',
      analysis: ['题型：反向双归一 → 求天数', '步骤：800÷8÷10=10（1人1天）→ 6000÷20=300（20人1天）→ 300÷10=30天', '⚠️ 先求1人1天，再算20人1天，最后反推天数'],
      type: 'ratio3b',
      rows: ['8人', { id: 'rA1', ans: 1, unit: '人' }, '20人'],
      rows2: ['10天', { id: 'rB1', ans: 1, unit: '天' }, { id: 'rB2', ans: 30, unit: '天' }],
      rcols: ['800米', { id: 'r1', ans: 10 }, '6000米'],
      ops: [
        { id: 'oA1', ans: '÷8' }, { id: 'oA2', ans: '×20' },
        { id: 'oB1', ans: '÷10' }, { id: 'oB2', ans: '×30' },
        { id: 'oC1', ans: '÷80' }, { id: 'oC2', ans: '×600' },
      ],
      hasBlocks: false, finalQ: '20人修6000米需要', finalUnit: '天', finalAns: 30,
    },
    {
      id: 'W8', title: '闯关8 · 增加零件', tag: 'type5', tagLabel: '双归一+增加量',
      text: '某工厂原计划20人4天做<strong>1600个</strong>零件，刚要开始生产，又增加了新任务，在工作效率相同的情况下，需要<strong>15人7天</strong>才能全部完成，请问增加了多少个零件？',
      analysis: ['题型：双归一 + 求增加量', '步骤：1600÷20÷4=20（1人1天）→ 20×15×7=2100（新总量）→ 2100-1600=500', '⚠️ "增加了多少"= 新总量 - 原总量'],
      type: 'ratio3b',
      rows: ['20人', { id: 'rA1', ans: 1, unit: '人' }, '15人'],
      rows2: ['4天', { id: 'rB1', ans: 1, unit: '天' }, '7天'],
      rcols: ['1600个', { id: 'r1', ans: 20 }, { id: 'r2', ans: 2100 }],
      ops: [
        { id: 'oA1', ans: '÷20' }, { id: 'oA2', ans: '×15' },
        { id: 'oB1', ans: '÷4' }, { id: 'oB2', ans: '×7' },
        { id: 'oC1', ans: '÷80' }, { id: 'oC2', ans: '×105' },
      ],
      hasBlocks: false, finalQ: '增加了', finalUnit: '个零件', finalAns: 500,
    },
    {
      id: 'W9', title: '闯关9 · 大卡车运沙', tag: 'type4', tagLabel: '反向双归一',
      text: '4辆大卡车7趟共运走沙土<strong>96吨</strong>，现有沙土<strong>480吨</strong>，增加了1辆相同的卡车，多少趟可以运完？',
      analysis: ['题型：反向双归一', '步骤：96÷4÷7=... 先简化，1车1趟=96÷28', '5车×趟=(480÷(96÷28))→ 趟=480×28÷96÷5=28趟', '⚠️ 增加了1辆=5辆，用新辆数反推趟数'],
      type: 'ratio3b',
      rows: ['4车', { id: 'rA1', ans: 1, unit: '车' }, '5车'],
      rows2: ['7趟', { id: 'rB1', ans: 1, unit: '趟' }, { id: 'rB2', ans: 28, unit: '趟' }],
      rcols: ['96吨', { id: 'r1', ans: 24 }, '480吨'],
      ops: [
        { id: 'oA1', ans: '÷4' }, { id: 'oA2', ans: '×5' },
        { id: 'oB1', ans: '÷7' }, { id: 'oB2', ans: '×28' },
        { id: 'oC1', ans: '÷28' }, { id: 'oC2', ans: '×140' },
      ],
      hasBlocks: false, finalQ: '5辆车需要', finalUnit: '趟', finalAns: 28,
    },
    {
      id: 'W10', title: '闯关10 · 制作零件（变化双归一）', tag: 'type5', tagLabel: '变化双归一',
      text: '8个工人3小时制作机器零件<strong>360个</strong>，如果人数变成原来的一半，时间增加了5小时，现在可制作机器零件多少个？',
      analysis: [
        '题型：变化双归一 → 人数减半，时间增加',
        '步骤①：归一到1人1时 = 360÷8÷3 = 15个',
        '步骤②：人数减半=4人，时间3+5=8时（注意是增加了5小时！）',
        '结果：15×4×8 = 480个',
        '⚠️ "增加了5小时"= 原3时+5=8时，不是×5！',
      ],
      type: 'ratio3b',
      rows: ['8人', { id: 'rA1', ans: 1, unit: '人' }, { id: 'rA2', ans: 4, unit: '人' }],
      rows2: ['3时', { id: 'rB1', ans: 1, unit: '时' }, { id: 'rB2', ans: 8, unit: '时' }],
      rcols: ['360个', { id: 'r1', ans: 15 }, { id: 'r2', ans: 480 }],
      ops: [
        { id: 'oA1', ans: '÷8' }, { id: 'oA2', ans: '×4' },
        { id: 'oB1', ans: '÷3' }, { id: 'oB2', ans: '×8' },
        { id: 'oC1', ans: '÷24' }, { id: 'oC2', ans: '×32' },
      ],
      dualSc: {
        initA: 8, unitA: '人', targetA: 4,
        initB: 3, unitB: '时', targetB: 8,
        totalBase: 360, unitC: '个',
        labelA: '工人数量', labelB: '工作时间', labelC: '零件数量',
      },
      hasBlocks: false, finalQ: '4人8时制作', finalUnit: '个零件', finalAns: 480,
    },
    {
      id: 'W11', title: '闯关11 · 加工零件（变化双归一）', tag: 'type5', tagLabel: '变化双归一',
      text: '4个工人6小时制作机器零件<strong>240个</strong>，如果人数增加了1倍，时间增加了5小时，现在可制作机器零件多少个？',
      analysis: [
        '题型：变化双归一 → 人数增倍，时间增加',
        '步骤①：归一到1人1时 = 240÷4÷6 = 10个',
        '步骤②：人数增1倍=8人（原×2），时间6+5=11时',
        '结果：10×8×11 = 880个',
        '⚠️ "增加了1倍"= 原×2=8人；"增加了5小时"= 原+5=11时',
      ],
      type: 'ratio3b',
      rows: ['4人', { id: 'rA1', ans: 1, unit: '人' }, { id: 'rA2', ans: 8, unit: '人' }],
      rows2: ['6时', { id: 'rB1', ans: 1, unit: '时' }, { id: 'rB2', ans: 11, unit: '时' }],
      rcols: ['240个', { id: 'r1', ans: 10 }, { id: 'r2', ans: 880 }],
      ops: [
        { id: 'oA1', ans: '÷4' }, { id: 'oA2', ans: '×8' },
        { id: 'oB1', ans: '÷6' }, { id: 'oB2', ans: '×11' },
        { id: 'oC1', ans: '÷24' }, { id: 'oC2', ans: '×88' },
      ],
      dualSc: {
        initA: 4, unitA: '人', targetA: 8,
        initB: 6, unitB: '时', targetB: 11,
        totalBase: 240, unitC: '个',
        labelA: '工人数量', labelB: '工作时间', labelC: '零件数量',
      },
      hasBlocks: false, finalQ: '8人11时制作', finalUnit: '个零件', finalAns: 880,
    },
    {
      id: 'W12', title: '闯关12 · 粉笔（最难）', tag: 'type5', tagLabel: '综合变化',
      text: '学校买来一批粉笔，原计划<strong>18个班</strong>可用<strong>30天</strong>，实际用了<strong>20天</strong>后，有<strong>8个班</strong>外出了，剩下的粉笔够用多少天？',
      analysis: ['题型：综合归一 → 已用+剩余分段计算', '步骤①：总份=18×30=540份；20天用了18×20=360份；剩余=180份', '步骤②：剩余班数=18-8=10班；180÷10=18天', '⚠️ 分三步：求总→求已用→求剩余时间'],
      type: 'ratio3b',
      rows: ['18班', { id: 'rA1', ans: 1, unit: '班' }, { id: 'rA2', ans: 10, unit: '班' }],
      rows2: ['30天', { id: 'rB1', ans: 1, unit: '天' }, { id: 'rB2', ans: 18, unit: '天' }],
      rcols: ['全部粉笔', { id: 'r1', ans: 1 }, { id: 'r2', ans: 180 }],
      ops: [
        { id: 'oA1', ans: '÷18' }, { id: 'oA2', ans: '×10' },
        { id: 'oB1', ans: '÷30' }, { id: 'oB2', ans: '×18' },
        { id: 'oC1', ans: '÷总' }, { id: 'oC2', ans: '×180' },
      ],
      hasBlocks: false, finalQ: '剩下粉笔够用', finalUnit: '天', finalAns: 18,
    },
  ],
}

Object.values(RAW_PROBLEMS).forEach(list => list.forEach(ensureBlockScene))

export const PROBLEMS: ProblemSet = RAW_PROBLEMS

export const PROBLEM_TYPES = [
  {
    tag: 'type1', color: 'blue', label: '题型1 · 直接归一',
    desc: '明确要求先求1份，÷份数→×目标份数。',
    example: '例：2分钟6只→1分钟→5分钟',
  },
  {
    tag: 'type2', color: 'green', label: '题型2 · 直接倍比（不需归一）',
    desc: '存在直接倍数关系，两边同倍×或÷，左右倍数必须一致！',
    example: '例：5分13道→20分几道（×4）',
  },
  {
    tag: 'type3', color: 'orange', label: '题型3 · 双归一（找中间桥梁）',
    desc: '两个变量（人数×时间），分别归到"1人1时"。',
    example: '例：2人3时60袋→1人1时→4人5时',
  },
  {
    tag: 'type4', color: 'purple', label: '题型4 · 反向归一（已知总量求份数）',
    desc: '已知目标总量，先归一求每份量，再用总量÷每份量反推份数。',
    example: '例：7车×?次×5吨=105吨 → ?=3次',
  },
  {
    tag: 'type5', color: 'red', label: '题型5 · 变化归一（关一半）',
    desc: '设备减半→效率减半→时间变长。先求全部效率再÷2。',
    example: '例：全部4时32吨→一半1时4吨→48÷4=12时',
  },
]

export const TYPE_STYLE: Record<string, { bg: string; border: string; titleColor: string; textColor: string }> = {
  type1: { bg: 'bg-blue-50', border: 'border-l-blue-500', titleColor: 'text-blue-800', textColor: 'text-blue-900' },
  type2: { bg: 'bg-green-50', border: 'border-l-green-500', titleColor: 'text-green-800', textColor: 'text-green-900' },
  type3: { bg: 'bg-orange-50', border: 'border-l-orange-500', titleColor: 'text-orange-700', textColor: 'text-orange-800' },
  type4: { bg: 'bg-purple-50', border: 'border-l-purple-500', titleColor: 'text-purple-800', textColor: 'text-purple-900' },
  type5: { bg: 'bg-red-50', border: 'border-l-red-500', titleColor: 'text-red-700', textColor: 'text-red-800' },
}

export const TAG_STYLE: Record<string, string> = {
  type1: 'bg-app-blue-light text-app-blue-dark',
  type2: 'bg-app-green-light text-app-green-dark',
  type3: 'bg-app-purple-light text-app-purple-dark',
  type4: 'bg-app-orange-light text-app-orange',
  type5: 'bg-app-red-light text-app-red',
}
