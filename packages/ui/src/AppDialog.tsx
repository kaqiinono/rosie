'use client'

import { Dialog, Flex, IconButton } from '@radix-ui/themes'
import { X } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'

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
  open,
  closeDisabled = false,
  onOpenChange,
  children,
}: AppDialogProps) {
  const bare = chrome === 'none'
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger>{trigger}</Dialog.Trigger>}
      <Dialog.Content
        {...(description ? {} : { 'aria-describedby': undefined })}
        maxWidth={MAX_WIDTH[size]}
        maxHeight="88dvh"
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          ...(bare ? { padding: 0 } : null),
        }}
        onEscapeKeyDown={(event) => {
          if (closeDisabled) event.preventDefault()
        }}
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
              ? 'min-h-0 overflow-y-auto'
              : '-mx-[var(--dialog-content-padding)] -mb-[var(--dialog-content-padding)] min-h-0 overflow-y-auto px-[var(--dialog-content-padding)] pb-[var(--dialog-content-padding)]'
          }
        >
          {children}
        </div>
      </Dialog.Content>
    </Dialog.Root>
  )
}
