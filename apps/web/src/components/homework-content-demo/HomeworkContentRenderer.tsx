'use client'

import { useEffect, useRef, useState } from 'react'
import { CharFlashCard, CharWriter, PoemRecite, WordFlashCard } from '@rosie/chinese'
import { FlashCard } from '@rosie/english'
import PassageView from '@rosie/english/components/reading/PassageView'
import { LessonView } from '@rosie/english/grammar/components/LessonView'
import { ExerciseView } from '@rosie/english/grammar/components/ExerciseView'
import { AnswerChoiceGroup, DarkScope, LoadingOverlay, StickerCard } from '@rosie/ui'
import { Button, Flex, Heading, Text } from '@rosie/ui/themes'
import ExamTypePreview from '../exams-preview/ExamTypePreview'
import type { Example } from './catalog'
import { GRAMMAR, GRAMMAR_EXERCISES, PASSAGE, POEM, WORD } from './fixtures'
import DemoMedia from './DemoMedia'
import PdfSample from './PdfSample'
import { AnswerSample, CalcSample, MathSample, WritingSample } from './PracticeSamples'
import riStrokes from './ri-strokes.json'

function Speak({ text, lang = 'en-US' }: { text: string; lang?: string }) {
  const [error, setError] = useState('')
  return <Flex direction="column" gap="2"><Button variant="soft" onClick={() => {
    if (!window.speechSynthesis) { setError('当前浏览器不支持朗读。'); return }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang; utterance.rate = 0.85
    window.speechSynthesis.speak(utterance)
  }}>🔊 朗读</Button>{error && <Text role="alert">{error}</Text>}</Flex>
}

function GardenPicture() {
  // eslint-disable-next-line @next/next/no-img-element -- local original SVG fixture
  return <img src="/dev-preview/homework-content/garden.svg" alt="花园里有树、小鸟和两朵花" className="mx-auto h-auto w-full max-w-xl" />
}

function ChineseWords() {
  const [flipped, setFlipped] = useState(false)
  return <Flex direction="column" gap="4">
    <div className="mx-auto w-full max-w-sm"><WordFlashCard data={{ word: '春风', pinyin: 'chūn fēng', unit: 1, lessonKey: 'demo', lessonTitle: '自拟示例', unitLessonNo: 1, bookLessonNo: 1 }} flipped={flipped} onFlip={() => setFlipped(value => !value)} /></div>
    <WritingSample label="看拼写词：chūn fēng" />
    <AnswerSample prompt="键盘填写：chūn fēng" answer="春风" />
  </Flex>
}

function Character() {
  const [flipped, setFlipped] = useState(false)
  return <div className="mx-auto w-full max-w-sm"><CharFlashCard data={{ char: '日', pinyin: 'rì', unit: 1, lessonTitle: '自拟字卡', radical: '日', strokeCount: 4, phrases: ['日子', '日光', '生日'] }} flipped={flipped} onFlip={() => setFlipped(value => !value)} /></div>
}

function Strokes() {
  const [mode, setMode] = useState<'animate' | 'quiz' | null>(null)
  const [round, setRound] = useState(0)
  const [message, setMessage] = useState('')
  return <Flex direction="column" gap="3">
    <Text align="center" size="8">日 · rì</Text>
    <Flex gap="2" wrap="wrap" justify="center"><Button onClick={() => { setMode('animate'); setRound(n => n + 1); setMessage('') }}>演示笔顺</Button><Button variant="soft" onClick={() => { setMode('quiz'); setRound(n => n + 1); setMessage('') }}>描写练习</Button></Flex>
    {mode && <CharWriter key={round} characterData={riStrokes} char="日" mode={mode} onQuizComplete={({ totalMistakes }) => setMessage(`完成描写 · 提示 ${totalMistakes} 次`)} />}
    {message && <Text role="status">{message}</Text>}
    <WritingSample label="自由书写：日" />
  </Flex>
}

function Reading({ kind }: { kind: string }) {
  const [hidden, setHidden] = useState(kind === 'dictation')
  const [translated, setTranslated] = useState(false)
  const [pinyin, setPinyin] = useState(false)
  const [sentence, setSentence] = useState(0)
  const chinese = kind === 'chinese-reading'
  const lines = chinese ? ['清晨，Rosie 打开窗户，看见花园里的小花开了。', '她提来一壶水，轻轻地浇在泥土上。小鸟在树上唱歌。'] : PASSAGE.paragraphs
  const text = kind === 'sentence' || kind === 'dictation' ? ['Rosie has a little garden.', 'She waters the flowers every morning.'][sentence] : lines.join('\n\n')
  return <Flex direction="column" gap="4">
    {kind === 'story' && <Heading size="4">Chapter 1 · A New Friend</Heading>}
    <Flex gap="2" wrap="wrap"><Speak text={text} lang={chinese ? 'zh-CN' : 'en-US'} /><Button variant="soft" onClick={() => setHidden(value => !value)}>{hidden ? '显示原文' : '隐藏原文，试着背诵'}</Button>{chinese && <Button variant="soft" onClick={() => setPinyin(value => !value)}>{pinyin ? '收起注音' : '重点词注音'}</Button>}{!chinese && <Button variant="soft" onClick={() => setTranslated(value => !value)}>{translated ? '收起译文' : '查看译文'}</Button>}</Flex>
    {kind === 'sentence' || kind === 'dictation' ? <>
      <Flex gap="2"><Button variant="soft" disabled={sentence === 0} onClick={() => { window.speechSynthesis?.cancel(); setSentence(0) }}>上一句</Button><Text>第 {sentence + 1} / 2 句</Text><Button variant="soft" disabled={sentence === 1} onClick={() => { window.speechSynthesis?.cancel(); setSentence(1) }}>下一句</Button></Flex>
      {!hidden && <Text size="6">{text}</Text>}
      {translated && <Text color="gray">{sentence === 0 ? 'Rosie 有一个小花园。' : '她每天早上给花浇水。'}</Text>}
      {['Rosie has a little garden.', 'She waters the flowers every morning.'].map((line, index) => <div key={line} hidden={sentence !== index}><AnswerSample prompt={`听一听，写下第 ${index + 1} 句`} answer={line} /></div>)}
    </> : <>
      {!hidden && (chinese ? lines.map(line => <p key={line} className="text-xl leading-loose">{pinyin ? line.split(/(清晨|花园|小鸟)/).map((part, index) => {
        const pronunciation: Record<string, string> = { 清晨: 'qīng chén', 花园: 'huā yuán', 小鸟: 'xiǎo niǎo' }
        return pronunciation[part] ? <ruby key={index}>{part}<rt>{pronunciation[part]}</rt></ruby> : part
      }) : line}</p>) : <PassageView passage={PASSAGE} lessonWords={[WORD]} masteryMap={{}} mode="focus" />)}
      {translated && <Text className="whitespace-pre-line">Rosie 有一个小花园。她每天早上给花浇水。一天，她发现树下有一只小鸟。她静静地看着，小鸟唱起了好听的歌。</Text>}
      {(chinese || hidden) && <WritingSample label="读完后，写下你记住的内容" />}
    </>}
  </Flex>
}

function WordSample({ kind }: { kind: string }) {
  const [flipped, setFlipped] = useState(false)
  const [choice, setChoice] = useState('')
  const [checked, setChecked] = useState(false)
  if (kind === 'word') return <Flex direction="column" gap="3"><GardenPicture /><DarkScope><div className="mx-auto max-w-sm"><FlashCard entry={WORD} flipped={flipped} onFlip={() => setFlipped(value => !value)} index={0} /></div></DarkScope></Flex>
  if (kind === 'spelling') return <Flex direction="column" gap="3"><Speak text="garden" /><Text>听一听，拼写“花园”。</Text><AnswerSample prompt="单词拼写" answer="garden" /></Flex>
  return <Flex direction="column" gap="3"><GardenPicture /><AnswerChoiceGroup label="Which word means 花园?" options={[{ id: 'garden', label: 'garden' }, { id: 'school', label: 'school' }, { id: 'kitchen', label: 'kitchen' }]} value={choice} onValueChange={value => { setChoice(value); setChecked(false) }} reserveFeedbackSpace={false} /><Button disabled={!choice} onClick={() => setChecked(true)}>检查答案</Button>{checked && <Text role="status">{choice === 'garden' ? '答对了！' : '再看看图片。'}</Text>}</Flex>
}

function StateSample() {
  const [state, setState] = useState<'ready' | 'loading' | 'error' | 'empty'>('ready')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const load = () => { if (timer.current) clearTimeout(timer.current); setState('loading'); timer.current = setTimeout(() => setState('ready'), 1500) }
  const switchState = (next: 'error' | 'empty') => { if (timer.current) clearTimeout(timer.current); setState(next) }
  return <Flex direction="column" gap="3"><Flex gap="2" wrap="wrap"><Button onClick={load}>模拟读取</Button><Button variant="soft" onClick={() => switchState('error')}>模拟失败</Button><Button variant="soft" onClick={() => switchState('empty')}>模拟空数据</Button></Flex>
    {state === 'loading' ? <div className="relative min-h-80"><LoadingOverlay visible placement="content" /></div> : state === 'error' ? <StickerCard tone="danger" size="sm"><Flex direction="column" gap="2"><Text role="alert">暂时无法读取内容，已保存的作答仍保留。</Text><Button onClick={load}>重试</Button></Flex></StickerCard> : state === 'empty' ? <Text>本次没有可展示的内容。</Text> : <Text role="status">内容已就绪。本示例没有关联媒体。</Text>}
  </Flex>
}

type Props = { example: Example; active: boolean; mediaEpoch: number }
export default function HomeworkContentRenderer({ example, active, mediaEpoch }: Props) {
  const kind = example.kind
  const media = (type: 'audio' | 'video') => <DemoMedia type={type} active={active} epoch={mediaEpoch} />
  if (kind.startsWith('calc-')) return <CalcSample kind={kind} />
  if (kind === 'exam') return <ExamTypePreview embedded initialDemo={example.exam} mediaActive={active} mediaEpoch={mediaEpoch} />
  switch (kind) {
    case 'math-text': return <MathSample />
    case 'math-figure': return <MathSample figure />
    case 'math-video': return <Flex direction="column" gap="4"><Text size="5">把 3 个黄球和 2 个绿球放在一起，一共有几个？</Text><AnswerSample prompt="一共几个？" answer="5" />{media('video')}</Flex>
    case 'char': return <Character />
    case 'strokes': return <Strokes />
    case 'words': return <ChineseWords />
    case 'poem': return <PoemRecite poem={POEM} />
    case 'accumulation': return <Flex direction="column" gap="4"><Heading size="4">读一读，记一记</Heading><Text size="5">一年之计在于春，一日之计在于晨。</Text><Text color="gray">谚语</Text><Speak text="一年之计在于春，一日之计在于晨。" lang="zh-CN" /><AnswerSample prompt="一年之计在于____" answer="春" /><AnswerSample prompt="一日之计在于____" answer="晨" /></Flex>
    case 'chinese-reading': case 'reading': case 'sentence': case 'dictation': case 'story': return <Reading kind={kind} />
    case 'word': case 'word-choice': case 'spelling': return <WordSample kind={kind} />
    case 'grammar-lesson': return <LessonView data={GRAMMAR} isAdmin={false} pageImages={[]} onPreviewFigure={() => {}} />
    case 'grammar-exercise': return <ExerciseView groups={GRAMMAR_EXERCISES} isAdmin={false} pageImages={[]} onGroupResult={() => {}} onPreviewFigure={() => {}} />
    case 'grammar-page': return (
      <Flex direction="column" gap="3">
        <Text size="2" color="gray">自拟语法页图，不冒充原书扫描。</Text>
        {/* eslint-disable-next-line @next/next/no-img-element -- local fixture */}
        <img src="/dev-preview/homework-content/grammar.svg" alt="自拟语法页：am、is、are 的例句和表格" className="mx-auto h-auto w-full max-w-lg" />
      </Flex>
    )
    case 'pdf': return <PdfSample active={active} epoch={mediaEpoch} />
    case 'audio': return media('audio')
    case 'video': return media('video')
    case 'image': return <Flex direction="column" gap="3"><GardenPicture /><Text align="center">观察图片，说一说你看到了什么。</Text></Flex>
    case 'mixed': return <Flex direction="column" gap="4"><Heading size="4">我的花园</Heading><Text>先观察图片，再听一段声音，最后说说花园里有哪些植物。</Text><GardenPicture />{media('audio')}<Button asChild variant="soft"><a href="/dev-preview/exams">进入考一考演示详情页</a></Button></Flex>
    case 'states': return <StateSample />
    default: return <Flex direction="column" gap="3"><Heading size="4">本周观察日记</Heading>{Array.from({ length: 5 }, (_, i) => <p key={i} className="break-words text-lg leading-loose">第 {i + 1} 天：仔细看看窗外的树叶，记下颜色、形状和变化。选择你最喜欢的一片叶子，画下来，并向家人介绍你的发现。</p>)}<Text className="break-words">长词换行：pneumonoultramicroscopicsilicovolcanoconiosis</Text></Flex>
  }
}
