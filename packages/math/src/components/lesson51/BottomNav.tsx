'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useLesson51 } from './Lesson51Provider'

const CONFIG = {
  basePath: '/math/ny/51',
  activeColor: 'text-emerald-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson51} />
}
