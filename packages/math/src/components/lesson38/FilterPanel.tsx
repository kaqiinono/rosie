'use client'

import { createFilterPanel } from '@rosie/math/components/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, FilterPanelProps } from '@rosie/math/components/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/38',
  title: '🎯 综合题库 · 第38讲',
  theme: {
    btnOn:              'border-[#a855f7] bg-[#a855f7] text-white',
    btnOff:             'border-[#d8b4fe] bg-[#fdf4ff] text-[#7e22ce]',
    containerBorder:    'border-[#e879f9]',
    containerGradient:  'bg-gradient-to-br from-[#fdf4ff] to-[#f3e8ff]',
    titleColor:         'text-[#7e22ce]',
    labelColor:         'text-[#6b21a8]',
    toggleColor:        'text-[#9333ea] hover:text-[#6b21a8]',
    progressTrack:      'bg-[#e9d5ff]',
    progressAttempted:  'bg-[#c4b5fd]',
    progressMastered:   'bg-[#a855f7]',
    dotColor:           'text-[#c4b5fd]',
    strongColor:        'text-[#7e22ce]',
    srcBadge:           'bg-[#f3e8ff] text-[#7e22ce]',
    accentClass:        'text-text-secondary',
  },
  sourceBtns: [
    { key: 'pretest',    label: '📝 课前测' },
    { key: 'lesson',     label: '📖 课堂' },
    { key: 'homework',   label: '✏️ 课后' },
    { key: 'workbook',   label: '📚 拓展' },
    { key: 'supplement', label: '📒 附加' },
  ],
  typeBtns: [
    { key: 'type1', label: '题型1·立体棱爬行' },
    { key: 'type2', label: '题型2·平面路线' },
    { key: 'type3', label: '题型3·街道最短路' },
    { key: 'type4', label: '题型4·一笔画判断' },
    { key: 'type5', label: '题型5·欧拉路径' },
    { key: 'type6', label: '题型6·立体最长路' },
    { key: 'type7', label: '题型7·路网最短路' },
  ],
  tagColors: {
    type1: 'bg-orange-100 text-orange-800',
    type2: 'bg-purple-100 text-purple-800',
    type3: 'bg-green-100 text-green-800',
    type4: 'bg-blue-100 text-blue-800',
    type5: 'bg-teal-100 text-teal-800',
    type6: 'bg-pink-100 text-pink-800',
    type7: 'bg-red-100 text-red-800',
  },
}, ProblemDetail)
