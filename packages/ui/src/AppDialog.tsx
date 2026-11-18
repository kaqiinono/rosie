'use client'

import { Dialog, Flex, IconButton } from '@radix-ui/themes'
import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type CSSProperties, type ReactElement, type ReactNode, type RefObject } from 'react'
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
  /** Size the bottom drawer to its content, within the viewport limits. */
  compactBottomDrawer?: boolean
  /** Center the bottom drawer and its companion together on wide screens. */
  centerBottomDrawerOnDesktop?: boolean
  /** A read-only card shared with any nested bottom drawer. */
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
const BottomDrawerCompanionContext = createContext<ReactNode>(null)

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
  centerBottomDrawerOnDesktop = false,
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
  const inheritedCompanion = useContext(BottomDrawerCompanionContext)
  const bottomDrawer = presentation === 'bottom-drawer'
  const companion = bottomDrawer ? bottomDrawerCompanion ?? inheritedCompanion : null
  const companionPlacement = companion == null ? undefined : bottomDrawerCompanion == null ? 'secondary' : 'primary'
  const [companionHost, setCompanionHost] = useState<HTMLElement | null>(null)
  const attachCompanionHost = useCallback((content: HTMLDivElement | null) => {
    setCompanionHost(content?.parentElement ?? null)
  }, [])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger>{trigger}</Dialog.Trigger>}
      <Dialog.Content
        ref={companionPlacement ? attachCompanionHost : undefined}
        data-presentation={presentation}
        data-mobile-fullscreen={mobileFullscreen || undefined}
        data-bottom-drawer-compact={bottomDrawer && compactBottomDrawer || undefined}
        data-bottom-drawer-centered={bottomDrawer && centerBottomDrawerOnDesktop || undefined}
        data-bottom-drawer-companion={companionPlacement}
        {...(description ? {} : { 'aria-describedby': undefined })}
        maxWidth={bottomDrawer ? 'var(--bottom-drawer-max-width, 100vw)' : presentation === 'fullscreen' ? '100vw' : presentation === 'drawer' ? 'min(64rem, 100vw)' : MAX_WIDTH[size]}
        maxHeight={bottomDrawer ? undefined : presentation !== 'dialog' ? '100dvh' : '88dvh'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          ...(bare ? { padding: 0 } : null),
          ...(bottomDrawer ? { '--bottom-drawer-width': MAX_WIDTH[size] } as CSSProperties : null),
          ...(presentation !== 'dialog' && !bottomDrawer ? {
            position: 'fixed', top: 0, right: 0, bottom: 0, left: 'auto',
            margin: 0, width: '100vw', height: '100dvh', borderRadius: 0,
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
          const card = event.target instanceof Element && event.target.closest('.rosie-bottom-drawer-companion')
          if (closeDisabled || (card && card.parentElement === companionHost)) event.preventDefault()
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
          <BottomDrawerCompanionContext.Provider value={companion ?? inheritedCompanion}>
            {children}
          </BottomDrawerCompanionContext.Provider>
        </div>
        {footer && <Flex direction="column" flexShrink="0" pt="3">{footer}</Flex>}
      </Dialog.Content>
      {companionPlacement && companionHost && createPortal(
        <div className="rosie-bottom-drawer-companion" aria-hidden="true">{companion}</div>,
        companionHost,
      )}
    </Dialog.Root>
  )
}
