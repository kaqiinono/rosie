'use client'

import { useAuth } from '@rosie/core'
import { AudioManagerPage } from '@rosie/audio'

export default function AdminAudioPage() {
  const { user } = useAuth()
  return <AudioManagerPage user={user} />
}
