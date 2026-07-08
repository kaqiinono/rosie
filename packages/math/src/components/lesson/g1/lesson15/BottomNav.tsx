'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG1Lesson15 } from './G1Lesson15Provider'

const CONFIG = {
  basePath: '/math/ny/1/15',
  activeColor: 'text-sky-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG1Lesson15} />
}
