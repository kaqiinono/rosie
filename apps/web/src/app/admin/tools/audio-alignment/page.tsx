import { PageShell } from '@rosie/ui'
import AudioAlignmentWorkbench from '@/components/admin/AudioAlignmentWorkbench'

export default async function AudioAlignmentPage({ searchParams }: {
  searchParams: Promise<{ key?: string | string[] }>
}) {
  const { key } = await searchParams
  return <PageShell title="音文对齐" backHref="/admin/tools" tone="paper" width="wide" showAccount>
    <AudioAlignmentWorkbench initialKey={typeof key === 'string' ? key : ''} />
  </PageShell>
}
