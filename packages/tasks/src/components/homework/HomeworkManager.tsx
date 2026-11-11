'use client'

import { useRef, useState } from 'react'
import { StickerCard } from '@rosie/ui'
import {
  AlertDialog,
  Badge,
  Button,
  Flex,
  Grid,
  IconButton,
  Select,
  Switch,
  Text,
  TextField,
} from '@rosie/ui/themes'
import {
  HOMEWORK_CYCLES,
  HOMEWORK_SUBJECTS,
  HOMEWORK_SUBJECT_COLORS,
  describeSchedule,
  type Homework,
  type HomeworkInput,
  type HomeworkSubject,
} from '../../homework'
import type { useHomeworkData } from '../../useHomeworkData'
import HomeworkEditor from './HomeworkEditor'

type Api = ReturnType<typeof useHomeworkData>
type Editor = { homework?: Homework }

export default function HomeworkManager({
  api,
  notify,
}: {
  api: Api
  notify: (message: string) => void
}) {
  const { data } = api
  const [query, setQuery] = useState(''),
    [subject, setSubject] = useState<'all' | HomeworkSubject>('all')
  const [status, setStatus] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [editor, setEditor] = useState<Editor | null>(null),
    [removing, setRemoving] = useState<Homework | null>(null)
  const [busyId, setBusyId] = useState(''),
    [deleting, setDeleting] = useState(false),
    [actionError, setActionError] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const keyword = query.trim().toLocaleLowerCase()
  const rows = data
    .filter(
      (item) =>
        (subject === 'all' || item.subject === subject) &&
        (status === 'all' || item.enabled === (status === 'enabled')) &&
        (!keyword || `${item.name} ${item.notes}`.toLocaleLowerCase().includes(keyword)),
    )
    .sort((a, b) => a.priority.localeCompare(b.priority))
  const enabledCount = data.filter((item) => item.enabled).length
  const totalMinutes = data
    .filter((item) => item.enabled)
    .reduce((sum, item) => sum + item.estimated_minutes, 0)
  const filtering = subject !== 'all' || status !== 'all' || !!keyword

  async function save(input: HomeworkInput) {
    if (editor?.homework) {
      await api.update(editor.homework.id, input)
      notify('作业已更新')
    } else {
      await api.create(input)
      notify('作业已新增')
    }
  }
  async function toggle(item: Homework, enabled: boolean) {
    setBusyId(item.id)
    setActionError('')
    try {
      await api.setEnabled(item.id, enabled)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : '操作失败，请重试。')
    } finally {
      setBusyId('')
    }
  }
  async function confirmRemove() {
    if (!removing) return
    setDeleting(true)
    setActionError('')
    try {
      await api.remove(removing.id)
      notify(`已删除「${removing.name}」`)
      setRemoving(null)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : '删除失败，请重试。')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Flex direction="column" gap="3" px={{ initial: '3', sm: '5' }} py="3">
      <Flex wrap="wrap" align="center" gap="2">
        <div className="min-w-40 flex-1">
          <TextField.Root
            ref={searchRef}
            type="search"
            aria-label="搜索作业名称或备注"
            placeholder="搜索作业名称或备注"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          >
            {query && (
              <TextField.Slot side="right">
                <IconButton
                  size="1"
                  variant="ghost"
                  aria-label="清空搜索"
                  onClick={() => {
                    setQuery('')
                    searchRef.current?.focus()
                  }}
                >
                  ×
                </IconButton>
              </TextField.Slot>
            )}
          </TextField.Root>
        </div>
        <Select.Root
          value={subject}
          onValueChange={(value) => setSubject(value as 'all' | HomeworkSubject)}
        >
          <Select.Trigger aria-label="按科目筛选" />
          <Select.Content>
            <Select.Item value="all">全部科目</Select.Item>
            {Object.entries(HOMEWORK_SUBJECTS).map(([value, label]) => (
              <Select.Item key={value} value={value}>
                {label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
        <Select.Root
          value={status}
          onValueChange={(value) => setStatus(value as 'all' | 'enabled' | 'disabled')}
        >
          <Select.Trigger aria-label="按状态筛选" />
          <Select.Content>
            <Select.Item value="all">全部状态</Select.Item>
            <Select.Item value="enabled">已启用</Select.Item>
            <Select.Item value="disabled">已停用</Select.Item>
          </Select.Content>
        </Select.Root>
        <Button onClick={() => setEditor({})}>新增作业</Button>
      </Flex>

      <Flex wrap="wrap" align="center" gap="2">
        <Text size="1" color="gray">
          <Text weight="bold" highContrast>
            {data.length}
          </Text>{' '}
          项作业
        </Text>
        <Text size="1" color="gray">
          <Text weight="bold" highContrast>
            {enabledCount}
          </Text>{' '}
          项启用
        </Text>
        <Text size="1" color="gray">
          启用作业预计共{' '}
          <Text weight="bold" highContrast>
            {totalMinutes}
          </Text>{' '}
          分钟
        </Text>
        {filtering && (
          <Button
            size="1"
            variant="soft"
            onClick={() => {
              setQuery('')
              setSubject('all')
              setStatus('all')
            }}
          >
            重置筛选
          </Button>
        )}
      </Flex>

      {actionError && !removing && (
        <Text role="alert" size="2" color="red">
          {actionError}
        </Text>
      )}

      {rows.length > 0 ? (
        <Grid columns={{ initial: '1', sm: '2', lg: '3' }} gap="3" asChild>
          <ul>
            {rows.map((item) => (
              <li key={item.id} className="min-w-0">
                <StickerCard
                  as="article"
                  size="md"
                  elevation="sm"
                  radius="md"
                  tone={item.enabled ? 'white' : 'paper'}
                  className="flex h-full flex-col gap-2"
                  aria-label={item.name}
                >
                  <Flex align="start" justify="between" gap="2">
                    <Text as="p" size="3" weight="bold" className="min-w-0 break-words">
                      {item.name}
                    </Text>
                    <Switch
                      size="2"
                      checked={item.enabled}
                      disabled={busyId === item.id}
                      aria-label={`${item.enabled ? '停用' : '启用'}${item.name}`}
                      onCheckedChange={(enabled) => {
                        void toggle(item, enabled)
                      }}
                    />
                  </Flex>
                  <Flex wrap="wrap" gap="1">
                    <Badge
                      variant="soft"
                      radius="full"
                      color={item.priority === 'P0' ? 'red' : 'gray'}
                    >
                      优先级 {item.priority}
                    </Badge>
                    <Badge
                      variant="soft"
                      radius="full"
                      color={HOMEWORK_SUBJECT_COLORS[item.subject]}
                    >
                      {HOMEWORK_SUBJECTS[item.subject]}
                    </Badge>
                    <Badge variant="soft" radius="full" color="gray">
                      {HOMEWORK_CYCLES[item.cycle]}
                    </Badge>
                    <Badge variant="soft" radius="full" color="gray">
                      约 {item.estimated_minutes} 分钟
                    </Badge>
                    {!item.enabled && (
                      <Badge variant="soft" radius="full" color="gray">
                        已停用
                      </Badge>
                    )}
                  </Flex>
                  <Text as="p" size="2" color="gray">
                    {describeSchedule(item)}
                  </Text>
                  {item.notes && (
                    <Text as="p" size="2" color="gray" className="break-words whitespace-pre-wrap">
                      {item.notes}
                    </Text>
                  )}
                  <Grid columns="2" gap="2" mt="auto" pt="1">
                    <Button
                      variant="soft"
                      aria-label={`编辑${item.name}`}
                      onClick={() => setEditor({ homework: item })}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="soft"
                      color="red"
                      aria-label={`删除${item.name}`}
                      onClick={() => {
                        setActionError('')
                        setRemoving(item)
                      }}
                    >
                      删除
                    </Button>
                  </Grid>
                </StickerCard>
              </li>
            ))}
          </ul>
        </Grid>
      ) : (
        <Flex direction="column" align="center" gap="2" py="6">
          <Text weight="bold">{data.length ? '没有匹配的作业' : '还没有作业'}</Text>
          <Text size="2" color="gray">
            {data.length
              ? '调整搜索或筛选条件试试。'
              : '新增第一项作业，设置科目、周期和预计耗时。'}
          </Text>
          {!data.length && <Button onClick={() => setEditor({})}>新增作业</Button>}
        </Flex>
      )}

      {editor && (
        <HomeworkEditor
          key={editor.homework?.id ?? 'new'}
          homework={editor.homework}
          onSave={save}
          onClose={() => setEditor(null)}
        />
      )}

      <AlertDialog.Root
        open={!!removing}
        onOpenChange={(open) => {
          if (!open && !deleting) setRemoving(null)
        }}
      >
        <AlertDialog.Content maxWidth="26rem">
          <AlertDialog.Title>删除作业</AlertDialog.Title>
          <AlertDialog.Description size="2">
            确定删除「{removing?.name}」吗？删除后无法恢复；只想暂时不用，可以改为停用。
          </AlertDialog.Description>
          {actionError && (
            <Text role="alert" size="2" color="red" as="p" mt="2">
              {actionError}
            </Text>
          )}
          <Flex justify="end" gap="2" mt="4">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray" disabled={deleting}>
                取消
              </Button>
            </AlertDialog.Cancel>
            <Button
              color="red"
              loading={deleting}
              disabled={deleting}
              onClick={() => {
                void confirmRemove()
              }}
            >
              删除
            </Button>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Flex>
  )
}
