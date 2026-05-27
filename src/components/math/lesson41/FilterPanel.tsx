'use client'

import { createFilterPanel } from '@/components/math/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, FilterPanelProps } from '@/components/math/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/41',
  title: '🎯 综合题库 · 第41讲',
  theme: {
    btnOn:              'border-sky-600 bg-sky-600 text-white',
    btnOff:             'border-sky-300 bg-[#f0f9ff] text-sky-700',
    containerBorder:    'border-sky-200',
    containerGradient:  'bg-gradient-to-br from-[#f0f9ff] to-[#e0f2fe]',
    titleColor:         'text-sky-800',
    labelColor:         'text-sky-700',
    toggleColor:        'text-sky-500 hover:text-sky-700',
    progressTrack:      'bg-sky-100',
    progressAttempted:  'bg-sky-200',
    progressMastered:   'bg-sky-500',
    dotColor:           'text-sky-300',
    strongColor:        'text-sky-800',
    srcBadge:           'bg-[#e0f2fe] text-[#0369a1]',
    accentClass:        'text-sky-700',
  },
  sourceBtns: [
    { key: 'pretest',  label: '📝 课前测' },
    { key: 'lesson',   label: '📖 课堂' },
    { key: 'homework', label: '✏️ 课后' },
    { key: 'workbook', label: '📚 拓展' },
  ],
  typeBtns: [
    { key: 'type1', label: '题型1·锯木头' },
    { key: 'type2', label: '题型2·爬楼梯' },
    { key: 'type3', label: '题型3·敲钟' },
    { key: 'type4', label: '题型4·圆形队列' },
  ],
  tagColors: {
    type1: 'bg-orange-100 text-orange-800',
    type2: 'bg-green-100 text-green-800',
    type3: 'bg-purple-100 text-purple-800',
    type4: 'bg-blue-100 text-blue-800',
  },
}, ProblemDetail)
