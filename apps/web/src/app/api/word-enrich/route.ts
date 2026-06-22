import { NextResponse } from 'next/server'

// 服务端调用 Claude，根据单词生成词典信息（音标 / 英文释义 / 中文释义 / 例句）。
// API key 只在服务端读取，绝不下发到客户端。客户端失败时会自行兜底到免费词典。

export const runtime = 'nodejs'

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

interface EnrichInput {
  ipa: string
  explanation: string
  chineseDef: string
  example: string
}

interface AnthropicContentBlock {
  type: string
  name?: string
  input?: Record<string, unknown>
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[]
}

const TOOL = {
  name: 'provide_word_info',
  description: '返回一个英文单词/短语的词典信息，面向中国小学生（约 7 岁）英语学习。',
  input_schema: {
    type: 'object' as const,
    properties: {
      ipa: { type: 'string', description: '国际音标，用斜杠包裹，如 /ˈæpəl/。短语给整体读音。' },
      explanation: { type: 'string', description: '简短的英文释义，用小学生能懂的简单英语。' },
      chineseDef: { type: 'string', description: '简洁的中文释义，只给最常用义项，不加拼音。' },
      example: { type: 'string', description: '一句简单、贴近儿童生活的英文例句，包含该单词。' },
    },
    required: ['ipa', 'explanation', 'chineseDef', 'example'],
  },
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'no_api_key' }, { status: 503 })
  }

  let word = ''
  let stage = ''
  try {
    const body = (await req.json()) as { word?: unknown; stage?: unknown }
    word = typeof body.word === 'string' ? body.word.trim() : ''
    stage = typeof body.stage === 'string' ? body.stage : ''
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  if (!word) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL
  const prompt =
    `请为英文单词/短语「${word}」生成词典信息。` +
    (stage ? `它属于教材阶段 ${stage}。` : '') +
    '面向中国小学生（约 7 岁）。务必通过 provide_word_info 工具返回结果。'

  let resp: Response
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'provide_word_info' },
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 502 })
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '')
    return NextResponse.json({ error: 'upstream', status: resp.status, detail }, { status: 502 })
  }

  const data = (await resp.json()) as AnthropicResponse
  const block = data.content?.find((b) => b.type === 'tool_use' && b.name === 'provide_word_info')
  const input = block?.input as Partial<EnrichInput> | undefined
  if (!input) {
    return NextResponse.json({ error: 'no_tool_use' }, { status: 502 })
  }

  return NextResponse.json({
    source: 'claude',
    model,
    ipa: typeof input.ipa === 'string' ? input.ipa : '',
    explanation: typeof input.explanation === 'string' ? input.explanation : '',
    chineseDef: typeof input.chineseDef === 'string' ? input.chineseDef : '',
    example: typeof input.example === 'string' ? input.example : '',
  })
}
