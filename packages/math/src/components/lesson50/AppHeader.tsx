'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useLesson50 } from './Lesson50Provider'

const CONFIG = {
  basePath: '/math/ny/50',
  emoji: '⚖️',
  titleShort: '归一',
  titleFull: '等量代换',
  titleColor: 'text-teal-700',
  navActiveColor: 'text-teal-700',
  navActiveBorderColor: '#0f766e',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson50} />
}
