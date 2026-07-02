import { isChineseBookSlug, type ChineseBookSlug } from './chinese-books'

/** Book-scoped path, e.g. chineseRoute('g2a', 'chars') → /chinese/g2a/chars */
export function chineseRoute(bookSlug: ChineseBookSlug, ...segments: string[]): string {
  const tail = segments.filter(Boolean).join('/')
  return tail ? `/chinese/${bookSlug}/${tail}` : `/chinese/${bookSlug}`
}

export function parseBookSlugFromPath(pathname: string): ChineseBookSlug | null {
  const match = pathname.match(/\/chinese\/(g\d[ab])(?:\/|$)/)
  const slug = match?.[1]
  if (slug && isChineseBookSlug(slug)) return slug
  return null
}
