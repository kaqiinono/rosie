'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Search } from 'lucide-react'
import { TextField, Text } from '@radix-ui/themes'
import type { FormSelectOption, FormSelectProps } from './FormSelect'
import { StickerCard } from './StickerCard'

const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export function SearchableFormSelect({
  value, options, onValueChange, disabled, placeholder = '输入关键词', ariaLabel, size = '2', className,
}: FormSelectProps) {
  const id = useId()
  const list = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [active, setActive] = useState('')
  const selected = options.find(option => option.value === value)
  const words = normalize(search).split(' ').filter(Boolean)
  const matches = options.filter(option => {
    const text = normalize(option.label + ' ' + option.value)
    return words.every(word => text.includes(word))
  })
  const index = matches.findIndex(option => option.value === active && !option.disabled)
  const expanded = open && !disabled

  useEffect(() => {
    if (expanded && index >= 0) list.current?.children[index]?.scrollIntoView({ block: 'nearest' })
  }, [expanded, index])

  function choose(option: FormSelectOption | undefined) {
    if (!option || option.disabled || disabled) return
    onValueChange(option.value)
    setOpen(false)
    setSearch('')
  }

  function show() {
    if (open || disabled) return
    setSearch('')
    setActive(value)
    setOpen(true)
  }

  function navigate(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape' && expanded) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!expanded) show()
      else {
        const step = event.key === 'ArrowDown' ? 1 : -1
        const start = index < 0 ? (step > 0 ? -1 : matches.length) : index
        for (let next = start + step; next >= 0 && next < matches.length; next += step) {
          if (!matches[next].disabled) {
            setActive(matches[next].value)
            break
          }
        }
      }
    } else if (event.key === 'Enter' && expanded) {
      event.preventDefault()
      choose(matches[index] ?? matches.find(option => !option.disabled))
    }
  }

  return <div className={['relative min-w-0', className].filter(Boolean).join(' ')}>
    <TextField.Root
      role="combobox" aria-label={ariaLabel} aria-autocomplete="list" aria-expanded={expanded}
      aria-controls={expanded ? id : undefined}
      aria-activedescendant={expanded && index >= 0 ? `${id}-${index}` : undefined}
      autoComplete="off" size={size} disabled={disabled}
      placeholder={expanded ? placeholder : selected?.label ?? placeholder}
      value={expanded ? search : (selected?.label ?? '')}
      onFocus={show} onClick={show} onBlur={() => setOpen(false)} onKeyDown={navigate}
      onChange={event => { setSearch(event.target.value); setActive(''); setOpen(true) }}
    >
      <TextField.Slot><Search size={15} aria-hidden /></TextField.Slot>
    </TextField.Root>
    {expanded && <StickerCard size="none" elevation="sm" radius="md" className="absolute inset-x-0 top-full z-30 mt-1 p-1">
      <ul id={id} ref={list} role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-y-auto">
        {matches.map((option, position) => <li key={option.value} id={`${id}-${position}`} role="option"
          aria-selected={option.value === value} aria-disabled={option.disabled || undefined}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}
          className={`break-words rounded-lg px-2 py-2 text-sm ${option.disabled ? 'text-slate-400' :
            position === index ? 'bg-amber-100' : 'cursor-pointer hover:bg-amber-50'}`}>
          {option.label}
        </li>)}
      </ul>
      {!matches.length && <Text as="p" role="status" size="2" color="gray" className="px-2 py-2">没有匹配项</Text>}
    </StickerCard>}
  </div>
}
