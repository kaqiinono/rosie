'use client'

import { useState } from 'react'
import { Button, Flex, Slider, Text, TextField } from '@rosie/ui/themes'

/** Width is a CSS-pixel cap; smaller containers remain responsive. */
export function ImageSizeControl({ value, onChange, disabled = false }: {
  value?: number; onChange: (value: number | undefined) => void; disabled?: boolean
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const commit = () => {
    if (editing !== null && editing.trim()) {
      const number = Number(editing)
      if (Number.isFinite(number)) onChange(Math.max(80, Math.min(1200, Math.round(number))))
    }
    setEditing(null)
  }
  return <Flex direction="column" gap="3">
    <Text size="2" weight="bold">最大宽度 · {value === undefined ? '默认' : `${value} px`}</Text>
    <Slider aria-label="图片最大宽度" min={80} max={1200} step={1} value={[value ?? 480]} disabled={disabled}
      onValueChange={values => { setEditing(null); onChange(values[0]) }} />
    <Flex gap="2" wrap="wrap" align="center">
      <TextField.Root aria-label="图片最大宽度（像素）" type="number" min={80} max={1200} step={1} size="2"
        value={editing ?? (value === undefined ? '' : String(value))} placeholder="默认宽度" disabled={disabled}
        onChange={event => {
          const text = event.target.value
          setEditing(text)
          const number = Number(text)
          if (text.trim() && Number.isInteger(number) && number >= 80 && number <= 1200) onChange(number)
        }} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit() } }} />
      <Button size="1" variant="soft" disabled={disabled || value === undefined} onClick={() => { setEditing(null); onChange(undefined) }}>恢复默认</Button>
    </Flex>
    <Text size="1" color="gray">这是正常预览的宽度上限；小屏自动缩小并保持比例，放大视图不受此上限限制。调整后请点击保存。</Text>
  </Flex>
}
