'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useG1Lesson41 } from './G1Lesson41Provider'

const CONFIG = {
  basePath: '/math/ny/1/41',
  emoji: '✂️',
  titleShort: '间隔',
  titleFull: '探险',
  titleColor: 'text-sky-700',
  navActiveColor: 'text-sky-700',
  navActiveBorderColor: '#0369a1',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useG1Lesson41} />
}
