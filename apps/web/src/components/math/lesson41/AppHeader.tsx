'use client'

import LessonAppHeader from '@/components/math/shared/LessonAppHeader'
import type { ProblemSet } from '@/utils/type'
import { useLesson41 } from './Lesson41Provider'

const CONFIG = {
  basePath: '/math/ny/41',
  emoji: '✂️',
  titleShort: '间隔',
  titleFull: '探险',
  titleColor: 'text-sky-700',
  navActiveColor: 'text-sky-700',
  navActiveBorderColor: '#0369a1',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson41} />
}
