import type { AiSubject } from '../types'

export interface ChunkInput {
  subject: AiSubject
  title: string
  content: string
  metadata: Record<string, unknown>
}

export interface ChunkOutput {
  chunkIndex: number
  content: string
  metadata: Record<string, unknown>
}

const LONG_TEXT_THRESHOLD = 400
const CHUNK_SIZE = 450
const OVERLAP_SENTENCES = 1

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？.!?])\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function chunkLongText(text: string): string[] {
  const sentences = splitSentences(text)
  if (sentences.length === 0) return [text]

  const chunks: string[] = []
  let current: string[] = []
  let currentLen = 0

  for (const sentence of sentences) {
    if (currentLen + sentence.length > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.join(''))
      const overlap = current.slice(-OVERLAP_SENTENCES)
      current = [...overlap]
      currentLen = overlap.join('').length
    }
    current.push(sentence)
    currentLen += sentence.length
  }

  if (current.length > 0) chunks.push(current.join(''))
  return chunks.length > 0 ? chunks : [text]
}

export function chunkDocument(input: ChunkInput): ChunkOutput[] {
  const normalized = input.content.trim()
  if (!normalized) return []

  const isStructured =
    input.metadata.structured === true ||
    normalized.length <= LONG_TEXT_THRESHOLD

  const pieces = isStructured ? [normalized] : chunkLongText(normalized)

  return pieces.map((content, chunkIndex) => ({
    chunkIndex,
    content,
    metadata: { ...input.metadata, chunkIndex, title: input.title },
  }))
}
