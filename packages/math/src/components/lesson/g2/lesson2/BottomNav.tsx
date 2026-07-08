'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG2Lesson2 } from './G2Lesson2Provider'

const CONFIG = {
  basePath: '/math/ny/2/2',
  activeColor: 'text-teal-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG2Lesson2} />
}
