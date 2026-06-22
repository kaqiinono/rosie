'use client'

import LessonBottomNav from '@/components/math/shared/LessonBottomNav'
import { useLesson36 } from './Lesson36Provider'

const CONFIG = {
  basePath: '/math/ny/36',
  activeColor: 'text-app-blue-dark',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson36} />
}
