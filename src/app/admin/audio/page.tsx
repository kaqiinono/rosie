'use client'

import { useAuth } from '@/contexts/AuthContext'
import AudioManagerPage from '@/components/admin/audio/AudioManagerPage'

export default function AdminAudioPage() {
  const { user } = useAuth()
  return <AudioManagerPage user={user} />
}
