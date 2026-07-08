'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG1Lesson37 } from './G1Lesson37Provider'

const CONFIG = {
  basePath: '/math/ny/1/37',
  activeColor: 'text-blue-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG1Lesson37} />
}
