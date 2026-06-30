'use client'

import { createFilterPanel } from '@rosie/math/components/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, PracticeFilter, FilterPanelProps } from '@rosie/math/components/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/34',
  title: '🎯 综合测试题库',
  theme: {
    btnOn:              'border-amber-500 bg-amber-500 text-white',
    btnOff:             'border-amber-300 bg-amber-50 text-amber-700',
    containerBorder:    'border-[#fcd34d]',
    containerGradient:  'bg-gradient-to-br from-[#fffbeb] to-amber-50',
    titleColor:         'text-amber-800',
    labelColor:         'text-amber-700',
    toggleColor:        'text-amber-500 hover:text-amber-700',
    progressTrack:      'bg-amber-100',
    progressAttempted:  'bg-amber-200',
    progressMastered:   'bg-amber-500',
    dotColor:           'text-amber-300',
    strongColor:        'text-amber-800',
    srcBadge:           'bg-[#f3e8ff] text-[#7e22ce]',
    accentClass:        'text-text-secondary',
  },
  sourceBtns: [
    { key: 'lesson',     label: '📖 课堂' },
    { key: 'homework',   label: '✏️ 课后' },
    { key: 'workbook',   label: '📚 拓展' },
    { key: 'supplement', label: '📒 补充题' },
    { key: 'pretest',    label: '📝 课前测' },
  ],
  typeBtns: [
    { key: 'type1', label: '招式1·凑整法' },
    { key: 'type2', label: '招式2·乘法分配律' },
  ],
  tagColors: {
    type1: 'bg-amber-100 text-amber-800',
    type2: 'bg-green-100 text-green-800',
  },
}, ProblemDetail)
