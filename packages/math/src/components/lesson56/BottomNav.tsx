'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useLesson56 } from './Lesson56Provider'

const CONFIG = {
  basePath: '/math/ny/2/7',
  activeColor: 'text-sky-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson56} />
}
