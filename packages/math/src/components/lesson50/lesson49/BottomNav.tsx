'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useLesson49 } from './Lesson49Provider'

const CONFIG = {
  basePath: '/math/ny/49',
  activeColor: 'text-indigo-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson49} />
}
