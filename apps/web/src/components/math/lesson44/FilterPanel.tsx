'use client'

import { createFilterPanel } from '@/components/math/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, FilterPanelProps } from '@/components/math/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/44',
  title: '🎯 综合题库 · 第44讲',
  theme: {
    btnOn:              'border-indigo-600 bg-indigo-600 text-white',
    btnOff:             'border-indigo-300 bg-indigo-50 text-indigo-700',
    containerBorder:    'border-indigo-200',
    containerGradient:  'bg-gradient-to-br from-indigo-50 to-[#e0e7ff]',
    titleColor:         'text-indigo-800',
    labelColor:         'text-indigo-700',
    toggleColor:        'text-indigo-500 hover:text-indigo-700',
    progressTrack:      'bg-indigo-100',
    progressAttempted:  'bg-indigo-200',
    progressMastered:   'bg-indigo-500',
    dotColor:           'text-indigo-300',
    strongColor:        'text-indigo-800',
    srcBadge:           'bg-indigo-100 text-indigo-700',
    accentClass:        'text-indigo-700',
  },
  sourceBtns: [
    { key: 'pretest',    label: '📝 课前测' },
    { key: 'lesson',     label: '📖 课堂' },
    { key: 'homework',   label: '✏️ 课后' },
    { key: 'workbook',   label: '📚 拓展' },
    { key: 'supplement', label: '📒 附加' },
  ],
  typeBtns: [
    { key: 'type1', label: '题型1·合理安排' },
    { key: 'type2', label: '题型2·等候最短' },
    { key: 'type3', label: '题型3·刷漆晾晒' },
    { key: 'type4', label: '题型4·过河过桥' },
    { key: 'type5', label: '题型5·烙饼问题' },
    { key: 'type6', label: '题型6·最短路径' },
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
