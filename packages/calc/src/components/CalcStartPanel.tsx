'use client'

import type { CalcTimingMode } from '@rosie/core'
import { StickerCard } from '@rosie/ui'
import { Button, Flex, Heading, Text } from '@rosie/ui/themes'
import CustomCountInput, { COUNT_OPTIONS } from './CustomCountInput'
import SessionTimingControls from './SessionTimingControls'
import { clampSessionQuestionCount, MAX_SESSION_QUESTION_COUNT } from '../utils/calc-planned-question-count'

type Props = {
  totalQuestions: number
  currentSessionCount: number
  expandedSessionCount: number
  currentTimingMode: CalcTimingMode
  currentBonusSec: number
  setSessionCount: (value: number) => void
  setSessionTimingMode: (value: CalcTimingMode) => void
  setSessionBonusSec: (value: number) => void
  handleStart: () => void
}

export default function CalcStartPanel({ totalQuestions, currentSessionCount, expandedSessionCount, currentTimingMode, currentBonusSec, setSessionCount, setSessionTimingMode, setSessionBonusSec, handleStart }: Props) {
  return <StickerCard size="md" elevation="flat">
    <Flex direction="column" gap="4">
      <Flex justify="between" align="start" gap="3">
        <Flex direction="column" gap="1">
          <Heading as="h2" size="3">本次目标题量</Heading>
          <Text size="2" color="gray">默认使用口算配置中的 {totalQuestions} 题，仅本次有效</Text>
        </Flex>
        <Text size="5" weight="bold" color="violet">{currentSessionCount} 题</Text>
      </Flex>
      <Flex gap="2" wrap="wrap" aria-label="选择本次练习题量">
        {COUNT_OPTIONS.map(count => <Button key={count} size="3" color="violet" variant={currentSessionCount === count ? 'solid' : 'soft'} aria-pressed={currentSessionCount === count} onClick={() => setSessionCount(count)}>{count}</Button>)}
        <CustomCountInput count={currentSessionCount} onChange={count => setSessionCount(clampSessionQuestionCount(count))} max={MAX_SESSION_QUESTION_COUNT} size="md" />
      </Flex>
      <SessionTimingControls timingMode={currentTimingMode} bonusSec={currentBonusSec} onChangeMode={setSessionTimingMode} onChangeBonus={setSessionBonusSec} />
      <Button size="4" color="violet" onClick={handleStart}>🚀 开始口算 · 预计 {expandedSessionCount} 题 →</Button>
    </Flex>
  </StickerCard>
}
