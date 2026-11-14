'use client'

import { useState } from 'react'
import type { WordEntry } from '@rosie/core'
import { AnswerChoiceGroup, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Spinner, Text } from '@rosie/ui/themes'
import SpellTiles from './words/SpellTiles'

type Progress = { attempts: number; helpClicks: number; lastAnswer: string | null; lastCorrect: boolean | null }
export type ExamWordReviewSessionProps = {
  word: WordEntry
  phase: 'meaning' | 'spelling'
  options: readonly { id: string; label: string }[]
  progress: Progress
  position: number
  total: number
  busy: boolean
  onAnswer: (answer: string) => void
  onHelp: () => void
  onRetry: () => void
  onNext: () => void
}
/** Controlled practice only. The application supplies server verdicts and saves evidence. */
export function ExamWordReviewSession({ word, phase, options, progress, position, total, busy, onAnswer, onHelp, onRetry, onNext }: ExamWordReviewSessionProps) {
  const [selected, setSelected] = useState('')
  const answered = progress.lastCorrect !== null
  return <StickerCard as="section" size="lg"><Flex direction="column" gap="5">
    <Flex justify="between" gap="3" wrap="wrap"><Badge radius="full">第 {position} / {total} 项</Badge><Badge radius="full" variant="soft">{phase === 'meaning' ? '看单词选释义' : '看释义拼单词'}</Badge></Flex>
    <Text size="6" weight="bold" lang={phase === 'meaning' ? 'en' : undefined}>{phase === 'meaning' ? word.word : word.explanation}</Text>
    {phase === 'meaning' ? <><AnswerChoiceGroup options={options} value={progress.lastAnswer ?? selected} onValueChange={setSelected} disabled={busy || answered} readOnly={answered} label="选择这个词的释义" />
      {!answered && <Button size="3" loading={busy} disabled={!selected} onClick={() => onAnswer(selected)}>确认答案</Button>}</>
      : answered ? <Text>你的拼写：{progress.lastAnswer}</Text> : <SpellTiles key={`${word.id}:${progress.attempts}`} word={word.word} onSubmit={onAnswer} answered={busy} isCorrect={null} buttonStyle="jelly" />}
    {busy && <Flex align="center" gap="2" role="status"><Spinner /><Text size="2">正在保存…</Text></Flex>}
    <Text role="status">{progress.lastCorrect === true ? '答对了！' : progress.lastCorrect === false ? '再想一想，可以查看词卡后重试。' : '确认答案后记录这次练习。'}</Text>
    <Flex gap="3" wrap="wrap">
      {!answered && <Button variant="soft" size="3" disabled={busy} onClick={onHelp}>查看词卡</Button>}
      {progress.lastCorrect === false && <Button size="3" disabled={busy} onClick={() => { setSelected(''); onRetry() }}>再试一次</Button>}
      {progress.lastCorrect === true && <Button size="3" loading={busy} onClick={onNext}>{position === total ? '保存并完成补练' : '继续'}</Button>}
    </Flex>
    <Text size="2" color="gray">已求助 {progress.helpClicks} 次 · 已重试 {Math.max(0, progress.attempts - 1)} 次</Text>
  </Flex></StickerCard>
}
