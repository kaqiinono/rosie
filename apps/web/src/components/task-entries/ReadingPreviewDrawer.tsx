'use client'

import dynamic from 'next/dynamic'
import { useRef } from 'react'
import { WordsProvider, findPassageByKey } from '@rosie/english'
import { AppDialog, DarkScope, LoadingOverlay } from '@rosie/ui'

const ReadingPassageDetail = dynamic(() => import('../reading/ReadingPassageDetail'), {
  loading: () => <LoadingOverlay visible placement="content" />,
})

export default function ReadingPreviewDrawer({ passageKey, open, onClose }: {
  passageKey: string
  open: boolean
  onClose: () => void
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  return <AppDialog open={open} onOpenChange={(value) => { if (!value) onClose() }}
    title={findPassageByKey(passageKey)?.title ?? '全文阅读'} presentation="bottom-drawer" contentLayout="fill">
    <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto">
      {open && <WordsProvider vocabScope="stage">
        <DarkScope appearance="light">
          <ReadingPassageDetail key={passageKey} passageKey={passageKey} appearance="light" showBackLink={false} scrollContainerRef={scrollContainerRef} />
        </DarkScope>
      </WordsProvider>}
    </div>
  </AppDialog>
}
