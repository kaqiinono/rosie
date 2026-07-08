'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG2Lesson5 } from './G2Lesson5Provider'

const CONFIG = {
  basePath: '/math/ny/2/5',
  activeColor: 'text-amber-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG2Lesson5} />
}
