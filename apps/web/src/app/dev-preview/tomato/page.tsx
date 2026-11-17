'use client'

import { useEffect } from 'react'
import { useImmersive } from '@rosie/core'

export default function TomatoTimerDemoPage() {
  const { setIsImmersive } = useImmersive()

  useEffect(() => {
    setIsImmersive(true)
    return () => setIsImmersive(false)
  }, [setIsImmersive])

  return (
    <main className="h-dvh">
      <iframe
        src="/tomato-timer/index.html?view=demo"
        title="番茄专注计时 Demo"
        sandbox="allow-scripts"
        allow="autoplay; fullscreen"
        allowFullScreen
        onLoad={event => event.currentTarget.contentWindow?.postMessage({ type: 'tomato:init' }, '*')}
        className="block h-full w-full border-0"
      />
    </main>
  )
}
