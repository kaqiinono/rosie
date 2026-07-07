'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useLesson47 } from './Lesson47Provider'

const CONFIG = {
  basePath: '/math/ny/1/47',
  emoji: '🧩',
  titleShort: '方格',
  titleFull: '秘密',
  titleColor: 'text-fuchsia-700',
  navActiveColor: 'text-fuchsia-700',
  navActiveBorderColor: '#a21caf',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson47} />
}
