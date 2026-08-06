import DOMPurify from 'dompurify'

/**
 * Allowed tags for math problem text.
 * Math problems use basic formatting plus sup/sub for exponents/fractions.
 */
const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'sup', 'sub', 'span', 'ul', 'ol', 'li']
const ALLOWED_ATTR = ['class', 'style']

/** Sanitize math problem text HTML to prevent XSS. */
export function sanitizeProblemText(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
}
