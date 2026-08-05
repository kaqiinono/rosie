'use client'

import LessonBottomNav from '@rosie/math-kit/components/shared/LessonBottomNav'
import { useG1Lesson23 } from './G1Lesson23Provider'

const CONFIG = {
  basePath: '/math/ny/1/23',
  activeColor: 'text-violet-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG1Lesson23} />
}
