'use client'

import { useAuth } from '@rosie/core'
import WordManagerPage from '@/components/admin/words/WordManagerPage'

export default function AdminWordsPage() {
  const { user } = useAuth()
  return <WordManagerPage user={user} />
}
