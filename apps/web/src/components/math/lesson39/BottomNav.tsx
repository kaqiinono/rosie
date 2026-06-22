'use client'

import LessonBottomNav from '@/components/math/shared/LessonBottomNav'
import { useLesson39 } from './Lesson39Provider'

const CONFIG = {
  basePath: '/math/ny/39',
  activeColor: 'text-amber-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson39} />
}
