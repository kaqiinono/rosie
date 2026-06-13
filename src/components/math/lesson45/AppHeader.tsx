'use client'

import LessonAppHeader from '@/components/math/shared/LessonAppHeader'
import type { ProblemSet } from '@/utils/type'
import { useLesson45 } from './Lesson45Provider'

const CONFIG = {
  basePath: '/math/ny/45',
  emoji: '🔥',
  titleShort: '火柴',
  titleFull: '探险',
  titleColor: 'text-orange-700',
  navActiveColor: 'text-orange-700',
  navActiveBorderColor: '#c2410c',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson45} />
}
