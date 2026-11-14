'use client'

import { useEffect, useState } from 'react'
import type { PracticeEntryRow } from '@rosie/tasks'
import { Flex, Text } from '@rosie/ui/themes'

type MathBrief = { title: string; text: string; question: string }

/** Management preview: the question or saved text, without the answer workspace. */
export default function EntryRowPreview({ row }: { row: PracticeEntryRow }) {
  const problemId = row.values.problemId
  const [math, setMath] = useState<MathBrief | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    if (!problemId) return
    let cancelled = false
    setMath(null)
    setMissing(false)
    void import('@rosie/math/utils/sea-data').then(({ SEA_POOL }) => {
      if (cancelled) return
      const problem = SEA_POOL.find((item) => item.problem.id === problemId)?.problem
      if (!problem) { setMissing(true); return }
      setMath({ title: problem.title, text: problem.text, question: problem.finalQ })
    }).catch(() => { if (!cancelled) setMissing(true) })
    return () => { cancelled = true }
  }, [problemId])
  const blocks = (row.content ?? []).filter((block) => block.title || block.text)
  return <Flex direction="column" gap="1">
    {problemId && !math && !missing && <Text size="2" color="gray" role="status">正在读取题目…</Text>}
    {math && <>
      <Text size="2" weight="bold">{math.title}</Text>
      {math.text && <Text size="2">{math.text}</Text>}
      {math.question && math.question !== math.text && <Text size="2">{math.question}</Text>}
    </>}
    {missing && <Text size="2" color="gray">没有找到这道题的正文。</Text>}
    {blocks.map((block, index) => <Flex key={`${block.title}:${index}`} direction="column" gap="1">
      {block.title && <Text size="2" weight="bold">{block.title}</Text>}
      {block.text && <Text size="2">{block.text}</Text>}
    </Flex>)}
    {!problemId && !blocks.length && <Text size="2" color="gray">这项没有可预览的正文。</Text>}
  </Flex>
}
