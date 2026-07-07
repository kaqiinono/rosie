'use client'

import { createFilterPanel } from '@rosie/math/components/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, FilterPanelProps } from '@rosie/math/components/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/2/1',
  title: '🎯 综合题库 · 第49讲',
  theme: {
    btnOn: 'border-indigo-600 bg-indigo-600 text-white',
    btnOff: 'border-indigo-300 bg-[#eef2ff] text-indigo-700',
    containerBorder: 'border-indigo-200',
    containerGradient: 'bg-gradient-to-br from-[#eef2ff] to-[#e0e7ff]',
    titleColor: 'text-indigo-800',
    labelColor: 'text-indigo-700',
    toggleColor: 'text-indigo-500 hover:text-indigo-700',
    progressTrack: 'bg-indigo-100',
    progressAttempted: 'bg-indigo-200',
    progressMastered: 'bg-indigo-500',
    dotColor: 'text-indigo-300',
    strongColor: 'text-indigo-800',
    srcBadge: 'bg-[#e0e7ff] text-[#4338ca]',
    accentClass: 'text-indigo-700',
  },
  sourceBtns: [
    { key: 'lesson', label: '📖 课堂' },
    { key: 'homework', label: '✏️ 课后' },
    { key: 'supplement', label: '📒 附加' },
  ],
  typeBtns: [
    { key: 'type1', label: '题型1·交换律结合律' },
    { key: 'type2', label: '题型2·去括号' },
    { key: 'type3', label: '题型3·按位相加' },
    { key: 'type4', label: '题型4·基准数' },
    { key: 'type5', label: '题型5·综合挑战' },
  ],
  tagColors: {
    type1: 'bg-blue-100 text-blue-800',
    type2: 'bg-green-100 text-green-800',
    type3: 'bg-orange-100 text-orange-800',
    type4: 'bg-purple-100 text-purple-800',
    type5: 'bg-red-100 text-red-800',
  },
}, ProblemDetail)
