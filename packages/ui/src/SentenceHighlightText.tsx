'use client'

import { useState, type ReactNode } from 'react'
import { Highlighter } from 'lucide-react'
import { Button, Flex, IconButton } from './themes'

export type SentenceRange = { id: string; start: number; end: number }

/** Authored sentence boundaries; highlights never imply a correct answer. */
export function SentenceHighlightText({ text, sentences, selected, onValueChange, readOnly = false, renderLayout }: {
  text: string; sentences: readonly SentenceRange[]; selected: readonly string[]
  onValueChange: (ids: string[]) => void; readOnly?: boolean
  renderLayout?: (slots: { content: ReactNode; toolbar: ReactNode }) => ReactNode
}) {
  const [history, setHistory] = useState<string[][]>([])
  const record = (next: string[]) => {
    if (readOnly) return
    setHistory(previous => [...previous.slice(-39), [...selected]])
    onValueChange(next)
  }
  const parts: ReactNode[] = []
  let cursor = 0
  for (const sentence of sentences) {
    parts.push(text.slice(cursor, sentence.start))
    const value = text.slice(sentence.start, sentence.end)
    const marked = selected.includes(sentence.id)
    parts.push(<span key={sentence.id}>
      {marked ? <mark className="bg-[var(--amber-4)] text-inherit">{value}</mark> : value}
      <span style={{ display: 'inline-block', position: 'relative', width: 0, height: 0, verticalAlign: 'baseline' }}>
      <span style={{ position: 'absolute', right: 0, bottom: '0.8em', lineHeight: 1 }}>
      <IconButton size="1" color={marked ? 'amber' : 'gray'} variant={marked ? 'soft' : 'ghost'}
        disabled={readOnly} aria-pressed={marked} aria-label={`${marked ? '取消标记' : '标记'}：${value}`}
        onClick={() => record(marked ? selected.filter(id => id !== sentence.id) : [...selected, sentence.id])}>
        <Highlighter size={14} strokeWidth={1.5} aria-hidden="true" />
      </IconButton>
      </span>
      </span>
    </span>)
    cursor = sentence.end
  }
  parts.push(text.slice(cursor))
  const toolbar = !readOnly && <Flex gap="3" justify="end" flexShrink="0"><Button size="1" variant="ghost" disabled={!history.length} onClick={() => {
      const previous = history.at(-1)
      if (previous) { onValueChange(previous); setHistory(history.slice(0, -1)) }
    }}>撤销标记</Button><Button size="1" variant="ghost" disabled={!selected.length} onClick={() => record([])}>清除标记</Button></Flex>
  const content = <div className="whitespace-pre-wrap text-lg leading-loose" lang="en">{parts}</div>
  return renderLayout ? renderLayout({ content, toolbar }) : <Flex direction="column" gap="3">{toolbar}{content}</Flex>
}
