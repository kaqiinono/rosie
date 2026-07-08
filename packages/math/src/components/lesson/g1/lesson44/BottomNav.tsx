'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG1Lesson44 } from './G1Lesson44Provider'

const CONFIG = {
  basePath: '/math/ny/1/44',
  activeColor: 'text-indigo-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG1Lesson44} />
}
