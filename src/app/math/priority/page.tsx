'use client'

import React, { useState } from 'react'

type TabKey = 'overview' | 'priority' | 'plan'

const Badge = ({ type, children }: { type: 'p1' | 'p2' | 'p3'; children: React.ReactNode }) => {
  const styles = {
    p1: 'bg-[#FCEBEB] text-[#A32D2D]',
    p2: 'bg-[#FAEEDA] text-[#854F0B]',
    p3: 'bg-[#E6F1FB] text-[#185FA5]',
  }
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${styles[type]}`}>
      {children}
    </span>
  )
}

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className="mr-1 mb-1 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
    {children}
  </span>
)

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2.5 rounded-xl border border-gray-200 bg-white px-4 py-3.5 dark:border-gray-700 dark:bg-gray-900">
    {children}
  </div>
)

const TopicTitle = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-1 text-[15px] font-medium text-gray-900 dark:text-gray-100">{children}</p>
)

const TopicDesc = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 text-[13px] text-gray-500 dark:text-gray-400">{children}</p>
)

const SectionTitle = ({
  badge,
  badgeType,
  subtitle,
}: {
  badge: string
  badgeType: 'p1' | 'p2' | 'p3'
  subtitle: string
}) => (
  <div className="mt-5 mb-2.5 flex items-center gap-2 text-[16px] font-medium text-gray-900 dark:text-gray-100">
    <Badge type={badgeType}>{badge}</Badge>
    <span>{subtitle}</span>
  </div>
)

const Tip = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-3 rounded-r-lg border-l-[3px] border-gray-300 bg-gray-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
    {children}
  </div>
)

function OverviewPanel() {
  return (
    <div>
      <SectionTitle badge="P1 必考核心" badgeType="p1" subtitle="高频出题，必须掌握" />

      <Card>
        <TopicTitle>🔢 巧算专题（第1、12、34讲）</TopicTitle>
        <TopicDesc>
          加减乘除的简便运算，贯穿全年。凑整法、带符号搬家、基准数法、乘法分配律等。
        </TopicDesc>
        <Tag>基本运算</Tag>
        <Tag>凑整法</Tag>
        <Tag>拆数法</Tag>
        <Tag>分配律</Tag>
      </Card>

      <Card>
        <TopicTitle>📏 和差倍问题（第15、18、29讲）</TopicTitle>
        <TopicDesc>
          目标班独有专题，分初步和进阶。线段图解题，公式：（和＋差）÷2＝大数；和倍、差倍模型。
        </TopicDesc>
        <Tag>线段图</Tag>
        <Tag>和差公式</Tag>
        <Tag>和倍差倍</Tag>
        <Tag>三量变式</Tag>
      </Card>

      <Card>
        <TopicTitle>🐔 鸡兔同笼 / 盈亏问题（第37、40讲）</TopicTitle>
        <TopicDesc>经典应用题模型，目标班独有。假设法三步走；盈盈/盈亏/亏亏三类公式。</TopicDesc>
        <Tag>假设法</Tag>
        <Tag>盈亏公式</Tag>
        <Tag>模型迁移</Tag>
      </Card>

      <Card>
        <TopicTitle>🔄 周期问题（第30、36讲）</TopicTitle>
        <TopicDesc>利用余数求"第X个是什么"、日期星期推算。连接数列规律与实际应用。</TopicDesc>
        <Tag>余数原理</Tag>
        <Tag>日期推算</Tag>
        <Tag>周期识别</Tag>
      </Card>

      <Card>
        <TopicTitle>🌿 间隔/植树问题（第13、41讲）</TopicTitle>
        <TopicDesc>
          三种基本模型（两端栽、只栽一端、两端不栽），延伸到锯木头、敲钟、爬楼梯。
        </TopicDesc>
        <Tag>两端模型</Tag>
        <Tag>封闭路线</Tag>
        <Tag>变式拓展</Tag>
      </Card>

      <SectionTitle badge="P2 重要专题" badgeType="p2" subtitle="高考察度，需要重点理解" />

      <Card>
        <TopicTitle>🧩 逻辑推理（第23讲）</TopicTitle>
        <TopicDesc>假设法、列表法、排除法。解决真假话、人物关系推理。</TopicDesc>
        <Tag>列表排除</Tag>
        <Tag>假设推理</Tag>
      </Card>

      <Card>
        <TopicTitle>🔁 逆推/还原问题（第31讲）</TopicTitle>
        <TopicDesc>从结果倒推，运算次序颠倒，符号相反。多步混合逆推。</TopicDesc>
        <Tag>倒推逻辑</Tag>
        <Tag>符号反转</Tag>
      </Card>

      <Card>
        <TopicTitle>📐 图形计数（第2、17讲）</TopicTitle>
        <TopicDesc>标号法、分类法、分割法数图形。不重不漏是关键。</TopicDesc>
        <Tag>标号法</Tag>
        <Tag>分类分割</Tag>
      </Card>

      <Card>
        <TopicTitle>♾ 等差数列（第43讲）</TopicTitle>
        <TopicDesc>高斯公式：（首项＋末项）×项数÷2。求某项、求项数。</TopicDesc>
        <Tag>高斯公式</Tag>
        <Tag>公差首末项</Tag>
      </Card>

      <Card>
        <TopicTitle>📦 抽屉原理（第46讲）</TopicTitle>
        <TopicDesc>"最不利情况＋1"模型，解决"至少保证"类问题。</TopicDesc>
        <Tag>最不利原则</Tag>
        <Tag>保证类问题</Tag>
      </Card>

      <SectionTitle badge="P3 基础理解" badgeType="p3" subtitle="相对容易，理解思路即可" />

      <Card>
        <TopicTitle>🧊 空间/几何类（第6、8、19、39讲）</TopicTitle>
        <TopicDesc>正方体展开图与相对面；多角度观察；图形剪拼；周长公式与平移法。</TopicDesc>
        <Tag>展开图</Tag>
        <Tag>三视图</Tag>
        <Tag>平移法</Tag>
      </Card>

      <Card>
        <TopicTitle>🎲 奇偶性 / 排队 / 重叠（第32、3、21讲）</TopicTitle>
        <TopicDesc>奇偶运算规律判断可能性；排队画图法；容斥原理公式A＋B－重叠＝总数。</TopicDesc>
        <Tag>奇偶判断</Tag>
        <Tag>韦恩图</Tag>
      </Card>

      <Card>
        <TopicTitle>⏱ 时间 / 归一 / 最优化（第20、35、44讲）</TopicTitle>
        <TopicDesc>时间推算；正反归一步骤；并行事件统筹安排。</TopicDesc>
        <Tag>时间计算</Tag>
        <Tag>单一量</Tag>
        <Tag>并行优化</Tag>
      </Card>
    </div>
  )
}

const priorityItems = [
  {
    num: '①',
    title: '和差倍问题',
    badge: 'p1' as const,
    badgeLabel: 'P1 必考',
    desc: '跨3讲（15、18、29），目标班独有，题型变化丰富。线段图必须画熟，公式必须背透。这是全年最系统、最重要的应用题专题。',
  },
  {
    num: '②',
    title: '鸡兔同笼 & 盈亏问题',
    badge: 'p1' as const,
    badgeLabel: 'P1 必考',
    desc: '经典模型，目标班独有。假设法和盈亏公式是固定套路，一旦掌握得分稳定。',
  },
  {
    num: '③',
    title: '巧算专题（加减乘除）',
    badge: 'p1' as const,
    badgeLabel: 'P1 必考',
    desc: '贯穿全年3讲，计算题必考，方法多样但规律清晰。短时间内收益最高的模块。',
  },
  {
    num: '④',
    title: '周期问题（含日期推算）',
    badge: 'p1' as const,
    badgeLabel: 'P1 必考',
    desc: `余数思想贯穿两讲，日期推算是常考场景，掌握"除以周期取余数"即可应对大部分题型。`,
  },
  {
    num: '⑤',
    title: '植树/间隔问题',
    badge: 'p1' as const,
    badgeLabel: 'P1 必考',
    desc: '两讲，模型固定，变式多（锯木头、敲钟、爬楼）。把三种基本模型背熟，变式都能转化。',
  },
  {
    num: '⑥',
    title: '逻辑推理',
    badge: 'p2' as const,
    badgeLabel: 'P2 重要',
    desc: '假设法+列表法，思路清晰但需要练习。题目灵活，考察分析能力。',
  },
  {
    num: '⑦',
    title: '逆推/还原问题',
    badge: 'p2' as const,
    badgeLabel: 'P2 重要',
    desc: '思路固定（顺序反转，符号反转），多练几道就能掌握规律。',
  },
  {
    num: '⑧',
    title: '等差数列',
    badge: 'p2' as const,
    badgeLabel: 'P2 重要',
    desc: '目标班独有，高斯公式是核心，理解推导过程后应用题不难。',
  },
  {
    num: '⑨',
    title: '抽屉原理',
    badge: 'p2' as const,
    badgeLabel: 'P2 重要',
    desc: `模型简单但考法灵活，"最不利+1"是万能钥匙，理解原理后快速上手。`,
  },
  {
    num: '⑩',
    title: '图形计数 / 空间几何 / 其他',
    badge: 'p3' as const,
    badgeLabel: 'P3 基础',
    desc: '这些板块相对直观，有时间就看，没时间保证前9个优先。',
  },
]

function PriorityPanel() {
  return (
    <div>
      <Tip>📌 根据"目标班独有"程度、应用题模型密度、覆盖讲次数，综合排定优先级。</Tip>
      <div className="mt-3.5">
        {priorityItems.map((item) => (
          <div
            key={item.num}
            className="flex items-start gap-2.5 border-b border-gray-100 py-2.5 last:border-0 dark:border-gray-800"
          >
            <div className="min-w-[28px] text-xl font-medium text-gray-400">{item.num}</div>
            <div>
              <p className="mb-1 flex flex-wrap items-center gap-2 text-[15px] font-medium text-gray-900 dark:text-gray-100">
                {item.title} <Badge type={item.badge}>{item.badgeLabel}</Badge>
              </p>
              <p className="text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const planItems = [
  {
    day: 'Day 1',
    title: '和差倍问题',
    lectures: '第15、18、29讲',
    content: '上午：画线段图，背公式（和差、和倍、差倍）；下午：做变式题（三个量、几倍多几）',
  },
  {
    day: 'Day 2',
    title: '鸡兔同笼 + 盈亏问题',
    lectures: '第37、40讲',
    content: '上午：练习假设法步骤；下午：盈盈/盈亏/亏亏三类各做5道',
  },
  {
    day: 'Day 3',
    title: '巧算专题',
    lectures: '第1、12、34讲',
    content: '上午：加减法（凑整、基准数）；下午：乘除法（25×4、分配律）',
  },
  {
    day: 'Day 4',
    title: '周期问题 + 植树间隔',
    lectures: '第30、36、13、41讲',
    content: '上午：周期余数、日期推算；下午：植树三模型+锯木头变式',
  },
  {
    day: 'Day 5',
    title: '逻辑推理 + 逆推还原',
    lectures: '第23、31讲',
    content: '上午：列表法推理练习；下午：多步逆推题目',
  },
  {
    day: 'Day 6',
    title: '等差数列 + 抽屉原理',
    lectures: '第43、46讲',
    content: '上午：高斯公式应用；下午：最不利原则应用题',
  },
  {
    day: 'Day 7',
    title: '综合冲刺 + 查漏补缺',
    lectures: '第10、25、33、48讲',
    content: '参考期末测试讲次的题型；重点攻克错题本',
  },
]

function PlanPanel() {
  return (
    <div>
      <Tip>
        ⏰ 以下为短期冲刺复习建议，适用于考前 <strong>5～7天</strong> 的快速复习。
      </Tip>
      <div className="mt-3.5 space-y-3">
        {planItems.map((item) => (
          <div key={item.day} className="grid grid-cols-[64px_1fr] items-start gap-2.5">
            <div className="rounded-lg bg-gray-100 px-1 py-1.5 text-center text-[12px] leading-tight font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {item.day}
            </div>
            <div className="text-[13px] leading-relaxed text-gray-800 dark:text-gray-200">
              <span className="font-semibold">{item.title}</span>
              <span className="ml-1 text-gray-400">（{item.lectures}）</span>
              <br />
              {item.content}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-r-lg border-l-[3px] border-gray-300 bg-gray-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
        💡 <strong className="text-gray-700 dark:text-gray-300">时间更短怎么办？</strong>
        <br />
        只有3天：专攻 ①和差倍 ②鸡兔同笼/盈亏 ③巧算，这三块是得分主力。
        <br />
        只有1天：和差倍公式＋鸡兔同笼假设法，把这两大模型的解题步骤背熟。
      </div>
    </div>
  )
}

const tabs: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '知识点总览' },
  { key: 'priority', label: '优先级排序' },
  { key: 'plan', label: '复习计划' },
]

export default function MathStudyPriorityPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 dark:bg-gray-950">
      <div className="mx-auto max-w-2xl">
        <h1 className="sr-only">纳约数学大纲知识点分析与复习计划</h1>

        {/* Tab Bar */}
        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${
                activeTab === tab.key
                  ? 'border-gray-300 bg-white font-medium text-gray-900 shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'
                  : 'border-gray-200 bg-gray-100 text-gray-500 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Panels */}
        {activeTab === 'overview' && <OverviewPanel />}
        {activeTab === 'priority' && <PriorityPanel />}
        {activeTab === 'plan' && <PlanPanel />}
      </div>
    </main>
  )
}
