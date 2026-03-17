'use client'

import { useEffect, useMemo } from 'react'
import { CONGRATS_MESSAGES } from '@/utils/constant'
import { launchConfetti } from '@/utils/confetti'

interface CongratsModalProps {
  visible: boolean
  onClose: () => void
}

export default function CongratsModal({ visible, onClose }: CongratsModalProps) {
  const msg = useMemo(
    () => CONGRATS_MESSAGES[Math.floor(Math.random() * CONGRATS_MESSAGES.length)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible],
  )

  useEffect(() => {
    if (visible) launchConfetti()
  }, [visible])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-5">
      <div className="w-full max-w-[340px] animate-pop-in rounded-[20px] bg-white px-7 py-8 text-center shadow-lg">
        <div className="mb-2.5 text-[60px]">{msg.emoji}</div>
        <div className="mb-1.5 text-[22px] font-extrabold">{msg.title}</div>
        <div className="mb-5 text-sm text-text-secondary">{msg.sub}</div>
        <button
          onClick={onClose}
          className="w-full cursor-pointer rounded-full bg-app-blue px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(59,130,246,0.3)] transition-all active:translate-y-px"
        >
          继续探险 →
        </button>
      </div>
    </div>
  )
}
