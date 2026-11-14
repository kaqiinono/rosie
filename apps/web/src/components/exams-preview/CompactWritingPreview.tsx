'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { FormSelect, JudgmentIconButton, LetterChoiceButton, type HandwritingStroke } from '@rosie/ui'
import { Badge, Button, Flex, Text, TextField } from '@rosie/ui/themes'
import InlineHandwritingPad from './InlineHandwritingPad'
import people from './assets/people.png'
import rooms from './assets/rooms.png'

type Variant = 'people' | 'labels' | 'binary' | 'open' | 'form'
type Entry = { ink: readonly HandwritingStroke[]; text: string }
const EMPTY: readonly HandwritingStroke[] = []
const words = ['blonde', 'short', 'beard', 'T-shirt', 'fat', 'short hair', 'slim', 'coat', 'dark hair', 'long hair', 'shorts', 'trousers', 'jeans', 'shirt']
const statements = ['The pillow is under the bed.', 'The bookcase is between the armchair and the sofa.', 'The desk is against the wall.', 'The fridge is next to the cooker.', 'The lamp is in the living room.', 'There is a cupboard under the sink.']
const replies = ['No, let’s drive.', 'I would prefer coffee.', 'Yes, that sounds delicious.', 'Good idea. She’s really clever.', 'Yes, and let’s take a ball.', 'She’s very busy at the moment.']
const roomGroups = [
  { name: 'A', viewBox: '0 65 335 240', numbers: [1, 2, 3] },
  { name: 'B', viewBox: '335 65 305 240', numbers: [4, 5, 6, 7] },
  { name: 'C', viewBox: '640 55 284 250', numbers: [8, 9, 10, 11] },
]

function Picture({ room, label, viewBox }: { room?: boolean; label: string; viewBox: string }) {
  const source = room ? rooms : people
  return <svg role="img" aria-label={label} viewBox={viewBox} className="block h-auto w-full">
    <image href={source.src} width={source.width} height={source.height} />
  </svg>
}

/** Local review surface only. Does not change production answers or grading. */
export default function CompactWritingPreview({ variant, titleActions }: { variant: Variant; titleActions?: HTMLElement | null }) {
  const [judgment, setJudgment] = useState('ticks')
  const [modes, setModes] = useState<Record<string, string>>({})
  const [keyboardFields, setKeyboardFields] = useState<Record<string, boolean>>({})
  const [entries, setEntries] = useState<Record<string, Entry>>({})
  const [drawing, setDrawing] = useState<string[]>([])
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({})
  const [answerModes, setAnswerModes] = useState<Record<string, string>>({})
  const baseScope = variant === 'binary' ? judgment : variant
  const supportsChoice = variant === 'binary' || variant === 'people'
  const choiceMode = supportsChoice && (answerModes[baseScope] ?? 'choice') === 'choice'
  const scope = supportsChoice ? `${baseScope}/${choiceMode ? 'choice' : 'handwriting'}` : baseScope
  const mode = modes[scope] ?? 'ink'
  const locked = !!submitted[baseScope]
  const ids = variant === 'people' ? words.map((_, i) => String(i + 1))
    : variant === 'labels' ? Array.from({ length: 11 }, (_, i) => String(i + 1))
      : variant === 'open' ? ['25', '26', '27'] : variant === 'form' ? ['6', '7', '8', '9', '10']
        : Array.from({ length: judgment === 'sd' ? 1 : judgment === 'pf' ? 8 : 6 }, (_, i) => String(i + 1))
  const completed = ids.filter(id => {
    const entry = entries[`${scope}/${id}`]
    return !!entry && (entry.ink.length > 0 || entry.text.trim().length > 0)
  }).length
  const field = (id: string, label: string, word = false) => {
    const key = `${scope}/${id}`
    const entry = entries[key]
    return mode === 'keyboard' || keyboardFields[key] ? <div className={word ? 'w-40 max-w-full' : 'w-20'}>
      <TextField.Root size="2" aria-label={label} value={entry?.text ?? ''} readOnly={locked}
        autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
        onChange={event => setEntries(previous => ({ ...previous, [key]: { ink: EMPTY, text: event.target.value } }))} />
      {mode !== 'keyboard' && !locked && !entry?.text && <Button size="1" variant="ghost" onClick={() => setKeyboardFields(previous => ({ ...previous, [key]: false }))}>手写</Button>}
    </div> : <InlineHandwritingPad key={key} label={label} strokes={entry?.ink ?? EMPTY} word={word} readOnly={locked}
      onKeyboardRequest={() => setKeyboardFields(previous => ({ ...previous, [key]: true }))}
      onChange={ink => setEntries(previous => ({ ...previous, [key]: { ink, text: '' } }))}
      onDrawingChange={active => setDrawing(previous => active
        ? previous.includes(key) ? previous : [...previous, key]
        : previous.includes(key) ? previous.filter(value => value !== key) : previous)} />
  }
  const row = (id: string, text: string, word = false) => <div key={id} className="flex min-w-0 justify-start items-center gap-2">
    <Text size="3" lang="en" className="self-center min-w-0">{id}. {text}</Text>{field(id, `第 ${id} 空${text ? `：${text}` : ''}`, word)}
  </div>
  const letterRow = (id: string, text: string, options: readonly { id: string; meaning: string }[]) => {
    const key = `${scope}/${id}`
    if (!choiceMode) return row(id, text)
    const selected = entries[key]?.text ?? ''
    return <Flex key={key} align="center" gap="2">
      <Text size="3" lang="en">{baseScope === 'sd' ? text : `${id}. ${text}`}</Text>
      <Flex gap="2" align="center" flexShrink="0" role="group" aria-label={`第 ${id} 题字母分类`}>
        {options.map(option => <LetterChoiceButton key={option.id} letter={option.id}
          label={`${option.id} · ${option.meaning}`} selected={selected === option.id} disabled={locked}
          onClick={() => setEntries(previous => ({ ...previous, [key]: { ink: EMPTY, text: option.id } }))} />)}
      </Flex>
    </Flex>
  }
  const switchMode = (next: string) => {
    if (next === mode || drawing.length) return
    // Preserve existing answers; alternate input is intended for empty grids only.
    setKeyboardFields(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith(`${scope}/`))))
    setModes(previous => ({ ...previous, [scope]: next }))
  }
  const modeButton = <Button size="1" variant={!choiceMode ? 'solid' : 'soft'}
    aria-pressed={!choiceMode} disabled={locked || drawing.length > 0}
    onClick={() => setAnswerModes(previous => ({ ...previous, [baseScope]: choiceMode ? 'handwriting' : 'choice' }))}>
    手写模式
  </Button>
  return <Flex direction="column" gap="3">
    {variant === 'binary' && <FormSelect ariaLabel="判断练习" value={judgment} disabled={drawing.length > 0} onValueChange={setJudgment} options={[
      { value: 'ticks', label: '练习4 · 判断对错 ✓ / ✗' }, { value: 'pf', label: '练习5 · 听音选择 P / F' },
      { value: 'ad', label: '练习8 · 选择 A / D' }, { value: 'sd', label: '阅读训练 · 选择 S / D' },
    ]} />}
    {supportsChoice && (titleActions ? createPortal(modeButton, titleActions) : titleActions === undefined ? modeButton : null)}
    {!supportsChoice && <Flex gap="3" align="center" wrap="wrap">
      <Badge color="gray">{choiceMode ? '原题节选 · 判断与分类点选 demo' : '原题节选 · 常驻书写 demo'}</Badge>
      {!choiceMode && <>
      <Button size="1" variant="soft" disabled={drawing.length > 0 || locked || completed > 0} onClick={() => switchMode(mode === 'ink' ? 'keyboard' : 'ink')}>
        {mode === 'ink' ? '键盘备用' : '直接手写'}
      </Button>
      <Text size="1" color="gray">{mode === 'ink' ? '直接写，抬笔即保留；回转箭头撤销，橡皮擦清除。' : '键盘备用；重做后可切换输入方式。'}</Text>
      </>}
      {choiceMode && <Text size="1" color="gray">点击选项即可作答，提交前可改选。</Text>}
    </Flex>}
    <div className="@container">
      {variant === 'people' && <>
        <Text as="p" size="3" lang="en">Write T (Tom), A (Axel) or N (Niko). Example: tall → T.</Text>
        <Text size="2" color="gray">T = Tom，A = Axel，N = Niko。可点选字母，也可切换手写。</Text>
        <div className="mt-3 grid items-start gap-4 @[44rem]:grid-cols-[minmax(0,1fr)_190px]">
          <div className="grid gap-x-5 gap-y-2 @[28rem]:grid-cols-2">
            {[0, 7].map(start => <div key={start} className="flex flex-col gap-2">{words.slice(start, start + 7).map((word, index) => letterRow(String(start + index + 1), word, [{ id: 'T', meaning: 'Tom' }, { id: 'A', meaning: 'Axel' }, { id: 'N', meaning: 'Niko' }]))}</div>)}
          </div>
          <div className="order-first mx-auto w-full max-w-[240px] @[44rem]:order-none"><Picture label="Tom、Axel、Niko" viewBox="475 20 455 345" /></div>
        </div>
      </>}
      {variant === 'labels' && <>
        <Text as="p" size="3" lang="en">Label the pictures with words from the box.</Text>
        <Text as="p" size="2" lang="en">armchair · bed · bookcase · cooker · cupboard · desk · fridge · <s>lamp</s> · pillow · sink · sofa · television</Text>
        <div className="mt-3 grid gap-4 @[40rem]:grid-cols-3">
          {roomGroups.map(room => <section key={room.name} className="min-w-0">
            <Text weight="bold">{room.name}{room.name === 'A' ? ' · Example: lamp' : ''}</Text>
            <div className="mx-auto w-full max-w-[260px]"><Picture room label={`房间 ${room.name} 与原题编号`} viewBox={room.viewBox} /></div>
            <div className="mt-2 flex flex-col gap-2">{room.numbers.map(number => row(String(number), '', true))}</div>
          </section>)}
        </div>
      </>}
      {variant === 'binary' && judgment === 'ticks' && <div className="flex flex-col gap-3">
        <div className="mx-auto w-full max-w-[700px]"><Picture room label="三个房间，供判断句子使用" viewBox="0 60 924 250" /></div>
        <Text size="2">Example: The lamp is on the table next to the bed. ✓</Text>
        <div className="grid gap-x-5 gap-y-2 @[36rem]:grid-cols-2">{statements.map((text, i) => {
          if (!choiceMode) return row(String(i + 1), text)
          const key = `${scope}/${i + 1}`
          return <Flex key={key} align="center" gap="2">
            <Text size="3" lang="en">{i + 1}. {text}</Text>
            <Flex align="center" gap="2" flexShrink="0" role="group" aria-label={`第 ${i + 1} 题：判断对错`}>
              {(['right', 'wrong'] as const).map(id =>
                <JudgmentIconButton key={id} answer={id} selected={entries[key]?.text === id} disabled={locked}
                  label={`第 ${i + 1} 题：${id === 'right' ? '对' : '错'}`}
                  onClick={() => setEntries(previous => ({ ...previous, [key]: { ink: EMPTY, text: id } }))} />)}
            </Flex>
          </Flex>
        })}</div>
      </div>}
      {variant === 'binary' && judgment === 'pf' && <>
        <Text as="p">Listen and write P (present) or F (future). Example: P.</Text>
        <div className="mt-3 grid gap-4 @[28rem]:grid-cols-4">{ids.map(id => letterRow(id, '', [{ id: 'P', meaning: 'present · 现在' }, { id: 'F', meaning: 'future · 将来' }]))}</div>
        <Text size="2" color="gray">P = 现在，F = 将来。可点选或手写；本页未接入原题音频，不判分。</Text>
      </>}
      {variant === 'binary' && judgment === 'ad' && <>
        <Text as="p">Write A (agree) or D (disagree) next to each reply.</Text><Text size="2" color="gray">A = 同意，D = 不同意。可点选或手写。</Text>
        <div className="mt-3 flex flex-col gap-2">{replies.map((text, i) => letterRow(String(i + 1), text, [{ id: 'A', meaning: 'agree · 同意' }, { id: 'D', meaning: 'disagree · 不同意' }]))}</div>
        <Text as="p" size="2">Examples: It’s just started to rain. → D · Fine. It’s only a 5-minute walk to the station. → A</Text>
      </>}
      {variant === 'binary' && judgment === 'sd' && <>
        <Text size="2" color="gray">S = 意思相近，D = 意思不同。可点选或手写。</Text>
        {letterRow('1', 'on foot / walk', [{ id: 'S', meaning: 'Similar meanings' }, { id: 'D', meaning: 'Different meanings' }])}
      </>}
      {variant === 'form' && <>
        <Text as="p" weight="bold">Radio camp</Text><Text as="p" size="2">Address: 102 Golden Street</Text>
        <div className="mt-3 flex flex-col gap-2">{['Date first course starts:', 'Learn to write:', 'Meet world famous:', 'Each person receives:', 'Discount price: $'].map((text, i) => row(String(i + 6), text, true))}</div>
        <Text as="p" size="2" color="gray">官方 Test 1 Listening Part 2 节选；本页没有音频，不判分。</Text>
      </>}
      {variant === 'open' && <div className="flex flex-col gap-3 text-lg leading-loose" lang="en">
        <Text weight="bold">From: Rachel · To: Chris</Text>
        <Text>We’re back <strong>from</strong> our holiday in the US. It was amazing!</Text>
        <div className="flex flex-wrap items-center gap-2">It’s {field('25', '25：一个单词', true)} biggest country I’ve ever been to.</div>
        <div className="flex flex-wrap items-center gap-2">We travelled from Los Angeles to Seattle {field('26', '26：一个单词', true)} car.</div>
        <div className="flex flex-wrap items-center gap-2">It’s nearly 2000 km and the trip took us {field('27', '27：一个单词', true)} very long time — nearly a week.</div>
      </div>}
    </div>
    <Flex gap="3" align="center" wrap="wrap">
      <Button disabled={locked || drawing.length > 0 || !completed} onClick={() => setSubmitted(previous => ({ ...previous, [baseScope]: true }))}>提交本示例</Button>
      <Button variant="soft" disabled={drawing.length > 0} onClick={() => { setEntries(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith(`${baseScope}/`)))); setKeyboardFields(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith(`${baseScope}/`)))); setSubmitted(previous => ({ ...previous, [baseScope]: false })) }}>重新作答</Button>
      <Text size="2" role="status">{locked ? choiceMode ? '已提交 · 模拟页不判分' : '已提交 · 待人工批阅（模拟，不判分）' : `已填写 ${completed} / ${ids.length}`}</Text>
    </Flex>
  </Flex>
}
