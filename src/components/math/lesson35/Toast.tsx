'use client'

import { useEffect } from 'react'

interface ToastProps {
  message: string | null
  onDismiss: () => void
}

export default function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDismiss, 2500)
    return () => clearTimeout(t)
  }, [message, onDismiss])

  return (
    <div
      className={`fixed bottom-20 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-text-primary px-5 py-2 text-[13px] text-white transition-all duration-300 md:bottom-5 ${
        message ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'
      }`}
    >
      {message}
    </div>
  )
}
