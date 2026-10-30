/** Conservative passive formats only. Classify the provider path, never a client MIME claim. */
export function materialFileType(path: string): {
  kind: 'audio' | 'image' | 'video' | 'pdf' | 'file'
  mime: string
} {
  const extension = path.match(/[.]([^. /]+)$/)?.[1].toLowerCase()
  switch (extension) {
    case 'mp3':
      return { kind: 'audio', mime: 'audio/mpeg' }
    case 'jpg':
      return { kind: 'image', mime: 'image/jpeg' }
    case 'jpeg':
      return { kind: 'image', mime: 'image/jpeg' }
    case 'png':
      return { kind: 'image', mime: 'image/png' }
    case 'gif':
      return { kind: 'image', mime: 'image/gif' }
    case 'webp':
      return { kind: 'image', mime: 'image/webp' }
    case 'avif':
      return { kind: 'image', mime: 'image/avif' }
    case 'm4a':
      return { kind: 'audio', mime: 'audio/mp4' }
    case 'wav':
      return { kind: 'audio', mime: 'audio/wav' }
    case 'ogg':
      return { kind: 'audio', mime: 'audio/ogg' }
    case 'mp4':
      return { kind: 'video', mime: 'video/mp4' }
    case 'webm':
      return { kind: 'video', mime: 'video/webm' }
    case 'ogv':
      return { kind: 'video', mime: 'video/ogg' }
    case 'pdf':
      return { kind: 'pdf', mime: 'application/pdf' }
    default:
      return { kind: 'file', mime: 'application/octet-stream' }
  }
}
