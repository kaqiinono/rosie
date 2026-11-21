'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge, Box, Button, Card, Flex, Grid, Heading, Separator, Switch, Text } from '@rosie/ui/themes'
import { SyncSelect, useSyncConfirmation } from './SyncControls'
import { invalidateSessionStore } from '@rosie/core'
import { CourseMainDirectory } from './SyncDirectoryChooser'
import { EnglishFileList, useEnglishFileInventory } from './EnglishAudioFiles'
import { LoadStatus, request, useQuery } from './EnglishSyncRequest'
import type { SyncDirectoryList } from '@/app/api/baidu/sync/directories/route'
import { directoryPrefix, type LessonAudioEditor, type LessonAudioPick } from '@/lib/english-audio-types'
import { matchEnglishAudio } from '@/lib/english-audio-match'

type Lesson = { stage: string; unit: string; unitTitle?: string; lesson: string; title: string; key: string }
type Props = { userId: string; paths: SyncDirectoryList }

function samePick(left?: LessonAudioPick, right?: LessonAudioPick) {
  return left?.directory_id === right?.directory_id && left?.path === right?.path && left?.file_id === right?.file_id
}

function Bindings({ userId, paths, initial, lessonKey, url, reload }: Props & { initial: LessonAudioEditor; lessonKey: string; url: string; reload: () => void }) {
  const { confirm, dialog } = useSyncConfirmation()
  const [saved, setSaved] = useState(initial)
  const [picks, setPicks] = useState(initial.picks)
  const [main, setMain] = useState(initial.mainDirectory)
  const isStory = lessonKey.startsWith('story:')
  const inventory = useEnglishFileInventory(userId, paths.generation, main)
  const [matchMessage, setMatchMessage] = useState('')
  const [onlyUnmatched, setOnlyUnmatched] = useState(false)
  const boundFiles = new Set(Object.values(picks).map(pick => pick.file_id))
  const [choosing, setChoosing] = useState(!initial.mainDirectory)
  const [target, setTarget] = useState(() => initial.slots.find(row => !row.unbindOnly && !initial.picks[row.slot])?.slot
    ?? initial.slots.find(row => !row.unbindOnly)?.slot ?? '')
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
  function autoMatch() {
    if (!main || !inventory.ready || saving) return
    const matches = matchEnglishAudio(lessonKey, saved.slots, picks, main, inventory.files)
    const count = Object.keys(matches).length
    if (count) {
      const next = { ...picks, ...matches }
      setPicks(next)
      setTarget(saved.slots.find(row => !row.unbindOnly && !next[row.slot])?.slot ?? '')
    }
    setMatchMessage(count ? `已匹配 ${count} 项，请核对后保存。` : '没有可唯一匹配的新条目。')
    setMessage('')
  }
  function bind(pick: LessonAudioPick) {
    if (!target || saving) return
    const next = { ...picks, [target]: pick }
    setPicks(next)
    setMatchMessage('')
    const index = saved.slots.findIndex(row => row.slot === target)
    const remaining = [...saved.slots.slice(index + 1), ...saved.slots.slice(0, index)]
    setTarget(remaining.find(row => !row.unbindOnly && !next[row.slot])?.slot ?? '')
    setMessage('')
  }
  async function save() {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setSaving(true); setMessage(''); setMatchMessage('')
    try {
      const next = await request<{ revision: string }>(userId, url, controller.signal, { revision: saved.revision, mainDirectory: main, picks })
      if (controller.signal.aborted) return
      setSaved({ ...saved, slots: saved.slots.filter(row => !row.unbindOnly || picks[row.slot]), mainDirectory: main, picks, revision: next.revision })
      invalidateSessionStore('baidu_reading_audio_keys')
      setMessage('音频绑定已保存。')
    } catch (e) {
      if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : '保存失败。')
    } finally { pending.current = null; if (!controller.signal.aborted) setSaving(false) }
  }
  return <Flex direction="column" gap="3" data-sync-dirty={dirty} data-sync-saving={saving}>
    <CourseMainDirectory
      userId={userId}
      paths={paths}
      main={main}
      disabled={saving}
      choosing={choosing}
      onChoosingChange={setChoosing}
      onClear={() => {
        setMain(null); setChoosing(true); setMessage(''); setMatchMessage('')
      }}
      onChoose={directory => {
        setMain(directory); setChoosing(false); setMessage(''); setMatchMessage('')
      }}
    />
    <Grid gap="3" columns={{ initial: '1', sm: '2' }} align="start">
      <Card>
        <Flex align="center" justify="between" gap="2" mb="3">
          <Heading as="h3" size="3">{isStory ? '故事音频' : '课程音频'}</Heading>
          <Flex align="center" gap="2" wrap="wrap">
            <Text size="1" color="gray">{Object.keys(picks).length} / {saved.slots.length} 已绑定</Text>
            <Text as="label" size="2">
              <Flex align="center" gap="2">
                <Switch checked={onlyUnmatched} onCheckedChange={checked => {
                  setOnlyUnmatched(checked)
                  if (checked && picks[target]) setTarget(saved.slots.find(row => !row.unbindOnly && !picks[row.slot])?.slot ?? '')
                }} />
                只看未匹配
              </Flex>
            </Text>
            <Button size="1" variant="soft" disabled={!main || !inventory.ready || saving || !saved.slots.some(row => !row.unbindOnly && !picks[row.slot])}
              onClick={autoMatch}>自动匹配</Button>
          </Flex>
        </Flex>
        {matchMessage && <Text as="p" size="2" mb="2" role="status">{matchMessage}</Text>}
        {onlyUnmatched && !saved.slots.some(row => !row.unbindOnly && !picks[row.slot]) && (
          <Text size="2" color="gray">全部条目均已匹配。</Text>
        )}
        <Box maxHeight="55vh" overflowY="auto" pr="4" style={{ scrollbarGutter: 'stable' }}>
          {[isStory ? '整本音频' : '课级音频', isStory ? '章节和原始音轨' : '单个单词音频', '逐句听记音频', '已移除条目的旧绑定'].map((groupLabel, group) => {
            const rows = saved.slots.filter(s => {
              if (onlyUnmatched && (s.unbindOnly || picks[s.slot])) return false
              if (s.unbindOnly) return group === 3
              if (s.slot.startsWith('clip:')) return group === 2
              if (s.slot.startsWith('chapter:') || s.slot.startsWith('track:') || s.slot.startsWith('word:')) return group === 1
              return group === 0
            })
            if (!rows.length) return null
            return <Box key={groupLabel} mb="3">
              <Text as="p" size="1" weight="bold" color="gray" mb="1">{groupLabel}</Text>
              {rows.map(({ slot, label, unbindOnly }) => {
                const pick = picks[slot]
                return <Box key={slot}>
                  <Flex align="center" gap="2" py="2">
                    <Box flexGrow="1" minWidth="0">
                      <Text as="p" size="2" weight="medium">{label}</Text>
                      {pick ? <Text as="p" size="1" color="gray" truncate title={pick.path}>
                        {pick.path.split('/').pop()}{main && !insideMain(pick) && ' · 主目录外'}
                      </Text> : <Text as="p" size="1" color="gray">未绑定</Text>}
                    </Box>
                    {!unbindOnly && <Button size="1" variant={target === slot ? 'solid' : 'soft'} disabled={saving}
                      aria-label={'匹配 ' + label} aria-pressed={target === slot}
                      onClick={() => setTarget(slot)}>{target === slot ? '匹配中' : '匹配'}</Button>}
                    {pick && <Button size="1" color="gray" variant="soft" aria-label={'解绑 ' + label} disabled={saving}
                      onClick={() => { const next = { ...picks }; delete next[slot]; setPicks(next); if (!unbindOnly) setTarget(slot); setMessage(''); setMatchMessage('') }}>解绑</Button>}
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
              inventory={inventory} onlyUnmatched={onlyUnmatched} boundFiles={boundFiles} main={main} disabled={saving || !target}
              choose={bind} />
          </> : <Text size="2" color="gray">选定主目录后，这里会列出其中及子目录内的文件。</Text>}
        </Flex>
      </Card>
    </Grid>
    {invalidPick && <Text role="alert" size="2" color="red">有新绑定的文件位于当前主目录外，请重新匹配或解绑后保存。</Text>}
    <Flex gap="2" wrap="wrap">
      <Button loading={saving} disabled={saving || !dirty || invalidPick} onClick={() => void save()}>{isStory ? '保存本书绑定' : '保存本课绑定'}</Button>
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
    .sort((a, b) => Number(a === 'Story') - Number(b === 'Story') || b.localeCompare(a, 'en', { numeric: true }))
  const stage = stages.includes(selectedStage) ? selectedStage : stages[0] ?? ''
  function changeSelection(proceed: () => void) {
    if (section.current?.querySelector('[data-sync-saving="true"]')) return
    if (section.current?.querySelector('[data-sync-dirty="true"]')) confirm('放弃尚未保存的音频绑定修改？', proceed)
    else proceed()
  }
  return <Flex ref={section} direction="column" gap="3" role="region" aria-label="英语资源同步">
    <Heading as="h2" size="4">英语资源同步</Heading>
    <LoadStatus {...catalog} />
    {catalog.data && <Grid gap="2" columns={{ initial: '1', sm: '3' }}>
      <SyncSelect label="册别" value={stage} disabled={!stages.length} empty={stages.length ? undefined : '暂无册别'}
        options={stages.map(v => ({ value: v, label: v }))}
        onValueChange={v => changeSelection(() => { setSelectedStage(v); setUnit(''); setLesson('') })} />
      <SyncSelect label={stage === 'Story' ? '故事集' : '单元'} empty={stage === 'Story' ? '选择故事集' : '选择单元'} value={unit} disabled={!stage}
        options={[...new Map(rows.filter(row => row.stage === stage).map(row => [row.unit, row.unitTitle ?? row.unit] as const))].map(([value, label]) => ({ value, label }))}
        onValueChange={v => changeSelection(() => { setUnit(v); setLesson('') })} />
      <SyncSelect label={stage === 'Story' ? '书名' : 'Lesson'} empty={stage === 'Story' ? '选择书名' : '选择 Lesson'} value={lesson} disabled={!unit}
        options={rows.filter(p => p.stage === stage && p.unit === unit).map(p => ({ value: p.key, label: stage === 'Story' ? p.title : p.lesson + ' · ' + p.title }))}
        onValueChange={v => changeSelection(() => setLesson(v))} />
    </Grid>}
    <LoadStatus {...editor} />
    {editor.data && <Bindings key={url} initial={editor.data} lessonKey={lesson} url={url} reload={editor.retry} userId={userId} paths={paths} />}
    {dialog}
  </Flex>
}
