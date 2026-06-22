'use client'

import LessonBottomNav from '@/components/math/shared/LessonBottomNav'
import { useLesson30 } from './Lesson30Provider'

const CONFIG = {
  basePath: '/math/ny/30',
  activeColor: 'text-amber-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson30} />
}
