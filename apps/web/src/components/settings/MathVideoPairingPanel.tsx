'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  bindingValue,
  type MathVideoEditor,
  type VideoProblem,
} from '@/lib/baidu-math-video-report-types'
import { AppDialog } from '@rosie/ui'
import { Badge, Box, Button, Card, Flex, Grid, Heading, Text } from '@rosie/ui/themes'
import {
  lessonReplayKey,
  orderedSummaryKeys,
  summaryReplayKey,
  summaryReplayOrder,
} from '@rosie/math-kit/utils/lesson-registry'
import MathVideoFilePicker from './MathVideoFilePicker'

type Props = {
  editor: MathVideoEditor
  problems: VideoProblem[]
  picks: Record<string, string>
  busy: boolean
  choose: (problemId: string, fileId: string | null) => void
}

const desktopQuery = '(min-width: 40rem)'
function subscribeLayout(update: () => void) {
  const media = window.matchMedia(desktopQuery)
  media.addEventListener('change', update)
  return () => media.removeEventListener('change', update)
}
const desktopLayout = () => window.matchMedia(desktopQuery).matches
const serverLayout = () => false

export default function MathVideoPairingPanel({ editor, problems, picks, busy, choose }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const desktop = useSyncExternalStore(subscribeLayout, desktopLayout, serverLayout)
  const [pickerOpen, setPickerOpen] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const selectedRow = useRef<HTMLDivElement>(null)
  const wholeLesson = {
    id: lessonReplayKey(editor.lessonKey),
    label: '整讲回放',
    title: '完整课堂视频',
  }
  const summary = { id: 'summary', label: '本讲总结视频', title: '可连续添加多个视频' }
  const summaryKeys = orderedSummaryKeys(editor.lessonKey, Object.keys(picks))
  const targets = [wholeLesson, summary, ...problems]
  const active =
    targets.find((p) => p.id === selectedId) ??
    problems.find((p) => !picks[p.id]) ??
    problems[0] ??
    wholeLesson
  const bindings = new Map(editor.bindings.map((b) => [b.problemId, b]))

  useEffect(() => {
    const container = list.current
    const row = selectedRow.current
    if (!container || !row) return
    const bounds = container.getBoundingClientRect()
    const item = row.getBoundingClientRect()
    if (item.bottom > bounds.bottom) container.scrollTop += item.bottom - bounds.bottom
    else if (item.top < bounds.top) container.scrollTop -= bounds.top - item.top
  }, [active?.id])

  function selectProblem(id: string) {
    setSelectedId(id)
    if (!desktop) setPickerOpen(true)
  }

  function assign(fileId: string) {
    if (!active || busy || !editor.version || picks[active.id] === fileId) return
    if (active.id === summary.id) {
      const last = summaryKeys[summaryKeys.length - 1]
      const order = last ? summaryReplayOrder(editor.lessonKey, last) + 1 : 1
      choose(summaryReplayKey(editor.lessonKey, order), fileId)
      return
    }
    choose(active.id, fileId)
    const index = targets.findIndex((p) => p.id === active.id)
    const remaining = [...targets.slice(index + 1), ...targets.slice(0, index)].filter(
      (p) => p.id !== wholeLesson.id && p.id !== summary.id,
    )
    const next = remaining.find((p) => !picks[p.id])
    setSelectedId(next?.id ?? active.id)
    if (!next) setPickerOpen(false)
  }

  const videoList = (
    <>
      <Text as="p" mb="2" size="2" weight="medium" aria-live="polite">
        当前匹配：{active.label} · {active.title}
      </Text>
      <MathVideoFilePicker
        editor={editor}
        picks={picks}
        problemId={active.id}
        disabled={busy || !editor.version}
        choose={assign}
      />
    </>
  )

  return (
    <Grid columns={{ initial: '1', sm: '2' }} gap="3" align="start">
      <Card>
        <Heading as="h4" size="3" mb="2">
          讲次视频与题目（{problems.length} 题）
        </Heading>
        <Box ref={list} role="list" aria-label="题目列表" maxHeight="24rem" overflowY="auto">
          {targets.map((p) => {
            const file = picks[p.id]
            const old = bindings.get(p.id)
            const name =
              file && (editor.files[file] ?? (old && bindingValue(old) === file ? old.name : file))
            const selected = p.id === active.id
            const isSummary = p.id === summary.id
            return (
              <Box key={p.id} role="listitem" ref={selected ? selectedRow : undefined} py="2">
                <Flex justify="between" align="start" gap="2" wrap="wrap">
                  <Text size="2" weight="medium">
                    {p.label} · {p.title}
                  </Text>
                  <Button
                    size="1"
                    variant={selected ? 'solid' : 'soft'}
                    aria-pressed={selected}
                    aria-label={'选择 ' + p.label}
                    disabled={busy}
                    onClick={() => selectProblem(p.id)}
                  >
                    {selected ? '当前题目' : '选择'}
                  </Button>
                </Flex>
                {isSummary ? (
                  <>
                    <Badge color="gray" mt="1">
                      已绑定 {summaryKeys.length} 个
                    </Badge>
                    {summaryKeys.map((key) => {
                      const id = picks[key]!
                      const filename = editor.files[id] ?? bindings.get(key)?.name ?? id
                      return (
                        <Flex key={key} align="center" justify="between" gap="2" mt="1">
                          <Text size="1" color="gray" className="break-all">
                            {filename}
                            {editor.version && !editor.files[id] && '（文件缺失）'}
                          </Text>
                          <Button
                            size="1"
                            variant="soft"
                            color="red"
                            disabled={busy}
                            aria-label={'解绑 ' + filename}
                            onClick={() => choose(key, null)}
                          >
                            解绑
                          </Button>
                        </Flex>
                      )
                    })}
                  </>
                ) : (
                  <Flex align="center" justify="between" gap="2" mt="1">
                    <Text size="1" color="gray" className="break-all">
                      {name || '未绑定'}
                      {file && editor.version && !editor.files[file] && '（文件缺失）'}
                      {file &&
                        editor.occupied[file] &&
                        ' · 已被 ' + editor.occupied[file].problemId + ' 占用，请改选。'}
                    </Text>
                    {file && (
                      <Button
                        size="1"
                        variant="soft"
                        color="red"
                        disabled={busy}
                        aria-label={'解绑 ' + p.label}
                        onClick={() => {
                          setSelectedId(p.id)
                          choose(p.id, null)
                        }}
                      >
                        解绑
                      </Button>
                    )}
                  </Flex>
                )}
              </Box>
            )
          })}
        </Box>
        {!problems.length && (
          <Text size="2" color="gray">
            没有符合筛选条件的题目。
          </Text>
        )}
      </Card>
      {desktop ? (
        <Card>
          <Heading as="h4" size="3" mb="2">
            视频列表
          </Heading>
          {videoList}
        </Card>
      ) : (
        <AppDialog
          title="选择回放视频"
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          trigger={
            <Button variant="soft" disabled={busy}>
              选择回放视频
            </Button>
          }
        >
          {videoList}
        </AppDialog>
      )}
    </Grid>
  )
}
