'use client'

import type { ReactNode } from 'react'
import { Theme } from '@radix-ui/themes'

// 刻意保留的深色区域（英语单词模块、英语计划管理、题海）的 Radix 主题作用域。
// 作用域内的 Button / TextField / Select / AppDialog 等控件自动换成深色配色，
// 不需要在每个控件上覆盖颜色。打印页等需要浅色时传 appearance="light"。
export function DarkScope({
  children,
  appearance = 'dark',
}: {
  children: ReactNode
  appearance?: 'dark' | 'light'
}) {
  return (
    <Theme
      appearance={appearance}
      accentColor="amber"
      grayColor="sand"
      radius="full"
      panelBackground="solid"
      hasBackground={false}
    >
      {children}
    </Theme>
  )
}

export default DarkScope
