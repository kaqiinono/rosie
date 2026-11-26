'use client'

import type { ProblemSet } from '@rosie/core'
import LessonAppHeader from '@rosie/math-kit/components/shared/LessonAppHeader'
import { useG2Lesson15 } from './G2Lesson15Provider'

const CONFIG = {
  basePath: '/math/ny/2/15',
  emoji: '📐',
  titleShort: '几何图形认知',
  titleFull: '几何图形认知',
  titleColor: 'text-teal-700',
  navActiveColor: 'text-teal-700',
  navActiveBorderColor: '#0f766e',
} as const
export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useG2Lesson15} />
}
