import { z } from 'zod'

const allowedHref = z
  .string()
  .refine(
    (href) =>
      href.startsWith('/math/') ||
      href.startsWith('/english/') ||
      href.startsWith('/chinese/') ||
      href.startsWith('/ai/'),
    { message: 'href must be an internal app path' },
  )

const agentBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), content: z.string().min(1) }),
  z.object({
    type: z.literal('word_card'),
    sourceRef: z.string(),
    word: z.string(),
    ipa: z.string().optional(),
    chineseDef: z.string(),
    example: z.string().optional(),
    stage: z.string().optional(),
    unit: z.string().optional(),
    lesson: z.string().optional(),
    explanation: z.string().optional(),
    phonics: z.string().optional(),
    syllables: z.array(z.string()).optional(),
    keywords: z.array(z.tuple([z.string(), z.string()])).optional(),
    vocabType: z.enum(['Target', 'Context', 'Extension']).optional(),
    imagePath: z.string().optional(),
  }),
  z.object({
    type: z.literal('char_card'),
    sourceRef: z.string(),
    char: z.string(),
    pinyin: z.string(),
    phrases: z.array(z.string()),
    unit: z.number().optional(),
    lessonTitle: z.string().optional(),
    radical: z.string().optional(),
    radicalName: z.string().optional(),
    structure: z.string().optional(),
    strokeCount: z.number().optional(),
  }),
  z.object({
    type: z.literal('passage_excerpt'),
    sourceRef: z.string(),
    title: z.string(),
    subject: z.enum(['english', 'math', 'chinese']).optional(),
    bookSlug: z.string().optional(),
    lessonKey: z.string().optional(),
    passageKey: z.string().optional(),
    stage: z.string().optional(),
    unit: z.string().optional(),
    lesson: z.string().optional(),
    paragraphs: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal('math_solution'),
    sourceRef: z.string(),
    problemId: z.string(),
    title: z.string(),
    steps: z.array(z.string()).min(1),
    finalAnswer: z.string().optional(),
    analysisImageUrl: z.string().optional(),
    fromCatalog: z.boolean(),
  }),
  z.object({
    type: z.literal('math_problem'),
    sourceRef: z.string(),
    problemId: z.string(),
    title: z.string(),
  }),
  z.object({
    type: z.literal('poem_recite'),
    sourceRef: z.string(),
    bookSlug: z.string(),
    poemId: z.string(),
    title: z.string(),
  }),
  z.object({
    type: z.literal('learning_status'),
    subject: z.enum(['english', 'math', 'chinese']).optional(),
    view: z.enum(['mastery', 'mistakes', 'overview']),
  }),
  z.object({
    type: z.literal('today_tasks'),
    subject: z.enum(['english', 'math', 'chinese']).optional(),
  }),
  z.object({
    type: z.literal('lesson_notes'),
    notes: z.array(
      z.object({
        title: z.string().nullable(),
        bodyHtml: z.string(),
      }),
    ).min(1),
  }),
])

const agentActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('navigate'),
    href: allowedHref,
    label: z.string(),
    icon: z.string().optional(),
  }),
  z.object({
    type: z.literal('open_problem'),
    problemId: z.string(),
    label: z.string(),
    title: z.string().optional(),
  }),
  z.object({
    type: z.literal('open_reading'),
    href: allowedHref,
    label: z.string(),
  }),
])

export const agentResponseSchema = z.object({
  text: z.string().min(1),
  blocks: z.array(agentBlockSchema),
  actions: z.array(agentActionSchema),
  sources: z
    .array(
      z.object({
        sourceRef: z.string(),
        title: z.string(),
        snippet: z.string().optional(),
        subject: z.enum(['english', 'math', 'chinese']).optional(),
      }),
    )
    .optional(),
})

export type ParsedAgentResponse = z.infer<typeof agentResponseSchema>

export function parseAgentResponse(input: unknown): ParsedAgentResponse {
  return agentResponseSchema.parse(input)
}

export function safeParseAgentResponse(
  input: unknown,
): { success: true; data: ParsedAgentResponse } | { success: false; error: string } {
  const result = agentResponseSchema.safeParse(input)
  if (result.success) return { success: true, data: result.data }
  return { success: false, error: result.error.message }
}

export function fallbackAgentResponse(text: string): ParsedAgentResponse {
  return {
    text,
    blocks: [{ type: 'text', content: text }],
    actions: [],
    sources: [],
  }
}
