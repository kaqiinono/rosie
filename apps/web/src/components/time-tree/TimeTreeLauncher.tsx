'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { STORAGE_KEYS, useFloatingLauncherPosition } from '@rosie/core'
import { IconButton } from '@rosie/ui/themes'
import { FloatingLauncherCloseButton } from '@rosie/ui'

const MinimizeTimeTree = createContext<() => void>(() => {})

function positionAboveAssistant(button: HTMLButtonElement) {
  const assistant = document.querySelector<HTMLElement>('[data-ai-floating-launcher]')
  if (!assistant?.offsetWidth) return
  const rect = assistant.getBoundingClientRect()
  const gap = 12
  const above = rect.top - button.offsetHeight - gap
  return {
    x: rect.left + (rect.width - button.offsetWidth) / 2,
    y: above >= 8 ? above : rect.bottom + gap,
  }
}

function TimeTreeIcon({ size }: { size: number }) {
  return <Image src="/icons/time-tree-launcher.png" alt="" width={size} height={size} draggable={false} />
}

export function MinimizeTimeTreeButton({ disabled }: { disabled: boolean }) {
  const minimize = useContext(MinimizeTimeTree)
  return (
    <IconButton
      type="button"
      size="2"
      variant="soft"
      color="green"
      title="最小化生命树"
      aria-label="最小化生命树"
      disabled={disabled}
      onClick={minimize}
    >
      <TimeTreeIcon size={28} />
    </IconButton>
  )
}

export default function TimeTreeLauncher({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [minimized, setMinimized] = useState(false)
  const onTreePage = pathname === '/time-tree'
  const previousTreePage = useRef(onTreePage)
  const visible = minimized && !onTreePage && !pathname.endsWith('/print')
  const { launcherRef, launcherStyle, dragging, handlers, consumeDragClick } =
    useFloatingLauncherPosition({
      storageKey: STORAGE_KEYS.TIME_TREE_LAUNCHER_POSITION,
      visible,
      getDefaultPosition: positionAboveAssistant,
    })

  useEffect(() => {
    const leftTree = previousTreePage.current && !onTreePage
    previousTreePage.current = onTreePage
    if (!onTreePage && !leftTree) return
    const frame = requestAnimationFrame(() => setMinimized(leftTree))
    return () => cancelAnimationFrame(frame)
  }, [onTreePage])

  function minimize() {
    setMinimized(true)
    router.push('/')
  }

  return (
    <MinimizeTimeTree.Provider value={minimize}>
      {children}
      {visible && (
        <div
          style={launcherStyle}
          className={`fixed right-5 bottom-40 z-50 touch-none md:right-7 md:bottom-[5.5rem] ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute -inset-1 rounded-full border-2 border-dashed border-[var(--green-8)] border-t-[var(--green-11)] ${dragging ? '' : 'motion-safe:animate-spin motion-safe:[animation-duration:9s]'}`}
          />
          <IconButton
            ref={launcherRef}
            type="button"
            size="4"
            variant="surface"
            color="green"
            radius="full"
            aria-label="展开生命树，可拖动调整位置"
            title="展开生命树，拖动或按方向键调整位置"
            {...handlers}
            onClick={(event) => {
              if (event.detail > 0 && consumeDragClick()) return
              setMinimized(false)
              router.push('/time-tree')
            }}
          >
            <TimeTreeIcon size={44} />
          </IconButton>
          <FloatingLauncherCloseButton
            label="关闭生命树浮标"
            onClose={() => setMinimized(false)}
          />
        </div>
      )}
    </MinimizeTimeTree.Provider>
  )
}
