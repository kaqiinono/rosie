'use client'

import { createFilterPanel } from '@rosie/math/components/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, PracticeFilter, FilterPanelProps } from '@rosie/math/components/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/1/29',
  title: '🎯 综合题库 · 第29讲',
  theme: {
    btnOn:              'border-rose-600 bg-rose-600 text-white',
    btnOff:             'border-rose-300 bg-rose-50 text-rose-700',
    containerBorder:    'border-rose-200',
    containerGradient:  'bg-gradient-to-br from-rose-50 to-[#ffe4e6]',
    titleColor:         'text-rose-800',
    labelColor:         'text-rose-700',
    toggleColor:        'text-rose-500 hover:text-rose-700',
    progressTrack:      'bg-rose-100',
    progressAttempted:  'bg-rose-200',
    progressMastered:   'bg-rose-500',
    dotColor:           'text-rose-300',
    strongColor:        'text-rose-800',
    srcBadge:           'bg-rose-100 text-rose-700',
    accentClass:        'text-rose-700',
  },
  sourceBtns: [
    { key: 'lesson',   label: '📖 课堂' },
    { key: 'homework', label: '✏️ 课后' },
  ],
  typeBtns: [
    { key: 'type1', label: '题型1·填四则运算符' },
    { key: 'type2', label: '题型2·24点游戏' },
    { key: 'type3', label: '题型3·奇偶填+/−' },
    { key: 'type4', label: '题型4·凑数逆推' },
  ],
  tagColors: {
    type1: 'bg-orange-100 text-orange-800',
    type2: 'bg-blue-100 text-blue-800',
    type3: 'bg-green-100 text-green-800',
    type4: 'bg-purple-100 text-purple-800',
  },
}, ProblemDetail)
