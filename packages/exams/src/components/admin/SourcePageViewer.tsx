'use client'

import { useEffect, useState } from 'react'
import { Flex, Text, TextField } from '@rosie/ui/themes'

export function SourcePageViewer({ title, initialPage = 1 }: { title: string; initialPage?: number }) {
  const [url, setUrl] = useState<string | null>(null)
  const [page, setPage] = useState(String(initialPage))
  useEffect(() => setPage(String(initialPage)), [initialPage])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return <Flex direction="column" gap="3">
    <Text as="p">对照来源：{title}。选择本机原书 PDF，核对版本和页码；文件只在当前浏览器打开。</Text>
    <label className="flex flex-col gap-2"><Text size="2">原书 PDF</Text><input type="file" accept="application/pdf" onChange={event => {
      const file = event.target.files?.[0]
      setUrl(file ? URL.createObjectURL(file) : null)
    }} /></label>
    <label className="flex flex-col gap-2"><Text size="2">PDF 页码（从 1 开始）</Text><TextField.Root size="3" inputMode="numeric" value={page} onChange={event => setPage(event.target.value)} /></label>
    {url && <iframe title="本机原书来源对照" src={`${url}#page=${/^[1-9][0-9]*$/.test(page) ? page : '1'}`} className="h-[70dvh] w-full" />}
  </Flex>
}
