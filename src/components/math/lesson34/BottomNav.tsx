'use client'

import LessonBottomNav from '@/components/math/shared/LessonBottomNav'
import { useLesson34 } from './Lesson34Provider'

const CONFIG = {
  basePath: '/math/ny/34',
  activeColor: 'text-amber-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson34} />
}
