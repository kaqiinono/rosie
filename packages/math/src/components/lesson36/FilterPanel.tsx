'use client'

import { createFilterPanel } from '@rosie/math/components/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, FilterPanelProps } from '@rosie/math/components/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/36',
  title: '🎯 综合测试题库',
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
    { key: 'lesson',   label: '📖 课堂' },
    { key: 'homework', label: '✏️ 课后' },
    { key: 'workbook', label: '📚 拓展' },
    { key: 'pretest',  label: '📝 课前测' },
  ],
  typeBtns: [
    { key: 'type1', label: '招式1·同月推算' },
    { key: 'type2', label: '招式2·跨月推算' },
    { key: 'type3', label: '招式3·跨年同月同日' },
    { key: 'type4', label: '招式4·跨年跨月' },
    { key: 'type5', label: '招式5·确定星期几' },
    { key: 'type6', label: '招式6·日期总和反推' },
  ],
  tagColors: {
    type1: 'bg-blue-100 text-blue-800',
    type2: 'bg-pink-100 text-pink-800',
    type3: 'bg-green-100 text-green-800',
    type4: 'bg-amber-100 text-amber-700',
    type5: 'bg-purple-100 text-purple-800',
    type6: 'bg-orange-100 text-orange-700',
  },
}, ProblemDetail)
