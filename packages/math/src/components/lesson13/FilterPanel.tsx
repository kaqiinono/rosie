'use client'

import { createFilterPanel } from '@rosie/math/components/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, PracticeFilter, FilterPanelProps } from '@rosie/math/components/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/1/13',
  title: '🎯 综合题库 · 第13讲',
  theme: {
    btnOn:              'border-green-600 bg-green-600 text-white',
    btnOff:             'border-green-300 bg-green-50 text-green-700',
    containerBorder:    'border-green-200',
    containerGradient:  'bg-gradient-to-br from-green-50 to-[#dcfce7]',
    titleColor:         'text-green-800',
    labelColor:         'text-green-700',
    toggleColor:        'text-green-500 hover:text-green-700',
    progressTrack:      'bg-green-100',
    progressAttempted:  'bg-green-200',
    progressMastered:   'bg-green-500',
    dotColor:           'text-green-300',
    strongColor:        'text-green-800',
    srcBadge:           'bg-green-100 text-green-700',
    accentClass:        'text-green-700',
  },
  sourceBtns: [
    { key: 'pretest',  label: '📝 课前测' },
    { key: 'lesson',   label: '📖 课堂' },
    { key: 'homework', label: '✏️ 课后' },
    { key: 'workbook', label: '📚 拓展' },
  ],
  typeBtns: [
    { key: 'type1', label: '题型1·两端都种' },
    { key: 'type2', label: '题型2·一端不种' },
    { key: 'type3', label: '题型3·两端不种' },
    { key: 'type4', label: '题型4·封闭型' },
    { key: 'type5', label: '题型5·行程速度' },
  ],
  tagColors: {
    type1: 'bg-green-100 text-green-800',
    type2: 'bg-blue-100 text-blue-800',
    type3: 'bg-orange-100 text-orange-800',
    type4: 'bg-purple-100 text-purple-800',
    type5: 'bg-red-100 text-red-800',
  },
}, ProblemDetail)
