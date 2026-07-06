'use client'

import { createFilterPanel } from '@rosie/math/components/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, FilterPanelProps } from '@rosie/math/components/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/53',
  title: '🎯 综合题库 · 第53讲',
  theme: {
    btnOn: 'border-amber-600 bg-amber-600 text-white',
    btnOff: 'border-amber-300 bg-amber-50 text-amber-700',
    containerBorder: 'border-amber-200',
    containerGradient: 'bg-gradient-to-br from-amber-50 to-orange-50',
    titleColor: 'text-amber-800',
    labelColor: 'text-amber-700',
    toggleColor: 'text-amber-500 hover:text-amber-700',
    progressTrack: 'bg-amber-100',
    progressAttempted: 'bg-amber-200',
    progressMastered: 'bg-amber-500',
    dotColor: 'text-amber-300',
    strongColor: 'text-amber-800',
    srcBadge: 'bg-amber-100 text-amber-800',
    accentClass: 'text-amber-700',
  },
  sourceBtns: [
    { key: 'lesson', label: '📖 课堂' },
    { key: 'homework', label: '✏️ 课后' },
    { key: 'supplement', label: '📒 附加' },
  ],
  typeBtns: [
    { key: 'type1', label: '题型1·数列' },
    { key: 'type2', label: '题型2·数表图形' },
    { key: 'type3', label: '题型3·图形编码' },
    { key: 'type4', label: '题型4·综合' },
  ],
  tagColors: {
    type1: 'bg-emerald-100 text-emerald-800',
    type2: 'bg-blue-100 text-blue-800',
    type3: 'bg-orange-100 text-orange-800',
    type4: 'bg-purple-100 text-purple-800',
  },
}, ProblemDetail)
