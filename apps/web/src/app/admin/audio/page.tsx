'use client'

import { useAuth } from '@rosie/core'
import AudioManagerPage from '@/components/admin/audio/AudioManagerPage'

export default function AdminAudioPage() {
  const { user } = useAuth()
  return <AudioManagerPage user={user} />
}
