'use client'

import { createFilterPanel } from '@/components/math/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, FilterPanelProps } from '@/components/math/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/23',
  title: '🎯 综合题库 · 第23讲',
  theme: {
    btnOn:              'border-violet-600 bg-violet-600 text-white',
    btnOff:             'border-violet-300 bg-violet-50 text-violet-700',
    containerBorder:    'border-violet-200',
    containerGradient:  'bg-gradient-to-br from-violet-50 to-[#ede9fe]',
    titleColor:         'text-violet-800',
    labelColor:         'text-violet-700',
    toggleColor:        'text-violet-500 hover:text-violet-700',
    progressTrack:      'bg-violet-100',
    progressAttempted:  'bg-violet-200',
    progressMastered:   'bg-violet-500',
    dotColor:           'text-violet-300',
    strongColor:        'text-violet-800',
    srcBadge:           'bg-violet-100 text-violet-700',
    accentClass:        'text-violet-700',
  },
  sourceBtns: [
    { key: 'pretest',  label: '📝 课前测' },
    { key: 'lesson',   label: '📖 课堂' },
    { key: 'homework', label: '✏️ 课后' },
    { key: 'workbook', label: '📚 练习册' },
  ],
  typeBtns: [
    { key: 'type1', label: '题型1·排除法' },
    { key: 'type2', label: '题型2·关系对应' },
    { key: 'type3', label: '题型3·假设验证' },
    { key: 'type4', label: '题型4·双半真' },
    { key: 'type5', label: '题型5·复合逻辑' },
  ],
  tagColors: {
    type1: 'bg-blue-100 text-blue-800',
    type2: 'bg-green-100 text-green-800',
    type3: 'bg-orange-100 text-orange-800',
    type4: 'bg-purple-100 text-purple-800',
    type5: 'bg-red-100 text-red-800',
  },
}, ProblemDetail)
