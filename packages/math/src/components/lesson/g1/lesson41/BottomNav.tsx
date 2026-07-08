'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG1Lesson41 } from './G1Lesson41Provider'

const CONFIG = {
  basePath: '/math/ny/1/41',
  activeColor: 'text-sky-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG1Lesson41} />
}
