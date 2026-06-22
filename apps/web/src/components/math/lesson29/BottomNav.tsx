'use client'

import LessonBottomNav from '@/components/math/shared/LessonBottomNav'
import { useLesson29 } from './Lesson29Provider'

const CONFIG = {
  basePath: '/math/ny/29',
  activeColor: 'text-rose-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson29} />
}
