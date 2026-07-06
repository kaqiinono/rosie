'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useLesson55 } from './Lesson55Provider'

const CONFIG = {
  basePath: '/math/ny/55',
  activeColor: 'text-teal-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson55} />
}
