'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { AppDialog } from '@rosie/ui'
import { Button, Callout, Flex, Tabs, Text, TextArea } from '@rosie/ui/themes'
import type { WordEntry } from '@rosie/core'
import { parseWordRows, WORD_TEMPLATE_HEADERS } from '@rosie/english'

type Props = {
  /** Current active 词库; pasted rows without a stage are backfilled with it. */
  defaultStage: string
  disabled: boolean
  onConfirm: (words: WordEntry[]) => Promise<void>
}

export default function BatchAddModal({ defaultStage, disabled, onConfirm }: Props) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function save(words: WordEntry[]) {
    setSubmitting(true)
    try {
      await onConfirm(words)
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppDialog
      title="批量添加单词"
      open={open}
      onOpenChange={setOpen}
      closeDisabled={submitting}
      trigger={
        <Button type="button" variant="soft" disabled={disabled}>
          批量添加
        </Button>
      }
    >
      <BatchAddForm
        defaultStage={defaultStage}
        submitting={submitting}
        onCancel={() => setOpen(false)}
        onConfirm={save}
      />
    </AppDialog>
  )
}

type FormProps = Pick<Props, 'defaultStage' | 'onConfirm'> & {
  submitting: boolean
  onCancel: () => void
}

function BatchAddForm({ defaultStage, submitting, onCancel, onConfirm }: FormProps) {
  const parseRequest = useRef(0)
  const [parsed, setParsed] = useState<WordEntry[] | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [status, setStatus] = useState<{ type: 'info' | 'error'; text: string } | null>(null)
  const processFile = useCallback(
    async (file: File) => {
      const request = ++parseRequest.current
      setParsed(null)
      setStatus({ type: 'info', text: '正在解析文件…' })
      try {
        const xlsx = await import('xlsx')
        const { read, utils } = xlsx.default || xlsx
        const buf = await file.arrayBuffer()
        if (request !== parseRequest.current) return
        const wb = read(buf, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: unknown[][] = utils.sheet_to_json(ws, { header: 1, defval: '' })
        const words = parseWordRows(rows, { hasHeader: true, hasStageColumn: true, defaultStage })
        if (!words.length) {
          setParsed(null)
          setStatus({ type: 'error', text: '未解析到有效单词（需 Stage/Unit/Lesson/单词 列）' })
          return
        }
        setParsed(words)
        setStatus(null)
      } catch (err) {
        if (request !== parseRequest.current) return
        setParsed(null)
        setStatus({
          type: 'error',
          text: `解析失败：${err instanceof Error ? err.message : '未知错误'}`,
        })
      }
    },
    [defaultStage],
  )

  const parsePaste = useCallback(() => {
    const lines = pasteText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    // 含 Tab 的按 Tab 分列（从表格复制最稳，单元格内逗号不会误拆），否则退回逗号
    const rows: unknown[][] = lines.map((line) =>
      (line.includes('\t') ? line.split('\t') : line.split(',')).map((c) => c.trim()),
    )
    const words = parseWordRows(rows, { hasHeader: false, hasStageColumn: false, defaultStage })
    if (!words.length) {
      setParsed(null)
      setStatus({ type: 'error', text: '未解析到有效行（每行至少需要 单元 / 课次 / 单词 三列）' })
      return
    }
    setParsed(words)
    setStatus(null)
  }, [pasteText, defaultStage])

  const downloadTemplate = useCallback(async () => {
    const xlsx = await import('xlsx')
    const { utils, writeFile } = xlsx.default || xlsx
    const sample = [
      [
        defaultStage || '4A',
        'Unit 1',
        'Lesson 1',
        'apple',
        'a round fruit',
        '苹果',
        '/ˈæpəl/',
        'I eat an apple.',
        'a-pp-le',
        'ap, ple',
        'round|red; fruit|gold',
      ],
    ]
    const ws = utils.aoa_to_sheet([WORD_TEMPLATE_HEADERS, ...sample])
    ws['!cols'] = [
      { wch: 8 },
      { wch: 10 },
      { wch: 12 },
      { wch: 18 },
      { wch: 34 },
      { wch: 14 },
      { wch: 16 },
      { wch: 40 },
      { wch: 14 },
      { wch: 18 },
      { wch: 34 },
    ]
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, '单词数据')
    writeFile(wb, 'RosieFun_词库模版.xlsx')
  }, [defaultStage])

  const handleConfirm = useCallback(async () => {
    if (!parsed?.length || submitting) return
    try {
      await onConfirm(parsed)
    } catch {
      setStatus({ type: 'error', text: '写入失败，请重试。' })
    }
  }, [parsed, submitting, onConfirm])

  const stageSummary = useMemo(() => {
    if (!parsed) return ''
    const stages = [...new Set(parsed.map((w) => w.stage || '(无)'))]
    const units = new Set(parsed.map((w) => w.unit)).size
    return `${parsed.length} 个单词 · ${units} 个 Unit · 词库：${stages.join(', ')}`
  }, [parsed])

  function resetPreview() {
    parseRequest.current++
    setParsed(null)
    setStatus(null)
  }

  return (
    <>
      <Text as="p" size="2" color="gray" mb="4">
        已有的同词库、同单元、同课次单词会更新，其余单词会追加。
      </Text>
      <Tabs.Root defaultValue="excel" onValueChange={resetPreview}>
        <Tabs.List aria-label="导入方式" mb="4">
          <Tabs.Trigger value="excel" disabled={submitting}>
            上传 Excel
          </Tabs.Trigger>
          <Tabs.Trigger value="paste" disabled={submitting}>
            粘贴文本
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="excel">
          <Flex direction="column" align="start" gap="3">
            <Button type="button" variant="soft" onClick={downloadTemplate}>
              下载 Excel 模版
            </Button>
            <Text as="label" size="2">
              选择 .xlsx 文件
              <input
                type="file"
                accept=".xlsx"
                disabled={submitting}
                className="mt-2 block max-w-full"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void processFile(file)
                  else resetPreview()
                }}
              />
            </Text>
          </Flex>
        </Tabs.Content>
        <Tabs.Content value="paste">
          <Text as="label" htmlFor="batch-word-paste" size="2" weight="medium">
            每行一个单词
          </Text>
          <Text as="p" size="2" color="gray" mb="2" id="batch-word-columns">
            从表格复制或用逗号分列。列顺序为单元、课次、单词、英文释义、中文释义、音标、例句、phonics、音节、关键词高亮、特殊词形
            JSON、词性。 前三列必填，默认词库为 {defaultStage || '未选'}。
          </Text>
          <TextArea
            id="batch-word-paste"
            aria-describedby="batch-word-columns"
            value={pasteText}
            disabled={submitting}
            rows={6}
            placeholder={'Unit 1\tLesson 1\tapple\ta round fruit\t苹果'}
            onChange={(event) => {
              setPasteText(event.target.value)
              resetPreview()
            }}
          />
          <Button
            type="button"
            variant="soft"
            mt="2"
            onClick={parsePaste}
            disabled={!pasteText.trim() || submitting}
          >
            解析预览
          </Button>
        </Tabs.Content>
      </Tabs.Root>

      {status && (
        <Callout.Root
          mt="3"
          color={status.type === 'error' ? 'red' : 'blue'}
          role={status.type === 'error' ? 'alert' : 'status'}
        >
          <Callout.Text>{status.text}</Callout.Text>
        </Callout.Root>
      )}
      {parsed && (
        <Text as="p" role="status" mt="3" size="2">
          已解析 {stageSummary}
        </Text>
      )}

      <Flex mt="5" gap="2" justify="end">
        <Button type="button" variant="soft" color="gray" disabled={submitting} onClick={onCancel}>
          取消
        </Button>
        <Button type="button" disabled={!parsed?.length || submitting} onClick={handleConfirm}>
          {submitting ? '写入中…' : parsed ? `确认添加 ${parsed.length} 个` : '确认添加'}
        </Button>
      </Flex>
    </>
  )
}
