'use client'

import { createFilterPanel } from '@/components/math/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, FilterPanelProps } from '@/components/math/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/42',
  title: '🎯 综合题库 · 第42讲',
  theme: {
    btnOn:              'border-rose-600 bg-rose-600 text-white',
    btnOff:             'border-rose-300 bg-rose-50 text-rose-700',
    containerBorder:    'border-rose-200',
    containerGradient:  'bg-gradient-to-br from-rose-50 to-[#fee2e2]',
    titleColor:         'text-rose-800',
    labelColor:         'text-rose-700',
    toggleColor:        'text-rose-500 hover:text-rose-700',
    progressTrack:      'bg-rose-100',
    progressAttempted:  'bg-rose-200',
    progressMastered:   'bg-rose-500',
    dotColor:           'text-rose-300',
    strongColor:        'text-rose-800',
    srcBadge:           'bg-rose-100 text-rose-700',
    accentClass:        'text-rose-700',
  },
  sourceBtns: [
    { key: 'pretest',    label: '📝 课前测' },
    { key: 'lesson',     label: '📖 课堂' },
    { key: 'homework',   label: '✏️ 课后' },
    { key: 'workbook',   label: '📚 拓展' },
    { key: 'supplement', label: '📒 附加' },
  ],
  typeBtns: [
    { key: 'type1', label: '题型1·砝码称重' },
    { key: 'type2', label: '题型2·公平分账' },
    { key: 'type3', label: '题型3·空瓶换水' },
    { key: 'type4', label: '题型4·计时量水' },
    { key: 'type5', label: '题型5·天平找异物' },
    { key: 'type6', label: '题型6·综合策略' },
  ],
  tagColors: {
    type1: 'bg-rose-100 text-rose-800',
    type2: 'bg-amber-100 text-amber-800',
    type3: 'bg-green-100 text-green-800',
    type4: 'bg-sky-100 text-sky-800',
    type5: 'bg-purple-100 text-purple-800',
    type6: 'bg-teal-100 text-teal-800',
  },
}, ProblemDetail)
