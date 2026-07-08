'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG2Lesson4 } from './G2Lesson4Provider'

const CONFIG = {
  basePath: '/math/ny/2/4',
  activeColor: 'text-sky-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG2Lesson4} />
}
