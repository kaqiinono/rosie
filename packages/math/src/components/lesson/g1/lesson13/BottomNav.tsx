'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG1Lesson13 } from './G1Lesson13Provider'

const CONFIG = {
  basePath: '/math/ny/1/13',
  activeColor: 'text-green-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG1Lesson13} />
}
