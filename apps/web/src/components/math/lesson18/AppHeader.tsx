'use client'

import LessonAppHeader from '@/components/math/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useLesson18 } from './Lesson18Provider'

const CONFIG = {
  basePath: '/math/ny/18',
  emoji: '✖️',
  titleShort: '和差倍',
  titleFull: '问题',
  titleColor: 'text-purple-700',
  navActiveColor: 'text-purple-700',
  navActiveBorderColor: '#9333ea',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson18} />
}
