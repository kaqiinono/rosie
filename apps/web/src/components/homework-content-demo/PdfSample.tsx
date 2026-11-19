'use client'

import { useEffect, useState } from 'react'
import { openPdfFile, renderPdfPageUrl, revokePageUrls } from '@rosie/math/utils/math-pdf'
import { LoadingOverlay } from '@rosie/ui'
import { Button, Flex, Text } from '@rosie/ui/themes'
import DemoMedia from './DemoMedia'
import { makeGardenPdf } from './pdfFixture'

export default function PdfSample({ active, epoch }: { active: boolean; epoch: number }) {
  const [urls, setUrls] = useState<string[]>([])
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [spread, setSpread] = useState(false)
  useEffect(() => {
    let cancelled = false
    const owned: string[] = []
    const source = new File([makeGardenPdf()], 'garden.pdf', { type: 'application/pdf' })
    setLoading(true); setError(''); setUrls([])
    void (async () => {
      try {
        const { doc, numPages } = await openPdfFile(source)
        try {
          for (let i = 1; i <= numPages && !cancelled; i++) {
            const url = await renderPdfPageUrl(doc, i, 1)
            if (cancelled) {
              URL.revokeObjectURL(url)
              break
            }
            owned.push(url)
          }
          if (!cancelled) setUrls([...owned])
        } finally {
          await doc.destroy()
        }
      } catch { if (!cancelled) setError('PDF 暂时无法读取，请检查网络后重试。') }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true; revokePageUrls(owned) }
  }, [attempt])
  return <Flex direction="column" gap="4">
    <Flex gap="2" wrap="wrap">
      <Button variant={!spread ? 'solid' : 'soft'} onClick={() => setSpread(false)}>单页</Button>
      <Button variant={spread ? 'solid' : 'soft'} onClick={() => { setSpread(true); setPage(p => p - p % 2) }}>双页</Button>
      <Button variant="soft" disabled={page === 0 || loading} onClick={() => setPage(p => Math.max(0, p - (spread ? 2 : 1)))}>上一页</Button>
      <Button variant="soft" disabled={page + (spread ? 2 : 1) >= urls.length || loading} onClick={() => setPage(p => p + (spread ? 2 : 1))}>下一页</Button>
      {urls.length > 0 && <Text>第 {page + 1}{spread && page + 2 <= urls.length ? `–${page + 2}` : ''} 页 / {urls.length}</Text>}
    </Flex>
    {loading && <div className="relative min-h-80"><LoadingOverlay visible placement="content" /></div>}
    {error && <Flex direction="column" gap="2"><Text role="alert" color="red">{error}</Text><Button onClick={() => setAttempt(n => n + 1)}>重试读取 PDF</Button></Flex>}
    {!loading && !error && <div className={spread ? 'grid grid-cols-2 gap-2' : 'mx-auto w-full max-w-lg'}>
      {urls.slice(page, page + (spread ? 2 : 1)).map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- rendered PDF blob URLs
        <img key={url} src={url} alt={`第 ${page + i + 1} 页`} className="aspect-[3/4] w-full min-w-0 object-contain" />
      ))}
    </div>}
    <Text size="2">页面词汇：garden 花园 · bird 小鸟 · tree 树</Text>
    <DemoMedia type="audio" active={active} epoch={epoch} />
  </Flex>
}
