export async function transcribeAudio(file: File): Promise<{ text: string; language: string }> {
  const apiKey = process.env.AI_STT_API_KEY ?? process.env.AI_EMBED_API_KEY
  const baseUrl = (process.env.AI_EMBED_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = process.env.AI_STT_MODEL ?? 'whisper-1'

  if (!apiKey) throw new Error('no_stt_api_key')

  const form = new FormData()
  form.append('file', file)
  form.append('model', model)
  form.append('language', 'zh')

  const res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`stt_failed:${res.status}:${body.slice(0, 200)}`)
  }

  const json = (await res.json()) as { text?: string }
  const text = (json.text ?? '').trim()
  if (!text) throw new Error('stt_empty')

  return { text, language: 'zh' }
}
