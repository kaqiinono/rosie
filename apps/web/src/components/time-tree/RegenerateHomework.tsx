'use client'

import { useState } from 'react'
import { AppDialog } from '@rosie/ui'
import { Button, Flex, Text, TextField } from '@rosie/ui/themes'
import { regenerationTargets } from '@/lib/time-tree/regenerate'
import { dayOf, shift } from '@/lib/time-tree/types'
import type { TreeController } from './useTimeTree'

export default function RegenerateHomework({ api }: { api: TreeController }) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState('')
  const [through, setThrough] = useState('')
  const [review, setReview] = useState<{ count: number; revision: number } | null>(null)
  const [mountedAt] = useState(Date.now)
  const today = api.tree?.today ?? dayOf(new Date(mountedAt + api.clockOffsetMs))
  const valid = from >= today && through >= from && through <= shift(today, 365)
  const stale = review !== null && review.revision !== api.revision
  return <>
    <Button size="1" variant="soft" disabled={api.busy || !api.tree} onClick={() => {
      setFrom(today); setThrough(shift(today, 6)); setReview(null); setOpen(true)
    }}>重新生成作业</Button>
    <AppDialog open={open} title="重新生成作业" closeDisabled={api.busy} onOpenChange={setOpen}>
      <Flex direction="column" gap="3">
        <Flex gap="3" wrap="wrap">
          <Flex direction="column" gap="1" flexGrow="1">
            <Text as="label" htmlFor="regenerate-from">开始日期</Text>
            <TextField.Root id="regenerate-from" type="date" value={from} min={today} max={shift(today, 365)} disabled={api.busy} onChange={event => { setFrom(event.target.value); setReview(null) }} />
          </Flex>
          <Flex direction="column" gap="1" flexGrow="1">
            <Text as="label" htmlFor="regenerate-through">结束日期</Text>
            <TextField.Root id="regenerate-through" type="date" value={through} min={from || today} max={shift(today, 365)} disabled={api.busy} onChange={event => { setThrough(event.target.value); setReview(null) }} />
          </Flex>
        </Flex>
        <Text size="2">按最新作业设置重建未开始的任务。已开始、已完成、已跳过及历史记录保留；拆分作业有任一段已开始时整组保留。</Text>
        {!valid && <Text color="red">请选择今天起一年内的有效日期范围。</Text>}
        {review && <Text role="status" weight="bold">将替换 {review.count} 条未开始的任务记录，并补齐所选范围内缺失的作业。</Text>}
        {review && <Text size="2">被替换任务的原排期、学习内容和本次备注将重新生成。</Text>}
        {stale && <Text color="amber">作业进度已变化，请重新预览。</Text>}
        {api.message && <Text role="alert" color="red">{api.message}</Text>}
        <Flex justify="end" gap="2">
          <Button variant="soft" disabled={api.busy} onClick={() => setOpen(false)}>取消</Button>
          {!review || stale ? <Button disabled={!valid || api.busy || api.revision === undefined} onClick={() => {
            if (api.tree && api.revision !== undefined) setReview({ count: regenerationTargets(api.tree, from, through).count, revision: api.revision })
          }}>预览替换数量</Button> : <Button loading={api.busy} disabled={!valid} onClick={async () => {
            const result = await api.run({ kind: 'regenerate', regenerate: { from, through, expectedCount: review.count } }, review.revision)
            if (result) setOpen(false)
            else setReview(null)
          }}>确认重新生成</Button>}
        </Flex>
      </Flex>
    </AppDialog>
  </>
}
