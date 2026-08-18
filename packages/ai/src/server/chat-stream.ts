const DEFAULT_CHAT_MODEL = 'gpt-4o-mini'

/** OpenAI-compatible chat completions streaming (Qoter / OpenAI / etc.). */
export async function* streamChatTokens(
  system: string,
  user: string,
): AsyncGenerator<string, string, undefined> {
  const apiKey = process.env.AI_CHAT_API_KEY ?? process.env.AI_EMBED_API_KEY
  const baseUrl = (process.env.AI_CHAT_BASE_URL ?? process.env.AI_EMBED_BASE_URL ?? 'https://api.openai.com/v1').replace(
    /\/$/,
    '',
  )
  const model = process.env.AI_CHAT_MODEL ?? DEFAULT_CHAT_MODEL

  if (!apiKey) throw new Error('no_chat_api_key')

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 200,
      stream: true,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })

  if (!res.ok || !res.body) {
    const body = await res.text()
    throw new Error(`chat_failed:${res.status}:${body.slice(0, 200)}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue

      try {
        const event = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>
        }
        const token = event.choices?.[0]?.delta?.content ?? ''
        if (token) {
          full += token
          yield token
        }
      } catch {
        // ignore malformed sse chunks
      }
    }
  }

  return full.trim()
}
