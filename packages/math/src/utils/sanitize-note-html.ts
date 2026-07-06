import DOMPurify from 'dompurify'

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li']
const ALLOWED_ATTR: string[] = []

/** Strip unsafe HTML; allow only note formatting tags. */
export function sanitizeNoteHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
}

/** True when sanitized HTML has no visible text content. */
export function isNoteBodyEmpty(html: string): boolean {
  const clean = sanitizeNoteHtml(html)
  if (!clean || clean === '<p></p>' || clean === '<p><br></p>') return true
  if (typeof document === 'undefined') {
    return clean.replace(/<[^>]+>/g, '').trim().length === 0
  }
  const el = document.createElement('div')
  el.innerHTML = clean
  return (el.textContent ?? '').trim().length === 0
}
