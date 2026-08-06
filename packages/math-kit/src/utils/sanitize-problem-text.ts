import DOMPurify from 'dompurify'

/**
 * Allowed tags for math problem text.
 * Math problems use basic formatting plus sup/sub for exponents/fractions.
 */
const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'sup', 'sub', 'span', 'ul', 'ol', 'li']
// No 'style': problem text (all static content) uses zero inline styles, and
// the attribute only widens the attack surface (e.g. layout-overriding CSS).
const ALLOWED_ATTR = ['class']

/** Sanitize math problem text HTML to prevent XSS. */
export function sanitizeProblemText(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
}
