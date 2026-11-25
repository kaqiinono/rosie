type StoryCue = { startMs: number; endMs: number }

function timestampMs(value: string) {
  const [hours, minutes, seconds] = value.split(':').map(Number)
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000)
}

export function readStoryCues(text: string) {
  const cues = new Map<string, StoryCue>()
  const pattern = /^([a-z0-9-]+-s\d+)\r?\n(\d{2,}:[0-5]\d:[0-5]\d\.\d{3})[ \t]+-->[ \t]+(\d{2,}:[0-5]\d:[0-5]\d\.\d{3})(?=[ \t\r\n]|$)/gm
  if (!/^\uFEFF?WEBVTT(?:[ \t\r\n]|$)/.test(text)) return cues
  for (const [, id, start, end] of text.matchAll(pattern)) {
    const startMs = timestampMs(start)
    const endMs = timestampMs(end)
    if (Number.isSafeInteger(startMs) && Number.isSafeInteger(endMs) && startMs < endMs) {
      cues.set(id, { startMs, endMs })
    }
  }
  return cues
}

function timestamp(ms: number) {
  const fields = [
    Math.floor(ms / 3_600_000),
    Math.floor(ms / 60_000) % 60,
    Math.floor(ms / 1000) % 60,
  ]
  return fields.map(field => String(field).padStart(2, '0')).join(':') + '.' + String(ms % 1000).padStart(3, '0')
}

export function formatStoryCues(cues: readonly (StoryCue & { id: string })[]) {
  return 'WEBVTT\n\n' + [...cues].sort((a, b) => a.startMs - b.startMs)
    .map(({ id, startMs, endMs }) => `${id}\n${timestamp(startMs)} --> ${timestamp(endMs)}\n${id}\n\n`)
    .join('')
}
