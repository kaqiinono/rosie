'use client'

import type { ReactNode, RefObject } from 'react'
import Link from 'next/link'
import { AppDialog } from '@rosie/ui'
import { Button, Flex, Text } from '@rosie/ui/themes'

type Props = { open: boolean; title: string; detailHref?: string; onClose: () => void; children: ReactNode; returnFocusRef: RefObject<HTMLButtonElement | null> }
export default function PracticeDrawer({ open, title, detailHref, onClose, children, returnFocusRef }: Props) {
  return <AppDialog open={open} onOpenChange={value => { if (!value) onClose() }} title={title} presentation="drawer" returnFocusRef={returnFocusRef} description="本次作答只保留在当前页面。">
    <Flex direction="column" gap="4">
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Text size="2" color="gray">关闭后保留现场，停止播放。</Text>
        {detailHref && <Button asChild variant="soft"><Link href={detailHref} onClick={onClose}>进入详情页</Link></Button>}
      </Flex>
      {children}
    </Flex>
  </AppDialog>
}
