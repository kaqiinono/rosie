import Link from 'next/link'
import { PageShell, StickerCard } from '@rosie/ui'
import { Heading, Text } from '@rosie/ui/themes'
import { alignmentWorkbenchUrl } from '@/lib/audio-alignment-contract'

export default function AdminToolsPage() {
  return <PageShell title="内容工具箱" backHref="/admin" tone="rose" width="narrow" showAccount>
    <div className="grid gap-4 sm:grid-cols-2">
      <StickerCard asChild interactive>
        <Link href={alignmentWorkbenchUrl()} className="space-y-1">
          <Heading as="h2" size="4">音文对齐</Heading>
          <Text as="p" size="2" color="gray">边听边标记故事和教材的句子，保存后更新学习页面。</Text>
        </Link>
      </StickerCard>
    </div>
  </PageShell>
}
