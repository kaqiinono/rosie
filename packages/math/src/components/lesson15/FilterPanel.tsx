'use client'

import { createFilterPanel } from '@rosie/math/components/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, FilterPanelProps } from '@rosie/math/components/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/15',
  title: '🎯 综合题库 · 第15讲',
  theme: {
    btnOn:              'border-sky-600 bg-sky-600 text-white',
    btnOff:             'border-sky-300 bg-sky-50 text-sky-700',
    containerBorder:    'border-sky-200',
    containerGradient:  'bg-gradient-to-br from-sky-50 to-[#e0f2fe]',
    titleColor:         'text-sky-800',
    labelColor:         'text-sky-700',
    toggleColor:        'text-sky-500 hover:text-sky-700',
    progressTrack:      'bg-sky-100',
    progressAttempted:  'bg-sky-200',
    progressMastered:   'bg-sky-500',
    dotColor:           'text-sky-300',
    strongColor:        'text-sky-800',
    srcBadge:           'bg-sky-100 text-sky-700',
    accentClass:        'text-sky-700',
  },
  sourceBtns: [
    { key: 'pretest',  label: '📝 课前测' },
    { key: 'lesson',   label: '📖 课堂' },
    { key: 'homework', label: '✏️ 课后' },
    { key: 'workbook', label: '📚 拓展' },
  ],
  typeBtns: [
    { key: 'type1', label: '题型1·基本和差' },
    { key: 'type2', label: '题型2·时间匹配' },
    { key: 'type3', label: '题型3·平均数变形' },
    { key: 'type4', label: '题型4·移多补少' },
    { key: 'type5', label: '题型5·双向变化' },
  ],
  tagColors: {
    type1: 'bg-blue-100 text-blue-800',
    type2: 'bg-green-100 text-green-800',
    type3: 'bg-orange-100 text-orange-800',
    type4: 'bg-purple-100 text-purple-800',
    type5: 'bg-red-100 text-red-800',
  },
}, ProblemDetail)
