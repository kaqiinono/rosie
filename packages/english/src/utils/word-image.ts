export const WORD_IMAGES_BUCKET = 'word-images'

export function slugWord(word: string): string {
  const core = word.replace(/\([^)]*\)/g, ' ').replace(/[\/]+/g, ' ')
  return core
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'word'
}

export function wordImageStoragePath(
  stage: string,
  unit: string,
  lesson: string,
  word: string,
): string {
  const u = unit.replace(/\s+/g, '_')
  const l = lesson.replace(/\s+/g, '_')
  return `${stage}/${u}/${l}/${slugWord(word)}.jpg`
}

export function buildPexelsQuery(word: string, explanation: string): string {
  const core = word.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
  const stop = new Set(['the','a','an','to','of','or','and','for','in','on','with','that','which','who','is','are','be','by','from','as','at','it','its'])
  const extras = explanation
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w))
    .slice(0, 3)
  return [core, ...extras].filter(Boolean).join(' ').slice(0, 100)
}

export function scorePexelsCandidate(alt: string, query: string, rankIndex: number): number {
  const base = Math.max(40, 90 - rankIndex * 8)
  const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2)
  const altL = (alt || '').toLowerCase()
  let hits = 0
  for (const t of tokens) if (altL.includes(t)) hits++
  const boost = tokens.length ? Math.round((hits / tokens.length) * 25) : 0
  return Math.min(100, base + boost)
}

/** Public URL for a path in the word-images bucket (no Supabase client import — safe for API routes). */
export function getWordImagePublicUrl(imagePath: string, supabaseUrl?: string): string {
  const base = (supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')
  if (!base) return ''
  return `${base}/storage/v1/object/public/${WORD_IMAGES_BUCKET}/${imagePath}`
}
