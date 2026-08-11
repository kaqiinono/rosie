const DEFAULT_MODEL = 'text-embedding-3-small'

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.AI_EMBED_API_KEY
  const baseUrl = (process.env.AI_EMBED_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = process.env.AI_EMBED_MODEL ?? DEFAULT_MODEL

  if (!apiKey) {
    throw new Error('no_embed_api_key')
  }

  if (texts.length === 0) return []

  const dimensionsRaw = process.env.AI_EMBED_DIMENSIONS
  const dimensions = dimensionsRaw ? Number(dimensionsRaw) : undefined

  const res = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: texts,
      ...(dimensions && Number.isFinite(dimensions) ? { dimensions } : {}),
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`embed_failed:${res.status}:${body.slice(0, 200)}`)
  }

  const json = (await res.json()) as {
    data?: Array<{ embedding: number[]; index: number }>
  }

  const rows = json.data ?? []
  return rows.sort((a, b) => a.index - b.index).map((row) => row.embedding)
}

export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text])
  if (!embedding) throw new Error('embed_empty')
  return embedding
}
