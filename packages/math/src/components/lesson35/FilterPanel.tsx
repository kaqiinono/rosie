'use client'

import { createFilterPanel } from '@rosie/math/components/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, PracticeFilter, FilterPanelProps } from '@rosie/math/components/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/35',
  title: '🎯 综合测试题库',
  theme: {
    btnOn:              'border-purple-500 bg-purple-500 text-white',
    btnOff:             'border-purple-300 bg-purple-50 text-purple-800',
    containerBorder:    'border-fuchsia-400',
    containerGradient:  'bg-gradient-to-br from-purple-50 to-purple-100',
    titleColor:         'text-purple-800',
    labelColor:         'text-purple-900',
    toggleColor:        'text-purple-500 hover:text-purple-700',
    progressTrack:      'bg-purple-200',
    progressAttempted:  'bg-purple-300',
    progressMastered:   'bg-purple-500',
    dotColor:           'text-purple-300',
    strongColor:        'text-purple-800',
    srcBadge:           'bg-purple-100 text-purple-800',
    accentClass:        'text-text-secondary',
  },
  sourceBtns: [
    { key: 'lesson',   label: '📖 课堂' },
    { key: 'homework', label: '✏️ 课后' },
    { key: 'workbook', label: '📚 拓展' },
    { key: 'pretest',  label: '📝 课前测' },
  ],
  typeBtns: [
    { key: 'type1', label: '题型1·基础比' },
    { key: 'type2', label: '题型2·连锁比' },
    { key: 'type3', label: '题型3·画线段图' },
    { key: 'type4', label: '题型4·按比分配' },
    { key: 'type5', label: '题型5·变比与不变量' },
  ],
  tagColors: {
    type1: 'bg-purple-100 text-purple-800',
    type2: 'bg-blue-100 text-blue-800',
    type3: 'bg-green-100 text-green-800',
    type4: 'bg-orange-100 text-orange-800',
    type5: 'bg-rose-100 text-rose-800',
  },
}, ProblemDetail)
