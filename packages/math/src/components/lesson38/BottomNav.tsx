'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useLesson38 } from './Lesson38Provider'

const CONFIG = {
  basePath: '/math/ny/1/38',
  activeColor: 'text-purple-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson38} />
}
