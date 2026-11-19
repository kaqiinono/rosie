export function projectMediaUrl(bucket: string, path: string): string {
  return `/api/project-media/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`
}

export function migrateProjectMediaUrl(src: string, bucket: string): string {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  if (!origin) return src
  const prefix = `${origin}/storage/v1/object/public/${bucket}/`
  if (!src.startsWith(prefix)) return src
  try {
    const url = new URL(src)
    const path = url.pathname.slice(`/storage/v1/object/public/${bucket}/`.length)
    return projectMediaUrl(bucket, decodeURIComponent(path)) + url.search + url.hash
  } catch {
    return src
  }
}
