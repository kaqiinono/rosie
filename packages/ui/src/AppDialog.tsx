'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'

type AppDialogProps = {
  title: string
  icon?: ReactNode
  trigger: ReactElement
  size?: 'standard' | 'preview'
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}

export function AppDialog({ title, icon, trigger, size = 'standard', onOpenChange, children }: AppDialogProps) {
  return <Dialog.Root onOpenChange={onOpenChange}>
    <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
      <Dialog.Content aria-describedby={undefined} className={`fixed top-1/2 left-1/2 z-50 flex max-h-[88dvh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-surface text-text-primary shadow-xl ${size === 'preview' ? 'max-w-4xl' : 'max-w-lg'}`}>
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border-light py-2 pr-2 pl-5">
          <Dialog.Title className="flex items-center gap-2 text-lg font-semibold">{icon}{title}</Dialog.Title>
          <Dialog.Close aria-label="关闭" className="grid size-11 place-items-center rounded-lg text-text-secondary hover:bg-surface-dim focus-visible:outline-2 focus-visible:outline-app-blue-dark">
            <X aria-hidden="true" className="size-5" />
          </Dialog.Close>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
