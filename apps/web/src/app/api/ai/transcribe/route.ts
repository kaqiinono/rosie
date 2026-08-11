import { NextResponse } from 'next/server'
import { getUserFromRequest, unauthorizedResponse } from '@/lib/api-auth'
import { transcribeAudio } from '@rosie/ai'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return unauthorizedResponse()

  if (!process.env.AI_EMBED_API_KEY && !process.env.AI_STT_API_KEY) {
    return NextResponse.json({ error: 'no_stt_key' }, { status: 503 })
  }

  const form = await req.formData()
  const audio = form.get('audio')
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  if (audio.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 })
  }

  try {
    const result = await transcribeAudio(audio)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'stt_error'
    if (message === 'stt_empty') {
      return NextResponse.json({ error: 'unrecognized', message: '没听清，再试一次' }, { status: 422 })
    }
    if (message === 'no_stt_api_key') {
      return NextResponse.json({ error: 'no_stt_key' }, { status: 503 })
    }
    return NextResponse.json({ error: 'stt_failed', message }, { status: 500 })
  }
}
