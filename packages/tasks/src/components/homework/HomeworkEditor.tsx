'use client'

import { useState, type ReactNode } from 'react'
import { AppDialog } from '@rosie/ui'
import { Button, Flex, Select, Switch, Text, TextArea, TextField } from '@rosie/ui/themes'
import {
  EMPTY_HOMEWORK,
  HOMEWORK_CYCLES,
  HOMEWORK_SUBJECTS,
  HOMEWORK_WEEKDAYS,
  HOMEWORK_WEEKDAY_ORDER,
  MAX_HOMEWORK_MINUTES,
  HOMEWORK_PRIORITIES,
  describeNextHomeworkDates,
  needsCycleStart,
  usesCycleCount,
  validateHomework,
  withCycle,
  type Homework,
  type HomeworkCycle,
  type HomeworkInput,
  type HomeworkPriority,
  type HomeworkSubject,
} from '../../homework'
import { localDate } from '../../time'

type Props = {
  /** 传入表示编辑；缺省为新增。 */
  homework?: Homework
  onSave: (input: HomeworkInput) => Promise<void>
  onClose: () => void
}

function toInput(homework?: Homework): HomeworkInput {
  if (!homework) return EMPTY_HOMEWORK
  return {
    name: homework.name,
    subject: homework.subject,
    cycle: homework.cycle,
    times_per_week: homework.times_per_week,
    times_per_cycle: homework.times_per_cycle,
    priority: homework.priority,
    start_weekday: homework.start_weekday,
    end_weekday: homework.end_weekday,
    start_date: homework.start_date,
    end_date: homework.end_date,
    estimated_minutes: homework.estimated_minutes,
    notes: homework.notes,
    enabled: homework.enabled,
  }
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <Flex direction="column" gap="1">
      <Text as="label" size="2" weight="bold">
        {label}
        {hint && (
          <Text size="1" color="gray" weight="regular">
            {' '}
            {hint}
          </Text>
        )}
      </Text>
      {children}
    </Flex>
  )
}

export default function HomeworkEditor({ homework, onSave, onClose }: Props) {
  const editing = !!homework
  const [draft, setDraft] = useState<HomeworkInput>(() => toInput(homework))
  const [minutes, setMinutes] = useState(
    String(homework?.estimated_minutes ?? EMPTY_HOMEWORK.estimated_minutes),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const nextDates = describeNextHomeworkDates(draft)
  const input: HomeworkInput = {
    ...draft,
    estimated_minutes: minutes.trim() === '' ? 0 : Number(minutes),
  }
  const patch = (next: Partial<HomeworkInput>) => {
    setDraft((prev) => ({ ...prev, ...next }))
    setError('')
  }

  async function submit() {
    const message = validateHomework(input)
    if (message) {
      setError(message)
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(input)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppDialog
      open
      size="form"
      title={editing ? '编辑作业' : '新增作业'}
      closeDisabled={saving}
      description="设置作业的科目、周期和预计耗时。"
      onOpenChange={(open) => {
        if (!open && !saving) onClose()
      }}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (!saving) void submit()
        }}
      >
        <Flex direction="column" gap="4" pb="1">
          <Row label="作业名称" hint="必填">
            <TextField.Root
              aria-label="作业名称"
              required
              maxLength={120}
              placeholder="例如：每日阅读"
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Row>

          <Flex gap="3" wrap="wrap">
            <Flex direction="column" gap="1" flexGrow="1" flexBasis="10rem" minWidth="0">
              <Text size="2" weight="bold">
                所属科目
                <Text size="1" color="gray" weight="regular">
                  {' '}
                  必填
                </Text>
              </Text>
              <Select.Root
                value={draft.subject}
                onValueChange={(value) => patch({ subject: value as HomeworkSubject })}
              >
                <Select.Trigger aria-label="所属科目" />
                <Select.Content>
                  {Object.entries(HOMEWORK_SUBJECTS).map(([value, label]) => (
                    <Select.Item key={value} value={value}>
                      {label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Flex>
            <Flex direction="column" gap="1" flexGrow="1" flexBasis="10rem" minWidth="0">
              <Text size="2" weight="bold">
                优先级
                <Text size="1" color="gray" weight="regular">
                  {' '}
                  P0 最高，P4 最低
                </Text>
              </Text>
              <Select.Root
                value={draft.priority}
                onValueChange={(value) => patch({ priority: value as HomeworkPriority })}
              >
                <Select.Trigger aria-label="优先级" />
                <Select.Content>
                  {HOMEWORK_PRIORITIES.map((priority) => (
                    <Select.Item key={priority} value={priority}>
                      {priority}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Flex>
          </Flex>

          <Flex gap="3" wrap="wrap">
            <Flex direction="column" gap="1" flexGrow="1" flexBasis="10rem" minWidth="0">
              <Text size="2" weight="bold">
                作业周期
                <Text size="1" color="gray" weight="regular">
                  {' '}
                  必填
                </Text>
              </Text>
              <Select.Root
                value={draft.cycle}
                onValueChange={(value) => {
                  setDraft((prev) => withCycle(prev, value as HomeworkCycle, localDate()))
                  setError('')
                }}
              >
                <Select.Trigger aria-label="作业周期" />
                <Select.Content>
                  {Object.entries(HOMEWORK_CYCLES).map(([value, label]) => (
                    <Select.Item key={value} value={value}>
                      {label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Flex>
            {(draft.cycle === 'weekly' || draft.cycle === 'custom') && (
              <Flex direction="column" gap="1" flexGrow="1" flexBasis="10rem" minWidth="0">
                <Text size="2" weight="bold">
                  每周次数
                </Text>
                <Select.Root
                  value={String(draft.times_per_week ?? 1)}
                  onValueChange={(value) => patch({ times_per_week: Number(value) })}
                >
                  <Select.Trigger aria-label="每周次数" />
                  <Select.Content>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <Select.Item key={n} value={String(n)}>
                        {n} 次
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Flex>
            )}
            {usesCycleCount(draft.cycle) && (
              <Flex direction="column" gap="1" flexGrow="1" flexBasis="10rem" minWidth="0">
                <Text size="2" weight="bold">
                  每周期完成次数
                  {draft.cycle === 'monthly' && (
                    <Text size="1" color="gray" weight="regular">
                      {' '}
                      按自然月计算
                    </Text>
                  )}
                </Text>
                <TextField.Root
                  aria-label="每周期完成次数"
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={draft.times_per_cycle ?? ''}
                  onChange={(e) => patch({ times_per_cycle: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </Flex>
            )}
          </Flex>

          {draft.cycle === 'weekly' && (
            <Flex gap="3" wrap="wrap">
              <Flex direction="column" gap="1" flexGrow="1" minWidth="10rem">
                <Text size="2" weight="bold">
                  开始星期
                </Text>
                <Select.Root
                  value={String(draft.start_weekday ?? 1)}
                  onValueChange={(value) => patch({ start_weekday: Number(value) })}
                >
                  <Select.Trigger aria-label="开始星期" />
                  <Select.Content>
                    {HOMEWORK_WEEKDAY_ORDER.map((day) => (
                      <Select.Item key={day} value={String(day)}>
                        {HOMEWORK_WEEKDAYS[day]}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Flex>
              <Flex direction="column" gap="1" flexGrow="1" minWidth="10rem">
                <Text size="2" weight="bold">
                  结束星期
                </Text>
                <Select.Root
                  value={String(draft.end_weekday ?? 0)}
                  onValueChange={(value) => patch({ end_weekday: Number(value) })}
                >
                  <Select.Trigger aria-label="结束星期" />
                  <Select.Content>
                    {HOMEWORK_WEEKDAY_ORDER.map((day) => (
                      <Select.Item key={day} value={String(day)}>
                        {HOMEWORK_WEEKDAYS[day]}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Flex>
            </Flex>
          )}

          <Flex gap="3" wrap="wrap">
            {(draft.cycle === 'custom' || needsCycleStart(draft.cycle)) && (
              <Flex direction="column" gap="1" flexGrow="1" flexBasis="10rem" minWidth="0">
                <Text size="2" weight="bold">
                  开始日期
                </Text>
                <TextField.Root
                  aria-label="开始日期"
                  type="date"
                  required
                  value={draft.start_date ?? ''}
                  onChange={(e) => patch({ start_date: e.target.value || null })}
                />
              </Flex>
            )}
            <Flex direction="column" gap="1" flexGrow="1" flexBasis="10rem" minWidth="0">
              <Text size="2" weight="bold">
                预计耗时
                <Text size="1" color="gray" weight="regular">
                  {' '}
                  分钟，最多 {MAX_HOMEWORK_MINUTES}
                </Text>
              </Text>
              <TextField.Root
                aria-label="预计耗时（分钟）"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_HOMEWORK_MINUTES}
                step={1}
                required
                value={minutes}
                onChange={(e) => {
                  setMinutes(e.target.value)
                  setError('')
                }}
              >
                <TextField.Slot side="right">分钟</TextField.Slot>
              </TextField.Root>
            </Flex>
          </Flex>

          {draft.cycle === 'custom' && (
            <Row label="结束日期">
              <TextField.Root
                aria-label="结束日期"
                type="date"
                required
                min={draft.start_date ?? undefined}
                value={draft.end_date ?? ''}
                onChange={(e) => patch({ end_date: e.target.value || null })}
              />
            </Row>
          )}

          {nextDates && <Text as="p" size="2" aria-live="polite">{nextDates}</Text>}

          <Row label="备注" hint="可选">
            <TextArea
              aria-label="备注"
              maxLength={2000}
              rows={3}
              placeholder="补充要求、材料位置等"
              value={draft.notes}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </Row>

          <Text as="label" size="2">
            <Flex align="center" gap="2">
              <Switch
                checked={draft.enabled}
                onCheckedChange={(enabled) => patch({ enabled })}
                aria-label="启用作业"
              />
              <Text weight="bold">{draft.enabled ? '已启用' : '已停用'}</Text>
            </Flex>
          </Text>

          {error && (
            <Text role="alert" size="2" color="red">
              {error}
            </Text>
          )}

          <Flex justify="end" gap="2">
            <Button type="button" variant="soft" color="gray" disabled={saving} onClick={onClose}>
              取消
            </Button>
            <Button type="submit" loading={saving} disabled={saving}>
              保存
            </Button>
          </Flex>
        </Flex>
      </form>
    </AppDialog>
  )
}
