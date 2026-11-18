import { LearningIcon } from '@rosie/ui'
import type { SubjectKey } from './model'

const SUBJECT_STICKERS = {
  chinese: (
    <g stroke="#a84053">
      <path fill="#f9868b" d="M3 8.5c4.8-1.2 8.6-.4 13 2.4 4.4-2.8 8.2-3.6 13-2.4V25c-4.7-.9-8.5-.3-13 2.4C11.5 24.7 7.7 24.1 3 25z" />
      <path fill="#fff0e4" d="M5 5.5c4.3-.8 7.8.1 11 2.8 3.2-2.7 6.7-3.6 11-2.8v16.8c-4.3-.8-7.8.1-11 2.8-3.2-2.7-6.7-3.6-11-2.8z" />
      <path d="M16 8.3v16.8" />
      <path stroke="#d9707c" d="M8.5 12c1.7.1 3.1.5 4.3 1.3m-4.3 3c1.7.1 3.1.5 4.3 1.3m6.4-4.3c1.2-.8 2.6-1.2 4.3-1.3m-4.3 5.6c1.2-.8 2.6-1.2 4.3-1.3" />
    </g>
  ),
  math: (
    <g stroke="#945c19">
      <rect x="5" y="3" width="22" height="26" rx="5" fill="#ffce68" />
      <rect x="9" y="7" width="14" height="7" rx="2" fill="#fff4c9" />
      <path d="M17 10.5h3" />
      <path strokeWidth="2.8" d="M10.5 19h.5m4.8 0h.5m4.8 0h.5m-11.1 5h.5m4.8 0h.5m4.8 0h.5" />
    </g>
  ),
  english: (
    <g stroke="#2965a0">
      <rect x="7" y="3.5" width="20" height="23" rx="4" transform="rotate(13 17 15)" fill="#8ac1fb" />
      <rect x="3" y="7" width="25" height="20" rx="4" fill="#c5e7ff" />
      <path strokeWidth="1.45" d="m6.5 20 2.2-6 2.2 6m-3.7-1.9h3M14 20v-6h2c1.9 0 1.9 3 0 3h-2m2 0c2 0 2 3 0 3h-2m11-5.3c-.4-.5-1-.7-1.6-.7-1.5 0-2.4 1.3-2.4 3s.9 3 2.4 3c.6 0 1.2-.2 1.6-.7" />
    </g>
  ),
  life: (
    <g stroke="#367556">
      <path fill="#a9eec5" d="M16 19c-7.3.1-12.2-4.3-12.4-11.1 7.1-.9 12.5 2.9 12.4 11.1z" />
      <path fill="#6ed7a1" d="M16 19c-.3-8.3 4.6-13.6 12.3-13.7.4 7.7-4.3 13.7-12.3 13.7z" />
      <path d="M16 26v-7m0 0c1.4-3.4 3.6-6 6.6-8m-6.6 8c-1.2-2.3-3-4.3-5.5-5.8" />
      <path stroke="#5c9a75" d="M11.5 26.5h9" />
    </g>
  ),
} as const

export default function BubbleTaskIcon({ subject, crown, size = 24, className }: {
  subject: SubjectKey
  crown?: boolean
  size?: number
  className?: string
}) {
  if (crown) return <LearningIcon name="crown" size={size} />
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" fill="none" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {SUBJECT_STICKERS[subject]}
    </svg>
  )
}
