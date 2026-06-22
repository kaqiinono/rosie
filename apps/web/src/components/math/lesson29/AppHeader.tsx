'use client'

import LessonAppHeader from '@/components/math/shared/LessonAppHeader'
import type { ProblemSet } from '@/utils/type'
import { useLesson29 } from './Lesson29Provider'

const CONFIG = {
  basePath: '/math/ny/29',
  emoji: '🎮',
  titleShort: '算符',
  titleFull: '大作战',
  titleColor: 'text-rose-700',
  navActiveColor: 'text-rose-700',
  navActiveBorderColor: '#e11d48',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson29} />
}
