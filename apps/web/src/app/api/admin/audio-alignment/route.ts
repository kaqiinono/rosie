import { lessonAudioUrl } from '@rosie/english/utils/reading-audio-types'
import { requireAdminFromRequest } from '@/lib/api-auth'
import {
  alignmentCandidates, alignmentChoices, alignmentSignature, alignmentTracks, boundAlignment,
  initialAlignment, parseAudioMark, storedAlignment,
} from '@/lib/audio-alignment'

const headers = { 'Cache-Control': 'private, no-store' }
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers })
const fail = (error: string, status: number) => reply({ error }, status)

async function manage(request: Request) {
  try {
    if (!await requireAdminFromRequest(request)) return fail('需要管理员权限。', 403)
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const slot = searchParams.get('slot')
    if (!key && request.method === 'GET') return reply(alignmentChoices())
    if (!key || key.length > 180) return fail('请选择内容。', 400)

    const tracks = await alignmentTracks(key)
    if (!tracks.length) return fail('这项内容已移除。', 404)
    const bound = await boundAlignment(key)
    const binding = bound.bindings.find(item => item.slot === slot)
    if (!slot && request.method === 'GET') {
      return reply(tracks.filter(track => bound.bindings.some(item => item.slot === track.slot))
        .map(({ slot, label }) => ({ slot, label })))
    }
    const track = tracks.find(item => item.slot === slot)
    if (!track || !binding || !bound.accountId) return fail('请先在同步管理绑定此音轨。', 404)
    const signature = alignmentSignature(track, binding)
    const saved = (await storedAlignment(key, bound)).find(item => item.slot === track.slot)
    const sourceChanged = Boolean(saved && saved.source_signature !== signature)
    const initial = saved ? {} : await initialAlignment(track, binding)

    if (request.method === 'GET') {
      return reply({
        signature, sourceChanged, canSkip: track.canSkip, audioUrl: lessonAudioUrl(key, track.slot),
        marks: sourceChanged ? {} : saved?.marks ?? initial,
        targets: sourceChanged ? track.targets : await alignmentCandidates(track, binding),
      })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return fail('标记格式无效。', 400)
    if (body.signature !== signature) return fail('音频或正文已变更，请重新载入。', 409)
    if (!track.targets.some(target => target.id === body.target)) return fail('这句正文已变更，请重新载入。', 409)
    const mark = parseAudioMark(body.mark)
    const expected = body.expected === null ? null : parseAudioMark(body.expected)
    if (!mark || (body.expected !== null && !expected) || (mark.status === 'skipped' && !track.canSkip) ||
        !Number.isSafeInteger(body.durationMs) || body.durationMs < 1 || body.durationMs > 86_400_000 ||
        (mark.status === 'timed' && mark.endMs > body.durationMs)) return fail('请填写有效的起止时间。', 400)

    const { data, error } = await bound.db.rpc('save_english_audio_alignment_mark', {
      p_account_id: bound.accountId, p_lesson_key: key, p_slot: track.slot,
      p_file_id: binding.file_id, p_path: binding.path, p_source_signature: signature,
      p_target: body.target, p_duration_ms: body.durationMs, p_expected: expected,
      p_mark: mark, p_initial: initial,
    })
    if (error?.message === 'alignment_overlap') return fail('这段时间与同音轨的另一句重叠，请微调后再保存。', 409)
    if (error?.message === 'alignment_mark_changed') return fail('这句已被更新，请重新载入再编辑。', 409)
    if (error?.message === 'alignment_source_changed') return fail('音轨绑定已变更，请重新载入。', 409)
    if (error?.message === 'alignment_invalid_bounds') return fail('请填写有效的起止时间。', 400)
    if (error) throw error
    return reply(data)
  } catch {
    return fail('时间轴暂时无法读取或保存，请稍后重试。', 503)
  }
}

export { manage as GET, manage as PUT }
