'use client'

import { useState } from 'react'
import { Button, Flex, Grid, Heading, Text, TextField } from '@rosie/ui/themes'
import type { CalcTimingMode } from '@rosie/core'
import { clampBonusSec, sessionStarMultiplier } from '../utils/calc-session-policy'

type Props = {
  timingMode: CalcTimingMode
  bonusSec: number
  onChangeMode: (mode: CalcTimingMode) => void
  onChangeBonus: (seconds: number) => void
}

const MODE_META: Record<CalcTimingMode, { label: string; description: string }> = {
  relaxed: { label: '宽松', description: '按自己的节奏作答' },
  strict: { label: '严格', description: '倒计时结束算错' },
  bonus: { label: '加时', description: '增加答题缓冲时间' },
}

const BONUS_PRESETS = [2, 3, 5]

function starBonusLine(mode: CalcTimingMode, bonusSec: number): string {
  if (mode === 'relaxed') return '星星 ×1.0'
  if (mode === 'strict') return '星星 ×1.2'
  const multiplier = sessionStarMultiplier(mode, bonusSec)
  return `星星 ×${multiplier.toFixed(2).replace(/0$/, '')}`
}

export default function SessionTimingControls({
  timingMode,
  bonusSec,
  onChangeMode,
  onChangeBonus,
}: Props) {
  const [customOpen, setCustomOpen] = useState(!BONUS_PRESETS.includes(bonusSec))

  return (
    <Flex direction="column" gap="2">
      <Flex justify="between" align="center" gap="2" wrap="wrap">
        <Heading as="h3" size="3">本次计时模式</Heading>
        <Text size="2" weight="bold" color="amber" highContrast>{starBonusLine(timingMode, bonusSec)}</Text>
      </Flex>
      <Grid columns={{ initial: '1', xs: '3' }} gap="2">
        {(Object.keys(MODE_META) as CalcTimingMode[]).map(mode => (
          <Button key={mode} type="button" size="3" color="violet" radius="large"
            variant={timingMode === mode ? 'solid' : 'soft'} aria-pressed={timingMode === mode}
            style={{ height: 'auto', minHeight: 48, padding: 8, whiteSpace: 'normal' }}
            onClick={() => onChangeMode(mode)}>
            <Flex direction="column" align="center">
              <Text weight="bold">{MODE_META[mode].label}</Text>
              <Text size="2">{MODE_META[mode].description}</Text>
            </Flex>
          </Button>
        ))}
      </Grid>
      {timingMode === 'bonus' && (
        <Flex gap="2" wrap="wrap" align="center">
          <Text size="2" weight="bold">加成秒数</Text>
          {BONUS_PRESETS.map(seconds => (
            <Button key={seconds} type="button" size="3" color="violet"
              variant={!customOpen && bonusSec === seconds ? 'solid' : 'soft'}
              aria-pressed={!customOpen && bonusSec === seconds}
              onClick={() => { setCustomOpen(false); onChangeBonus(seconds) }}>+{seconds}秒</Button>
          ))}
          <Button type="button" size="3" color="violet" variant={customOpen ? 'solid' : 'soft'}
            aria-pressed={customOpen} onClick={() => setCustomOpen(true)}>自定义</Button>
          {customOpen && (
            <Flex align="center" gap="1">
              <TextField.Root type="number" size="3" aria-label="自定义加成秒数" className="w-20"
                inputMode="numeric" min={0} max={15} value={bonusSec}
                onChange={event => onChangeBonus(clampBonusSec(Number(event.target.value)))} />
              <Text size="2">秒</Text>
            </Flex>
          )}
        </Flex>
      )}
    </Flex>
  )
}
