'use client'

import { useAuth } from '@rosie/core'
import AudioPageView from '@/components/audio/AudioPageView'

export default function AudioPage() {
  const { user } = useAuth()
  return <AudioPageView user={user} />
}
