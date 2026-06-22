'use client'

import { createLessonProvider } from '@rosie/math/components/shared/createLessonProvider'

const { Provider, useLessonContext } = createLessonProvider('Lesson12')

export default Provider
export { useLessonContext as useLesson12 }
