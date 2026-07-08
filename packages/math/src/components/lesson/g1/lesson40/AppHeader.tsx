'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useG1Lesson40 } from './G1Lesson40Provider'

const CONFIG = {
  basePath: '/math/ny/1/40',
  emoji: '📐',
  titleShort: '周长',
  titleFull: '一圈有多长',
  titleColor: 'text-green-700',
  navActiveColor: 'text-green-700',
  navActiveBorderColor: '#15803d',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useG1Lesson40} />
}
