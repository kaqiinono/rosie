'use client'

import { createFilterPanel } from '@rosie/math/components/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, PracticeFilter, FilterPanelProps } from '@rosie/math/components/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/1/47',
  title: '🎯 综合题库 · 第47讲',
  theme: {
    btnOn:              'border-fuchsia-600 bg-fuchsia-600 text-white',
    btnOff:             'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700',
    containerBorder:    'border-fuchsia-200',
    containerGradient:  'bg-gradient-to-br from-fuchsia-50 to-[#fae8ff]',
    titleColor:         'text-fuchsia-800',
    labelColor:         'text-fuchsia-700',
    toggleColor:        'text-fuchsia-500 hover:text-fuchsia-700',
    progressTrack:      'bg-fuchsia-100',
    progressAttempted:  'bg-fuchsia-200',
    progressMastered:   'bg-fuchsia-500',
    dotColor:           'text-fuchsia-300',
    strongColor:        'text-fuchsia-800',
    srcBadge:           'bg-fuchsia-100 text-fuchsia-700',
    accentClass:        'text-fuchsia-700',
  },
  sourceBtns: [
    { key: 'lesson',   label: '📖 课堂' },
    { key: 'homework', label: '✏️ 课后' },
    { key: 'workbook', label: '📚 拓展' },
  ],
  typeBtns: [
    { key: 'type1', label: '数连' },
    { key: 'type2', label: '数桥' },
    { key: 'type3', label: '数方' },
    { key: 'type4', label: '不等号数独' },
    { key: 'type5', label: '无马数独' },
    { key: 'type6', label: '窗口数独' },
    { key: 'type7', label: '常规数独' },
    { key: 'type8', label: '对角线数独' },
    { key: 'type9', label: '锯齿数独' },
  ],
  tagColors: {
    type1: 'bg-green-100 text-green-800',
    type2: 'bg-blue-100 text-blue-800',
    type3: 'bg-orange-100 text-orange-800',
    type4: 'bg-purple-100 text-purple-800',
    type5: 'bg-red-100 text-red-800',
    type6: 'bg-pink-100 text-pink-800',
    type7: 'bg-teal-100 text-teal-800',
    type8: 'bg-cyan-100 text-cyan-800',
    type9: 'bg-amber-100 text-amber-800',
  },
}, ProblemDetail)
