'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { CONGRATS_MESSAGES } from '@rosie/core'
import { launchConfetti } from '@rosie/core'
import { Button } from '@rosie/ui/themes'

interface CongratsModalProps {
  visible: boolean
  onClose: () => void
  nextHref?: string
}

export default function CongratsModal({ visible, onClose, nextHref }: CongratsModalProps) {
  const router = useRouter()
  const msg = useMemo(
    () => CONGRATS_MESSAGES[Math.floor(Math.random() * CONGRATS_MESSAGES.length)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible],
  )

  useEffect(() => {
    if (visible) launchConfetti()
  }, [visible])

  if (!visible) return null

  function handleContinue() {
    onClose()
    if (nextHref) router.push(nextHref)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-5">
      <div className="animate-pop-in shadow-sticker w-full max-w-[340px] rounded-[20px] bg-white px-7 py-8 text-center">
        <div className="mb-2.5 text-[60px]">{msg.emoji}</div>
        <div className="mb-1.5 text-[22px] font-extrabold">{msg.title}</div>
        <div className="text-text-secondary mb-5 text-sm">{msg.sub}</div>
        <Button onClick={handleContinue} variant="solid" color="blue" size="2" className="w-full">
          继续探险 →
        </Button>
      </div>
    </div>
  )
}
