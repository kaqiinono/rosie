'use client'

import { useAuth } from '@/contexts/AuthContext'
import AudioPageView from '@/components/audio/AudioPageView'

export default function AudioPage() {
  const { user } = useAuth()
  return <AudioPageView user={user} />
}
