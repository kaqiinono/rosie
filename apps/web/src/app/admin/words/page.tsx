'use client'

import { useAuth } from '@/contexts/AuthContext'
import WordManagerPage from '@/components/admin/words/WordManagerPage'

export default function AdminWordsPage() {
  const { user } = useAuth()
  return <WordManagerPage user={user} />
}
