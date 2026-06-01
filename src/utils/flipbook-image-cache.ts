const displayUrlBySource = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

/** Fetch each source URL once; returns a stable blob URL for all <img> consumers. */
export async function prefetchFlipbookImage(sourceUrl: string): Promise<string> {
  const cached = displayUrlBySource.get(sourceUrl)
  if (cached) return cached

  const running = inflight.get(sourceUrl)
  if (running) return running

  const task = (async () => {
    const res = await fetch(sourceUrl)
    if (!res.ok) {
      inflight.delete(sourceUrl)
      throw new Error(`页图加载失败: ${sourceUrl}`)
    }
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    displayUrlBySource.set(sourceUrl, blobUrl)
    inflight.delete(sourceUrl)
    return blobUrl
  })()

  inflight.set(sourceUrl, task)
  return task
}

export function isFlipbookImageCached(sourceUrl: string): boolean {
  return displayUrlBySource.has(sourceUrl)
}

export function revokeFlipbookImageCache(): void {
  for (const blobUrl of displayUrlBySource.values()) {
    URL.revokeObjectURL(blobUrl)
  }
  displayUrlBySource.clear()
  inflight.clear()
}
