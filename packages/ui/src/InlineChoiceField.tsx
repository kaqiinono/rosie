'use client'

import { useState } from 'react'
import { AnswerChoiceGroup, type AnswerChoiceOption } from './AnswerChoiceGroup'
import { Button, Flex, Popover, Text } from './themes'

export function InlineChoiceField({ label, options, value, onValueChange, readOnly = false }: {
  label: string; options: readonly AnswerChoiceOption[]; value: string
  onValueChange: (value: string) => void; readOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find(option => option.id === value)
  return <Popover.Root open={open && !readOnly} onOpenChange={setOpen}>
    <Popover.Trigger><Button size="2" variant={open ? 'solid' : 'soft'} disabled={readOnly}
      aria-label={`${label}，${selected ? `已选 ${selected.label}，点击修改` : '点击选词'}`}>
      {label} · {selected?.label ?? '选词'}
    </Button></Popover.Trigger>
    <Popover.Content side="bottom" align="start" sideOffset={8} width="280px" maxWidth="calc(100vw - 32px)" aria-label={`${label}选项`}>
      <Flex direction="column" gap="3"><Text weight="bold">{label} · 选择一个词</Text>
        <AnswerChoiceGroup label={`${label}选项`} optionLang="en" options={options} value={value}
          reserveFeedbackSpace={false} onValueChange={next => { onValueChange(next); setOpen(false) }} />
        <Flex justify="between" gap="2"><Button size="2" variant="ghost" disabled={!value} onClick={() => { onValueChange(''); setOpen(false) }}>清除这一空</Button>
          <Popover.Close><Button size="2" variant="soft">关闭</Button></Popover.Close></Flex>
      </Flex>
    </Popover.Content>
  </Popover.Root>
}
