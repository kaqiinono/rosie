import 'server-only'
/** Quote integer tokens before JSON.parse, never stringify an already rounded ID. */
export function parseBaiduJson(raw: string): Record<string, unknown> {
  const quoted = raw.replace(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, (token) => {
    if (/^-?\d+$/.test(token) && !Number.isSafeInteger(Number(token))) return JSON.stringify(token)
    return token
  })
  return JSON.parse(quoted) as Record<string, unknown>
}
export function exactBaiduId(value: unknown): string {
  const s = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value
  if (typeof s !== 'string' || !/^[1-9]\d{0,19}$/.test(s)) throw Error('baidu_invalid_identity')
  return s
}
export async function verifyBaiduAccount(accessToken: string): Promise<string> {
  const url = new URL('https://pan.baidu.com/rest/2.0/xpan/nas')
  url.search = new URLSearchParams({ method: 'uinfo', access_token: accessToken }).toString()
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  })
  const body = parseBaiduJson(await response.text())
  if (!response.ok || body.errno !== 0) throw Error('baidu_identity_unavailable')
  return exactBaiduId(body.uk)
}
