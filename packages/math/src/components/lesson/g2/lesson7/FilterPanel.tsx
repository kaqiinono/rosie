'use client'

import { createFilterPanel } from '@rosie/math/components/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, FilterPanelProps } from '@rosie/math/components/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/2/7',
  title: '🎯 综合题库 · 第56讲',
  theme: {
    btnOn: 'border-sky-600 bg-sky-600 text-white',
    btnOff: 'border-sky-300 bg-sky-50 text-sky-700',
    containerBorder: 'border-sky-200',
    containerGradient: 'bg-gradient-to-br from-sky-50 to-sky-50',
    titleColor: 'text-sky-800',
    labelColor: 'text-sky-700',
    toggleColor: 'text-sky-500 hover:text-sky-700',
    progressTrack: 'bg-sky-100',
    progressAttempted: 'bg-sky-200',
    progressMastered: 'bg-sky-500',
    dotColor: 'text-sky-300',
    strongColor: 'text-sky-800',
    srcBadge: 'bg-sky-100 text-sky-800',
    accentClass: 'text-sky-700',
  },
  sourceBtns: [
    { key: 'lesson', label: '📖 课堂' },
    { key: 'homework', label: '✏️ 课后' },
    { key: 'supplement', label: '📒 附加' },
  ],
  typeBtns: [
    { key: 'type1', label: '题型1·加法谜' },
    { key: 'type2', label: '题型2·减法谜' },
    { key: 'type3', label: '题型3·数字和分析' },
    { key: 'type5', label: '题型4·附加挑战' },
  ],
  tagColors: {
    type1: 'bg-blue-100 text-blue-800',
    type2: 'bg-green-100 text-green-800',
    type3: 'bg-orange-100 text-orange-800',
    type4: 'bg-purple-100 text-purple-800',
    type5: 'bg-red-100 text-red-800',
  },
}, ProblemDetail)
