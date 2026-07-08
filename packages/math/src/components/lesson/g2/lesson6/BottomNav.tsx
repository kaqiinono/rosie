'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG2Lesson6 } from './G2Lesson6Provider'

const CONFIG = {
  basePath: '/math/ny/2/6',
  activeColor: 'text-teal-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG2Lesson6} />
}
