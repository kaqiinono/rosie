'use client'

import LessonAppHeader from '@/components/math/shared/LessonAppHeader'
import type { ProblemSet } from '@/utils/type'
import { useLesson38 } from './Lesson38Provider'

const CONFIG = {
  basePath: '/math/ny/38',
  emoji: '✏️',
  titleShort: '一笔画',
  titleFull: '探险',
  titleColor: 'text-purple-700',
  navActiveColor: 'text-purple-700',
  navActiveBorderColor: '#7c3aed',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson38} />
}
