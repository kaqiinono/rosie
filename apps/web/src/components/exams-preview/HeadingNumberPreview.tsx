'use client'

import { useState } from 'react'
import Image from 'next/image'
import { FormSelect, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Heading, Text } from '@rosie/ui/themes'
import people from './assets/people.png'
import { HEADING_NUMBER_SAMPLES } from './heading-number-samples'

// Preview-local composition. Promote only after the presentation is reviewed.
function SectionHeading({ category, title }: { category: string; title: string }) {
  return <Flex direction="column" align="start" gap="2">
    <Badge size="2" variant="soft" radius="full" lang="en">{category}</Badge>
    <Heading as="h3" size="5" lang="en">{title}</Heading>
  </Flex>
}

function ActivityInstruction({ number, instruction }: { number: string; instruction: string }) {
  return <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
    <Badge size="3" variant="solid" radius="full" aria-label={`练习 ${number}`}>{number}</Badge>
    <Text as="p" size="4" lang="en">{instruction}</Text>
  </div>
}

/** Titles and question navigation only: no scoring, audio request or draft writes. */
export default function HeadingNumberPreview() {
  const [sectionId, setSectionId] = useState('people')
  const [questionId, setQuestionId] = useState<string | null>(null)
  const section = HEADING_NUMBER_SAMPLES.find(item => item.id === sectionId) ?? HEADING_NUMBER_SAMPLES[0]
  const entries = section.activities.flatMap(activity => activity.questions.map(question => ({ activity, question })))
  const current = entries.find(entry => entry.question.id === questionId) ?? entries[0]

  return <Flex direction="column" gap="4">
    <FormSelect ariaLabel="标题与编号样例" value={section.id} options={HEADING_NUMBER_SAMPLES.map(item => ({ value: item.id, label: item.label }))}
      onValueChange={id => { setSectionId(id); setQuestionId(null) }} />
    <Text size="2" color="gray">Trainer Test 1 · {section.source} · 题干节选，仅预览标题与编号</Text>
    <div className="@container">
      <div className="grid items-start gap-4 @[40rem]:grid-cols-[11rem_minmax(0,1fr)]">
        <StickerCard as="nav" size="sm" elevation="flat" aria-label="练习与小题">
          <Flex direction="column" gap="2">
            {entries.map(({ question }) => <Button key={question.id} size="2"
              variant={current.question.id === question.id ? 'solid' : 'soft'}
              aria-current={current.question.id === question.id ? 'true' : undefined}
              onClick={() => setQuestionId(question.id)}>{question.navigationLabel}</Button>)}
          </Flex>
        </StickerCard>
        <StickerCard as="section" tone="paper" elevation="flat" size="md" aria-label={section.title ?? '阅读练习'}>
          <Flex direction="column" gap="5">
            {section.category && section.title && <SectionHeading category={section.category} title={section.title} />}
            <ActivityInstruction number={current.activity.number} instruction={current.activity.instruction} />
            {section.id === 'people' && <Image src={people} alt="原题中的 Tom、Axel 和 Niko 人物及词语" className="h-auto w-full" />}
            {current.question.prompt !== current.activity.instruction && <Flex direction="column" gap="2">
              <Text size="2" weight="bold">{current.question.label}</Text>
              <Text as="p" size="4" lang="en" className="whitespace-pre-wrap">{current.question.prompt}</Text>
            </Flex>}
          </Flex>
        </StickerCard>
      </div>
    </div>
  </Flex>
}
