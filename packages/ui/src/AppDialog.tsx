'use client'

import { Dialog, Flex, IconButton } from '@radix-ui/themes'
import { X } from 'lucide-react'
import { useCallback, useState, type ReactElement, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

type AppDialogProps = {
  title: string
  icon?: ReactNode
  /** 标题下方的说明文字，同时作为弹窗的无障碍描述。 */
  description?: string
  /** 省略时由 `open` / `onOpenChange` 受控打开。 */
  trigger?: ReactElement
  /** standard=列表与简单表单；form=较宽的表单；preview=媒体预览。 */
  size?: 'standard' | 'form' | 'preview'
  /**
   * standard=共享标题栏 + 关闭按钮；
   * none=内容自带头部（如带「取消 / 保存」的表单），共享组件只提供外壳、无障碍标题与滚动。
   */
  chrome?: 'standard' | 'none'
  /** Drawer uses the same focus/escape contract, with a full-height trailing panel. */
  presentation?: 'dialog' | 'drawer' | 'bottom-drawer' | 'fullscreen'
  /** Full viewport on phones; retain the standard dialog on wider screens. */
  compactBottomDrawer?: boolean
  /** A read-only card next to the bottom drawer, sharing its backdrop. */
  bottomDrawerCompanion?: ReactNode
  mobileFullscreen?: boolean
  /** Remains visible outside the scrolling content, e.g. media transport. */
  footer?: ReactNode
  /** scroll=正文整体滚动；fill=正文撑满剩余高度，由内部区块自己滚动。 */
  contentLayout?: 'scroll' | 'fill'
  returnFocusRef?: RefObject<HTMLElement | null>
  open?: boolean
  closeDisabled?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}

const MAX_WIDTH = { standard: '32rem', form: '42rem', preview: '56rem' } as const

export function AppDialog({
  title,
  icon,
  description,
  trigger,
  size = 'standard',
  chrome = 'standard',
  presentation = 'dialog',
  mobileFullscreen = false,
  compactBottomDrawer = false,
  bottomDrawerCompanion,
  footer,
  contentLayout = 'scroll',
  returnFocusRef,
  open,
  closeDisabled = false,
  onOpenChange,
  children,
}: AppDialogProps) {
  const bare = chrome === 'none'
  const hasCompanion = presentation === 'bottom-drawer' && bottomDrawerCompanion != null
  const [companionHost, setCompanionHost] = useState<HTMLElement | null>(null)
  const attachCompanionHost = useCallback((content: HTMLDivElement | null) => {
    setCompanionHost(content?.parentElement ?? null)
  }, [])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger>{trigger}</Dialog.Trigger>}
      <Dialog.Content
        ref={hasCompanion ? attachCompanionHost : undefined}
        data-presentation={presentation}
        data-mobile-fullscreen={mobileFullscreen || undefined}
        data-bottom-drawer-companion={hasCompanion || undefined}
        {...(description ? {} : { 'aria-describedby': undefined })}
        maxWidth={presentation === 'fullscreen' || presentation === 'bottom-drawer' ? '100vw' : presentation === 'drawer' ? 'min(64rem, 100vw)' : MAX_WIDTH[size]}
        maxHeight={presentation !== 'dialog' ? '100dvh' : '88dvh'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          ...(bare ? { padding: 0 } : null),
          ...(presentation !== 'dialog' ? {
            position: 'fixed', top: 0, right: 0, bottom: 0, left: 'auto',
            margin: 0, width: '100vw', height: '100dvh', borderRadius: 0,
          } : null),
          ...(presentation === 'bottom-drawer' ? {
            top: 'auto', left: 0, height: '92dvh', borderRadius: '28px 28px 0 0',
            ...(compactBottomDrawer ? { maxWidth: MAX_WIDTH[size], marginInline: 'auto', height: 'auto', maxHeight: '92dvh' } : null),
            ...(hasCompanion ? {
              left: 'var(--drawer-companion-content-left)',
              bottom: 'var(--drawer-companion-content-bottom)',
              width: 'var(--drawer-companion-content-width)',
              maxHeight: 'var(--drawer-companion-content-height)',
              marginInline: 'var(--drawer-companion-content-margin)',
            } : null),
          } : null),
        }}
        onEscapeKeyDown={(event) => {
          if (closeDisabled) event.preventDefault()
        }}
        onCloseAutoFocus={returnFocusRef ? (event) => {
          event.preventDefault()
          returnFocusRef.current?.focus({ preventScroll: true })
        } : undefined}
        onInteractOutside={(event) => {
          if (closeDisabled) event.preventDefault()
        }}
      >
        {bare ? (
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
        ) : (
          <Flex
            align="center"
            justify="between"
            gap="3"
            mb={description ? '1' : '3'}
            flexShrink="0"
          >
            <Flex align="center" gap="3" minWidth="0">
              {icon && (
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-4)] text-[var(--accent-11)]"
                >
                  {icon}
                </span>
              )}
              <Dialog.Title mb="0" size="5" trim="normal">
                {title}
              </Dialog.Title>
            </Flex>
            <Dialog.Close>
              <IconButton
                type="button"
                variant="soft"
                color="gray"
                disabled={closeDisabled}
                aria-label="关闭"
              >
                <X size={18} aria-hidden="true" />
              </IconButton>
            </Dialog.Close>
          </Flex>
        )}
        {description &&
          (bare ? (
            <Dialog.Description className="sr-only">{description}</Dialog.Description>
          ) : (
            <Dialog.Description size="2" color="gray" mb="3">
              {description}
            </Dialog.Description>
          ))}
        {/* 标准外壳：滚动区向外延伸到内边距，让滚动条贴在弹窗卡片外边缘，内容仍保持原内边距 */}
        <div
          className={
            bare
              ? `min-h-0 flex-1 ${contentLayout === 'fill' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`
              : `-mx-[var(--dialog-content-padding)] ${footer ? '' : '-mb-[var(--dialog-content-padding)]'} min-h-0 flex-1 px-[var(--dialog-content-padding)] pb-[var(--dialog-content-padding)] ${contentLayout === 'fill' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`
          }
        >
          {children}
        </div>
        {footer && <Flex direction="column" flexShrink="0" pt="3">{footer}</Flex>}
      </Dialog.Content>
      {hasCompanion && companionHost && createPortal(
        <div className="rosie-bottom-drawer-companion" aria-hidden="true">{bottomDrawerCompanion}</div>,
        companionHost,
      )}
    </Dialog.Root>
  )
}
