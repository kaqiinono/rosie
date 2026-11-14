'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnswerChoiceGroup, InlineChoiceField, FormSelect, MatchingBoard, PageShell, StickerCard } from '@rosie/ui'
import { Badge, Button, Checkbox, Flex, Heading, Text, TextArea } from '@rosie/ui/themes'
import people from './assets/people.png'
import rooms from './assets/rooms.png'
import tennis from './assets/tennis.png'
import ReadingHighlightPreview, { createReadingAnnotations } from './ReadingHighlightPreview'
import HandwritingReviewDemo from './HandwritingReviewDemo'
import IllustratedReadingPreview from './IllustratedReadingPreview'
import HeadingNumberPreview from './HeadingNumberPreview'
import CompactWritingPreview from './CompactWritingPreview'
import { KET_READING_SAMPLE } from './ket-reading-sample'

import { EXAM_DEMOS, type DemoId } from './exam-demos'

const demos = EXAM_DEMOS
type Choice = { id: string; label: string; content?: ReactNode; disabled?: boolean }
type Answers = Record<string, string>
const abc = (labels: string[]): Choice[] => labels.map((label, i) => ({ id: String.fromCharCode(65 + i), label }))

function SourcePicture({ source, viewBox, label }: { source: string; viewBox: string; label: string }) {
  const dimensions = source === people.src ? [938, 374] : source === tennis.src ? [1352, 344] : [924, 336]
  return <svg role="img" aria-label={label} viewBox={viewBox} className="block h-auto w-full" preserveAspectRatio="xMidYMid meet"><image href={source} width={dimensions[0]} height={dimensions[1]} /></svg>
}

function LocalRecorder({ disabled, onReady, onReset, mediaActive = true, mediaEpoch = 0 }: { disabled: boolean; onReady: () => void; onReset: () => void; mediaActive?: boolean; mediaEpoch?: number }) {
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const alive = useRef(true)
  const audioUrl = useRef('')
  const [recording, setRecording] = useState(false)
  const [pending, setPending] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const requestGeneration = useRef(0)
  const permitted = useRef(mediaActive)
  useEffect(() => {
    permitted.current = mediaActive
    requestGeneration.current += 1
    if (recorder.current?.state === 'recording') recorder.current.stop()
    stream.current?.getTracks().forEach(track => track.stop())
    setPending(false)
  }, [mediaActive, mediaEpoch])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (recorder.current?.state === 'recording') recorder.current.stop()
      stream.current?.getTracks().forEach(track => track.stop())
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
    }
  }, [])
  const start = async () => {
    if (pending || recording || disabled || !permitted.current) return
    const generation = requestGeneration.current
    setError(''); setPending(true); onReset()
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('请在支持录音的浏览器和 HTTPS 页面打开。')
      const input = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!alive.current || !permitted.current || generation !== requestGeneration.current) { input.getTracks().forEach(track => track.stop()); return }
      stream.current = input
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
      audioUrl.current = ''; setUrl('')
      const next = new MediaRecorder(input)
      const chunks: Blob[] = []
      next.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      next.onstop = () => {
        input.getTracks().forEach(track => track.stop())
        stream.current = null
        if (!alive.current) return
        setRecording(false)
        if (chunks.length) {
          const blob = new Blob(chunks, { type: next.mimeType || chunks[0].type })
          audioUrl.current = URL.createObjectURL(blob)
          setUrl(audioUrl.current); onReady()
        }
      }
      next.onerror = () => {
        input.getTracks().forEach(track => track.stop())
        if (alive.current) { setRecording(false); setError('录音失败，请重新尝试。'); onReset() }
      }
      recorder.current = next; next.start(); setRecording(true)
    } catch (reason) {
      stream.current?.getTracks().forEach(track => track.stop())
      if (alive.current && generation === requestGeneration.current) setError(reason instanceof Error ? reason.message : '无法开始录音，请检查麦克风权限。')
    } finally { if (alive.current && generation === requestGeneration.current) setPending(false) }
  }
  return <Flex direction="column" gap="3">
    <Flex gap="3"><Button loading={pending} disabled={disabled || recording || pending} onClick={() => void start()}>开始录音</Button><Button variant="soft" disabled={!recording} onClick={() => recorder.current?.stop()}>结束录音</Button></Flex>
    <Text role="status">{recording ? '正在录音…' : '录音仅保留在当前页面，离开后清除。'}</Text>
    {error && <Text color="red" role="alert">{error}</Text>}
    {url && <audio controls src={url} aria-label="回听我的回答" />}
  </Flex>
}

export default function ExamTypePreview({ embedded = false, initialDemo = 'labels', mediaActive = true, mediaEpoch = 0 }: { embedded?: boolean; initialDemo?: DemoId; mediaActive?: boolean; mediaEpoch?: number }) {
  const [active, setActive] = useState<DemoId>(initialDemo)
  const [titleActions, setTitleActions] = useState<HTMLSpanElement | null>(null)
  const [answers, setAnswers] = useState<Answers>({})
  const [readingAnnotations, setReadingAnnotations] = useState(createReadingAnnotations)
  const [submitted, setSubmitted] = useState<Partial<Record<DemoId, boolean>>>({})
  const [recordingEpoch, setRecordingEpoch] = useState(0)
  const [writingKind, setWritingKind] = useState('email')
  const [speakingKind, setSpeakingKind] = useState('interview')
  const locked = !!submitted[active]
  const value = (key: string) => answers[`${active}:${key}`] ?? ''
  const change = (key: string, next: string) => { if (!locked) setAnswers(previous => ({ ...previous, [`${active}:${key}`]: next })) }
  const choice = (key: string, label: string, options: readonly Choice[], grid = false) => <AnswerChoiceGroup key={key} label={label} optionLang="en" options={options} value={value(key)} onValueChange={next => change(key, next)} readOnly={locked} layout={grid ? 'grid' : 'list'} reserveFeedbackSpace={false} />
  const inlineChoice = (key: string, number: string, options: readonly Choice[]) => <InlineChoiceField
    label={number} options={options} value={value(key)} onValueChange={next => change(key, next)} readOnly={locked} />
  const material = (children: ReactNode) => <StickerCard tone="paper" elevation="flat" size="md"><div className="text-lg leading-loose" lang="en">{children}</div></StickerCard>
  const task = (label: string, children: ReactNode) => <Flex key={label} direction="column" gap="3"><Text weight="bold" size="4" lang="en">{label}</Text>{children}</Flex>
  const matchingValues = Object.fromEntries(Object.entries(answers).filter(([key]) => key.startsWith(`${active}:`)).map(([key, answer]) => [key.slice(active.length + 1), answer]))
  const changeMatches = (next: Record<string, string>) => {
    if (locked) return
    setAnswers(previous => ({ ...Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith(`${active}:`))), ...Object.fromEntries(Object.entries(next).map(([key, answer]) => [`${active}:${key}`, answer])) }))
  }
  const missingAudio = <Text size="2" color="gray">本模拟页没有接入原题音频；可体验选答和填写，不进行听力判分。</Text>
  const page = demos.find(demo => demo[0] === active)!
  const filled = Object.entries(answers).filter(([key, answer]) => key.startsWith(`${active}:`) && answer.trim()).length
  const compactWriting = ['people', 'labels', 'binary', 'open', 'form'].includes(active)

  let content: ReactNode
  switch (active) {
    case 'notice': content = <>{material(<><strong>{KET_READING_SAMPLE.notice.title}</strong><br />{KET_READING_SAMPLE.notice.body}<br />{KET_READING_SAMPLE.notice.detail}</>)}{choice('1', '选择与告示意思相符的一项', KET_READING_SAMPLE.options)}</>; break
    case 'reading': content = <ReadingHighlightPreview key={recordingEpoch} annotations={readingAnnotations} onAnnotationsChange={setReadingAnnotations}
      answers={{ '14': value('14'), '15': value('15') }} onAnswer={change} readOnly={locked} />; break
    case 'picture': content = <>{missingAudio}{task('6. When are they going to play tennis?', choice('6', '选择正确图片', ['A', 'B', 'C'].map((id, i) => ({ id, label: `图片 ${id}`, content: <span className="block w-full"><SourcePicture source={tennis.src} viewBox={['80 70 370 270', '495 70 375 270', '950 70 395 270'][i]} label={`选项 ${id} 的日历`} /></span> })), true))}</>; break
    case 'people': content = <CompactWritingPreview key="people" variant="people" titleActions={titleActions} />; break
    case 'binary': content = <CompactWritingPreview key="binary" variant="binary" titleActions={titleActions} />; break
    case 'labels': content = <CompactWritingPreview key="labels" variant="labels" />; break
    case 'matching': content = <>
      <Text size="2" color="gray">以下为自拟交互示例，演示共享材料与选项可重复使用。</Text>
      {material(<><strong>A · Lily</strong><br />I like stories about animals.<br /><strong>B · Sam</strong><br />I enjoy books with lots of pictures.<br /><strong>C · Ben</strong><br />I read about space.</>)}
      <MatchingBoard key={`matching-${recordingEpoch}`} layout="columns" items={[
        { id: '1', label: 'Who likes illustrated books?' },
        { id: '2', label: 'Who enjoys animal stories?' },
        { id: '3', label: 'Who likes books about planets?' },
        { id: '4', label: 'Who reads about animals?' },
      ]} options={abc(['Lily', 'Sam', 'Ben'])} value={matchingValues} onValueChange={changeMatches} allowReuse readOnly={locked} />
    </>; break
    case 'replies': {
      const options = abc(['No, let’s drive.', 'I would prefer coffee.', 'Yes, that sounds delicious.', 'Good idea. She’s really clever.', 'Yes, and let’s take a ball.', 'She’s very busy at the moment.', 'It’s just started to rain.', 'Fine. It’s only a 5-minute walk to the station.'])
      const selected = options.filter(option => value(option.id) === 'selected')
      content = <>
        <Text size="4" weight="bold" lang="en">What about having a chocolate cake?</Text>
        <Flex justify="between" gap="2" wrap="wrap"><Text>选择两个回应。再次点击可以取消，顺序不限。</Text><Badge variant="soft">已选 {selected.length}/2</Badge></Flex>
        <Flex direction="column" gap="3" role="group" aria-label="选择两个回应">
          {options.map(option => {
            const checked = value(option.id) === 'selected'
            return <Text as="label" key={option.id} size="4"><Flex align="start" gap="3" py="2">
              <Checkbox size="3" checked={checked} disabled={locked || (!checked && selected.length >= 2)}
                onCheckedChange={next => { if (next !== true || selected.length < 2) change(option.id, next === true ? 'selected' : '') }} />
              <Text as="span" lang="en">{option.id} · {option.label}</Text>
            </Flex></Text>
          })}
        </Flex>
        <Text role="status" size="2">{selected.length === 2 ? '已选满两个；要更换，请先取消一个。' : `还需选择 ${2 - selected.length} 个回应。`}</Text>
        <Text size="2" color="gray">原训练题的回应配对存在来源冲突；这里只演示选择两个回应，不提供正确答案。</Text>
      </>; break
    }
    case 'cloze': {
      const options = [['learning', 'studying', 'understanding'], ['game', 'match', 'competition'], ['became', 'turned', 'started'], ['plan', 'way', 'thing'], ['offered', 'took', 'sold'], ['times', 'days', 'years']]
      const gap = (n: number) => inlineChoice(String(n), String(n), abc(options[n - 19]))
      content = <>{material(<><strong>Philo T. Farnsworth</strong><br />Philo T. Farnsworth was born in the USA in 1906. As a child, he was very interested in science and electricity and spent a lot of time {gap(19)} about it. He also won a national {gap(20)} for young engineers when he was just 13.<br /><br />When he was 20, Farnsworth {gap(21)} his own business. In 1927 he showed everyone his new idea: a {gap(22)} of sending pictures using electricity. Many other people were working on ideas for machines to do this, but Farnsworth’s was the first that had no moving parts. In fact, it was the first true electronic TV.<br /><br />After many business problems, Farnsworth had success in 1938 when another company {gap(23)} him $1 million for his idea. He is not very famous these {gap(24)}, but, as the father of electronic television, Farnsworth changed the world.</>)}<Text size="2" color="gray">点原文空位选词，答案直接回填；再次点击可改选或清除。</Text>
      </>; break
    }
    case 'bank': {
      const words = ['children', 'teenagers', 'adults'].map(word => ({ id: word, label: word }))
      content = <><Text size="2" color="gray">自拟词库示例，用于确认同一题多个空的操作方式。</Text>
        {material(<>In the park, I can see {inlineChoice('first', '1', words)} and {inlineChoice('second', '2', words)}.</>)}
        <Text>点击空位直接选词，选后回填。本例词语可重复使用；再次点击可修改或清除。</Text>
      </>; break
    }
    case 'open': content = <CompactWritingPreview key="open" variant="open" />; break
    case 'form': content = <CompactWritingPreview key="form" variant="form" />; break
    case 'writing': content = <><FormSelect ariaLabel="写作形式" value={writingKind} onValueChange={setWritingKind} options={[{ value: 'email', label: '写邮件 · 至少25词' }, { value: 'story', label: '看图故事 · 至少35词' }]} /><Text size="2" color="gray">自拟写作示例。</Text>{writingKind === 'email' ? material(<>Write an email to your friend. Invite your friend to a picnic. Say where and when to meet, and what to bring.</>) : material(<><Flex gap="4" wrap="wrap"><Text size="8" aria-label="第一幅：下雨">🌧️</Text><Text size="8" aria-label="第二幅：共用雨伞">☂️</Text><Text size="8" aria-label="第三幅：一起回家">🏠</Text></Flex><Text>Write a story about the three pictures.（图标仅演示三图顺序，正式题使用原图。）</Text></>)}<TextArea size="3" rows={10} aria-label="写作答案" value={value(writingKind)} readOnly={locked} onChange={event => change(writingKind, event.target.value)} /><Text>{value(writingKind).trim() ? value(writingKind).trim().split(/\s+/).length : 0} 词 · 至少 {writingKind === 'email' ? 25 : 35} 词 · 提交后由家长评价</Text></>; break
    case 'handwriting-review': content = <HandwritingReviewDemo />; break
    case 'illustrated-reading': content = <IllustratedReadingPreview />; break
    case 'heading-number': content = <HeadingNumberPreview />; break
    case 'speaking': content = <><FormSelect ariaLabel="口语形式" value={speakingKind} onValueChange={setSpeakingKind} options={[{ value: 'interview', label: '口语问答' }, { value: 'discussion', label: '看图讨论' }]} /><Text size="2" color="gray">自拟口语示例。</Text>{material(speakingKind === 'interview' ? 'Tell me about your favourite weekend activity.' : <><SourcePicture source={rooms.src} viewBox="0 0 924 336" label="三个不同房间" />Which room do you like? Why?</>)}<LocalRecorder key={recordingEpoch} mediaActive={mediaActive} mediaEpoch={mediaEpoch} disabled={locked} onReady={() => change('recording', 'ready')} onReset={() => change('recording', '')} /><Text>没有唯一正确答案；正式模考中，考官脚本只在家长授权区域显示。</Text></>; break
  }

  if (embedded) return <Flex direction="column" gap="4">
    <Flex align="center" justify="between" gap="2"><Text size="2" color="gray">{page[2]}</Text><span ref={setTitleActions} /></Flex>
    {content}
    {!compactWriting && !['handwriting-review', 'illustrated-reading', 'heading-number'].includes(active) && <Flex gap="3" wrap="wrap">
      <Button disabled={locked || (active === 'replies' ? filled !== 2 : filled === 0)} onClick={() => setSubmitted(previous => ({ ...previous, [active]: true }))}>提交本示例</Button>
      <Button variant="soft" onClick={() => { setSubmitted({}); setAnswers({}); setReadingAnnotations(createReadingAnnotations()); setRecordingEpoch(epoch => epoch + 1) }}>重新作答</Button>
      <Text role="status">{locked ? '已提交 · 不保存记录' : '作答仅保留在本页'}</Text>
    </Flex>}
  </Flex>

  return <PageShell title="考一考 · 题型体验" subtitle="先试着答一题，再决定怎么呈现" tone="paper" width="wide" backHref="/" backLabel="返回首页" actions={<Badge variant="soft" radius="full">模拟页 · 不保存记录</Badge>}>
    <div className="grid items-start gap-4 xl:grid-cols-[200px_minmax(0,1fr)]">
      <StickerCard className="hidden xl:block" as="aside" role="navigation" size="md" elevation="flat" aria-label="题型目录"><Flex direction="column" gap="2"><Text weight="bold">14 种题面 · 3 个专项预览</Text>{demos.map(([id, title], index) => <Button key={id} size="3" variant={active === id ? 'solid' : 'soft'} aria-current={active === id ? 'page' : undefined} onClick={() => { if (active === 'speaking' && id !== active) setAnswers(previous => { const next = { ...previous }; delete next['speaking:recording']; return next }); setActive(id) }}>{String(index + 1).padStart(2, '0')} · {title}{submitted[id] ? ' ✓' : ''}</Button>)}</Flex></StickerCard>
      <Flex direction="column" gap="4">
        <div className="xl:hidden"><FormSelect ariaLabel="题型目录" value={active} options={demos.map(([id, title], index) => ({ value: id, label: `${index + 1} · ${title}` }))} onValueChange={next => { const item = demos.find(demo => demo[0] === next); if (item) { if (active === 'speaking' && next !== active) setAnswers(previous => { const updated = { ...previous }; delete updated['speaking:recording']; return updated }); setActive(item[0]) } }} /></div>
        <Flex direction="column" gap="2"><Flex align="center" gap="3" wrap="wrap"><Heading as="h2" size="6">{page[1]}</Heading><span ref={setTitleActions} /></Flex><Text size="2" color="gray">{page[2]}</Text></Flex>
        <StickerCard as="section" size={compactWriting ? "md" : "lg"}><Flex direction="column" gap="5">{content}{!compactWriting && active !== 'handwriting-review' && active !== 'illustrated-reading' && active !== 'heading-number' && <Flex gap="3" wrap="wrap" align="center"><Button size="3" disabled={locked || (active === 'replies' ? filled !== 2 : filled === 0)} onClick={() => setSubmitted(previous => ({ ...previous, [active]: true }))}>提交本示例</Button><Button size="3" variant="soft" onClick={() => { if (active === 'reading') setReadingAnnotations(createReadingAnnotations()); setRecordingEpoch(epoch => epoch + 1); setSubmitted(previous => ({ ...previous, [active]: false })); setAnswers(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith(`${active}:`)))) }}>重新作答</Button><Text role="status" size="2">{locked ? '已锁定答案 · 模拟页不判分' : '可修改答案，提交后锁定'}</Text></Flex>}</Flex></StickerCard>
        <Text size="2" color="gray">刷新后作答清空。原题节选来自用户提供的真题与截图；自拟题已单独标明。本页用于确认交互，不代表完整试卷或已审核题库。</Text>
      </Flex>
    </div>
  </PageShell>
}
