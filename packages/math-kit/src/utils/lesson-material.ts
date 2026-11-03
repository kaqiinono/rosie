const formats: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', mp3: 'audio/mpeg', wav: 'audio/wav',
  m4a: 'audio/mp4', ogg: 'audio/ogg', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
}

export function materialType(name: string) {
  const extension = name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase()
  return extension && Object.hasOwn(formats, extension) ? formats[extension]! : 'application/octet-stream'
}
