export async function transcribeAudio(file: File): Promise<{ text: string; language: string }> {
  const apiKey = process.env.AI_STT_API_KEY ?? process.env.AI_EMBED_API_KEY
  const baseUrl = (
    process.env.AI_STT_BASE_URL ??
    process.env.AI_EMBED_BASE_URL ??
    'https://api.openai.com/v1'
  ).replace(/\/$/, '')
  const model = process.env.AI_STT_MODEL ?? 'whisper-1'

  if (!apiKey) throw new Error('no_stt_api_key')

  if (model.startsWith('qwen3-asr-flash')) {
    const audioBase64 = Buffer.from(await file.arrayBuffer()).toString('base64')
    const dataUri = `data:${file.type || 'audio/mpeg'};base64,${audioBase64}`
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [{ type: 'input_audio', input_audio: { data: dataUri } }],
          },
        ],
        stream: false,
        asr_options: { language: 'zh', enable_itn: true },
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`stt_failed:${res.status}:${body.slice(0, 200)}`)
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const text = (json.choices?.[0]?.message?.content ?? '').trim()
    if (!text) throw new Error('stt_empty')

    return { text, language: 'zh' }
  }

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
