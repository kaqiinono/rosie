'use client'

import LessonAppHeader from '@/components/math/shared/LessonAppHeader'
import type { ProblemSet } from '@/utils/type'
import { useLesson34 } from './Lesson34Provider'

const CONFIG = {
  basePath: '/math/ny/34',
  emoji: '🧮',
  titleShort: '乘除巧算',
  titleFull: '探险',
  titleColor: 'text-amber-700',
  navActiveColor: 'text-amber-700',
  navActiveBorderColor: '#b45309',
  backIcon: <span className="text-[13px] font-semibold leading-none">←</span>,
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson34} />
}
