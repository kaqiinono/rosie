'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG1Lesson35 } from './G1Lesson35Provider'

const CONFIG = {
  basePath: '/math/ny/1/35',
  activeColor: 'text-yellow-dark',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG1Lesson35} />
}
