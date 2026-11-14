'use client'

import { Flex } from '@rosie/ui/themes'
import type { ExamOption, MaterialBlock } from '../../types/content'
import { BlocksEditor, DraftText } from './DraftFields'
import { ImageSizeControl } from './ImageSizeControl'

export function ActivityBlocks({ blocks, onChange }: {
  blocks: readonly MaterialBlock[]; onChange: (blocks: readonly MaterialBlock[]) => void
}) {
  return <BlocksEditor blocks={blocks} onChange={onChange}
    renderImageSize={(block, replace) => <ImageSizeControl value={block.displayWidth}
      onChange={displayWidth => replace({ ...block, displayWidth })} />} />
}

export function OptionFields({ options, onChange }: {
  options: readonly ExamOption[]; onChange: (options: readonly ExamOption[]) => void
}) {
  return <Flex direction="column" gap="3">{options.map(option => {
    const replace = (next: ExamOption) => onChange(options.map(item => item.id === option.id ? next : item))
    return <Flex key={option.id} direction="column" gap="2">
      <DraftText label={`选项 ${option.id}`} value={option.label} onChange={label => replace({ ...option, label })} />
      {option.imageSlotId && <ImageSizeControl value={option.displayWidth} onChange={displayWidth => replace({ ...option, displayWidth })} />}
    </Flex>
  })}</Flex>
}

