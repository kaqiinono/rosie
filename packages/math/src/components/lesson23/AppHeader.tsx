'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useLesson23 } from './Lesson23Provider'

const CONFIG = {
  basePath: '/math/ny/23',
  emoji: '🔍',
  titleShort: '逻辑',
  titleFull: '推理',
  titleColor: 'text-violet-700',
  navActiveColor: 'text-violet-700',
  navActiveBorderColor: '#7c3aed',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson23} />
}
