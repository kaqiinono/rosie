'use client'

import { createFilterPanel } from '@rosie/math-kit/components/shared/FilterPanel'
import { PROBLEM_TYPES, TAG_STYLE } from '@rosie/math-content/utils/g2/lesson9-data'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, FilterPanelProps } from '@rosie/math-kit/components/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/2/9',
  title: '🎯 综合题库 · 第9讲',
  theme: {
    btnOn: 'border-amber-600 bg-amber-600 text-white', btnOff: 'border-amber-300 bg-amber-50 text-amber-700',
    containerBorder: 'border-amber-200', containerGradient: 'bg-gradient-to-br from-amber-50 to-orange-50',
    titleColor: 'text-amber-800', labelColor: 'text-amber-700', toggleColor: 'text-amber-500 hover:text-amber-700',
    progressTrack: 'bg-amber-100', progressAttempted: 'bg-amber-200', progressMastered: 'bg-amber-500',
    dotColor: 'text-amber-300', strongColor: 'text-amber-800', srcBadge: 'bg-amber-100 text-amber-800', accentClass: 'text-amber-700',
  },
  sourceBtns: [
    { key: 'pretest', label: '📝 课前测' },
    { key: 'lesson', label: '📖 课堂' },
    { key: 'homework', label: '✏️ 课后' },
  ],
  typeBtns: PROBLEM_TYPES.map((type) => ({ key: type.tag, label: `${type.icon} ${type.label}` })),
  tagColors: TAG_STYLE,
}, ProblemDetail)
