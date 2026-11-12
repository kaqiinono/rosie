'use client'

import { useRef, useState } from 'react'
import { AlertDialog, Box, Button, Flex, Select, Spinner, Text } from '@rosie/ui/themes'

export function SyncSelect({ label, value, options, empty, disabled, onValueChange, layout = 'stack' }: {
  label: string
  value: string
  options: { value: string; label: string }[]
  empty?: string
  disabled?: boolean
  layout?: 'stack' | 'inline'
  onValueChange: (value: string) => void
}) {
  // Radix reserves the empty value. Encode it so users can explicitly clear a binding.
  const control = (
    <Select.Root value={'=' + value} onValueChange={next => onValueChange(next.slice(1))} disabled={disabled}>
      <Select.Trigger aria-label={label} />
      <Select.Content position="popper">
        {empty && <Select.Item value="=">{empty}</Select.Item>}
        {options.filter(option => option.value).map(option =>
          <Select.Item key={option.value} value={'=' + option.value}>{option.label}</Select.Item>)}
      </Select.Content>
    </Select.Root>
  )
  if (layout === 'inline') {
    return (
      <Flex align="center" gap="2" wrap="wrap" minWidth="0">
        <Text size="2" weight="medium" className="shrink-0">{label}</Text>
        <Box flexGrow="1" minWidth="12rem">{control}</Box>
      </Flex>
    )
  }
  return (
    <Flex direction="column" gap="1" minWidth="0">
      <Text size="2" weight="medium">{label}</Text>
      {control}
    </Flex>
  )
}

export function SyncPending({ children = '正在加载…' }: { children?: string }) {
  return <Flex role="status" align="center" gap="2" py="2">
    <Spinner /><Text size="2" color="gray">{children}</Text>
  </Flex>
}

export function useSyncConfirmation() {
  const [request, setRequest] = useState<{ message: string; proceed: () => void } | null>(null)
  const origin = useRef<HTMLElement | null>(null)
  function confirm(message: string, proceed: () => void) {
    origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setRequest({ message, proceed })
  }
  const dialog = <AlertDialog.Root open={request !== null} onOpenChange={open => { if (!open) setRequest(null) }}>
    <AlertDialog.Content maxWidth="26rem" onCloseAutoFocus={event => {
      if (origin.current?.isConnected) { event.preventDefault(); origin.current.focus() }
    }}>
      <AlertDialog.Title>确认修改</AlertDialog.Title>
      <AlertDialog.Description>{request?.message}</AlertDialog.Description>
      <Flex justify="end" mt="4" gap="2">
        <AlertDialog.Cancel><Button variant="soft" color="gray">取消</Button></AlertDialog.Cancel>
        <AlertDialog.Action><Button onClick={() => request?.proceed()}>继续</Button></AlertDialog.Action>
      </Flex>
    </AlertDialog.Content>
  </AlertDialog.Root>
  return { confirm, dialog }
}
