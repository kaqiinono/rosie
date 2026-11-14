'use client'

import { useId, useState } from 'react'
import CalcQuestionStage from '@rosie/calc/components/CalcQuestionStage'
import { DarkScope, HandwritingField, ProblemSolutionView, StickerCard, type HandwritingAnswer } from '@rosie/ui'
import { Button, Flex, Text, TextField } from '@rosie/ui/themes'
import { CALC } from './fixtures'

export function AnswerSample({ prompt, answer, unit = '' }: { prompt: string; answer: string; unit?: string }) {
  const inputId = useId()
  const [value, setValue] = useState('')
  const [feedback, setFeedback] = useState('')
  return <Flex direction="column" gap="2">
    <Text as="label" htmlFor={inputId}>{prompt}</Text>
    <Flex gap="2" align="center" wrap="wrap">
      <TextField.Root id={inputId} value={value} onChange={event => { setValue(event.target.value); setFeedback('') }} placeholder="填写答案" />
      {unit && <Text>{unit}</Text>}
      <Button variant="soft" disabled={!value.trim()} onClick={() => setFeedback(value.trim().toLowerCase().replace(/[.!。]/g, '') === answer.toLowerCase().replace(/[.!。]/g, '') ? '答对了！' : '再想一想，可以修改答案。')}>检查</Button>
    </Flex>
    {feedback && <Text role="status">{feedback}</Text>}
  </Flex>
}

export function WritingSample({ label }: { label: string }) {
  const [answer, setAnswer] = useState<HandwritingAnswer | null>(null)
  return <HandwritingField label={label} value={answer} onChange={setAnswer} />
}

export function MathSample({ figure = false }: { figure?: boolean }) {
  const [show, setShow] = useState(false)
  return <Flex direction="column" gap="4">
    <Text size="5">{figure ? '长方形花坛长 6 米、宽 4 米。它的周长和面积分别是多少？' : 'Rosie 有 8 张贴纸，妈妈又给了她 7 张。她送给朋友 3 张。'}</Text>
    {figure && <svg viewBox="0 0 400 240" role="img" aria-label="长 6 米、宽 4 米的长方形" className="mx-auto w-full max-w-md"><rect x="60" y="50" width="270" height="140" rx="6" fill="#d1fae5" stroke="#047857" strokeWidth="3"/><g fill="#292524" fontSize="22" textAnchor="middle"><text x="195" y="35">6 米</text><text x="355" y="125">4 米</text></g></svg>}
    <AnswerSample prompt={figure ? '① 周长是多少？' : '① 收到妈妈的贴纸后，一共有多少张？'} answer={figure ? '20' : '15'} unit={figure ? '米' : '张'} />
    <AnswerSample prompt={figure ? '② 面积是多少？' : '② 送给朋友后，还剩多少张？'} answer={figure ? '24' : '12'} unit={figure ? '平方米' : '张'} />
    <Button variant="soft" onClick={() => setShow(value => !value)}>{show ? '收起解析' : '查看解析'}</Button>
    {show && <ProblemSolutionView analysis={figure ? ['周长 =（长 + 宽）× 2 =（6 + 4）× 2 = 20（米）。', '面积 = 长 × 宽 = 6 × 4 = 24（平方米）。'] : ['先求总数：8 + 7 = 15（张）。', '再减去送出的：15 − 3 = 12（张）。']} />}
  </Flex>
}

export function CalcSample({ kind }: { kind: string }) {
  const question = CALC[kind]
  const [input, setInput] = useState('')
  const [result, setResult] = useState<boolean | null>(null)
  const [attempt, setAttempt] = useState(0)
  const check = (raw: string) => {
    const answer = question.answer
    if (answer.kind === 'fraction') {
      const [num, den] = raw.split('/').map(Number)
      setResult(den > 0 && num * answer.den === den * answer.num)
    } else if (answer.kind === 'remainder') setResult(raw === `${answer.quotient}…${answer.remainder}`)
    else setResult(raw.trim() !== '' && Number(raw) === answer.value)
  }
  return <Flex direction="column" gap="3">
    <DarkScope><div className="flex min-h-[480px] flex-col rounded-3xl bg-violet-950 p-4">
      <CalcQuestionStage question={question} disabled={result === true} padKey={attempt} input={input} onInputChange={setInput} onNumberSubmit={() => check(input)} onFractionSubmit={check} onRemainderSubmit={check} onVerticalSubmit={correct => setResult(correct)} feedback={result === null ? null : result ? 'correct' : 'retry'} />
    </div></DarkScope>
    {result !== null && <StickerCard tone={result ? 'success' : 'warning'} size="sm"><Text role="status">{result ? '本题完成 · 正确 1 / 1 · 不发放奖励' : '再试一次，答案还不正确。'}</Text></StickerCard>}
    <Button variant="soft" onClick={() => { setInput(''); setResult(null); setAttempt(n => n + 1) }}>重新作答</Button>
  </Flex>
}
