'use client'

import LessonBottomNav from '@/components/math/shared/LessonBottomNav'
import { useLesson37 } from './Lesson37Provider'

const CONFIG = {
  basePath: '/math/ny/37',
  activeColor: 'text-blue-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson37} />
}
