'use client'

import { IconButton } from './themes'

export function FloatingLauncherCloseButton({
  label,
  title = label,
  onClose,
}: {
  label: string
  title?: string
  onClose: () => void
}) {
  return (
    <IconButton
      type="button"
      aria-label={label}
      title={title}
      size="1"
      radius="full"
      variant="surface"
      color="gray"
      className="absolute -top-2 -right-2"
      onClick={onClose}
    >
      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="m3 3 6 6m0-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </IconButton>
  )
}
