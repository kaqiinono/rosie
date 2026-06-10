'use client'

import { createLessonProvider } from '@/components/math/shared/createLessonProvider'

const { Provider, useLessonContext } = createLessonProvider('Lesson15')

export default Provider
export { useLessonContext as useLesson15 }
