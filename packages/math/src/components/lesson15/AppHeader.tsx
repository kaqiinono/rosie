'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useLesson15 } from './Lesson15Provider'

const CONFIG = {
  basePath: '/math/ny/1/15',
  emoji: '➕',
  titleShort: '和差',
  titleFull: '问题',
  titleColor: 'text-sky-700',
  navActiveColor: 'text-sky-700',
  navActiveBorderColor: '#0284c7',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson15} />
}
