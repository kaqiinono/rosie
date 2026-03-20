import type { Problem, ProblemSet } from './type'

const LESSON: Problem[] = [
  {
    id: '36-L1', title: '例题1(1)：过100天是星期几', tag: 'type1', tagLabel: '同月及跨月',
    text: '今天是<strong>星期六</strong>，过7天是星期几？过<strong>100天</strong>是星期几？',
    analysis: [
      '过7天=整整一周，星期不变，还是星期六',
      '过100天：100÷7=14余2',
      '余数为2，从星期六往后推2天',
      '星期六→星期日→星期一',
    ],
    type: 'none',
    finalQ: '过100天是星期几？（1=周一，2=周二，...，7=周日）', finalUnit: '', finalAns: 1,
  },
  {
    id: '36-L2', title: '例题1(2)：同月推算', tag: 'type1', tagLabel: '同月及跨月',
    text: '2026年<strong>2月3日</strong>是星期二，2月25日是星期几？',
    analysis: [
      '同月内推算：25−3=22天后',
      '22÷7=3余1',
      '余数为1，星期二往后推1天',
      '星期二→星期三',
    ],
    type: 'none',
    finalQ: '2月25日是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 3,
  },
  {
    id: '36-L3', title: '例题2：跨月推算', tag: 'type1', tagLabel: '同月及跨月',
    text: '2026年<strong>4月4日</strong>是星期六，那么2026年6月23日是星期几？',
    analysis: [
      '计算天数差：4月4日→6月23日',
      '4月剩余：30−4=26天，5月：31天，6月1~23日：23天',
      '总计：26+31+23=80天',
      '80÷7=11余3，星期六往后推3天=星期二',
    ],
    type: 'none',
    finalQ: '6月23日是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 2,
  },
  {
    id: '36-L4', title: '例题3：跨年推算元旦', tag: 'type2', tagLabel: '跨年推算',
    text: '2023年<strong>1月1日</strong>是星期日，2026年1月1日是星期几？',
    analysis: [
      '每过一年，元旦往后推：平年+1，闰年+2',
      '2023年（平年）+1 → 2024元旦=周一',
      '2024年（闰年）+2 → 2025元旦=周三',
      '2025年（平年）+1 → 2026元旦=周四',
    ],
    type: 'none',
    finalQ: '2026年1月1日是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 4,
  },
  {
    id: '36-L5', title: '例题4：跨年跨月推算', tag: 'type2', tagLabel: '跨年推算',
    text: '2021年<strong>12月18日</strong>是星期六，那么2026年1月5日是星期几？',
    analysis: [
      '计算总天数：13+365+365+366+365+5=1479天',
      '（12月剩13天，2022平年，2023平年，2024闰年，2025平年，1月前5天）',
      '1479÷7=211余2',
      '星期六往后推2天：星期六→日→一=星期一',
    ],
    type: 'none',
    finalQ: '2026年1月5日是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 1,
  },
  {
    id: '36-L6', title: '例题5：31天确定31日星期几', tag: 'type3', tagLabel: '确定星期几',
    text: '某月有<strong>31天</strong>，有<strong>4个星期二</strong>和<strong>5个星期三</strong>，那么这个月的31日是星期几？',
    analysis: [
      '31=4×7+3，最后3天（29、30、31日）各出现5次',
      '5个星期三：三在多出的3天里',
      '4个星期二：二不在多出的3天里（否则也会出现5次）',
      '多出的3天不含二，且含三，连续3天只有{三、四、五}满足',
      '29=三，30=四，31=五，即31日是星期五',
    ],
    type: 'none',
    finalQ: '这个月的31日是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 5,
  },
  {
    id: '36-L7', title: '例题6：由日期和确定第一个星期三', tag: 'type3', tagLabel: '确定星期几',
    text: '已知某个月<strong>所有星期三的日期加起来是80</strong>，则这个月第一个星期三是几号？',
    analysis: [
      '设第一个星期三是x号，星期三依次为x, x+7, x+14, x+21...',
      '若有5个星期三：x+(x+7)+(x+14)+(x+21)+(x+28)=5x+70=80',
      '解得5x=10，x=2',
      '验证：最后一个星期三=2+28=30，合理',
    ],
    type: 'none',
    finalQ: '第一个星期三是几号？', finalUnit: '号', finalAns: 2,
  },
]

const HOMEWORK: Problem[] = [
  {
    id: '36-H1', title: '课后巩固1：从日历推算4月1日', tag: 'type1', tagLabel: '同月及跨月',
    text: '如图是2025年1月份日历表（<strong>1月1日是星期三</strong>）。<br/>1) 该月8号是星期几？<br/>2) 该年<strong>4月1日</strong>是星期几？',
    analysis: [
      '由日历知1月1日=星期三，所以8日=星期三',
      '计算4月1日：1月(31天)+2月(28天)+3月(31天)=90天后',
      '90÷7=12余6',
      '星期三往后推6天：三→四→五→六→日→一→二=星期二',
    ],
    type: 'none',
    finalQ: '该年4月1日是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 2,
  },
  {
    id: '36-H2', title: '课后巩固2：2008年奥运会是星期几', tag: 'type1', tagLabel: '同月及跨月',
    text: '2008年<strong>3月3日</strong>是星期一，请你算一算2008年<strong>8月8日奥运会</strong>开幕是星期几？',
    analysis: [
      '3月3日→8月8日天数：(31-3)+30+31+30+31+8=158天',
      '158÷7=22余4',
      '星期一往后推4天：一→二→三→四→五=星期五',
    ],
    type: 'none',
    finalQ: '8月8日奥运会是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 5,
  },
  {
    id: '36-H3', title: '课后巩固3：2022→2026年元旦', tag: 'type2', tagLabel: '跨年推算',
    text: '2022年的元旦是<strong>星期六</strong>，那么2026年的元旦是星期几？',
    analysis: [
      '2022年（平年）+1 → 2023元旦=周日',
      '2023年（平年）+1 → 2024元旦=周一',
      '2024年（闰年）+2 → 2025元旦=周三',
      '2025年（平年）+1 → 2026元旦=周四',
    ],
    type: 'none',
    finalQ: '2026年元旦是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 4,
  },
  {
    id: '36-H4', title: '课后巩固4：2025年8月→2026年10月', tag: 'type2', tagLabel: '跨年推算',
    text: '已知2025年<strong>8月8日</strong>是星期五，那么2026年10月1日是星期几？',
    analysis: [
      '天数：(31-8)+30+31+30+31+31+28+31+30+31+30+31+31+30+1=419天',
      '（8月剩23天+9/10/11/12月2025+2026年1-9月+10月1日）',
      '419÷7=59余6',
      '星期五往后推6天：五→六→日→一→二→三→四=星期四',
    ],
    type: 'none',
    finalQ: '2026年10月1日是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 4,
  },
  {
    id: '36-H5', title: '课后巩固5：由日期和确定第二个星期四', tag: 'type3', tagLabel: '确定星期几',
    text: '已知某个月<strong>所有星期四的日期加起来是70</strong>，那么这个月第二个星期四是多少日？',
    analysis: [
      '设第一个星期四是x号，星期四依次为x, x+7, x+14, x+21...',
      '若有4个星期四：x+(x+7)+(x+14)+(x+21)=4x+42=70',
      '解得4x=28，x=7',
      '第二个星期四=7+7=14号',
    ],
    type: 'none',
    finalQ: '第二个星期四是几号？', finalUnit: '号', finalAns: 14,
  },
  {
    id: '36-H6', title: '课后巩固6：31天确定20日星期几', tag: 'type3', tagLabel: '确定星期几',
    text: '某月有<strong>31天</strong>，有<strong>4个星期二</strong>和<strong>4个星期五</strong>，那么这个月的20日是星期几？',
    analysis: [
      '31=4×7+3，最后3天各出现5次，二和五都未出现5次',
      '多出的3天不含二(Tue)也不含五(Fri)',
      '连续3天不含二、五，只有{六、日、一}满足',
      '29=六，30=日，31=一，推算1日=六（星期六）',
      '20日=1日+19天，19÷7=2余5，六往后推5天=星期四',
    ],
    type: 'none',
    finalQ: '该月20日是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 4,
  },
]

const WORKBOOK: Problem[] = [
  {
    id: '36-W1', title: '闯关1：纳纳生日是星期几', tag: 'type1', tagLabel: '同月及跨月',
    text: '纳纳的生日是<strong>6月27日</strong>，这一年的<strong>6月1日是星期六</strong>，纳纳的生日是星期几呢？',
    analysis: ['27-1=26天后', '26÷7=3余5', '星期六往后推5天：六→日→一→二→三→四=星期四'],
    type: 'none',
    finalQ: '6月27日是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 4,
  },
  {
    id: '36-W2', title: '闯关2：6月→9月跨月推算', tag: 'type1', tagLabel: '同月及跨月',
    text: '2026年<strong>6月19日</strong>是星期五，则2026年9月19日是星期几？',
    analysis: ['6月19日→9月19日：(30-19)+31+31+19=92天', '92÷7=13余1', '星期五往后推1天=星期六'],
    type: 'none',
    finalQ: '9月19日是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 6,
  },
  {
    id: '36-W3', title: '闯关3：2024→2026年10月', tag: 'type2', tagLabel: '跨年推算',
    text: '2024年<strong>12月1日</strong>是星期日，那么2026年10月1日是星期几？',
    analysis: [
      '12月1日→次年12月1日=365天（2025平年）',
      '12月1日，2025→2026年10月1日还有：31+31+28+31+30+31+30+31+31+30+1=274天（Dec到Oct1）',
      '总计：30+365+274=669天',
      '669÷7=95余4，星期日往后推4天：日→一→二→三→四=星期四',
    ],
    type: 'none',
    finalQ: '2026年10月1日是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 4,
  },
  {
    id: '36-W4', title: '闯关4：2018→2021年元旦', tag: 'type2', tagLabel: '跨年推算',
    text: '2018年元旦是<strong>星期一</strong>，2019年元旦是星期几？2020年元旦是星期几？<strong>2021年元旦是星期几？</strong>',
    analysis: [
      '2018年（平年）+1 → 2019元旦=周二',
      '2019年（平年）+1 → 2020元旦=周三',
      '2020年（闰年）+2 → 2021元旦=周五',
    ],
    type: 'none',
    finalQ: '2021年元旦是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 5,
  },
  {
    id: '36-W5', title: '闯关5：2022年→2023年6月', tag: 'type2', tagLabel: '跨年推算',
    text: '已知2022年<strong>12月8日</strong>是星期四，那么2023年6月1日是星期几？',
    analysis: [
      '12月8日→2023年6月1日：(31-8)+31+28+31+30+31+1=175天',
      '175÷7=25余0，余数为0说明星期不变',
      '星期四+0=星期四',
    ],
    type: 'none',
    finalQ: '2023年6月1日是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 4,
  },
  {
    id: '36-W6', title: '闯关6：2015→2017年2月', tag: 'type2', tagLabel: '跨年推算',
    text: '2015年<strong>1月1日</strong>是星期四，那么2017年2月5日是星期几？',
    analysis: [
      '1月1日，2015→2017年2月5日：365+366+36=767天',
      '（2015平年+2016闰年+2017年前36天）',
      '767÷7=109余4，星期四往后推4天=星期一',
    ],
    type: 'none',
    finalQ: '2017年2月5日是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 1,
  },
  {
    id: '36-W7', title: '闯关7：4月有5个周六和周日', tag: 'type3', tagLabel: '确定星期几',
    text: '四月份共有<strong>30天</strong>，如果其中有<strong>5个星期六和星期日</strong>，那么4月1日是星期几？',
    analysis: [
      '30=4×7+2，有2天各出现5次',
      '5个星期六且5个星期日，说明六和日都是多出的2天',
      '这2天连续：星期六和星期日',
      '若29=六，30=日，则1日=六（因为28天=4周，1日与29日同星期）',
      '4月1日=星期六',
    ],
    type: 'none',
    finalQ: '4月1日是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 6,
  },
  {
    id: '36-W8', title: '闯关8：刚好3个星期日是偶数', tag: 'type3', tagLabel: '确定星期几',
    text: '在某个月中<strong>刚好有3个星期日的日期是偶数</strong>，则这个月的5日是星期几？',
    analysis: [
      '若有5个星期日，第一个在偶数日x：x, x+7, x+14, x+21, x+28',
      '偶数位置：x, x+14, x+28为偶数（共3个），x+7和x+21为奇数',
      '说明x是偶数，最小取x=2：星期日为2,9,16,23,30',
      '2日=日，则1日=星期六',
      '5日=1日+4天：六→日→一→二→三=星期三',
    ],
    type: 'none',
    finalQ: '该月5日是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 3,
  },
  {
    id: '36-W9', title: '闯关9：31天，4个周三和4个周日', tag: 'type3', tagLabel: '确定星期几',
    text: '某月有<strong>31天</strong>，有<strong>4个星期三</strong>和<strong>4个星期日</strong>，那么这个月的15日是星期几？',
    analysis: [
      '31=4×7+3，最后3天各出现5次，三和日都未出现5次',
      '多出的3天不含三(Wed)也不含日(Sun)',
      '连续3天不含三、日：只有{四、五、六}满足',
      '29=四，30=五，31=六，推算1日=四（星期四）',
      '15日=1日+14天=四（14=2×7，星期不变）=星期四',
    ],
    type: 'none',
    finalQ: '该月15日是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 4,
  },
  {
    id: '36-W10', title: '闯关10：周二>周三，周一>周日，6号是星期几', tag: 'type3', tagLabel: '确定星期几',
    text: '已知某月中，<strong>星期二的天数比星期三的天数多</strong>，而<strong>星期一的天数比星期日的天数多</strong>，那么这个月的6号是星期几？',
    analysis: [
      '二>三说明星期二出现5次、星期三4次，一>日说明星期一出现5次、星期日4次',
      '二和一同时出现5次，说明多出的2天连续为一和二',
      '（30天月份=4×7+2，有2天出现5次）',
      '1日=周一，2日=周二',
      '6日=1日+5天：一→二→三→四→五→六=星期六',
    ],
    type: 'none',
    finalQ: '该月6号是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 6,
  },
  {
    id: '36-W11', title: '闯关11：2006年53个周日，2007元旦是几', tag: 'type3', tagLabel: '确定星期几',
    text: '奶奶告诉奇奇："2006年共有<strong>53个星期日</strong>。"聪明的奇奇立刻告诉奶奶："我知道2007年的元旦是星期几啦！"聪明的小朋友，你知道了吗？',
    analysis: [
      '365=52×7+1，某天出现53次当且仅当该天是1月1日（=12月31日同天）',
      '2006年53个周日 → 2006年1月1日=星期日',
      '2006年是平年，+1天偏移',
      '2007年1月1日=星期日+1=星期一',
    ],
    type: 'none',
    finalQ: '2007年元旦是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 1,
  },
  {
    id: '36-W12', title: '闯关12：53个周二（元旦非周二），下一年最后一天', tag: 'type3', tagLabel: '确定星期几',
    text: '某一年中有<strong>53个星期二</strong>，并且<strong>当年的元旦不是星期二</strong>，那么下一年的最后一天是星期几？',
    analysis: [
      '元旦非周二但有53个周二，只能是闰年（366=52×7+2，两天出现53次）',
      '二出现53次，元旦非二，则元旦=一（周一），周一和周二各出现53次',
      '闰年12月31日=元旦+365天=周一+1=周二',
      '下一年1月1日=周三，若下一年是平年：12月31日=周三+364天=周三',
    ],
    type: 'none',
    finalQ: '下一年的最后一天是星期几？（1=周一，...，7=周日）', finalUnit: '', finalAns: 3,
  },
]

export const PROBLEMS: ProblemSet = {
  pretest: [],
  lesson: LESSON,
  homework: HOMEWORK,
  workbook: WORKBOOK,
}

export const PROBLEM_TYPES = [
  {
    tag: 'type1', color: 'blue', label: '招式1 · 同月推算',
    desc: '在同一个月里，知道某天是星期几，推算同月另一天是星期几。用大日期 − 小日期得差值，÷7取余数，再从已知星期往后数。',
    example: '例：2月3日是周二，2月25日是？（25−3=22，22÷7余1，周二+1=周三）',
  },
  {
    tag: 'type2', color: 'pink', label: '招式2 · 跨月推算',
    desc: '同一年内跨越不同月份推算星期几。天数分三段：①起始月剩余天数，②中间各月总天数，③结束月目标日数字，三段相加÷7取余。',
    example: '例：4月4日是周六，6月23日是？（26+31+23=80天，80÷7余3，周六+3=周二）',
  },
  {
    tag: 'type3', color: 'green', label: '招式3 · 跨年推算（同月同日）',
    desc: '从某年某日推算若干年后同月同日是星期几。平年365天÷7余1，星期+1；闰年366天÷7余2，星期+2。逐年累加偏移量÷7取余。',
    example: '例：2023年1月1日是周日，2026年1月1日是？（+1+2+1=4，周日+4=周四）',
  },
  {
    tag: 'type4', color: 'amber', label: '招式4 · 跨年跨月（终极两步走）',
    desc: '目标年份和月日都不同时，分两步：先用招式3推算到目标年的同月同日，再用招式2从同月同日推算到目标日期。口诀：先过年，再过月。',
    example: '例：2021年3月18日周六，2026年9月5日是？（先跨年到2026年3月18日=周五，再跨月171天÷7余3=周一）',
  },
  {
    tag: 'type5', color: 'purple', label: '招式5 · 确定星期几',
    desc: '已知某月某星期出现次数，反推1号是星期几再算目标日。月天数÷7的余数就是"出现5次的星期个数"，这几个星期从1号起连续排列。',
    example: '例：某31天月有5个周三、周四、周五，则1号是周三，31日是(31−1)÷7余2，周三+2=周五。',
  },
  {
    tag: 'type6', color: 'orange', label: '招式6 · 日期总和反推',
    desc: '已知某月所有星期X的日期之和，反推出是哪几号。分4次和5次两种情况：用给定总和减去最小总和（46或75），差值能被次数整除则找到答案。',
    example: '例：某月所有星期X日期之和为80，31天月：80−75=5，5÷5=1，第一个是2号（2、9、16、23、30）。',
  },
]

export const TYPE_STYLE: Record<string, { bg: string; border: string; titleColor: string; textColor: string }> = {
  type1: { bg: 'bg-blue-50',   border: 'border-l-blue-500',   titleColor: 'text-blue-800',   textColor: 'text-blue-900'   },
  type2: { bg: 'bg-pink-50',   border: 'border-l-pink-500',   titleColor: 'text-pink-800',   textColor: 'text-pink-900'   },
  type3: { bg: 'bg-green-50',  border: 'border-l-green-500',  titleColor: 'text-green-800',  textColor: 'text-green-900'  },
  type4: { bg: 'bg-amber-50',  border: 'border-l-amber-500',  titleColor: 'text-amber-700',  textColor: 'text-amber-800'  },
  type5: { bg: 'bg-purple-50', border: 'border-l-purple-500', titleColor: 'text-purple-800', textColor: 'text-purple-900' },
  type6: { bg: 'bg-orange-50', border: 'border-l-orange-500', titleColor: 'text-orange-700', textColor: 'text-orange-800' },
}

export const TAG_STYLE: Record<string, string> = {
  type1: 'bg-app-blue-light text-app-blue-dark',
  type2: 'bg-app-green-light text-app-green-dark',
  type3: 'bg-yellow-light text-yellow-dark',
}

export const LESSON_TIP = '口诀：天数差÷7，余数定星期！余0同一天，余几往后推几天。平年+1，闰年+2。'
