'use client'

import { useAuth } from '@rosie/core'
import { AudioPageView } from '@rosie/audio'

export default function AudioPage() {
  const { user } = useAuth()
  return <AudioPageView user={user} />
}
