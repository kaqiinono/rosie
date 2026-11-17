'use client'

import { useState } from 'react'
import { HomeworkPage, type Homework } from '@rosie/tasks'

import HomeworkJournal from '@/components/time-tree/HomeworkJournal'
import HomeworkCardPreview from '@/components/time-tree/HomeworkCardPreview'

export default function Page() {
  const [preview, setPreview] = useState<Homework | null>(null)
  return (
    <HomeworkPage onPreview={setPreview}>
      <HomeworkJournal />
      {preview && <HomeworkCardPreview homework={preview} onClose={() => setPreview(null)} />}
    </HomeworkPage>
  )
}
