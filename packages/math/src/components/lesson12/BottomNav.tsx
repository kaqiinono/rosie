'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useLesson12 } from './Lesson12Provider'

const CONFIG = {
  basePath: '/math/ny/1/12',
  activeColor: 'text-orange-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson12} />
}
