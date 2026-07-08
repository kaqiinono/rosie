'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG1Lesson39 } from './G1Lesson39Provider'

const CONFIG = {
  basePath: '/math/ny/1/39',
  activeColor: 'text-amber-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG1Lesson39} />
}
