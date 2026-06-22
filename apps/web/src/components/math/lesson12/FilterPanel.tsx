'use client'

import { createFilterPanel } from '@/components/math/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, FilterPanelProps } from '@/components/math/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/12',
  title: '🎯 综合题库 · 第12讲',
  theme: {
    btnOn:              'border-orange-600 bg-orange-600 text-white',
    btnOff:             'border-orange-300 bg-orange-50 text-orange-700',
    containerBorder:    'border-orange-200',
    containerGradient:  'bg-gradient-to-br from-orange-50 to-[#ffedd5]',
    titleColor:         'text-orange-800',
    labelColor:         'text-orange-700',
    toggleColor:        'text-orange-500 hover:text-orange-700',
    progressTrack:      'bg-orange-100',
    progressAttempted:  'bg-orange-200',
    progressMastered:   'bg-orange-500',
    dotColor:           'text-orange-300',
    strongColor:        'text-orange-800',
    srcBadge:           'bg-orange-100 text-orange-700',
    accentClass:        'text-orange-700',
  },
  sourceBtns: [
    { key: 'pretest',  label: '📝 课前测' },
    { key: 'lesson',   label: '📖 课堂' },
    { key: 'homework', label: '✏️ 课后' },
    { key: 'workbook', label: '📚 拓展' },
  ],
  typeBtns: [
    { key: 'type1', label: '题型1·凑整法' },
    { key: 'type2', label: '题型2·花减法' },
    { key: 'type3', label: '题型3·括号法' },
    { key: 'type4', label: '题型4·归整法' },
    { key: 'type5', label: '题型5·等差求和' },
  ],
  tagColors: {
    type1: 'bg-orange-100 text-orange-800',
    type2: 'bg-red-100 text-red-800',
    type3: 'bg-blue-100 text-blue-800',
    type4: 'bg-purple-100 text-purple-800',
    type5: 'bg-green-100 text-green-800',
  },
}, ProblemDetail)
