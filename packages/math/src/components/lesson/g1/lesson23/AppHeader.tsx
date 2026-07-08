'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useG1Lesson23 } from './G1Lesson23Provider'

const CONFIG = {
  basePath: '/math/ny/1/23',
  emoji: '🔍',
  titleShort: '逻辑',
  titleFull: '推理',
  titleColor: 'text-violet-700',
  navActiveColor: 'text-violet-700',
  navActiveBorderColor: '#7c3aed',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useG1Lesson23} />
}
