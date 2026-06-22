'use client'

import { createLessonProvider } from '@/components/math/shared/createLessonProvider'

const { Provider, useLessonContext } = createLessonProvider('Lesson23')

export default Provider
export { useLessonContext as useLesson23 }
