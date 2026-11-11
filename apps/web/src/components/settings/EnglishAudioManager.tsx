'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge, Box, Button, Card, Flex, Grid, Heading, Separator, Text } from '@rosie/ui/themes'
import { SyncSelect, useSyncConfirmation } from './SyncControls'
import { invalidateSessionStore } from '@rosie/core'
import { DirectoryChooser, EnglishFileList } from './EnglishAudioFiles'
import { LoadStatus, request, useQuery } from './EnglishSyncRequest'
import type { SyncDirectoryList } from '@/app/api/baidu/sync/directories/route'
import { directoryPrefix, type LessonAudioEditor, type LessonAudioPick } from '@/lib/english-audio-types'

type Lesson = { stage: string; unit: string; lesson: string; title: string; key: string }
type Props = { userId: string; paths: SyncDirectoryList }

function samePick(left?: LessonAudioPick, right?: LessonAudioPick) {
  return left?.directory_id === right?.directory_id && left?.path === right?.path && left?.file_id === right?.file_id
}

function Bindings({ userId, paths, initial, url, reload }: Props & { initial: LessonAudioEditor; url: string; reload: () => void }) {
  const { confirm, dialog } = useSyncConfirmation()
  const [saved, setSaved] = useState(initial)
  const [picks, setPicks] = useState(initial.picks)
  const [main, setMain] = useState(initial.mainDirectory)
  const [choosing, setChoosing] = useState(!initial.mainDirectory)
  const [target, setTarget] = useState(() => initial.slots.find(row => !initial.picks[row.slot])?.slot ?? initial.slots[0]?.slot ?? '')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  const dirty = main?.directory_id !== saved.mainDirectory?.directory_id || main?.path !== saved.mainDirectory?.path ||
    saved.slots.some(({ slot }) => !samePick(picks[slot], saved.picks[slot]))
  function insideMain(pick: LessonAudioPick) {
    return main && pick.directory_id === main.directory_id && pick.path.startsWith(directoryPrefix(main.path))
  }
  const invalidPick = Object.entries(picks).some(([slot, pick]) => !samePick(pick, saved.picks[slot]) && !insideMain(pick))
  const targetLabel = saved.slots.find(row => row.slot === target)?.label
  function bind(pick: LessonAudioPick) {
    if (!target || saving) return
    const next = { ...picks, [target]: pick }
    setPicks(next)
    const index = saved.slots.findIndex(row => row.slot === target)
    const remaining = [...saved.slots.slice(index + 1), ...saved.slots.slice(0, index)]
    setTarget(remaining.find(row => !next[row.slot])?.slot ?? '')
    setMessage('')
  }
  async function save() {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setSaving(true); setMessage('')
    try {
      const next = await request<{ revision: string }>(userId, url, controller.signal, { revision: saved.revision, mainDirectory: main, picks })
      if (controller.signal.aborted) return
      setSaved({ ...saved, mainDirectory: main, picks, revision: next.revision })
      invalidateSessionStore('baidu_reading_audio_keys')
      setMessage('本课绑定已保存。')
    } catch (e) {
      if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : '保存失败。')
    } finally { pending.current = null; if (!controller.signal.aborted) setSaving(false) }
  }
  return <Flex direction="column" gap="3" data-sync-dirty={dirty} data-sync-saving={saving}>
    <Card>
      <Flex direction="column" gap="2">
        <Flex align="center" justify="between" gap="2" wrap="wrap">
          <Box minWidth="0">
            <Heading as="h3" size="3">课程主目录</Heading>
            {main && <Text as="p" size="2" color="gray" truncate title={main.path}>{main.path}</Text>}
          </Box>
          <Flex gap="2">
            {main && <Button variant="soft" color="gray" size="1" disabled={saving} onClick={() => {
              setMain(null); setChoosing(true); setMessage('')
            }}>解除主目录</Button>}
            {!choosing && <Button variant="soft" size="1" disabled={saving} onClick={() => setChoosing(true)}>更换目录</Button>}
          </Flex>
        </Flex>
        {choosing && <DirectoryChooser userId={userId} paths={paths} initial={main} disabled={saving}
          cancel={main ? () => setChoosing(false) : undefined} choose={directory => {
            setMain(directory); setChoosing(false); setMessage('')
          }} />}
      </Flex>
    </Card>
    <Grid gap="3" columns={{ initial: '1', sm: '2' }} align="start">
      <Card>
        <Flex align="center" justify="between" gap="2" mb="3">
          <Heading as="h3" size="3">课程音频</Heading>
          <Text size="1" color="gray">{Object.keys(picks).length} / {saved.slots.length} 已绑定</Text>
        </Flex>
        <Box maxHeight="55vh" overflowY="auto">
          {['课级音频', '单个单词音频', '逐句听记音频'].map((groupLabel, group) => {
            const rows = saved.slots.filter(s => (s.slot.startsWith('word:') ? 1 : s.slot.startsWith('clip:') ? 2 : 0) === group)
            if (!rows.length) return null
            return <Box key={groupLabel} mb="3">
              <Text as="p" size="1" weight="bold" color="gray" mb="1">{groupLabel}</Text>
              {rows.map(({ slot, label }) => {
                const pick = picks[slot]
                return <Box key={slot}>
                  <Flex align="center" gap="2" py="2">
                    <Box flexGrow="1" minWidth="0">
                      <Text as="p" size="2" weight="medium">{label}</Text>
                      {pick ? <Text as="p" size="1" color="gray" truncate title={pick.path}>
                        {pick.path.split('/').pop()}{main && !insideMain(pick) && ' · 主目录外'}
                      </Text> : <Text as="p" size="1" color="gray">未绑定</Text>}
                    </Box>
                    <Button size="1" variant={target === slot ? 'solid' : 'soft'} disabled={saving}
                      aria-label={'匹配 ' + label} aria-pressed={target === slot}
                      onClick={() => setTarget(slot)}>{target === slot ? '匹配中' : '匹配'}</Button>
                    {pick && <Button size="1" color="gray" variant="soft" aria-label={'解绑 ' + label} disabled={saving}
                      onClick={() => { const next = { ...picks }; delete next[slot]; setPicks(next); setTarget(slot); setMessage('') }}>解绑</Button>}
                  </Flex>
                  <Separator size="4" />
                </Box>
              })}
            </Box>
          })}
        </Box>
      </Card>
      <Card>
        <Flex direction="column" gap="2">
          <Heading as="h3" size="3">目录文件</Heading>
          {main ? <>
            {targetLabel ? <Box role="status"><Badge>正在匹配 · {targetLabel}</Badge></Box> : <Text size="2" color="gray">选择课程音频条目后即可绑定文件。</Text>}
            <EnglishFileList key={JSON.stringify([paths.generation, main.directory_id, main.path])}
              userId={userId} generation={paths.generation} main={main} disabled={saving || !target}
              choose={bind} />
          </> : <Text size="2" color="gray">选定主目录后，这里会列出其中及子目录内的文件。</Text>}
        </Flex>
      </Card>
    </Grid>
    {invalidPick && <Text role="alert" size="2" color="red">有新绑定的文件位于当前主目录外，请重新匹配或解绑后保存。</Text>}
    <Flex gap="2" wrap="wrap">
      <Button loading={saving} disabled={saving || !dirty || invalidPick} onClick={() => void save()}>保存本课绑定</Button>
      <Button variant="soft" disabled={saving} onClick={() => { if (dirty) confirm('放弃修改并重新读取？', reload); else reload() }}>重新读取</Button>
    </Flex>
    {message && <Text size="2" role="status">{message}</Text>}
    {dialog}
  </Flex>
}

export default function EnglishAudioManager({ userId, paths }: Props) {
  const catalog = useQuery<Lesson[]>(userId, '/api/baidu/sync/english')
  const [selectedStage, setSelectedStage] = useState('')
  const [unit, setUnit] = useState('')
  const [lesson, setLesson] = useState('')
  const { confirm, dialog } = useSyncConfirmation()
  const section = useRef<HTMLDivElement>(null)
  const url = lesson ? '/api/baidu/sync/english?' + new URLSearchParams({ lesson, generation: paths.generation }) : ''
  const editor = useQuery<LessonAudioEditor>(userId, url)
  const rows = catalog.data ?? []
  const stages = [...new Set(rows.map(row => row.stage).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
  const stage = stages.includes(selectedStage) ? selectedStage : stages[0] ?? ''
  function changeSelection(proceed: () => void) {
    if (section.current?.querySelector('[data-sync-saving="true"]')) return
    if (section.current?.querySelector('[data-sync-dirty="true"]')) confirm('放弃本课尚未保存的修改？', proceed)
    else proceed()
  }
  return <Flex ref={section} direction="column" gap="3" role="region" aria-label="英语资源同步">
    <Heading as="h2" size="4">英语资源同步</Heading>
    <LoadStatus {...catalog} />
    {catalog.data && <Grid gap="2" columns={{ initial: '1', sm: '3' }}>
      <SyncSelect label="册别" value={stage} disabled={!stages.length} empty={stages.length ? undefined : '暂无册别'}
        options={stages.map(v => ({ value: v, label: v }))}
        onValueChange={v => changeSelection(() => { setSelectedStage(v); setUnit(''); setLesson('') })} />
      <SyncSelect label="单元" empty="选择单元" value={unit} disabled={!stage}
        options={[...new Set(rows.filter(p => p.stage === stage).map(p => p.unit))].map(v => ({ value: v, label: v }))}
        onValueChange={v => changeSelection(() => { setUnit(v); setLesson('') })} />
      <SyncSelect label="Lesson" empty="选择 Lesson" value={lesson} disabled={!unit}
        options={rows.filter(p => p.stage === stage && p.unit === unit).map(p => ({ value: p.key, label: p.lesson + ' · ' + p.title }))}
        onValueChange={v => changeSelection(() => setLesson(v))} />
    </Grid>}
    <LoadStatus {...editor} />
    {editor.data && <Bindings key={url} initial={editor.data} url={url} reload={editor.retry} userId={userId} paths={paths} />}
    {dialog}
  </Flex>
}
