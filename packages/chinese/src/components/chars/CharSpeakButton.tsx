'use client'

import { IconButton } from '@rosie/ui/themes'
import { speakChinese } from '../../utils/speak-chinese'

interface CharSpeakButtonProps {
  text: string
  /** 仅用于布局（定位、外边距）。 */
  className?: string
  size?: 'md' | 'sm'
}

export default function CharSpeakButton({ text, className, size = 'md' }: CharSpeakButtonProps) {
  return (
    <IconButton
      type="button"
      aria-label={`朗读 ${text}`}
      onClick={(e) => {
        e.stopPropagation()
        speakChinese(text)
      }}
      variant="soft"
      color="amber"
      size={size === 'sm' ? '1' : '2'}
      radius="full"
      className={className}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
      </svg>
    </IconButton>
  )
}
