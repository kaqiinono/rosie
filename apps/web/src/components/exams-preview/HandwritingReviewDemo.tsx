'use client'

import { useRef, useState } from 'react'
import { HandwritingField, StickerCard, type HandwritingAnswer } from '@rosie/ui'
import { Badge, Button, Flex, Text, TextArea } from '@rosie/ui/themes'

type Decision = 'correct' | 'incorrect' | 'unclear'
const decisions: { id: Decision; label: string }[] = [{ id: 'correct', label: '正确' }, { id: 'incorrect', label: '错误' }, { id: 'unclear', label: '看不清，待确认' }]

/** Isolated workflow proposal: no OCR, requests, attempt state or grade writes. */
export default function HandwritingReviewDemo() {
  const [answer, setAnswer] = useState<HandwritingAnswer | null>(null)
  const handwritingOutlet = useRef<HTMLDivElement>(null)
  const [submitted, setSubmitted] = useState(false)
  const [role, setRole] = useState<'child' | 'parent'>('child')
  const [decision, setDecision] = useState<Decision | null>(null)
  const [comment, setComment] = useState('')
  const [saved, setSaved] = useState<{ decision: Decision; comment: string } | null>(null)
  return <Flex direction="column" gap="4">
    <Badge color="amber">待 review · 自拟题 · 不接正式成绩</Badge>
    <Flex gap="3"><Button variant={role === 'child' ? 'solid' : 'soft'} onClick={() => setRole('child')}>小朋友视角</Button>
      <Button variant={role === 'parent' ? 'solid' : 'soft'} disabled={!submitted} onClick={() => setRole('parent')}>家长批阅演示</Button></Flex>
    <StickerCard tone="paper" elevation="flat"><Flex direction="column" gap="3">
      <Text as="div" lang="en" size="4">I go to school <HandwritingField label="1" value={answer} onChange={setAnswer}
        presentation="anchored" inlineTarget={handwritingOutlet} readOnly={submitted} maxWords={1} /> bus.</Text>
      <Text>在空白处写一个英文单词。</Text>
      <div ref={handwritingOutlet} />
    </Flex></StickerCard>
    {!submitted && <Flex><Button disabled={!answer} onClick={() => setSubmitted(true)}>提交手写答案</Button></Flex>}
    {submitted && <Text role="status">{saved?.decision === 'correct' ? '已批阅：正确 · 1 / 1' : saved?.decision === 'incorrect' ? '已批阅：错误 · 0 / 1' : saved?.decision === 'unclear' ? '字迹待确认 · 暂不计分' : '已提交 · 等待家长批阅 · 暂不计分'}</Text>}
    {role === 'parent' && submitted && <StickerCard elevation="flat"><Flex direction="column" gap="4">
      <Text weight="bold">对照原始笔迹批阅</Text><Text>参考答案：by。可点笔迹放大查看。</Text>
      <Flex gap="2" wrap="wrap">{decisions.map(item => <Button key={item.id} variant={decision === item.id ? 'solid' : 'soft'} onClick={() => setDecision(item.id)}>{item.label}</Button>)}</Flex>
      <TextArea aria-label="给孩子的批阅留言" placeholder="给孩子的留言（选填）" value={comment} onChange={e => setComment(e.target.value)} />
      <Flex><Button disabled={!decision} onClick={() => { if (decision) { setSaved({ decision, comment }); setRole('child') } }}>保存本次模拟批阅</Button></Flex>
      <Text size="2" color="gray">这里仅切换演示视角。正式接入时需沿用家长授权，并保留每次批阅记录。</Text>
    </Flex></StickerCard>}
    {role === 'child' && saved?.comment && <Text>家长留言：{saved.comment}</Text>}
    <Flex><Button variant="soft" onClick={() => { setAnswer(null); setSubmitted(false); setRole('child'); setDecision(null); setComment(''); setSaved(null) }}>重新体验</Button></Flex>
    <Text size="2" color="gray">保留原始笔迹，不自动识别文字。刷新后全部清空。</Text>
  </Flex>
}
