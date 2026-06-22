'use client'

import LessonBottomNav from '@/components/math/shared/LessonBottomNav'
import { useLesson35 } from './Lesson35Provider'

const CONFIG = {
  basePath: '/math/ny/35',
  activeColor: 'text-yellow-dark',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson35} />
}
