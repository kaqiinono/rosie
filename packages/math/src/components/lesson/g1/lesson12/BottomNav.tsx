'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG1Lesson12 } from './G1Lesson12Provider'

const CONFIG = {
  basePath: '/math/ny/1/12',
  activeColor: 'text-orange-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG1Lesson12} />
}
