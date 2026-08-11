import { NextResponse } from 'next/server'
import { forbiddenResponse, requireAdminFromRequest } from '@/lib/api-auth'

// 服务端调用百炼（OpenAI 兼容），根据单词生成词典信息（音标 / 英文释义 / 中文释义 / 例句）。
// API key 只在服务端读取，绝不下发到客户端。客户端失败时会自行兜底到免费词典。

export const runtime = 'nodejs'

const DEFAULT_MODEL = 'qwen-plus'

interface EnrichInput {
  ipa: string
  explanation: string
  chineseDef: string
  example: string
}

const TOOL = {
  type: 'function' as const,
  function: {
    name: 'provide_word_info',
    description: '返回一个英文单词/短语的词典信息，面向中国小学生（约 7 岁）英语学习。',
    parameters: {
      type: 'object' as const,
      properties: {
        ipa: { type: 'string', description: '国际音标，用斜杠包裹，如 /ˈæpəl/。短语给整体读音。' },
        explanation: { type: 'string', description: '简短的英文释义，用小学生能懂的简单英语。' },
        chineseDef: { type: 'string', description: '简洁的中文释义，只给最常用义项，不加拼音。' },
        example: { type: 'string', description: '一句简单、贴近儿童生活的英文例句，包含该单词。' },
      },
      required: ['ipa', 'explanation', 'chineseDef', 'example'],
    },
  },
}

function resolveChatConfig() {
  const apiKey =
    process.env.AI_WORD_ENRICH_API_KEY ??
    process.env.AI_CHAT_API_KEY ??
    process.env.AI_EMBED_API_KEY
  const baseUrl = (
    process.env.AI_WORD_ENRICH_BASE_URL ??
    process.env.AI_CHAT_BASE_URL ??
    process.env.AI_EMBED_BASE_URL ??
    'https://dashscope.aliyuncs.com/compatible-mode/v1'
  ).replace(/\/$/, '')
  const model = process.env.AI_WORD_ENRICH_MODEL ?? process.env.AI_CHAT_MODEL ?? DEFAULT_MODEL
  return { apiKey, baseUrl, model }
}

function parseToolInput(raw: unknown): Partial<EnrichInput> | undefined {
  if (!raw) return undefined
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Partial<EnrichInput>
    } catch {
      return undefined
    }
  }
  if (typeof raw === 'object') return raw as Partial<EnrichInput>
  return undefined
}

function extractEnrichInput(data: {
  choices?: Array<{
    message?: {
      content?: string | null
      tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>
    }
  }>
}): Partial<EnrichInput> | undefined {
  const message = data.choices?.[0]?.message
  const toolCall = message?.tool_calls?.find((tc) => tc.function?.name === 'provide_word_info')
  const fromTool = parseToolInput(toolCall?.function?.arguments)
  if (fromTool) return fromTool

  if (typeof message?.content === 'string' && message.content.trim()) {
    return parseToolInput(message.content)
  }
  return undefined
}

export async function POST(req: Request) {
  const admin = await requireAdminFromRequest(req)
  if (!admin) return forbiddenResponse()

  const { apiKey, baseUrl, model } = resolveChatConfig()
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
  if (!word || word.length > 100 || stage.length > 50) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const prompt =
    `请为英文单词/短语「${word}」生成词典信息。` +
    (stage ? `它属于教材阶段 ${stage}。` : '') +
    '面向中国小学生（约 7 岁）。务必调用 provide_word_info 工具返回结果。'

  let resp: Response
  try {
    resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        tools: [TOOL],
        tool_choice: { type: 'function', function: { name: 'provide_word_info' } },
        messages: [
          {
            role: 'system',
            content:
              '你是面向中国小学生的英语词典助手。只通过 provide_word_info 工具返回结构化结果。',
          },
          { role: 'user', content: prompt },
        ],
      }),
    })
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 502 })
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '')
    return NextResponse.json({ error: 'upstream', status: resp.status, detail }, { status: 502 })
  }

  const data = (await resp.json()) as Parameters<typeof extractEnrichInput>[0]
  const input = extractEnrichInput(data)
  if (!input) {
    return NextResponse.json({ error: 'no_tool_use' }, { status: 502 })
  }

  return NextResponse.json({
    source: 'ai',
    model,
    ipa: typeof input.ipa === 'string' ? input.ipa : '',
    explanation: typeof input.explanation === 'string' ? input.explanation : '',
    chineseDef: typeof input.chineseDef === 'string' ? input.chineseDef : '',
    example: typeof input.example === 'string' ? input.example : '',
  })
}
