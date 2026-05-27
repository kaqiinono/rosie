'use client'

import { createFilterPanel } from '@/components/math/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, FilterPanelProps } from '@/components/math/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/43',
  title: '🎯 综合题库 · 第43讲',
  theme: {
    btnOn:              'border-cyan-600 bg-cyan-600 text-white',
    btnOff:             'border-cyan-300 bg-cyan-50 text-cyan-700',
    containerBorder:    'border-cyan-200',
    containerGradient:  'bg-gradient-to-br from-cyan-50 to-[#cffafe]',
    titleColor:         'text-cyan-800',
    labelColor:         'text-cyan-700',
    toggleColor:        'text-cyan-500 hover:text-cyan-700',
    progressTrack:      'bg-cyan-100',
    progressAttempted:  'bg-cyan-200',
    progressMastered:   'bg-cyan-500',
    dotColor:           'text-cyan-300',
    strongColor:        'text-cyan-800',
    srcBadge:           'bg-cyan-100 text-cyan-700',
    accentClass:        'text-cyan-700',
  },
  sourceBtns: [
    { key: 'pretest',    label: '📝 课前测' },
    { key: 'lesson',     label: '📖 课堂' },
    { key: 'homework',   label: '✏️ 课后' },
    { key: 'workbook',   label: '📚 拓展' },
    { key: 'supplement', label: '📒 附加' },
  ],
  typeBtns: [
    { key: 'type1', label: '题型1·求第几项' },
    { key: 'type2', label: '题型2·求项数' },
    { key: 'type3', label: '题型3·公差首末' },
    { key: 'type4', label: '题型4·数列应用' },
    { key: 'type5', label: '题型5·数列求和' },
    { key: 'type6', label: '题型6·综合规律' },
  ],
  tagColors: {
    type1: 'bg-blue-100 text-blue-800',
    type2: 'bg-green-100 text-green-800',
    type3: 'bg-orange-100 text-orange-800',
    type4: 'bg-purple-100 text-purple-800',
    type5: 'bg-red-100 text-red-800',
    type6: 'bg-pink-100 text-pink-800',
  },
}, ProblemDetail)
