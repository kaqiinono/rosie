'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  bindingValue,
  type MathVideoEditor,
  type VideoProblem,
} from '@/lib/baidu-math-video-report-types'
import { AppDialog, StickerCard } from '@rosie/ui'
import { Badge, Box, Button, Flex, Grid, Heading, Text } from '@rosie/ui/themes'
import {
  lessonReplayKey,
  lessonReplayOrder,
  orderedLessonReplayKeys,
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
  onlyUnbound: boolean
  reorder: (left: string, right: string) => void
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

export default function MathVideoPairingPanel({ editor, problems, picks, busy, onlyUnbound, reorder, choose }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const desktop = useSyncExternalStore(subscribeLayout, desktopLayout, serverLayout)
  const [pickerOpen, setPickerOpen] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const selectedRow = useRef<HTMLDivElement>(null)
  const wholeLesson = {
    id: lessonReplayKey(editor.lessonKey),
    label: '整讲回放',
    title: '可连续添加多个视频',
  }
  const summary = { id: 'summary', label: '本讲总结视频', title: '可连续添加多个视频' }
  const summaryKeys = orderedSummaryKeys(editor.lessonKey, Object.keys(picks))
  const fullKeys = orderedLessonReplayKeys(editor.lessonKey, Object.keys(picks))
  const targets = [wholeLesson, summary, ...problems].filter((target) => !onlyUnbound ||
    (target.id === wholeLesson.id ? !fullKeys.length : target.id === summary.id ? !summaryKeys.length : !picks[target.id]))
  const active =
    targets.find((p) => p.id === selectedId) ??
    targets.find((p) => p.id !== wholeLesson.id && p.id !== summary.id && !picks[p.id]) ??
    targets[0]
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
    if (active.id === summary.id || active.id === wholeLesson.id) {
      const full = active.id === wholeLesson.id
      const keys = full ? fullKeys : summaryKeys
      const last = keys[keys.length - 1]
      const order = last ? (full ? lessonReplayOrder : summaryReplayOrder)(editor.lessonKey, last) + 1 : 1
      choose((full ? lessonReplayKey : summaryReplayKey)(editor.lessonKey, order), fileId)
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
        {active ? `当前匹配：${active.label} · ${active.title}` : '没有待绑定的题目；可关闭“只看未绑定”继续添加。'}
      </Text>
      <MathVideoFilePicker
        editor={editor}
        picks={picks}
        problemId={active?.id ?? ''}
        disabled={busy || !editor.version || !active}
        choose={assign}
        onlyUnbound={onlyUnbound}
      />
    </>
  )

  return (
    <Grid columns={{ initial: '1', md: '2' }} gap="3" align="start">
      <StickerCard size="sm">
        <Heading as="h4" size="3" mb="2">
          讲次视频与题目（{problems.length} 题）
        </Heading>
        <Box ref={list} role="list" aria-label="题目列表" maxHeight="24rem" overflowY="auto">
          {targets.map((p) => {
            const selected = p.id === active?.id
            const multi = p.id === summary.id || p.id === wholeLesson.id
            const keys = p.id === summary.id ? summaryKeys : p.id === wholeLesson.id ? fullKeys : picks[p.id] ? [p.id] : []
            return (
              <Box key={p.id} role="listitem" ref={selected ? selectedRow : undefined} py="2">
                <StickerCard size="sm" radius="md" elevation="flat" tone={selected ? 'accent' : 'white'}>
                  <Flex direction="column" gap="3">
                    <Grid columns="minmax(0, 1fr) 5rem" align="start" gap="2">
                      <Text size="2" weight="medium">{p.label} · {p.title}</Text>
                      <Box flexShrink="0">
                        <Button size="1" variant={selected ? 'solid' : 'soft'} aria-pressed={selected}
                          aria-label={'选择 ' + p.label} disabled={busy} onClick={() => selectProblem(p.id)}>
                          {multi ? '添加视频' : selected ? '当前题目' : '选择视频'}
                        </Button>
                      </Box>
                    </Grid>
                  <Flex direction="column" gap="2" minWidth="0">
                    {multi && <Badge color="gray">已绑定 {keys.length} 个</Badge>}
                    {!keys.length && <Text size="1" color="gray">未绑定</Text>}
                    {keys.map((key, index) => {
                      const id = picks[key]!
                      const old = bindings.get(key)
                      const filename = editor.files[id] ?? (old && bindingValue(old) === id ? old.name : id)
                      return <Grid key={key} columns="minmax(0, 1fr) 5rem" align="start" gap="2">
                        <Flex direction="column" gap="1" minWidth="0">
                        <Text size="1" color="gray" className="break-all">
                          {multi && `${index + 1}. `}{filename}
                          {editor.version && !editor.files[id] && '（文件缺失）'}
                          {editor.occupied[id] && '（已被其他讲次占用，请改选）'}
                        </Text>
                        {multi && <Flex gap="1" wrap="wrap">
                            <Button size="1" variant="soft" aria-label={'上移 ' + filename}
                              disabled={busy || index === 0 || !editor.files[id] || !editor.files[picks[keys[index - 1]!]!]}
                              onClick={() => reorder(key, keys[index - 1]!)}>上移</Button>
                            <Button size="1" variant="soft" aria-label={'下移 ' + filename}
                              disabled={busy || index === keys.length - 1 || !editor.files[id] || !editor.files[picks[keys[index + 1]!]!]}
                              onClick={() => reorder(key, keys[index + 1]!)}>下移</Button>
                        </Flex>}
                        </Flex>
                        <Box>
                          <Button size="1" variant="soft" color="red" disabled={busy} aria-label={'解绑 ' + filename}
                            onClick={() => choose(key, null)}>解绑</Button>
                        </Box>
                      </Grid>
                    })}
                  </Flex>
                  </Flex>
                </StickerCard>
              </Box>
            )
          })}
        </Box>
        {!problems.length && (
          <Text size="2" color="gray">
            没有符合筛选条件的题目。
          </Text>
        )}
      </StickerCard>
      {desktop ? (
        <StickerCard size="sm">
          <Heading as="h4" size="3" mb="2">
            视频列表
          </Heading>
          {videoList}
        </StickerCard>
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
