'use client'

import LessonAppHeader from '@/components/math/shared/LessonAppHeader'
import type { ProblemSet } from '@/utils/type'
import { useLesson36 } from './Lesson36Provider'

const CONFIG = {
  basePath: '/math/ny/36',
  emoji: '📅',
  titleShort: '星期几',
  titleFull: '问题探险',
  titleColor: 'text-app-blue-dark',
  navActiveColor: 'text-app-blue-dark',
  navActiveBorderColor: '#3b82f6',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson36} />
}
