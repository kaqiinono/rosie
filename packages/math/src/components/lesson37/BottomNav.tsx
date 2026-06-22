'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useLesson37 } from './Lesson37Provider'

const CONFIG = {
  basePath: '/math/ny/37',
  activeColor: 'text-blue-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson37} />
}
