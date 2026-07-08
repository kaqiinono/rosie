'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG1Lesson43 } from './G1Lesson43Provider'

const CONFIG = {
  basePath: '/math/ny/1/43',
  activeColor: 'text-cyan-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG1Lesson43} />
}
