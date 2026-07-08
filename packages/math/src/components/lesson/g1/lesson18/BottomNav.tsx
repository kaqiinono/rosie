'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG1Lesson18 } from './G1Lesson18Provider'

const CONFIG = {
  basePath: '/math/ny/1/18',
  activeColor: 'text-purple-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG1Lesson18} />
}
