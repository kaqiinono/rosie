'use client'

import { Check, X } from 'lucide-react'
import { useId, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { StickerCard } from './StickerCard'
import { ImageZoomTarget } from './ImageZoomTarget'
import { Box, Flex, RadioGroup, Text } from './themes'

export type AnswerChoiceOption = {
  /** 题内可读的选项标识，例如 A、B、C。 */
  id: string
  label: string
  /** Optional non-interactive image/content inside the option hit area. */
  content?: ReactNode
  imageMaxWidth?: number
  disabled?: boolean
}

export type AnswerChoiceFeedback = {
  status: 'correct' | 'incorrect'
  correctOptionId: string
  message: string
}

export type AnswerChoiceGroupProps = {
  options: readonly AnswerChoiceOption[]
  value: string
  label?: string
  optionLang?: string
  disabled?: boolean
  feedback?: AnswerChoiceFeedback
  reserveFeedbackSpace?: boolean
  layout?: 'list' | 'grid' | 'images'
  /** Image preview is separate from selecting the answer. */
  onOptionPreview?: (id: string, event: MouseEvent<HTMLButtonElement>) => void
} & (
  | { readOnly?: boolean; onValueChange: (value: string) => void }
  | { readOnly: true; onValueChange?: never }
)

/** 受控选择与结果展示；不提交、不判分、不切题，也不写学习记录。 */
export function AnswerChoiceGroup({
  options,
  value,
  onValueChange,
  label = '选择答案',
  optionLang,
  disabled = false,
  readOnly = false,
  feedback,
  reserveFeedbackSpace = true,
  layout = 'list',
  onOptionPreview,
}: AnswerChoiceGroupProps) {
  const statusId = useId()
  const selected = options.find((option) => option.id === value)
  const selectionText = selected
    ? `${readOnly || feedback ? '你的选择' : '已选'} ${selected.id}${readOnly || feedback ? '' : ' · 尚未判分'}`
    : readOnly
      ? '未作答'
      : '请选择一个答案'
  const correct = feedback?.status === 'correct'

  return (
    <Flex direction="column" gap="4">
      <RadioGroup.Root
        className="rosie-AnswerChoiceGroup"
        size="3"
        variant="soft"
        orientation="vertical"
        data-layout={layout}
        value={value}
        disabled={disabled}
        data-disabled={disabled || undefined}
        data-readonly={readOnly || undefined}
        aria-label={label}
        aria-readonly={readOnly || undefined}
        aria-describedby={statusId}
        onValueChange={(nextValue) => {
          if (!disabled && !readOnly && !options.find(option => option.id === nextValue)?.disabled) onValueChange?.(nextValue)
        }}
      >
        {options.map((option) => {
          const imageLayout = layout === 'images'
          const controlId = `${statusId}-${option.id}`
          const unit = <Flex key={option.id} direction="column" gap="2" minWidth={imageLayout ? undefined : '0'}
            className={imageLayout ? 'rosie-AnswerChoiceImageUnit' : undefined}
            style={imageLayout ? { '--choice-image-min-width': `${Math.min(320, Math.max(224, option.imageMaxWidth ?? 224))}px` } as CSSProperties : undefined}>
          <Flex
            asChild
            align="start"
            gap="3"
            width="100%"
            minHeight="44px"
            px="2"
            py="3"
          >
            <Text
              as="label"
              size="4"
              color={disabled ? 'gray' : undefined}
              className="rosie-AnswerChoiceOption"
            >
              <RadioGroup.Item id={controlId} value={option.id} disabled={option.disabled} />
              <Text as="span" weight="bold">
                {option.id}
              </Text>
              <Text as="span" wrap="wrap" lang={optionLang} className="rosie-AnswerChoiceLabel">
                {option.label !== option.id ? option.label : null}
                {!imageLayout && !onOptionPreview && option.content}
              </Text>
            </Text>
          </Flex>
          {onOptionPreview && option.content && <ImageZoomTarget label={`放大题图 ${option.id}：${option.label}`}
            maxWidth={option.imageMaxWidth} onOpen={event => onOptionPreview(option.id, event)}>
            {option.content}
          </ImageZoomTarget>}
          {imageLayout && !onOptionPreview && option.content && <Text as="label" htmlFor={controlId} className="rosie-AnswerChoiceOption">
            {option.content}
          </Text>}
          </Flex>
          return imageLayout ? <StickerCard key={option.id} asChild variant="soft" tone={value === option.id ? 'accent' : 'white'}
            elevation="flat" radius="md" size="sm">{unit}</StickerCard> : unit
        })}
      </RadioGroup.Root>

      <Text id={statusId} as="p" size="2" color="gray" aria-live="polite" aria-atomic="true">
        {selectionText}
      </Text>

      <Box minHeight={reserveFeedbackSpace ? '140px' : undefined} aria-live="polite" aria-atomic="true">
        {feedback && (
          <StickerCard tone={correct ? 'success' : 'danger'} elevation="flat" radius="md">
            <Flex direction="column" gap="2">
              <Flex align="start" gap="2">
                <Box flexShrink="0">
                  {correct ? <Check size={20} aria-hidden="true" /> : <X size={20} aria-hidden="true" />}
                </Box>
                <Text as="p" size="4" weight="bold" color={correct ? 'green' : 'red'}>
                  {correct ? '答对了' : '需要订正'} · 正确答案 {feedback.correctOptionId}
                </Text>
              </Flex>
              <Text as="p" size="3">
                {feedback.message}
              </Text>
            </Flex>
          </StickerCard>
        )}
      </Box>
    </Flex>
  )
}
