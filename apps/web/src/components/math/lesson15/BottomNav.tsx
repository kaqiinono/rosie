'use client'

import LessonBottomNav from '@/components/math/shared/LessonBottomNav'
import { useLesson15 } from './Lesson15Provider'

const CONFIG = {
  basePath: '/math/ny/15',
  activeColor: 'text-sky-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson15} />
}
