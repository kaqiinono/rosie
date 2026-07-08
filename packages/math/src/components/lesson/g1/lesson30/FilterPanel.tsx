'use client'

import { createFilterPanel } from '@rosie/math/components/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, PracticeFilter, FilterPanelProps } from '@rosie/math/components/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/1/30',
  title: '🎯 综合题库 · 第30讲',
  theme: {
    btnOn:              'border-amber-600 bg-amber-600 text-white',
    btnOff:             'border-amber-300 bg-amber-50 text-amber-700',
    containerBorder:    'border-amber-200',
    containerGradient:  'bg-gradient-to-br from-amber-50 to-[#fef3c7]',
    titleColor:         'text-amber-800',
    labelColor:         'text-amber-700',
    toggleColor:        'text-amber-500 hover:text-amber-700',
    progressTrack:      'bg-amber-100',
    progressAttempted:  'bg-amber-200',
    progressMastered:   'bg-amber-500',
    dotColor:           'text-amber-300',
    strongColor:        'text-amber-800',
    srcBadge:           'bg-amber-100 text-amber-700',
    accentClass:        'text-amber-700',
  },
  sourceBtns: [
    { key: 'pretest',  label: '📝 课前测' },
    { key: 'lesson',   label: '📖 课堂' },
    { key: 'workbook', label: '📚 拓展' },
  ],
  typeBtns: [
    { key: 'type1', label: '题型1·特殊和差' },
    { key: 'type2', label: '题型2·三量和差' },
    { key: 'type3', label: '题型3·三量和倍' },
    { key: 'type4', label: '题型4·三量差倍' },
    { key: 'type5', label: '题型5·特殊变形' },
    { key: 'type6', label: '题型6·综合变形' },
  ],
  tagColors: {
    type1: 'bg-orange-100 text-orange-800',
    type2: 'bg-blue-100 text-blue-800',
    type3: 'bg-green-100 text-green-800',
    type4: 'bg-purple-100 text-purple-800',
    type5: 'bg-red-100 text-red-800',
    type6: 'bg-pink-100 text-pink-800',
  },
}, ProblemDetail)
