'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useLesson18 } from './Lesson18Provider'

const CONFIG = {
  basePath: '/math/ny/18',
  activeColor: 'text-purple-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson18} />
}
