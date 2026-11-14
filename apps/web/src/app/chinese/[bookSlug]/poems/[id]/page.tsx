'use client'
import { use } from 'react'
import Link from 'next/link'
import { getBookPoems, PoemRecite, useChineseContext } from '@rosie/chinese'
import { Button, Flex, Text } from '@rosie/ui/themes'

export default function PoemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { bookSlug } = useChineseContext()
  const poem = getBookPoems(bookSlug).find((item) => item.id === id)
  return <Flex direction="column" gap="4" p="4">
    <Button asChild variant="soft"><Link href={`/chinese/${bookSlug}/poems`}>返回古诗列表</Link></Button>
    {poem ? <PoemRecite poem={poem} /> : <Text>未找到该古诗，请更新入口内容。</Text>}
  </Flex>
}
