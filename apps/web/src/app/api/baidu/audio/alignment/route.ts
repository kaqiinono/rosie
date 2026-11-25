import { type NextRequest } from 'next/server'
import { formatStoryCues } from '@rosie/english/utils/story-timing'
import { alignmentSignature, alignmentTracks, readBoundAlignments } from '@/lib/audio-alignment'
import { getUserFromRequest } from '@/lib/api-auth'
import { BAIDU_AUDIO_COOKIE } from '@/lib/baidu-reading-audio'

const headers = { 'Cache-Control': 'private, no-store' }
const empty = (status: number) => new Response(null, { status, headers })

export async function GET(request: NextRequest) {
  const token = request.cookies.get(BAIDU_AUDIO_COOKIE)?.value
  if (!token || !await getUserFromRequest(new Request(request.url, { headers: { Authorization: 'Bearer ' + token } }))) {
    return empty(401)
  }
  const key = request.nextUrl.searchParams.get('key')
  const slot = request.nextUrl.searchParams.get('slot')
  if (!key || key.length > 180) return empty(404)
  const story = key.startsWith('story:')
  const tracks = await alignmentTracks(key).catch(() => [])
  const storyTrack = story ? tracks.find(track => track.slot === slot) : undefined
  if (!tracks.length || (story && !storyTrack)) return empty(404)

  const legacy = () => storyTrack?.legacyPath
    ? new Response(null, { status: 307, headers: { ...headers, Location: '/' + storyTrack.legacyPath } })
    : Response.json({}, { headers })
  try {
    const bound = await readBoundAlignments(key, storyTrack?.slot ?? null)
    if (storyTrack) {
      const [row] = bound
      if (!row) return empty(404)
      if (!row.marks) return storyTrack.expectedFilename && !row.path.endsWith('/' + storyTrack.expectedFilename)
        ? empty(404) : legacy()
      if (row.source_signature !== alignmentSignature(storyTrack, row)) return empty(404)
      const marks = row.marks
      const cues = storyTrack.targets.flatMap(({ id }) => {
        const mark = marks[id]
        return mark?.status === 'timed' ? [{ id, startMs: mark.startMs, endMs: mark.endMs }] : []
      })
      return new Response(formatStoryCues(cues), { headers: { ...headers, 'Content-Type': 'text/vtt; charset=utf-8' } })
    }
    const marks = Object.fromEntries(bound.flatMap(row => {
      const track = tracks.find(item => item.slot === row.slot)
      if (!track || !row.marks) return []
      return [[row.slot, row.source_signature === alignmentSignature(track, row) ? row.marks : {}]]
    }))
    return Response.json(marks, { headers })
  } catch (cause) {
    const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined
    return code === 'PGRST202' || code === '42P01' ? legacy() : empty(503)
  }
}
