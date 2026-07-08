'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG1Lesson42 } from './G1Lesson42Provider'

const CONFIG = {
  basePath: '/math/ny/1/42',
  activeColor: 'text-rose-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG1Lesson42} />
}
