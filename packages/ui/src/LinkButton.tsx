'use client'

import type { ReactNode } from 'react'

type LinkButtonProps = { children: ReactNode } & (
  | { onClick: () => void }
  | { href: string; download?: string }
)

const linkStyle = 'inline-flex min-h-11 items-center gap-1 rounded-sm text-sm font-medium text-app-blue-dark underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-app-blue'

export function LinkButton(props: LinkButtonProps) {
  if ('href' in props) {
    return <a href={props.href} download={props.download} className={linkStyle}>{props.children}</a>
  }
  return <button type="button" onClick={props.onClick} className={linkStyle}>{props.children}</button>
}
