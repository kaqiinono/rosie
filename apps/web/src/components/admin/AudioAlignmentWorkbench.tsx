'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useAuth } from '@rosie/core'
import { useBaiduReadingAudio } from '@rosie/english'
import { FormSelect, SearchableFormSelect, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Heading, SegmentedControl, Switch, Text, TextField, Slider } from '@rosie/ui/themes'
import { LoadStatus, request, useQuery } from '@/components/settings/EnglishSyncRequest'
import type {
  AlignmentChoice, AlignmentDocument, AlignmentTarget, AlignmentTrack, AudioMark, AudioMarks,
} from '@/lib/audio-alignment-contract'

const endpoint = '/api/admin/audio-alignment'
const rates = ['0.75', '1', '1.25'].map(rate => ({ value: rate, label: rate + '×' }))
const time = (ms: number | null) => ms === null || !Number.isFinite(ms) ? '—' : (
  `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
)

export default function AudioAlignmentWorkbench({ initialKey }: { initialKey: string }) {
  const { user } = useAuth()
  const media = useBaiduReadingAudio(user)
  const userId = user?.id ?? ''
  const catalog = useQuery<AlignmentChoice[]>(userId, userId ? endpoint : '')
  const [selectedModule, setModule] = useState('')
  const [key, setKey] = useState(initialKey)
  const [trackSlot, setTrackSlot] = useState('')
  const [saving, setSaving] = useState(false)
  const allChoices = catalog.data ?? []
  const modules = new Map(allChoices.map(choice => [choice.module, choice.moduleLabel]))
  const module = selectedModule || allChoices.find(choice => choice.key === key)?.module || allChoices[0]?.module
  const choices = allChoices.filter(choice => choice.module === module)
  const selected = choices.find(choice => choice.key === key)
  const tracks = useQuery<AlignmentTrack[]>(userId, selected ? endpoint + '?' + new URLSearchParams({ key }) : '')
  const slot = tracks.data?.find(track => track.slot === trackSlot)?.slot ?? tracks.data?.[0]?.slot
  const documentUrl = slot ? endpoint + '?' + new URLSearchParams({ key, slot }) : ''
  const document = useQuery<AlignmentDocument>(userId, documentUrl)

  return <div className="space-y-4">
    <StickerCard as="section" size="md" className="space-y-3">
      {module && <SegmentedControl.Root aria-label="内容来源" value={module} disabled={saving} onValueChange={value => {
        setModule(value)
        setKey('')
        setTrackSlot('')
      }}>
        {[...modules].map(([value, label]) => <SegmentedControl.Item key={value} value={value}>{label}</SegmentedControl.Item>)}
      </SegmentedControl.Root>}
      <div className="grid gap-3 sm:grid-cols-2">
        <SearchableFormSelect ariaLabel="搜索内容" placeholder="搜索故事系列、书名或课文"
          value={selected?.key ?? ''} options={choices.map(({ key: value, label }) => ({ value, label }))}
          disabled={saving || !choices.length} onValueChange={value => { setKey(value); setTrackSlot('') }} />
        <SearchableFormSelect ariaLabel="搜索音轨" placeholder="搜索音轨" value={slot ?? ''}
          options={(tracks.data ?? []).map(({ slot: value, label }) => ({ value, label }))}
          disabled={saving || !tracks.data?.length} onValueChange={setTrackSlot} />
      </div>
      <LoadStatus {...catalog} />
      <LoadStatus {...tracks} />
      {tracks.data?.length === 0 && <Text as="p" size="2">请先在 <Link className="underline" href="/admin/sync">同步管理</Link> 绑定这项内容的音频。</Text>}
    </StickerCard>
    <LoadStatus {...document} />
    {document.data && slot && (media.error
      ? <Text role="alert" color="red">{media.error}</Text>
      : media.isLoading
        ? <Text role="status">正在建立音频会话…</Text>
        : <AlignmentEditor key={documentUrl + '#' + document.data.signature} initial={document.data} endpointUrl={documentUrl}
            userId={userId} source={document.data.audioUrl} onSaving={setSaving} reload={document.retry} />)}
  </div>
}

function AlignmentEditor({ initial, endpointUrl, userId, source, onSaving, reload }: {
  initial: AlignmentDocument
  endpointUrl: string
  userId: string
  source: string
  onSaving: (saving: boolean) => void
  reload: () => void
}) {
  const { targets, signature, canSkip, sourceChanged } = initial
  const first = targets.find(target => !initial.marks[target.id]) ?? targets[0]
  const [marks, setMarks] = useState(initial.marks)
  const [id, setId] = useState(first?.id ?? '')
  const [playbackId, setPlaybackId] = useState('')
  const selected = targets.find(target => target.id === id)
  const [filter, setFilter] = useState<'pending' | 'all'>(first && initial.marks[first.id] ? 'all' : 'pending')
  const [start, setStart] = useState<number | null>(null)
  const [end, setEnd] = useState<number | null>(null)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState('1')
  const [loop, setLoop] = useState(false)
  const [preview, setPreview] = useState<{ start: number; end: number } | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [otherEdit, setOtherEdit] = useState<{ id: string; start: number; end: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [recordingReplaced, setRecordingReplaced] = useState(sourceChanged)
  const audio = useRef<HTMLAudioElement>(null)
  const editor = useRef<HTMLDivElement>(null)
  const sentenceList = useRef<HTMLOListElement>(null)
  const playbackRow = useRef<HTMLLIElement>(null)
  const selectedRow = useRef<HTMLLIElement>(null)
  const pinnedTarget = useRef('')
  const operation = useRef<AbortController | null>(null)
  const drafts = useRef<Record<string, { start: number | null; end: number | null }>>({})

  useEffect(() => () => {
    operation.current?.abort()
    onSaving(false)
  }, [onSaving])

  useEffect(() => {
    if (!preview) return
    const player = audio.current
    if (!player) return
    let frame: number
    const follow = () => {
      if (player.currentTime * 1000 >= preview.end || player.ended) {
        if (loop && !player.ended) player.currentTime = preview.start / 1000
        else {
          player.pause()
          setPreview(null)
          return
        }
      }
      frame = requestAnimationFrame(follow)
    }
    frame = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(frame)
  }, [preview, loop])

  useEffect(() => {
    const list = sentenceList.current
    const row = playbackRow.current
    if (!list || !row) return
    const { top, bottom } = list.getBoundingClientRect()
    const position = row.getBoundingClientRect()
    if (position.top < top) list.scrollTop += position.top - top
    else if (position.bottom > bottom) list.scrollTop += position.bottom - bottom
  }, [playbackId, filter])

  useEffect(() => {
    const list = sentenceList.current
    const row = selectedRow.current
    if (!list || !row) return
    const { top, bottom } = list.getBoundingClientRect()
    const position = row.getBoundingClientRect()
    if (position.height > bottom - top || position.top < top) list.scrollTop += position.top - top
    else if (position.bottom > bottom) list.scrollTop += position.bottom - bottom
  }, [filter, id])

  const totalAligned = targets.filter(target => marks[target.id]?.status === 'timed').length
  const totalProcessed = targets.filter(target => marks[target.id]).length
  const ordered = targets.filter(target => filter === 'all' || !marks[target.id])
  const completeRange = start !== null && end !== null && Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start < end && end <= duration
  const selectedMark = marks[id]
  const hasUnsavedRange = selectedMark?.status === 'timed'
    ? start !== selectedMark.startMs || end !== selectedMark.endMs
    : start !== null || end !== null

  const conflicts = targets.flatMap(target => {
    const mark = marks[target.id]
    return target.id !== id && start !== null && end !== null && start < end &&
      mark?.status === 'timed' && start < mark.endMs && end > mark.startMs
      ? [{ target, mark, from: Math.max(start, mark.startMs), to: Math.min(end, mark.endMs) }] : []
  })

  const otherTarget = targets.find(target => target.id === otherEdit?.id)
  const otherOriginal = otherEdit ? marks[otherEdit.id] : undefined
  const otherValid = !!otherEdit && Number.isSafeInteger(otherEdit.start) && Number.isSafeInteger(otherEdit.end) &&
    otherEdit.start >= 0 && otherEdit.end - otherEdit.start >= 100 && otherEdit.end <= duration &&
    !targets.some(target => {
      if (target.id === otherEdit.id) return false
      const mark = target.id === id && start !== null && end !== null
        ? { status: 'timed', startMs: start, endMs: end } : marks[target.id]
      return mark?.status === 'timed' && otherEdit.start < mark.endMs && otherEdit.end > mark.startMs
    })
  const unresolved = conflicts.some(conflict => conflict.target.id !== otherEdit?.id || !otherValid)

  function editBoundary(which: 'start' | 'end', value: number | null) {
    if (saving) return
    pinnedTarget.current = id
    audio.current?.pause()
    setPreview(null)
    setError('')
    if (which === 'start') setStart(value)
    else setEnd(value)
  }

  async function previewRange(from: number, to: number) {
    const player = audio.current
    if (!player) return
    player.pause()
    player.currentTime = Math.max(0, from) / 1000
    setPreview({ start: Math.max(0, from), end: Math.min(duration, to) })
    try { await player.play() } catch { setPreview(null); setError('无法试听，请重试播放。') }
  }

  function trimmedRange(a: number, b: number, fixedStart: number, fixedEnd: number) {
    // Containment cannot be resolved by choosing a boundary without discarding a whole phrase.
    if (a < fixedStart && b > fixedStart && b <= fixedEnd && fixedStart - a >= 100)
      return { start: a, end: fixedStart }
    if (a >= fixedStart && a < fixedEnd && b > fixedEnd && b - fixedEnd >= 100)
      return { start: fixedEnd, end: b }
    return null
  }

  function followPlayback(player: HTMLAudioElement) {
    const timeMs = player.currentTime * 1000
    const current = player.ended ? undefined : targets.find(target => {
      const mark = marks[target.id]
      return mark?.status === 'timed' && mark.startMs <= timeMs && timeMs < mark.endMs
    })
    setPlaybackId(current?.id ?? '')
    if (!current || current.id === id || player.paused || filter !== 'all' ||
        preview || saving || hasUnsavedRange || pinnedTarget.current === id) return

    const mark = marks[current.id]
    if (mark?.status !== 'timed') return
    setId(current.id)
    setStart(mark.startMs)
    setEnd(mark.endMs)
    setNotice('')
  }

  function loadTarget(target: AlignmentTarget, current: AudioMarks, moveFocus = true) {
    if (target.id !== id) drafts.current[id] = { start, end }
    setOtherEdit(null)
    const draft = drafts.current[target.id]
    const saved = current[target.id]
    if (moveFocus) pinnedTarget.current = saved?.status === 'timed' ? '' : target.id
    const before = targets.slice(0, targets.indexOf(target)).reverse()
      .map(item => current[item.id]).find(mark => mark?.status === 'timed')
    const previousEnd = before?.status === 'timed' ? before.endMs : 0
    const location = saved?.status === 'timed' ? saved.startMs :
      target.candidateMs === undefined ? previousEnd : Math.max(0, target.candidateMs - 1000)
    setId(target.id)
    setStart(draft ? draft.start : saved?.status === 'timed' ? saved.startMs : null)
    setEnd(draft ? draft.end : saved?.status === 'timed' ? saved.endMs : null)
    setPreview(null)
    setError('')
    const player = audio.current
    if (player && player.readyState >= 1) {
      player.pause()
      player.currentTime = Math.min(location / 1000, player.duration)
    }
    if (moveFocus) editor.current?.focus({ preventScroll: true })
  }

  function setBoundary(which: 'start' | 'end') {
    const player = audio.current
    if (!player || !duration || !selected || saving || player.seeking) return
    pinnedTarget.current = selected.id
    setPreview(null)
    const value = Math.round(player.currentTime * 1000)
    if (which === 'start') setStart(value)
    else setEnd(value)
    editor.current?.focus({ preventScroll: true })
  }

  function adjust(which: 'start' | 'end', delta: number) {
    const value = which === 'start' ? start : end
    if (value === null) return
    pinnedTarget.current = id
    const next = Math.min(duration, Math.max(0, value + delta))
    setPreview(null)
    if (which === 'start') setStart(next)
    else setEnd(next)
    const player = audio.current
    if (player) { player.pause(); player.currentTime = next / 1000 }
  }

  async function playSelection() {
    const player = audio.current
    if (!player || !completeRange || start === null || end === null) return
    setError('')
    player.currentTime = start / 1000
    setPreview({ start, end })
    try { await player.play() } catch {
      setPreview(null)
      setError('无法试听，请重试播放。')
    }
  }

  async function save(mark: AudioMark) {
    if (!selected || !duration || operation.current) return
    const controller = new AbortController()
    operation.current = controller
    audio.current?.pause()
    setPreview(null)
    setSaving(true)
    onSaving(true)
    setError('')
    setNotice('')
    let otherSaved = false
    try {
      let expectedMarks = marks
      if (mark.status === 'timed' && otherEdit) {
        if (!otherValid || unresolved) throw new Error('请先调整冲突句，确保两句时间有效且不重叠。')
        expectedMarks = await request<AudioMarks>(userId, endpointUrl, controller.signal, {
          signature, target: otherEdit.id, expected: marks[otherEdit.id] ?? null, durationMs: duration,
          mark: { status: 'timed', startMs: otherEdit.start, endMs: otherEdit.end },
        })
        if (controller.signal.aborted) return
        otherSaved = true
        setMarks(expectedMarks)
        setOtherEdit(null)
        delete drafts.current[otherEdit.id]
      }
      const updated = await request<AudioMarks>(userId, endpointUrl, controller.signal, {
        signature, target: selected.id, expected: marks[selected.id] ?? null, durationMs: duration, mark,
      })
      if (controller.signal.aborted) return
      delete drafts.current[selected.id]
      setMarks(updated)
      const position = targets.indexOf(selected)
      const next = [...targets.slice(position + 1), ...targets.slice(0, position)].find(item => !updated[item.id])
      if (next) loadTarget(next, updated)
      else if (filter === 'pending') {
        // Keep the completed queue empty instead of showing all saved sentences again.
        setId('')
        setStart(null)
        setEnd(null)
        setOtherEdit(null)
        pinnedTarget.current = ''
      } else loadTarget(selected, updated)
      delete drafts.current[selected.id]
      setRecordingReplaced(false)
      setNotice(otherSaved ? '两句时间点已生效。' : mark.status === 'skipped' ? '已标为原音未读。' : '时间点已生效。')
    } catch (cause) {
      if (!controller.signal.aborted) setError((otherSaved ? '另一句已保存，当前句尚未确认保存，草稿已保留。' : '') + (cause instanceof Error ? cause.message : '保存失败，请重试。'))
    } finally {
      operation.current = null
      if (!controller.signal.aborted) { setSaving(false); onSaving(false) }
    }
  }

  const saveRange = () => {
    if (!unresolved && (!otherEdit || otherValid) && completeRange && start !== null && end !== null) void save({ status: 'timed', startMs: start, endMs: end })
  }
  function shortcuts(event: KeyboardEvent<HTMLElement>) {
    if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.repeat || saving) return
    const target = event.target
    if (target instanceof HTMLElement && target.closest('input, textarea, select, [role="combobox"], [contenteditable]')) return
    const key = event.key.toLowerCase()
    if (key === 'i' || key === 'o') {
      event.preventDefault()
      setBoundary(key === 'i' ? 'start' : 'end')
    } else if (key === 'enter' && !(target instanceof HTMLElement && target.closest('button, a, audio'))) {
      event.preventDefault()
      saveRange()
    }
  }

  return <div role="region" aria-label="音文标记工作区" className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]" onKeyDown={shortcuts}>
    <StickerCard as="section" aria-label="句子列表" size="md" className="order-2 space-y-3 lg:order-1">
      <Flex align="center" justify="between" gap="2" wrap="wrap">
        <Heading size="3">句子</Heading>
        <Text role="status" size="2" color="gray">已处理 {totalProcessed}/{targets.length} · 已对齐 {totalAligned}</Text>
      </Flex>
      <SegmentedControl.Root aria-label="筛选句子" value={filter} onValueChange={value => {
        if (value === 'pending' || value === 'all') {
          if (value === 'all') pinnedTarget.current = id
          setFilter(value)
        }
      }}>
        <SegmentedControl.Item value="pending">待处理</SegmentedControl.Item>
        <SegmentedControl.Item value="all">全部</SegmentedControl.Item>
      </SegmentedControl.Root>
      <ol ref={sentenceList} className="max-h-[50vh] space-y-1 overflow-y-auto">
        {ordered.map(target => <li key={target.id} ref={node => {
          if (target.id === playbackId) playbackRow.current = node
          if (target.id === id) selectedRow.current = node
        }}>
          <StickerCard asChild interactive tone={target.id === id ? 'accent' : target.id === playbackId ? 'info' : 'paper'} size="sm" elevation="flat">
          {/* native-ok: 多行句子整块选择，使用共享卡片承载外观 */}
          <button type="button"
            aria-pressed={target.id === id} aria-current={target.id === playbackId ? 'true' : undefined}
            className="w-full text-left" disabled={saving}
            onClick={() => { setNotice(''); loadTarget(target, marks) }}>
            <span className="flex w-full min-w-0 flex-wrap items-start gap-2 text-left"><span className="min-w-0 basis-full whitespace-normal break-words" lang="en">{target.text}</span>
            {target.id === playbackId && <Badge color="blue">播放位置</Badge>}
            {marks[target.id] && <Badge color={marks[target.id].status === 'timed' ? 'green' : 'gray'}>
              {marks[target.id].status === 'timed' ? '已对齐' : '原音未读'}
            </Badge>}
            </span>
          </button>
          </StickerCard>
        </li>)}
      </ol>
      {!ordered.length && <Text as="p" size="2" color="gray">这条音轨的句子已处理完。</Text>}
    </StickerCard>
    <StickerCard as="section" aria-label="试听与标记" size="md" className="order-1 space-y-4 lg:order-2">
      <div ref={editor} tabIndex={-1} className="space-y-2">
        {selected && <>
          <Text as="div" color="gray" size="2">{selected.group} · 第 {targets.indexOf(selected) + 1} 句</Text>
          <Heading as="h2" size="5" lang="en">{selected.text}</Heading>
        </>}
      </div>
      {recordingReplaced && <Text as="p" color="orange">音频或正文已变更，请从新录音重新标记。</Text>}
      <audio ref={audio} controls src={source} preload="metadata" aria-label="标记用音频" className="w-full"
        onPause={() => setPreview(null)}
        onPlaying={event => followPlayback(event.currentTarget)}
        onTimeUpdate={event => followPlayback(event.currentTarget)}
        onSeeked={event => followPlayback(event.currentTarget)}
        onEnded={() => setPlaybackId('')}
        onDurationChange={event => {
          const seconds = event.currentTarget.duration
          if (Number.isFinite(seconds) && seconds > 0) setDuration(Math.round(seconds * 1000))
        }}
        onError={() => { setDuration(0); setPlaybackId(''); setError('网盘音频无法加载，请检查当前绑定。') }}
        onLoadedMetadata={event => {
          const player = event.currentTarget
          if (Number.isFinite(player.duration) && player.duration > 0) {
            const milliseconds = Math.round(player.duration * 1000)
            setDuration(milliseconds)
            player.playbackRate = Number(speed)
            if (selected) loadTarget(selected, marks, false)
          }
        }} />
      <Flex align="center" gap="3" wrap="wrap">
        <FormSelect ariaLabel="播放速度" options={rates} value={speed} onValueChange={value => {
          setSpeed(value)
          if (audio.current) audio.current.playbackRate = Number(value)
        }} />
        <Button type="button" variant="soft" disabled={!completeRange || saving} onClick={() => void playSelection()}>试听选段</Button>
        <Text as="label" size="2"><Flex align="center" gap="2"><Switch checked={loop} onCheckedChange={setLoop} />循环试听</Flex></Text>
      </Flex>
      <div className="grid gap-2 sm:grid-cols-2">
        {(['start', 'end'] as const).map(which => {
          const value = which === 'start' ? start : end
          const label = which === 'start' ? '起点' : '终点'
          return <StickerCard key={which} tone="paper" size="sm" elevation="flat" radius="md" className="space-y-2">
            <Text as="div" size="2" className="font-mono tabular-nums">{label} {time(value)}</Text>
            <Text as="label" size="2">{label}（秒）
              <TextField.Root type="number" min="0" max={duration / 1000} step="0.001"
                aria-label={`${label}秒数`} value={value === null ? '' : value / 1000} disabled={saving}
                onChange={event => editBoundary(which, event.target.value === '' ? null : Math.round(Number(event.target.value) * 1000))} />
            </Text>
            <Slider aria-label={`拖动${label}`} min={0} max={Math.max(1, duration)} step={10}
              value={[value ?? 0]} disabled={saving || !duration}
              onValueChange={values => editBoundary(which, values[0])} />
            <Flex gap="2" wrap="wrap">
              <Button type="button" variant="soft" size="2" disabled={!duration || !selected || saving}
                onClick={() => setBoundary(which)}>标{label} · {which === 'start' ? 'I' : 'O'}</Button>
              {[-100, 100].map(delta => <Button key={delta} type="button" variant="ghost" size="2"
                aria-label={`${label}${delta < 0 ? '提前' : '延后'} 0.1 秒`} disabled={value === null || saving}
                onClick={() => adjust(which, delta)}>{delta < 0 ? '−' : '+'}0.1 秒</Button>)}
            </Flex>
          </StickerCard>
        })}
      </div>
      {!!conflicts.length && <StickerCard tone="warning" size="sm" elevation="flat" className="space-y-3">
        <Text as="p" weight="bold">时间重叠：请选择以哪句为准</Text>
        <Text as="p">当前句：{selected?.text} · {time(start)}–{time(end)}</Text>
        {conflicts.map(({ target, mark, from, to }) => {
          const currentTrim = start !== null && end !== null ? trimmedRange(start, end, mark.startMs, mark.endMs) : null
          const otherTrim = start !== null && end !== null ? trimmedRange(mark.startMs, mark.endMs, start, end) : null
          return <div key={target.id} className="space-y-2">
            <Text as="p">冲突句：{target.text} · {time(mark.startMs)}–{time(mark.endMs)}</Text>
            <Text as="p" color="red">重叠 {time(from)}–{time(to)}（{to - from} 毫秒）</Text>
            <Flex gap="2" wrap="wrap">
              <Button variant="soft" disabled={saving} onClick={() => void previewRange(from - 2000, to + 2000)}>试听衔接前后各 2 秒</Button>
              <Button variant="soft" disabled={saving || conflicts.length !== 1 || !currentTrim} onClick={() => {
                if (!currentTrim) return
                editBoundary('start', currentTrim.start); editBoundary('end', currentTrim.end)
                setNotice(`当前句：${time(start)}–${time(end)} → ${time(currentTrim.start)}–${time(currentTrim.end)}，请试听后保存。`)
              }}>保留另一句，微调当前句</Button>
              <Button variant="soft" disabled={saving || !completeRange} onClick={() => {
                pinnedTarget.current = id
                setOtherEdit({ id: target.id, start: otherTrim?.start ?? mark.startMs, end: otherTrim?.end ?? mark.endMs })
                setNotice(otherTrim ? '已生成另一句的调整草稿，请试听后保存两句。' : '当前句时间保持不变，请按实际发音选择另一句在前还是在后，再试听保存。')
              }}>保留当前句，微调另一句</Button>
              <Button variant="ghost" disabled={saving} onClick={() => {
                loadTarget(target, marks)
                pinnedTarget.current = target.id
                setNotice('已切换到冲突句，原句草稿已保留。调整并保存后，返回原句继续。')
              }}>手动编辑这句</Button>
            </Flex>
          </div>
        })}
        <Text as="p" size="2">以实际发音为准。包含场景可保留当前句，再选择另一句在前还是在后；调整只生成草稿，试听确认后保存。</Text>
      </StickerCard>}
      {otherEdit && otherTarget && <StickerCard tone="paper" size="sm" elevation="flat" className="space-y-3">
        <Text as="p" weight="bold">调整另一句：{otherTarget.text}</Text>
        <Text as="p">保留当前句：{time(start)}–{time(end)}</Text>
        {otherOriginal?.status === 'timed' && <Text as="p">另一句原时间：{time(otherOriginal.startMs)}–{time(otherOriginal.endMs)}</Text>}
        <Text as="p">另一句调整后：{time(otherEdit.start)}–{time(otherEdit.end)}</Text>
        <Flex gap="2" wrap="wrap">
          <Button variant="soft" disabled={saving || start === null || otherOriginal?.status !== 'timed' || start - otherOriginal.startMs < 100}
            onClick={() => {
              if (start !== null && otherOriginal?.status === 'timed') setOtherEdit({ ...otherEdit, start: otherOriginal.startMs, end: start })
            }}>另一句在前：终点对齐当前句起点</Button>
          <Button variant="soft" disabled={saving || end === null || otherOriginal?.status !== 'timed' || otherOriginal.endMs - end < 100}
            onClick={() => {
              if (end !== null && otherOriginal?.status === 'timed') setOtherEdit({ ...otherEdit, start: end, end: otherOriginal.endMs })
            }}>另一句在后：起点对齐当前句终点</Button>
        </Flex>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['start', 'end'] as const).map(boundary => <Text as="label" key={boundary} size="2">
            另一句{boundary === 'start' ? '起点' : '终点'}（秒）
            <TextField.Root type="number" min="0" max={duration / 1000} step="0.001" disabled={saving}
              value={Number.isFinite(otherEdit[boundary]) ? otherEdit[boundary] / 1000 : ''}
              onChange={event => setOtherEdit({ ...otherEdit, [boundary]: event.target.value === '' ? NaN : Math.round(Number(event.target.value) * 1000) })} />
          </Text>)}
        </div>
        {!otherValid && <Text as="p" color="red">另一句仍重叠、超出音轨或不足 0.1 秒，请调整边界。</Text>}
        <Flex gap="2" wrap="wrap">
          <Button variant="soft" disabled={saving || !otherValid} onClick={() => void previewRange(otherEdit.start, otherEdit.end)}>试听调整后的另一句</Button>
          <Button variant="ghost" disabled={saving} onClick={() => setOtherEdit(null)}>撤销另一句调整</Button>
        </Flex>
      </StickerCard>}
      <Flex gap="3" wrap="wrap">
        <Button type="button" variant="ghost" disabled={saving || !selected} onClick={() => {
          delete drafts.current[id]
          if (selected) loadTarget(selected, marks)
          setNotice('已恢复这句保存前的时间。')
        }}>撤销本句调整</Button>
        <Button type="button" loading={saving} disabled={!completeRange || unresolved || (!!otherEdit && !otherValid)} onClick={saveRange}>{otherEdit ? '保存两句并继续 · Enter' : '保存并继续 · Enter'}</Button>
        {canSkip && <Button type="button" variant="soft" color="gray" disabled={saving || !duration || !selected || !!otherEdit}
          onClick={() => void save({ status: 'skipped' })}>原音未读</Button>}
        {error && <Button type="button" variant="ghost" color="gray" disabled={saving} onClick={reload}>重新载入</Button>}
      </Flex>
      {error && <Text role="alert" color="red">{error}</Text>}
      {notice && <Text role="status" color="green">{notice}</Text>}
    </StickerCard>
  </div>
}
