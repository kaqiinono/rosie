'use client'

import LessonBottomNav from '@/components/math/shared/LessonBottomNav'
import { useLesson23 } from './Lesson23Provider'

const CONFIG = {
  basePath: '/math/ny/23',
  activeColor: 'text-violet-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson23} />
}
