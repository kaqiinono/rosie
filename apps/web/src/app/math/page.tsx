'use client'

import { OrbBackground } from '@rosie/ui'
import { BackLink } from '@rosie/ui'
import CourseCard from '@rosie/math/components/CourseCard'
import MathDailyCard from '@rosie/math/components/MathDailyCard'
import MathSeaCard from '@rosie/math/components/MathSeaCard'
import { MathFavoritesCard } from '@rosie/math'
import MathQuizCard from '@rosie/math/components/MathQuizCard'
import MathCatalogCard from '@rosie/math/components/MathCatalogCard'
import { useAuth } from '@rosie/core'
import type { CourseCardData } from '@rosie/core'

const courses: CourseCardData[] = [
  {
    href: '/math/ny/47',
    title: '方格中的秘密探险',
    description: '数连、数桥、数方，再加上不等号、无马、窗口、对角线、锯齿等变型数独 —— 动手在格子里拼出答案。',
    icon: '🧩',
    lectureNum: '第 47 讲',
    tags: ['方格谜题', '数连·数桥·数方·变型数独', '30 道互动题'],
    variant: 'blue',
  },
  {
    href: '/math/ny/46',
    title: '抽屉原理与最不利探险',
    description: '用抽屉原理和最不利原则，解决各种"至少……才能保证"的难题。',
    icon: '🗄️',
    lectureNum: '第 46 讲',
    tags: ['抽屉原理', '最不利原则·保证问题', '49 道互动题'],
    variant: 'amber',
  },
  {
    href: '/math/ny/44',
    title: '统筹优化探险',
    description: '合理安排时间、减少等候、过河过桥、烙饼刷漆与最短路径 —— 生活中的统筹问题。',
    icon: '⏱️',
    lectureNum: '第 44 讲',
    tags: ['统筹优化', '排队·过河·路径', '40 道互动题'],
    variant: 'violet',
  },
  {
    href: '/math/ny/43',
    title: '等差数列初识探险',
    description: '认识首项、公差、项数与求和公式，解决生活中的等差数列问题。',
    icon: '📊',
    lectureNum: '第 43 讲',
    tags: ['等差数列', '求项·求和·应用', '49 道互动题'],
    variant: 'blue',
  },
  {
    href: '/math/ny/42',
    title: '生活智力题挑战',
    description: '天平称重、空瓶换水、绳子计时、量水标线、找假币 —— 用智慧解决生活中的真问题。',
    icon: '🧠',
    lectureNum: '第 42 讲',
    tags: ['生活智力题', '称重·换水·计时·找异物', '14 道互动题'],
    variant: 'amber',
  },
  {
    href: '/math/ny/41',
    title: '间隔趣题探险',
    description: '掌握间隔核心原理，解决锯木头、爬楼梯、敲钟 3 大经典题型。',
    icon: '✂️',
    lectureNum: '第 41 讲',
    tags: ['间隔趣题', '锯木头·爬楼·敲钟', '37 道互动题'],
    variant: 'amber',
  },
  {
    href: '/math/ny/40',
    title: '周长问题探险',
    description:
      '掌握拼图法、剪切法、平移法、标向法，解决各类长方形、正方形及不规则图形的周长问题。',
    icon: '📐',
    lectureNum: '第 40 讲',
    tags: ['周长问题', '剪切·平移·标向', '38 道互动题'],
    variant: 'violet',
  },
  {
    href: '/math/ny/39',
    title: '盈亏问题探险',
    description:
      '掌握盈亏核心公式：份数 = 总差额 ÷ 每份差额，解决盈盈、亏亏、盈亏、盈恰、亏恰 5 大题型。',
    icon: '⚖️',
    lectureNum: '第 39 讲',
    tags: ['盈亏问题', '差额公式', '12 道互动题'],
    variant: 'blue',
  },
  {
    href: '/math/ny/38',
    title: '一笔画探险',
    description:
      '掌握一笔画的秘密：端点、奇点与偶点，判断能否一笔画，以及如何改造图形让它可以一笔画。',
    icon: '✏️',
    lectureNum: '第 38 讲',
    tags: ['一笔画', '奇点偶点', '5道附加题'],
    variant: 'violet',
  },
  {
    href: '/math/ny/37',
    title: '鸡兔同笼探险',
    description:
      '掌握假设法4大题型：头和腿和基础、先求头和、双组分配、倒扣分，附加题挑战特殊条件与代数方法。',
    icon: '🐔',
    lectureNum: '第 37 讲',
    tags: ['鸡兔同笼', '假设法', '34 道互动题'],
    variant: 'violet',
  },
  {
    href: '/math/ny/36',
    title: '星期几问题探险',
    description:
      '掌握 3 大题型推算任意日期的星期几：同月/跨月天数余数法、跨年平年+1/闰年+2 累计偏移、确定星期几的分布分析。',
    icon: '📅',
    lectureNum: '第 36 讲',
    tags: ['星期几问题', '余数推算', '25 道互动题'],
    variant: 'amber',
  },
  {
    href: '/math/ny/35',
    title: '归一问题探险',
    description:
      '学会用倍比图解决归一问题，覆盖 5 大题型：基础归一、直接倍比、双归一、反向归一、变化归一。',
    icon: '🎯',
    lectureNum: '第 35 讲',
    tags: ['归一问题', '倍比图', '29 道互动题'],
    variant: 'blue',
  },
  {
    href: '/math/ny/34',
    title: '一袋里有几个',
    description: '用袋子装东西的故事演示 4×25 + 9×25，看两袋合成一袋的过程，直观理解乘法分配律。',
    icon: '🎁',
    lectureNum: '第 34 讲',
    tags: ['乘法分配律', '分步演示', '合并思维'],
    variant: 'violet',
  },
  {
    href: '/math/ny/30',
    title: '和差倍问题进阶',
    description: '三量联立的和差倍综合，兼顾减法算式、三粮仓差倍、跳绳打球倍比等进阶场景。',
    icon: '🧮',
    lectureNum: '第 30 讲',
    tags: ['和差倍进阶', '三量联立·倍比', '29 道互动题'],
    variant: 'amber',
  },
  {
    href: '/math/ny/29',
    title: '算符大作战',
    description: '用加减乘除四种算符填空、24点游戏、奇偶性填算符，以及凑数法与逆推法。',
    icon: '🎮',
    lectureNum: '第 29 讲',
    tags: ['算符填空', '24点·奇偶·逆推', '18 道互动题'],
    variant: 'violet',
  },
  {
    href: '/math/ny/23',
    title: '我是小侦探（逻辑推理）',
    description: '排除法、假设法、对应法、推理表、多线索联立，掌握五大逻辑推理方法。',
    icon: '🔍',
    lectureNum: '第 23 讲',
    tags: ['逻辑推理', '排除·假设·对应', '35 道互动题'],
    variant: 'violet',
  },
  {
    href: '/math/ny/18',
    title: '和差倍问题初步',
    description: '从两量和倍、差倍到三量联立，覆盖倍比关系的六大经典题型。',
    icon: '✖️',
    lectureNum: '第 18 讲',
    tags: ['和差倍初步', '和倍·差倍·三量', '37 道互动题'],
    variant: 'violet',
  },
  {
    href: '/math/ny/15',
    title: '"和"与"差"的故事',
    description: '和差基础公式与隐藏差的发现，覆盖基础和差、移多补少、平均数变形三类题型。',
    icon: '➕',
    lectureNum: '第 15 讲',
    tags: ['和差问题', '移多补少·隐藏差', '32 道互动题'],
    variant: 'blue',
  },
  {
    href: '/math/ny/13',
    title: '植树问题',
    description: '掌握两端植、一端植、环形植三大场景，突破等距关系与间隔数核心原理。',
    icon: '🌳',
    lectureNum: '第 13 讲',
    tags: ['植树问题', '两端·一端·环形', '37 道互动题'],
    variant: 'blue',
  },
  {
    href: '/math/ny/12',
    title: '巧算加减法进阶',
    description: '补数凑整、连续自然数求和、加减法的灵活计算与速算技巧进阶。',
    icon: '🔢',
    lectureNum: '第 12 讲',
    tags: ['巧算加减法', '补数·凑整·速算', '52 道互动题'],
    variant: 'amber',
  },
]

export default function MathPage() {
  const { user } = useAuth()
  const raw = user?.email?.replace('@rosie.app', '') ?? user?.email?.split('@')[0]
  const username = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : undefined
  return (
    <>
      <OrbBackground variant="math" />
      <BackLink />

      <div className="relative z-1 flex min-h-screen flex-col items-center gap-7 px-5 pt-24 pb-12 max-[500px]:gap-5 max-[500px]:px-3.5 max-[500px]:pt-20 max-[500px]:pb-8">
        <section className="max-w-[480px] text-center">
          <div className="animate-bounce-slow inline-block text-5xl">🧮</div>
          <h1 className="mt-2 bg-gradient-to-br from-blue-900 via-violet-600 to-amber-500 bg-clip-text text-[clamp(26px,5vw,34px)] leading-tight font-black text-transparent">
            数学探险乐园
          </h1>
          <p className="text-text-secondary mt-1.5 text-sm leading-relaxed">
            选一节课开始今天的数学冒险吧
          </p>
        </section>

        <section className="flex w-full max-w-[680px] flex-col gap-4">
          <div className="grid grid-cols-2 items-stretch gap-3 min-[501px]:grid-cols-[1fr_120px_120px_120px_120px]">
            <div className="h-full min-[501px]:col-span-1 col-span-2">
              <MathDailyCard />
            </div>
            <MathSeaCard />
            <MathFavoritesCard />
            <MathQuizCard />
            <MathCatalogCard />
          </div>
          {courses.map((course) => (
            <CourseCard key={course.href} data={course} />
          ))}
        </section>

        <div className="text-text-muted text-xs">{username ?? 'Rosie'} 的数学探险乐园</div>
      </div>
    </>
  )
}
