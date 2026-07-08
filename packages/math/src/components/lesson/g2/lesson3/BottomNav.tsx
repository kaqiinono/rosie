'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG2Lesson3 } from './G2Lesson3Provider'

const CONFIG = {
  basePath: '/math/ny/2/3',
  activeColor: 'text-emerald-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG2Lesson3} />
}
