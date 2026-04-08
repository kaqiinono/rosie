'use client'

import LessonBottomNav from '@/components/math/shared/LessonBottomNav'
import { useLesson38 } from './Lesson38Provider'

const CONFIG = {
  basePath: '/math/ny/38',
  activeColor: 'text-purple-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson38} />
}
