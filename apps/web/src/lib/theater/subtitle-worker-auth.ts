import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { TheaterVideoFormat } from './types'

export function theaterWorkerSigningKey() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  return secret ? createHmac('sha256', secret).update('rosie-theater-worker-v1').digest('hex') : null
}

export function theaterWorkerOrigin() {
  const configured = process.env.THEATER_SUBTITLE_WORKER_ORIGIN ?? process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : '')
  return normalizeTheaterOrigin(configured)
}

export function normalizeTheaterOrigin(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' && !url.port && !url.username && !url.password &&
        url.pathname === '/' && !url.search && !url.hash && /^[a-z0-9.-]+\.[a-z0-9-]+$/.test(url.hostname))
      return url.origin
  } catch { /* No public HTTPS origin is configured. */ }
  return null
}

function verifySignature(secret: string, input: string, signature: string) {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false
  const expected = createHmac('sha256', secret).update(input).digest()
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'))
}

export function validTheaterCronRequest(token: string, origin: string) {
  const secret = theaterWorkerSigningKey()
  const match = /^(\d{10})\.([a-f0-9]{64})$/.exec(token)
  if (!secret || !match) return false
  const age = Math.floor(Date.now() / 1000) - Number(match[1])
  return age >= -10 && age <= 90 && verifySignature(secret, 'theater-worker:' + match[1] + ':' + origin, match[2])
}

export function signedTheaterSource(origin: string, jobId: string, expires: number, format: TheaterVideoFormat) {
  const secret = theaterWorkerSigningKey()
  if (!secret) throw Error('worker_not_configured')
  const url = new URL('/api/theater/subtitle-source/' + jobId + '/video.' + format, origin)
  const signature = createHmac('sha256', secret).update('theater-source:' + jobId + ':' + expires).digest('hex')
  url.searchParams.set('ticket', expires + '.' + signature)
  return url.href
}

export function theaterSourceExpiry(jobId: string, token: string) {
  const secret = theaterWorkerSigningKey()
  const match = /^(\d{10})\.([a-f0-9]{64})$/.exec(token)
  if (!secret || !match || Number(match[1]) <= Math.floor(Date.now() / 1000) ||
      !verifySignature(secret, 'theater-source:' + jobId + ':' + match[1], match[2])) return null
  return Number(match[1])
}
