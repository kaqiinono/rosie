'use client'

import LessonAppHeader from '@/components/math/shared/LessonAppHeader'
import type { ProblemSet } from '@/utils/type'
import { useLesson37 } from './Lesson37Provider'

const CONFIG = {
  basePath: '/math/ny/37',
  emoji: '🐔',
  titleShort: '鸡兔同笼',
  titleFull: '假设法探险',
  titleColor: 'text-blue-700',
  navActiveColor: 'text-blue-700',
  navActiveBorderColor: '#3b82f6',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson37} />
}
