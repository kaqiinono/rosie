'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AppDialog, FormSelect } from '@rosie/ui'
import { Button, Flex, Slider, Text, TextArea, TextField } from '@rosie/ui/themes'
import {
  canApplyTheaterCueAction, parseSubtitleTimestamp, subtitleTimestamp, theaterSubtitleShortcut,
} from '@/lib/theater/subtitle-timeline'
import {
  theaterLanguageLabel, theaterSubtitleLanguages, type SubtitleCue, type SubtitleTracks,
  type TheaterCueAction, type TheaterLanguage, type TheaterSubtitleEdit, type TheaterSubtitleSelection,
  type TheaterSubtitleSplice, type TheaterSubtitles,
} from '@/lib/theater/types'

export type SubtitleEditorPlayback = {
  position: () => number
  time: number
  duration: number | null
  preview: (startMs: number, endMs: number) => Promise<boolean>
  pause: () => void
  seek: (ms: number) => void
}

type Props = {
  selection: TheaterSubtitleSelection
  tracks: SubtitleTracks
  precision: NonNullable<TheaterSubtitles['editor']>['precision']
  playback: SubtitleEditorPlayback
  saving: boolean
  waiting: boolean
  locked: boolean
  error: string
  onClose: () => void
  onSave: (edit: TheaterSubtitleEdit | TheaterSubtitleSplice) => void
}

type Action = TheaterCueAction | 'insert'
const labels = { edit: '改文字', split: '拆成两句', previous: '与上一句合并', next: '与下一句合并',
  insert: '插入新句', remove: '删除此句' } satisfies Record<Action, string>
const maxTime = 86_400_000

function cueDraft(action: Action, track: SubtitleCue[], language: TheaterLanguage, index: number, step: number, playhead: number) {
  const cue = track[index]
  if (!cue) return { action: 'insert' as const, texts: [''], cut: '' }
  if (action === 'edit' || action === 'insert') return { action: 'edit' as const, cut: '', texts: [cue.text] }
  const edit = theaterSubtitleShortcut(track, language, index, action, step, playhead)
  if (!edit) return { action: 'edit' as const, cut: '', texts: [cue.text] }
  return { action, cut: action === 'split' ? subtitleTimestamp(edit.after[0].endMs) : '',
    texts: edit.after.length ? edit.after.map(entry => entry.text) : [cue.text] }
}

export default function TheaterCueEditDialog(props: Props) {
  const { selection, tracks, precision, locked, saving } = props
  const options = theaterSubtitleLanguages.flatMap(language => {
    if (!precision[language]) return []
    const indices = selection === 'insert' ? [-1] : selection.sourceCues?.[language] ?? []
    return indices.flatMap(index => {
      const cue = tracks[language]?.[index]
      if (index >= 0 && !cue) return []
      return [{ value: language + ':' + index, language, index, label: theaterLanguageLabel[language] +
        (indices.length > 1 && cue ? ' · ' + subtitleTimestamp(cue.startMs) + ' · ' + cue.text.slice(0, 28) : '') }]
    })
  })
  const [selected, setSelected] = useState(options[0]?.value)
  const option = options.find(entry => entry.value === selected) ?? options[0]
  if (!option) return null

  return <AppDialog open closeDisabled={saving} onOpenChange={open => { if (!open) props.onClose() }}
    title={selection === 'insert' ? '插入新句' : '编辑台词'} size="form" mobileFullscreen>
    <Flex direction="column" gap="3">
      {options.length > 1 && <Flex direction="column" gap="1">
        <Text size="2" weight="medium">字幕轨道</Text>
        <FormSelect value={option.value} options={options} disabled={saving || locked}
          ariaLabel="字幕轨道" onValueChange={value => { props.playback.pause(); setSelected(value) }} />
      </Flex>}
      {selection === 'insert' && options.length === 1 && <Text size="2" weight="medium">字幕轨道 · {option.label}</Text>}
      <CueForm key={option.value} {...props} language={option.language} index={option.index} />
    </Flex>
  </AppDialog>
}

function CueForm({ selection, tracks, precision, playback, locked, saving, waiting, error, onClose, onSave, language, index }:
  Props & { language: TheaterLanguage; index: number }) {
  const track = tracks[language] ?? []
  const cue = track[index]
  const step = precision[language] ?? 1
  const limit = Math.floor(Math.min(playback.duration ?? maxTime, maxTime) / step) * step
  const atPlayhead = () => Math.floor(Math.min(playback.position(), limit) / step) * step
  const [{ action, texts, cut }, setDraft] = useState(() =>
    cueDraft(selection === 'insert' ? selection : 'edit', track, language, index, step, atPlayhead()))
  const [start, setStart] = useState(() => subtitleTimestamp(Math.max(0, Math.min(atPlayhead(), limit - step))))
  const [end, setEnd] = useState(() => subtitleTimestamp(Math.min(atPlayhead() + 2000, limit)))
  const [previewError, setPreviewError] = useState(false)
  const slider = useRef<HTMLSpanElement>(null)
  const showPlayhead = playback.duration !== null && (action === 'insert' || action === 'split')
  const sliderStart = action === 'split' ? cue.startMs : 0
  const sliderEnd = action === 'split' ? Math.min(cue.endMs, limit) : limit
  const sliderTime = Math.max(sliderStart, Math.min(playback.time, sliderEnd))
  const playheadLabel = subtitleTimestamp(sliderTime)
  const disabled = saving || waiting || locked
  const startMs = parseSubtitleTimestamp(start)
  const endMs = parseSubtitleTimestamp(end)
  const cutMs = parseSubtitleTimestamp(cut)
  const pairStart = action === 'previous' ? index - 1 : index
  const pair = track.slice(pairStart, pairStart + 2)

  useEffect(() => {
    const thumb = slider.current?.querySelector('[role="slider"]')
    thumb?.setAttribute('aria-label', '播放位置')
    thumb?.setAttribute('aria-valuetext', playheadLabel)
  }, [playheadLabel, showPlayhead])

  function chooseAction(value: Action) {
    playback.pause()
    setPreviewError(false)
    setDraft(cueDraft(value, track, language, index, step, atPlayhead()))
  }

  function range(from: number, to: number) {
    return Number.isInteger(from) && Number.isInteger(to) && from % step === 0 && to % step === 0 &&
      from >= 0 && to > from && to <= maxTime
  }

  let before: SubtitleCue[] = cue ? [cue] : []
  let after: SubtitleCue[] = []
  let editIndex = index
  const text = texts[0].trim()
  if (action === 'insert' && range(startMs, endMs) && endMs <= limit) {
    const next = track.findIndex(entry => entry.startMs > startMs || entry.startMs === startMs && entry.endMs > endMs)
    editIndex = next < 0 ? track.length : next
    after = [{ startMs, endMs, text }]
  } else if (action === 'split' && range(cue.startMs, cutMs) && range(cutMs, cue.endMs)) {
    after = [{ ...cue, endMs: cutMs, text }, { ...cue, startMs: cutMs, text: texts[1]?.trim() ?? '' }]
  } else if ((action === 'previous' || action === 'next') && pair.length === 2) {
    before = pair
    editIndex = pairStart
    after = [{ startMs: pair[0].startMs, endMs: Math.max(pair[0].endMs, pair[1].endMs), text }]
  }
  const valid = action === 'edit' ? Boolean(text && text !== cue.text) : action === 'remove' ||
    (after.length > 0 && after.every(entry => entry.text && entry.text.length <= 1800))

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid || disabled) return
    playback.pause()
    onSave(action === 'edit' ? { language, index, before: cue.text, text }
      : { kind: 'timeline', language, index: editIndex, before, after })
  }

  async function audition(from: number, to: number) {
    setPreviewError(false)
    setPreviewError(!await playback.preview(from, to))
  }

  function timeInput(label: string, value: string, change: (next: string) => void) {
    return <Flex direction="column" gap="1">
      <Text as="label" size="2" weight="medium" htmlFor={'theater-time-' + label}>{label}</Text>
      <Flex gap="2" wrap="wrap">
        <TextField.Root id={'theater-time-' + label} value={value} size="2" placeholder="00:00:00.000"
          disabled={disabled} onChange={event => change(event.target.value)} />
        <Button type="button" size="2" variant="soft" disabled={disabled || playback.duration === null}
          onClick={() => change(subtitleTimestamp(atPlayhead()))}>用播放位置</Button>
      </Flex>
    </Flex>
  }

  return <form onSubmit={submit}>
    <Flex direction="column" gap="3">
      {cue && <Flex gap="2" align="center" wrap="wrap">
        <Text size="2" weight="medium">{theaterLanguageLabel[language]} · {subtitleTimestamp(cue.startMs)} – {subtitleTimestamp(cue.endMs)}</Text>
        <Button type="button" size="1" variant="soft" disabled={disabled || playback.duration === null}
          onClick={() => void audition(cue.startMs, cue.endMs)}>试听原句</Button>
      </Flex>}
      {cue && <Flex gap="2" wrap="wrap" role="group" aria-label="字幕操作">
        {(['edit', 'split', 'previous', 'next', 'remove'] as const).map(value =>
          <Button key={value} type="button" size="2" variant={value === action ? 'solid' : 'soft'}
            color={value === 'remove' ? 'red' : undefined} aria-pressed={value === action}
            disabled={disabled || !canApplyTheaterCueAction(track, index, step, value)}
            onClick={() => chooseAction(value)}>{labels[value]}</Button>)}
      </Flex>}
      <Flex gap="2" align="center" wrap="wrap">
        <Text size="2" color="gray">播放位置 {subtitleTimestamp(playback.time)}</Text>
        {playback.duration !== null && <Button type="button" size="1" variant="ghost" onClick={playback.pause}>暂停试听</Button>}
      </Flex>
      {showPlayhead && sliderEnd > sliderStart && <Slider ref={slider} size="2" min={sliderStart} max={sliderEnd} step={step}
        disabled={disabled} value={[sliderTime]}
        onValueChange={([position]) => { playback.pause(); playback.seek(position) }} />}
      {action === 'insert' && <Flex gap="3" wrap="wrap">
        {timeInput('开始时间', start, setStart)}
        {timeInput('结束时间', end, setEnd)}
      </Flex>}
      {action === 'split' && timeInput('拆分时间', cut, value => setDraft(previous => ({ ...previous, cut: value })))}
      {action === 'remove' ? <Text size="2" className="whitespace-pre-wrap wrap-break-word">{cue.text}</Text> :
        texts.map((entry, offset) => {
          const label = action === 'split' ? (offset === 0 ? '第一句' : '第二句') : '台词'
          const preview = after[offset]
          return <Flex key={offset} direction="column" gap="1">
            <Flex gap="2" align="center" wrap="wrap">
              <Text as="label" size="2" weight="medium" htmlFor={'theater-draft-' + offset}>{label}</Text>
              {preview && <Button type="button" size="1" variant="ghost"
                disabled={disabled || playback.duration === null} onClick={() => void audition(preview.startMs, preview.endMs)}>
                试听{label}
              </Button>}
            </Flex>
            <TextArea id={'theater-draft-' + offset} value={entry} disabled={disabled} maxLength={1800}
              onChange={event => {
                const next = event.target.value
                setDraft(previous => ({ ...previous, texts: previous.texts.map((value, i) => i === offset ? next : value) }))
              }} />
          </Flex>
        })}
      {(action === 'insert' || action === 'split') && !after.length && <Text size="2" color="gray">
        {action === 'split' ? '请将拆分时间设在原句起止之间。' : '请输入有效的起止时间，结束时间须晚于开始时间。'}
        {step === 10 && ' ASS 字幕时间精确到 0.01 秒。'}
      </Text>}
      {texts.some(entry => entry.length > 1800) && <Text size="2" color="red">单句最多 1800 字符，请缩短台词。</Text>}
      {previewError && <Text size="2" color="red" role="alert">暂时无法试听，请核对时间后重试。</Text>}
      {locked && <Text size="2" color="gray">请先完成字幕同步，再继续编辑。</Text>}
      {error && <Text size="2" color="red" role="alert">{error}</Text>}
      <Flex justify="end" gap="2" wrap="wrap">
        <Button type="button" variant="soft" color="gray" disabled={saving} onClick={onClose}>取消</Button>
        <Button type="submit" loading={saving} color={action === 'remove' ? 'red' : undefined} disabled={disabled || !valid}>
          {action === 'remove' ? '确认删除此句' : '保存修订'}
        </Button>
      </Flex>
    </Flex>
  </form>
}
