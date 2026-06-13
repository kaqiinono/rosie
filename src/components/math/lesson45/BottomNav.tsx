'use client'

import LessonBottomNav from '@/components/math/shared/LessonBottomNav'
import { useLesson45 } from './Lesson45Provider'

const CONFIG = {
  basePath: '/math/ny/45',
  activeColor: 'text-orange-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson45} />
}
