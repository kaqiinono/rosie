'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useLesson13 } from './Lesson13Provider'

const CONFIG = {
  basePath: '/math/ny/13',
  activeColor: 'text-green-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson13} />
}
