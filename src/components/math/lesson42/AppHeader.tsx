'use client'

import LessonAppHeader from '@/components/math/shared/LessonAppHeader'
import type { ProblemSet } from '@/utils/type'
import { useLesson42 } from './Lesson42Provider'

const CONFIG = {
  basePath: '/math/ny/42',
  emoji: '🧠',
  titleShort: '智力',
  titleFull: '挑战',
  titleColor: 'text-rose-700',
  navActiveColor: 'text-rose-700',
  navActiveBorderColor: '#be123c',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson42} />
}
