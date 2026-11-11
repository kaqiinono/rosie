'use client'

import { lessonReplayKey, orderedSummaryKeys } from '@rosie/math-kit/utils/lesson-registry'
import { useMemo, useState } from 'react'
import type { MathVideoEditor } from '@/lib/baidu-math-video-report-types'
import { Box, Button, Flex, Text, TextField } from '@rosie/ui/themes'

type Props = {
  editor: MathVideoEditor
  picks: Record<string, string>
  problemId: string
  disabled?: boolean
  choose: (id: string) => void
}
export default function MathVideoFilePicker({ editor, picks, problemId, disabled, choose }: Props) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const used = new Map(Object.entries(picks).map(([problem, file]) => [file, problem]))
  const labels = new Map(editor.problems.map((p) => [p.id, p.label]))
  labels.set(lessonReplayKey(editor.lessonKey), '整讲回放')
  for (const key of orderedSummaryKeys(editor.lessonKey, Object.keys(picks)))
    labels.set(key, '本讲总结视频')
  const files = useMemo(() => {
    const collator = new Intl.Collator('zh-CN', { numeric: true })
    return Object.entries(editor.files).sort((a, b) => collator.compare(a[1], b[1]))
  }, [editor.files])
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? files.filter(([, name]) => name.toLowerCase().includes(query)) : files
  }, [files, search])
  const currentPage = Math.min(page, Math.max(0, Math.ceil(matches.length / 30) - 1))
  const offset = currentPage * 30
  return (
    <Flex direction="column" gap="2">
      <TextField.Root
        aria-label="搜索视频文件名"
        placeholder="搜索视频文件名"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(0)
        }}
      />
      <Box role="list" maxHeight="18rem" overflowY="auto">
        {matches.slice(offset, offset + 30).map(([id, name]) => {
          const owner = editor.occupied[id]
          const local = used.get(id)
          const occupied = owner
            ? owner.lessonKey + ' / ' + owner.problemId
            : local && local !== problemId
              ? '本讲 ' + (labels.get(local) ?? local)
              : ''
          const selected = picks[problemId] === id
          return (
            <Flex key={id} role="listitem" align="center" justify="between" py="1" gap="2">
              <Text size="2" className="break-all">
                {name}
                {occupied && '（已占用：' + occupied + '）'}
              </Text>
              <Button
                type="button"
                size="1"
                variant={selected ? 'solid' : 'soft'}
                aria-pressed={selected}
                aria-label={
                  name +
                  (selected ? '（当前绑定）' : '') +
                  (occupied ? '（已占用：' + occupied + '）' : '')
                }
                disabled={disabled || Boolean(occupied)}
                onClick={() => choose(id)}
              >
                {selected ? '当前绑定' : '绑定'}
              </Button>
            </Flex>
          )
        })}
      </Box>
      {!matches.length && (
        <Text size="2" color="gray">
          没有符合条件的视频。
        </Text>
      )}
      {matches.length > 30 && (
        <Flex align="center" gap="2">
          <Button variant="soft" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>
            上一页
          </Button>
          <Text size="2">
            {currentPage + 1} / {Math.ceil(matches.length / 30)}
          </Text>
          <Button
            variant="soft"
            disabled={offset + 30 >= matches.length}
            onClick={() => setPage(currentPage + 1)}
          >
            下一页
          </Button>
        </Flex>
      )}
    </Flex>
  )
}
