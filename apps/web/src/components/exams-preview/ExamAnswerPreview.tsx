'use client'

import { useRef, useState } from 'react'
import { AnswerChoiceGroup, PageShell, StickerCard, type AnswerChoiceFeedback } from '@rosie/ui'
import { Badge, Box, Button, Flex, Text } from '@rosie/ui/themes'
import { KET_READING_SAMPLE as sample } from './ket-reading-sample'

export default function ExamAnswerPreview() {
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [submittedAnswer, setSubmittedAnswer] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const submitted = submittedAnswer !== null
  const feedback: AnswerChoiceFeedback | undefined = submitted
    ? {
        status: submittedAnswer === sample.correctOptionId ? 'correct' : 'incorrect',
        correctOptionId: sample.correctOptionId,
        message: sample.explanation,
      }
    : undefined

  const handleAction = () => {
    if (submitted) {
      setSelectedAnswer('')
      setSubmittedAnswer(null)
      headingRef.current?.focus()
      return
    }
    if (selectedAnswer) setSubmittedAnswer(selectedAnswer)
  }

  return (
    <PageShell
      title="考一考"
      tone="paper"
      width="narrow"
      backHref="/"
      backLabel="返回首页"
      actions={<Badge variant="soft" radius="full">练习预览</Badge>}
    >
      <Flex direction="column" gap="5">
        <Text as="p" size="2" color="gray">
          答题页预览：本页只演示选择、提交和反馈，不保存学习记录。
        </Text>

        <Flex direction="column" gap="2">
          <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-20 text-2xl font-bold">
            阅读 · 短信息
          </h2>
          <Flex justify="between" align="start" gap="3" wrap="wrap">
            <Text as="p" size="2" color="gray">Test 1 · {sample.location}</Text>
            <Text as="p" size="2" color="gray">本组 1 题</Text>
          </Flex>
        </Flex>

        <StickerCard as="section" tone="white" size="md" elevation="sm" radius="lg" aria-label="阅读题目">
          <Flex direction="column" gap="5">
            <Text as="p" size="4" lang="en">{sample.instruction}</Text>

            <StickerCard tone="paper" size="md" elevation="flat" radius="md" lang="en">
              <Flex direction="column" gap="3">
                <Text as="p" size="5" weight="bold">{sample.notice.title}</Text>
                <Flex direction="column" gap="1">
                  <Text as="p" size="4">{sample.notice.body}</Text>
                  <Text as="p" size="4">{sample.notice.detail}</Text>
                </Flex>
              </Flex>
            </StickerCard>

            <AnswerChoiceGroup
              label="失物招领：选择与告示意思相符的答案"
              optionLang="en"
              options={sample.options}
              value={submittedAnswer ?? selectedAnswer}
              onValueChange={setSelectedAnswer}
              readOnly={submitted}
              feedback={feedback}
            />

            <Box width="100%">
              <Flex asChild width="100%">
                <Button
                  type="button"
                  size="4"
                  variant="solid"
                  disabled={!submitted && !selectedAnswer}
                  onClick={handleAction}
                >
                  {submitted ? '再练一次' : '提交本组'}
                </Button>
              </Flex>
            </Box>
          </Flex>
        </StickerCard>

        <Text as="p" size="1" color="gray">{sample.source} · 原书第 8 页</Text>
      </Flex>
    </PageShell>
  )
}
