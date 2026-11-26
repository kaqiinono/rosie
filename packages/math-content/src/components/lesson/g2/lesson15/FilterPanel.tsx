'use client'

import { createFilterPanel } from '@rosie/math-kit/components/shared/FilterPanel'
import { LESSON_SOURCE_BTNS } from '@rosie/math-kit/utils/lesson-source-btns'
import { PROBLEM_TYPES, TAG_STYLE } from '../../../../utils/g2/lesson15-data'
import ProblemDetail from './ProblemDetail'

export type {
  Filters,
  MasteryFilter,
  FilterPanelProps,
} from '@rosie/math-kit/components/shared/FilterPanel'
export default createFilterPanel(
  {
    base: '/math/ny/2/15',
    title: '🎯 综合题库 · 第15讲',
    theme: {
      btnOn: 'border-teal-600 bg-teal-600 text-white',
      btnOff: 'border-teal-300 bg-teal-50 text-teal-700',
      containerBorder: 'border-teal-200',
      containerGradient: 'bg-teal-50',
      titleColor: 'text-teal-800',
      labelColor: 'text-teal-700',
      toggleColor: 'text-teal-500 hover:text-teal-700',
      progressTrack: 'bg-teal-100',
      progressAttempted: 'bg-teal-200',
      progressMastered: 'bg-teal-500',
      dotColor: 'text-teal-300',
      strongColor: 'text-teal-800',
      srcBadge: 'bg-teal-100 text-teal-800',
      accentClass: 'text-teal-700',
    },
    sourceBtns: LESSON_SOURCE_BTNS['2-15'],
    typeBtns: PROBLEM_TYPES.map((type) => ({ key: type.tag, label: `${type.icon} ${type.label}` })),
    tagColors: TAG_STYLE,
  },
  ProblemDetail,
)
