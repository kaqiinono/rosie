'use client'

import LessonBottomNav from '@/components/math/shared/LessonBottomNav'
import { useLesson42 } from './Lesson42Provider'

const CONFIG = {
  basePath: '/math/ny/42',
  activeColor: 'text-rose-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson42} />
}
