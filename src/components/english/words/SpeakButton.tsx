'use client'

import { speakWord } from '@/utils/speak'

interface SpeakButtonProps {
  word: string
  /** Tailwind size class, defaults to text-[1.1rem] */
  size?: string
  /** Extra class names */
  className?: string
}

export default function SpeakButton({ word, size = 'text-[1.1rem]', className = '' }: SpeakButtonProps) {
  return (
    <button
      type="button"
      aria-label={`朗读 ${word}`}
      onClick={(e) => {
        e.stopPropagation()
        speakWord(word)
      }}
      className={`flex cursor-pointer items-center justify-center rounded-full transition-all active:scale-90 ${size} ${className}`}
      style={{ lineHeight: 1 }}
    >
      🔊
    </button>
  )
}
