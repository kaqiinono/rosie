'use client'

import { createFilterPanel } from '@rosie/math/components/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, FilterPanelProps } from '@rosie/math/components/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/2/2',
  title: '🎯 综合题库 · 第50讲',
  theme: {
    btnOn: 'border-teal-600 bg-teal-600 text-white',
    btnOff: 'border-teal-300 bg-teal-50 text-teal-700',
    containerBorder: 'border-teal-200',
    containerGradient: 'bg-gradient-to-br from-teal-50 to-emerald-50',
    titleColor: 'text-teal-800',
    labelColor: 'text-teal-700',
    toggleColor: 'text-teal-500 hover:text-teal-700',
    progressTrack: 'bg-teal-100',
    progressAttempted: 'bg-teal-200',
    progressMastered: 'bg-teal-500',
    dotColor: 'text-teal-300',
    strongColor: 'text-teal-800',
    srcBadge: 'bg-teal-100 text-teal-800',
    accentClass: 'text-teal-700',
  },
  sourceBtns: [
    { key: 'pretest', label: '📝 课前测' },
    { key: 'lesson', label: '📖 课堂' },
    { key: 'homework', label: '✏️ 课后' },
    { key: 'supplement', label: '📒 附加' },
  ],
  typeBtns: [
    { key: 'type1', label: '题型1·归一问题' },
    { key: 'type2', label: '题型2·等量代换' },
    { key: 'type3', label: '题型3·分组统计' },
    { key: 'type4', label: '题型4·位置推理' },
    { key: 'type5', label: '题型5·逻辑综合' },
  ],
  tagColors: {
    type1: 'bg-blue-100 text-blue-800',
    type2: 'bg-green-100 text-green-800',
    type3: 'bg-orange-100 text-orange-800',
    type4: 'bg-purple-100 text-purple-800',
    type5: 'bg-red-100 text-red-800',
  },
}, ProblemDetail)
