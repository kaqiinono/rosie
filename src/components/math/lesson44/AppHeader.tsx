'use client'

import LessonAppHeader from '@/components/math/shared/LessonAppHeader'
import type { ProblemSet } from '@/utils/type'
import { useLesson44 } from './Lesson44Provider'

const CONFIG = {
  basePath: '/math/ny/44',
  emoji: '⏱️',
  titleShort: '统筹',
  titleFull: '探险',
  titleColor: 'text-indigo-700',
  navActiveColor: 'text-indigo-700',
  navActiveBorderColor: '#4338ca',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson44} />
}
