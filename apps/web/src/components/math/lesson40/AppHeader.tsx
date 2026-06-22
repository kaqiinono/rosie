'use client'

import LessonAppHeader from '@/components/math/shared/LessonAppHeader'
import type { ProblemSet } from '@/utils/type'
import { useLesson40 } from './Lesson40Provider'

const CONFIG = {
  basePath: '/math/ny/40',
  emoji: '📐',
  titleShort: '周长',
  titleFull: '一圈有多长',
  titleColor: 'text-green-700',
  navActiveColor: 'text-green-700',
  navActiveBorderColor: '#15803d',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson40} />
}
