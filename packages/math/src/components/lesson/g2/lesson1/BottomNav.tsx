'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG2Lesson1 } from './G2Lesson1Provider'

const CONFIG = {
  basePath: '/math/ny/2/1',
  activeColor: 'text-indigo-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG2Lesson1} />
}
