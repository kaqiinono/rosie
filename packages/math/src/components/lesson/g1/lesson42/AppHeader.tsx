'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useG1Lesson42 } from './G1Lesson42Provider'

const CONFIG = {
  basePath: '/math/ny/1/42',
  emoji: '🧠',
  titleShort: '智力',
  titleFull: '挑战',
  titleColor: 'text-rose-700',
  navActiveColor: 'text-rose-700',
  navActiveBorderColor: '#be123c',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useG1Lesson42} />
}
