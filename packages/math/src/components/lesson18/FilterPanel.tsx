'use client'

import { createFilterPanel } from '@rosie/math/components/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, FilterPanelProps } from '@rosie/math/components/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/18',
  title: '🎯 综合题库 · 第18讲',
  theme: {
    btnOn:              'border-purple-600 bg-purple-600 text-white',
    btnOff:             'border-purple-300 bg-purple-50 text-purple-700',
    containerBorder:    'border-purple-200',
    containerGradient:  'bg-gradient-to-br from-purple-50 to-[#ede9fe]',
    titleColor:         'text-purple-800',
    labelColor:         'text-purple-700',
    toggleColor:        'text-purple-500 hover:text-purple-700',
    progressTrack:      'bg-purple-100',
    progressAttempted:  'bg-purple-200',
    progressMastered:   'bg-purple-500',
    dotColor:           'text-purple-300',
    strongColor:        'text-purple-800',
    srcBadge:           'bg-purple-100 text-purple-700',
    accentClass:        'text-purple-700',
  },
  sourceBtns: [
    { key: 'pretest',  label: '📝 课前测' },
    { key: 'lesson',   label: '📖 课堂' },
    { key: 'homework', label: '✏️ 课后' },
    { key: 'workbook', label: '📚 练习册' },
  ],
  typeBtns: [
    { key: 'type1', label: '题型1·和倍问题' },
    { key: 'type2', label: '题型2·和倍变形' },
    { key: 'type3', label: '题型3·差倍问题' },
    { key: 'type4', label: '题型4·差倍变形' },
    { key: 'type5', label: '题型5·移动变倍' },
    { key: 'type6', label: '题型6·三量和倍' },
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
