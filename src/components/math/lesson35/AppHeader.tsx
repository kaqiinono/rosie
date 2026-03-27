'use client'

import LessonAppHeader from '@/components/math/shared/LessonAppHeader'
import type { ProblemSet } from '@/utils/type'
import { useLesson35 } from './Lesson35Provider'

const CONFIG = {
  basePath: '/math/ny/35',
  emoji: '🐦',
  titleShort: '归一',
  titleFull: '问题探险',
  titleColor: 'text-yellow-dark',
  navActiveColor: 'text-yellow-dark',
  navActiveBorderColor: '#f59e0b',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson35} />
}
