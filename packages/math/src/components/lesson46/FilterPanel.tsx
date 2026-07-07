'use client'

import { createFilterPanel } from '@rosie/math/components/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, PracticeFilter, FilterPanelProps } from '@rosie/math/components/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/1/46',
  title: '🎯 综合题库 · 第46讲',
  theme: {
    btnOn:              'border-teal-600 bg-teal-600 text-white',
    btnOff:             'border-teal-300 bg-teal-50 text-teal-700',
    containerBorder:    'border-teal-200',
    containerGradient:  'bg-gradient-to-br from-teal-50 to-[#ccfbf1]',
    titleColor:         'text-teal-800',
    labelColor:         'text-teal-700',
    toggleColor:        'text-teal-500 hover:text-teal-700',
    progressTrack:      'bg-teal-100',
    progressAttempted:  'bg-teal-200',
    progressMastered:   'bg-teal-500',
    dotColor:           'text-teal-300',
    strongColor:        'text-teal-800',
    srcBadge:           'bg-teal-100 text-teal-700',
    accentClass:        'text-teal-700',
  },
  sourceBtns: [
    { key: 'pretest',    label: '📝 课前测' },
    { key: 'lesson',     label: '📖 课堂' },
    { key: 'homework',   label: '✏️ 课后' },
    { key: 'workbook',   label: '📚 拓展' },
    { key: 'supplement', label: '📒 附加' },
  ],
  typeBtns: [
    { key: 'type1', label: '题型1·抽屉原理' },
    { key: 'type2', label: '题型2·两个相同' },
    { key: 'type3', label: '题型3·目标出现' },
    { key: 'type4', label: '题型4·种类齐全' },
    { key: 'type5', label: '题型5·保证成双' },
    { key: 'type6', label: '题型6·完全相同' },
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
