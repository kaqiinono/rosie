// 数学讲次卡片数据。href 为 canonical 路由 /math/ny/{grade}/{seq}。
import type {CourseCardData} from '@rosie/core'
import {gradeOf, lessonIdFromHref} from './lesson-grade'

const RAW_COURSES: CourseCardData[] = [
  {
    href: '/math/ny/2/7',
    title: '数字谜探险',
    description: '加法/减法/数字和分析 —— 方框、字母、汉字竖式推理，从个位进位退位逐位破解，含附加挑战。',
    icon: '🔐',
    lectureNum: '第 7 讲',
    tags: ['数字谜', '竖式推理·字母谜', '35 道互动题'],
    variant: 'blue',
  },
  {
    href: '/math/ny/2/6',
    title: '简单枚举探险',
    description: '有序列举、分类讨论 —— 简单枚举、无序分堆、数字排序与隔板分物，含终极挑战附加题。',
    icon: '🔢',
    lectureNum: '第 6 讲',
    tags: ['简单枚举', '分堆·组数·隔板', '66 道互动题'],
    variant: 'blue',
  },
  {
    href: '/math/ny/2/5',
    title: '找规律探险',
    description: '数列、数表与图形编码 —— 观察差比和、位置轮换与乘积关系，含终极挑战附加题。',
    icon: '🔮',
    lectureNum: '第 5 讲',
    tags: ['找规律', '数列·数表·图形编码', '57 道互动题'],
    variant: 'amber',
  },
  {
    href: '/math/ny/2/4',
    title: '差倍问题探险',
    description: '找差找倍画线段图 —— 基本差倍、移多补少、年龄问题与和倍应用，含综合挑战附加题。',
    icon: '📊',
    lectureNum: '第 4 讲',
        tags: ['差倍问题', '移多补少·年龄·和倍', '64 道互动题'],
    variant: 'violet',
  },
  {
        href: '/math/ny/2/3',
        title: '等量代换与归一问题探险',
        description: '等量代换统一数量、消元求单价、直接归一与反比例归一 —— 学会先求每份再算总量。',
        icon: '⚖️',
        lectureNum: '第 3 讲',
        tags: ['等量代换', '归一问题·消元', '30 道互动题'],
        variant: 'blue',
    },
    {
        href: '/math/ny/2/2',
        title: '基本应用题探险',
        description: '读题找关系、先归一再求解 —— 归一、等量代换、分组统计与位置推理，含逻辑综合挑战。',
        icon: '📝',
        lectureNum: '第 2 讲',
        tags: ['基本应用题', '归一·等量代换·分组统计', '37 道互动题'],
        variant: 'blue',
    },
    {
        href: '/math/ny/2/1',
        title: '加减法速算与巧算探险',
        description: '凑整、去括号、按位相加、基准数 —— 学会用运算定律让加减法又快又准，还有终极挑战附加题。',
        icon: '🧮',
        lectureNum: '第 1 讲',
        tags: ['速算巧算', '交换律·结合律·去括号·基准数', '56 道互动题'],
        variant: 'violet',
    },
    {
        href: '/math/ny/1/47',
        title: '方格中的秘密探险',
        description: '数连、数桥、数方，再加上不等号、无马、窗口、对角线、锯齿等变型数独 —— 动手在格子里拼出答案。',
        icon: '🧩',
        lectureNum: '第 47 讲',
        tags: ['方格谜题', '数连·数桥·数方·变型数独', '30 道互动题'],
        variant: 'blue',
    },
    {
        href: '/math/ny/1/46',
        title: '抽屉原理与最不利探险',
        description: '用抽屉原理和最不利原则，解决各种"至少……才能保证"的难题。',
        icon: '🗄️',
        lectureNum: '第 46 讲',
        tags: ['抽屉原理', '最不利原则·保证问题', '49 道互动题'],
        variant: 'amber',
    },
    {
        href: '/math/ny/1/44',
        title: '统筹优化探险',
        description: '合理安排时间、减少等候、过河过桥、烙饼刷漆与最短路径 —— 生活中的统筹问题。',
        icon: '⏱️',
        lectureNum: '第 44 讲',
        tags: ['统筹优化', '排队·过河·路径', '40 道互动题'],
        variant: 'violet',
    },
    {
        href: '/math/ny/1/43',
        title: '等差数列初识探险',
        description: '认识首项、公差、项数与求和公式，解决生活中的等差数列问题。',
        icon: '📊',
        lectureNum: '第 43 讲',
        tags: ['等差数列', '求项·求和·应用', '49 道互动题'],
        variant: 'blue',
    },
    {
        href: '/math/ny/1/42',
        title: '生活智力题挑战',
        description: '天平称重、空瓶换水、绳子计时、量水标线、找假币 —— 用智慧解决生活中的真问题。',
        icon: '🧠',
        lectureNum: '第 42 讲',
        tags: ['生活智力题', '称重·换水·计时·找异物', '14 道互动题'],
        variant: 'amber',
    },
    {
        href: '/math/ny/1/41',
        title: '间隔趣题探险',
        description: '掌握间隔核心原理，解决锯木头、爬楼梯、敲钟 3 大经典题型。',
        icon: '✂️',
        lectureNum: '第 41 讲',
        tags: ['间隔趣题', '锯木头·爬楼·敲钟', '37 道互动题'],
        variant: 'amber',
    },
    {
        href: '/math/ny/1/40',
        title: '周长问题探险',
        description:
            '掌握拼图法、剪切法、平移法、标向法，解决各类长方形、正方形及不规则图形的周长问题。',
        icon: '📐',
        lectureNum: '第 40 讲',
        tags: ['周长问题', '剪切·平移·标向', '38 道互动题'],
        variant: 'violet',
    },
    {
        href: '/math/ny/1/39',
        title: '盈亏问题探险',
        description:
            '掌握盈亏核心公式：份数 = 总差额 ÷ 每份差额，解决盈盈、亏亏、盈亏、盈恰、亏恰 5 大题型。',
        icon: '⚖️',
        lectureNum: '第 39 讲',
        tags: ['盈亏问题', '差额公式', '12 道互动题'],
        variant: 'blue',
    },
    {
        href: '/math/ny/1/38',
        title: '一笔画探险',
        description:
            '掌握一笔画的秘密：端点、奇点与偶点，判断能否一笔画，以及如何改造图形让它可以一笔画。',
        icon: '✏️',
        lectureNum: '第 38 讲',
        tags: ['一笔画', '奇点偶点', '5道附加题'],
        variant: 'violet',
    },
    {
        href: '/math/ny/1/37',
        title: '鸡兔同笼探险',
        description:
            '掌握假设法4大题型：头和腿和基础、先求头和、双组分配、倒扣分，附加题挑战特殊条件与代数方法。',
        icon: '🐔',
        lectureNum: '第 37 讲',
        tags: ['鸡兔同笼', '假设法', '34 道互动题'],
        variant: 'violet',
    },
    {
        href: '/math/ny/1/36',
        title: '星期几问题探险',
        description:
            '掌握 3 大题型推算任意日期的星期几：同月/跨月天数余数法、跨年平年+1/闰年+2 累计偏移、确定星期几的分布分析。',
        icon: '📅',
        lectureNum: '第 36 讲',
        tags: ['星期几问题', '余数推算', '25 道互动题'],
        variant: 'amber',
    },
    {
        href: '/math/ny/1/35',
        title: '归一问题探险',
        description:
            '学会用倍比图解决归一问题，覆盖 5 大题型：基础归一、直接倍比、双归一、反向归一、变化归一。',
        icon: '🎯',
        lectureNum: '第 35 讲',
        tags: ['归一问题', '倍比图', '29 道互动题'],
        variant: 'blue',
    },
    {
        href: '/math/ny/1/34',
        title: '一袋里有几个',
        description: '用袋子装东西的故事演示 4×25 + 9×25，看两袋合成一袋的过程，直观理解乘法分配律。',
        icon: '🎁',
        lectureNum: '第 34 讲',
        tags: ['乘法分配律', '分步演示', '合并思维'],
        variant: 'violet',
    },
    {
        href: '/math/ny/1/30',
        title: '和差倍问题进阶',
        description: '三量联立的和差倍综合，兼顾减法算式、三粮仓差倍、跳绳打球倍比等进阶场景。',
        icon: '🧮',
        lectureNum: '第 30 讲',
        tags: ['和差倍进阶', '三量联立·倍比', '29 道互动题'],
        variant: 'amber',
    },
    {
        href: '/math/ny/1/29',
        title: '算符大作战',
        description: '用加减乘除四种算符填空、24点游戏、奇偶性填算符，以及凑数法与逆推法。',
        icon: '🎮',
        lectureNum: '第 29 讲',
        tags: ['算符填空', '24点·奇偶·逆推', '18 道互动题'],
        variant: 'violet',
    },
    {
        href: '/math/ny/1/23',
        title: '我是小侦探（逻辑推理）',
        description: '排除法、假设法、对应法、推理表、多线索联立，掌握五大逻辑推理方法。',
        icon: '🔍',
        lectureNum: '第 23 讲',
        tags: ['逻辑推理', '排除·假设·对应', '35 道互动题'],
        variant: 'violet',
    },
    {
        href: '/math/ny/1/18',
        title: '和差倍问题初步',
        description: '从两量和倍、差倍到三量联立，覆盖倍比关系的六大经典题型。',
        icon: '✖️',
        lectureNum: '第 18 讲',
        tags: ['和差倍初步', '和倍·差倍·三量', '37 道互动题'],
        variant: 'violet',
    },
    {
        href: '/math/ny/1/15',
        title: '"和"与"差"的故事',
        description: '和差基础公式与隐藏差的发现，覆盖基础和差、移多补少、平均数变形三类题型。',
        icon: '➕',
        lectureNum: '第 15 讲',
        tags: ['和差问题', '移多补少·隐藏差', '32 道互动题'],
        variant: 'blue',
    },
    {
        href: '/math/ny/1/13',
        title: '植树问题',
        description: '掌握两端植、一端植、环形植三大场景，突破等距关系与间隔数核心原理。',
        icon: '🌳',
        lectureNum: '第 13 讲',
        tags: ['植树问题', '两端·一端·环形', '37 道互动题'],
        variant: 'blue',
    },
    {
        href: '/math/ny/1/12',
        title: '巧算加减法进阶',
        description: '补数凑整、连续自然数求和、加减法的灵活计算与速算技巧进阶。',
        icon: '🔢',
        lectureNum: '第 12 讲',
        tags: ['巧算加减法', '补数·凑整·速算', '52 道互动题'],
        variant: 'amber',
    },
]

export const COURSES: CourseCardData[] = RAW_COURSES

/** 某年级课程在首页卡片上的简要说明（从 COURSES 自动派生）。 */
export function gradeCourseSummary(grade: number): string {
    const courses = COURSES.filter((c) => {
        const id = lessonIdFromHref(c.href)
        return id !== undefined && gradeOf(id) === grade
    })
    if (courses.length === 0) return ''

    if (courses.length === 1) {
        const c = courses[0]
        return c.tags.slice(0, 2).join(' · ')
    }

    const topics = courses.slice(0, 5).map((c) => c.tags[0]).filter(Boolean)
    const joined = topics.join('、')
    if (courses.length > 5) {
        return `${joined}…共 ${courses.length} 讲`
    }
    return `${joined} · 共 ${courses.length} 讲`
}
