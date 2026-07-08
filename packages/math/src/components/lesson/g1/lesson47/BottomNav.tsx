'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG1Lesson47 } from './G1Lesson47Provider'

const CONFIG = {
  basePath: '/math/ny/1/47',
  activeColor: 'text-fuchsia-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG1Lesson47} />
}
