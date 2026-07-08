'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG1Lesson30 } from './G1Lesson30Provider'

const CONFIG = {
  basePath: '/math/ny/1/30',
  activeColor: 'text-amber-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG1Lesson30} />
}
