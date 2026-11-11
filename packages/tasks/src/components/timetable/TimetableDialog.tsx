'use client'

import type { ReactNode } from 'react'
import { AppDialog } from '@rosie/ui'

/**
 * 课程表弹窗：统一走 @rosie/ui 的 AppDialog（受控、始终打开，关闭由父组件卸载）。
 * bare=内容自带头部（如编辑课程的「取消 / 保存」），其余使用共享标题栏。
 */
export default function TimetableDialog({
  title,
  onClose,
  children,
  description,
  bare = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  description?: string
  bare?: boolean
}) {
  return (
    <AppDialog
      open
      size="form"
      title={title}
      description={description}
      chrome={bare ? 'none' : 'standard'}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      {children}
    </AppDialog>
  )
}
