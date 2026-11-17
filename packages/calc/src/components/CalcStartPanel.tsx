'use client'

import type { Ref } from 'react'
import type { CalcTimingMode } from '@rosie/core'
import { DarkScope, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Grid, Heading, Text } from '@rosie/ui/themes'
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
  startButtonRef?: Ref<HTMLButtonElement>
  startDisabled?: boolean
  handleStart: () => void
}

export default function CalcStartPanel({ totalQuestions, currentSessionCount, expandedSessionCount, currentTimingMode, currentBonusSec, setSessionCount, setSessionTimingMode, setSessionBonusSec, startButtonRef, startDisabled, handleStart }: Props) {
  return <DarkScope appearance="light"><StickerCard size="md" elevation="flat">
    <Flex direction="column" gap="4" className="@container">
      <Flex direction="column" gap="2">
        <Flex justify="between" align="start" gap="3">
          <Flex direction="column" className="gap-1.5">
            <Heading as="h2" size="4" weight="bold">本次目标题量</Heading>
            <Text size="1" weight="regular" color="gray">默认使用口算配置中的 {totalQuestions} 题，仅本次有效</Text>
          </Flex>
          <Badge color="violet" variant="soft" radius="full" className="shrink-0 tabular-nums">{currentSessionCount} 题</Badge>
        </Flex>
        <Grid gap="2" role="group" aria-label="选择本次练习题量" className="grid-cols-3 @[26rem]:grid-cols-6">
          {COUNT_OPTIONS.map(count => <Button key={count} type="button" size="3" color="violet"
            variant={currentSessionCount === count ? 'solid' : 'soft'} aria-pressed={currentSessionCount === count}
            className="min-h-11 min-w-0 px-2 font-fredoka text-[17px] tabular-nums" onClick={() => setSessionCount(count)}>{count}</Button>)}
          <CustomCountInput appearance="light" count={currentSessionCount} onChange={count => setSessionCount(clampSessionQuestionCount(count))} max={MAX_SESSION_QUESTION_COUNT} size="md" />
        </Grid>
      </Flex>
      <SessionTimingControls timingMode={currentTimingMode} bonusSec={currentBonusSec} onChangeMode={setSessionTimingMode} onChangeBonus={setSessionBonusSec} />
      <Button ref={startButtonRef} type="button" size="4" color="violet" radius="large" disabled={startDisabled} onClick={handleStart}>
        <span aria-hidden="true">🚀</span>
        <Text size="3" className="font-medium tracking-wide">开始口算</Text>
        <Text size="1" weight="regular">预计 {expandedSessionCount} 题</Text>
        <span aria-hidden="true">→</span>
      </Button>
    </Flex>
  </StickerCard></DarkScope>
}
