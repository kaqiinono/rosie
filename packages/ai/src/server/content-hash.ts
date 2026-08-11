import { createHash } from 'crypto'

export function normalizeContent(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function contentHash(text: string): string {
  return createHash('sha256').update(normalizeContent(text)).digest('hex')
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+\n/g, '\n')
    .trim()
}
