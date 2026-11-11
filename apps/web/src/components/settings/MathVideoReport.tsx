'use client'

import { lessonReplayKey, orderedSummaryKeys } from '@rosie/math-kit/utils/lesson-registry'
import { useState } from 'react'
import type { MathVideoEditor } from '@/lib/baidu-math-video-report-types'
import { Box, Button, Card, Flex, Text } from '@rosie/ui/themes'

export default function MathVideoReport({ editor }: { editor: MathVideoEditor }) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string[]>([])
  const labels = new Map(editor.problems.map((p) => [p.id, p.label + ' · ' + p.title]))
  labels.set(lessonReplayKey(editor.lessonKey), '整讲回放')
  for (const key of orderedSummaryKeys(
    editor.lessonKey,
    editor.bindings.map((b) => b.problemId),
  ))
    labels.set(key, '本讲总结视频')
  const byProblem = new Map(editor.bindings.map((b) => [b.problemId, b]))
  const groups: [string, string[]][] = [
    [
      '已绑定',
      editor.bindings
        .filter((b) => b.available)
        .map((b) => (labels.get(b.problemId) ?? b.problemId) + ' → ' + b.name),
    ],
    [
      '未绑定',
      editor.problems.filter((p) => !byProblem.has(p.id)).map((p) => p.label + ' · ' + p.title),
    ],
    [
      '其他讲次已占用',
      Object.entries(editor.occupied).map(
        ([id, owner]) => editor.files[id] + ' → ' + owner.lessonKey + ' / ' + owner.problemId,
      ),
    ],
    [
      '文件缺失',
      editor.bindings
        .filter((b) => !b.available)
        .map((b) => (labels.get(b.problemId) ?? b.problemId) + ' → ' + b.name),
    ],
    ['旧清单待确认', editor.reviewNames],
  ]
  return (
    <Box>
      <Button variant="soft" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? '收起匹配报告' : '查看匹配报告'}
      </Button>
      {open && (
        <Card mt="2">
          <Flex direction="column" gap="2" align="start">
            <Text size="2" color="gray">
              本讲按已保存的绑定统计，文件占用按当前所选目录显示。
            </Text>
            {groups.map(([label, rows]) => (
              <Box key={label}>
                <Button
                  variant="soft"
                  color="gray"
                  aria-expanded={expanded.includes(label)}
                  onClick={() =>
                    setExpanded((prev) =>
                      prev.includes(label)
                        ? prev.filter((item) => item !== label)
                        : [...prev, label],
                    )
                  }
                >
                  {label}（{rows.length}）
                </Button>
                <Box
                  display={expanded.includes(label) ? 'block' : 'none'}
                  maxHeight="18rem"
                  overflowY="auto"
                  role="list"
                >
                  {rows.map((row, i) => (
                    <Text key={i} as="p" role="listitem" size="2" my="1" className="break-all">
                      {row}
                    </Text>
                  ))}
                </Box>
              </Box>
            ))}
          </Flex>
        </Card>
      )}
    </Box>
  )
}
