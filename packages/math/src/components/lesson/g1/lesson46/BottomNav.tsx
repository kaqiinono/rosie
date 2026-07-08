'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG1Lesson46 } from './G1Lesson46Provider'

const CONFIG = {
  basePath: '/math/ny/1/46',
  activeColor: 'text-teal-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG1Lesson46} />
}
