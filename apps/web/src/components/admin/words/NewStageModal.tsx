'use client'

import { useState } from 'react'
import { AppDialog } from '@rosie/ui'
import { Button, TextField } from '@rosie/ui/themes'

type Props = {
  existingStages: string[]
  onCancel: () => void
  onSubmit: (stage: string, unit: string, lesson: string) => void
}

const labelCls = 'mb-1 block text-[11px] font-extrabold tracking-wide text-slate-500 uppercase'

export default function NewStageModal({ existingStages, onCancel, onSubmit }: Props) {
  const [stage, setStage] = useState('')
  const [unit, setUnit] = useState('Unit 1')
  const [lesson, setLesson] = useState('Lesson 1')

  const dup = existingStages.includes(stage.trim())
  const canSubmit =
    stage.trim().length > 0 && unit.trim().length > 0 && lesson.trim().length > 0 && !dup

  return (
    <AppDialog
      open
      title="新建词库"
      description="同时建立第一个单元与课次；添加单词后写入云端。"
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <div>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>词库 (stage) *</label>
            <TextField.Root
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              placeholder="4C"
              autoFocus
            />
            {dup && <div className="mt-1 text-[11px] font-bold text-red-500">该词库已存在</div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>第一个单元 *</label>
              <TextField.Root
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Unit 1"
              />
            </div>
            <div>
              <label className={labelCls}>第一个课次 *</label>
              <TextField.Root
                value={lesson}
                onChange={(e) => setLesson(e.target.value)}
                placeholder="Lesson 1"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <Button
            type="button"
            onClick={onCancel}
            variant="outline"
            color="gray"
            size="2"
            className="flex-1"
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={() => onSubmit(stage.trim(), unit.trim(), lesson.trim())}
            disabled={!canSubmit}
            size="2"
            className="flex-[2]"
          >
            创建词库
          </Button>
        </div>
      </div>
    </AppDialog>
  )
}
