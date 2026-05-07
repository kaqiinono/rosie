'use client'

import LessonBottomNav from '@/components/math/shared/LessonBottomNav'
import { useLesson41 } from './Lesson41Provider'

const CONFIG = {
  basePath: '/math/ny/41',
  activeColor: 'text-sky-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson41} />
}
