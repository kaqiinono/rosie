'use client'

import LessonAppHeader from '@/components/math/shared/LessonAppHeader'
import type { ProblemSet } from '@/utils/type'
import { useLesson39 } from './Lesson39Provider'

const CONFIG = {
  basePath: '/math/ny/39',
  emoji: '⚖️',
  titleShort: '盈亏',
  titleFull: '探险',
  titleColor: 'text-amber-700',
  navActiveColor: 'text-amber-700',
  navActiveBorderColor: '#b45309',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson39} />
}
