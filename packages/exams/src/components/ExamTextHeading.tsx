import { StickerCard } from '@rosie/ui'
import { Badge, Heading, Text } from '@rosie/ui/themes'
import { Children, createContext, type ReactNode } from 'react'
import type { MaterialBlock } from '../types/content'

/** Count and handwriting controls drawn on the instruction row, not on their own line. */
export const ExamInstructionToolsContext = createContext<ReactNode>(null)

export function ExamTextHeading({ block, aside }: { block: Extract<MaterialBlock, { kind: 'text' }>; aside?: ReactNode }) {
  const presentation = block.presentation
  if (presentation?.role === 'heading') return <StickerCard as="header" tone="accent" variant="soft" size="sm" radius="md">
    <Heading as="h3" size="6" lang="en">{presentation.prefix ? `${presentation.prefix}: ${block.text}` : block.text}</Heading>
  </StickerCard>
  if (presentation?.role === 'instruction') return <div lang="en">
    <span className="mr-2 inline-flex align-middle"><Badge size="3" aria-label={`Exercise ${presentation.number}`}>{presentation.number}</Badge></span>
    <Text as="span" size="5" weight="bold">{block.text}</Text>
    {Children.map(aside, child => <span className="ml-2 inline-flex align-middle">{child}</span>)}
  </div>
  return null
}
