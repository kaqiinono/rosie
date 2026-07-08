'use client'

import { createFilterPanel } from '@rosie/math/components/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, FilterPanelProps } from '@rosie/math/components/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/2/3',
  title: '🎯 综合题库 · 第51讲',
  theme: {
    btnOn: 'border-emerald-600 bg-emerald-600 text-white',
    btnOff: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    containerBorder: 'border-emerald-200',
    containerGradient: 'bg-gradient-to-br from-emerald-50 to-teal-50',
    titleColor: 'text-emerald-800',
    labelColor: 'text-emerald-700',
    toggleColor: 'text-emerald-500 hover:text-emerald-700',
    progressTrack: 'bg-emerald-100',
    progressAttempted: 'bg-emerald-200',
    progressMastered: 'bg-emerald-500',
    dotColor: 'text-emerald-300',
    strongColor: 'text-emerald-800',
    srcBadge: 'bg-emerald-100 text-emerald-800',
    accentClass: 'text-emerald-700',
  },
  sourceBtns: [
    { key: 'pretest', label: '📝 课前测' },
    { key: 'lesson', label: '📖 课堂' },
    { key: 'homework', label: '✏️ 课后' },
    { key: 'supplement', label: '📒 附加' },
  ],
  typeBtns: [
    { key: 'type1', label: '题型1·等量代换' },
    { key: 'type2', label: '题型2·消元求单价' },
    { key: 'type3', label: '题型3·归一问题' },
    { key: 'type4', label: '题型4·反比例归一' },
    { key: 'type5', label: '题型5·综合应用' },
  ],
  tagColors: {
    type1: 'bg-blue-100 text-blue-800',
    type2: 'bg-green-100 text-green-800',
    type3: 'bg-orange-100 text-orange-800',
    type4: 'bg-purple-100 text-purple-800',
    type5: 'bg-red-100 text-red-800',
  },
}, ProblemDetail)
