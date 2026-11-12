'use client'

import { useState } from 'react'
import { AppDialog } from '@rosie/ui'
import { Button, Flex, Text, TextArea } from '@rosie/ui/themes'
import type { WorkStep } from '@/lib/time-tree/types'
import type { TreeController } from './useTimeTree'

type Props = {
  step: WorkStep
  api: TreeController
  close: () => void
}

export function HomeworkNotesDialog({ step, api, close }: Props) {
  const [previous] = useState(step.planNote ?? '')
  const [value, setValue] = useState(previous)
  const [attempted, setAttempted] = useState(false)

  async function save() {
    setAttempted(true)
    const notes = [{ id: step.id, previous, value }]
    if (await api.run({ kind: 'saveNotes', notes })) close()
  }

  return (
    <AppDialog open title="备注" description={`${step.name} · ${step.planned ?? step.scheduled}`} size="form" closeDisabled={api.busy}
      onOpenChange={(open) => { if (!open) close() }}>
      <Flex direction="column" gap="3">
        <TextArea
          aria-label="本次任务备注"
          value={value}
          placeholder="本次作业内容（选填）"
          disabled={api.busy}
          onChange={(event) => setValue(event.target.value)}
        />
        {attempted && api.message && <Text role="alert" color="red">{api.message}</Text>}
        <Button loading={api.busy} disabled={api.busy || value.trim() === previous} onClick={save}>保存</Button>
      </Flex>
    </AppDialog>
  )
}
