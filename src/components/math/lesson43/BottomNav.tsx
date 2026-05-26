'use client'

import LessonBottomNav from '@/components/math/shared/LessonBottomNav'
import { useLesson43 } from './Lesson43Provider'

const CONFIG = {
  basePath: '/math/ny/43',
  activeColor: 'text-cyan-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson43} />
}
