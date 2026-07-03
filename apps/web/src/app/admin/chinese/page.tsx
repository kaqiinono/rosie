'use client'

import { useAuth } from '@rosie/core'
import ChineseCharManagerPage from '@/components/admin/chinese/ChineseCharManagerPage'

export default function AdminChinesePage() {
  const { user } = useAuth()
  return <ChineseCharManagerPage user={user} />
}
