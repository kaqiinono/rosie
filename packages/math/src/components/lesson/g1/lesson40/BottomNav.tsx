'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG1Lesson40 } from './G1Lesson40Provider'

const CONFIG = {
  basePath: '/math/ny/1/40',
  activeColor: 'text-green-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG1Lesson40} />
}
