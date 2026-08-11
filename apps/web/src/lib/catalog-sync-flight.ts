const CATALOG_SYNC_RESULT_TTL_MS = 5 * 60 * 1000

export class CatalogSyncBusyError extends Error {
  constructor(public readonly activeSubjects: string[]) {
    super(`catalog_sync_busy:${activeSubjects.join(',')}`)
    this.name = 'CatalogSyncBusyError'
  }
}

interface CatalogSyncFlight<T = unknown> {
  key: string
  subjects: Set<string>
  promise: Promise<T>
  active: boolean
  expiresAt: number
}

interface CatalogSyncFlightRegistry {
  flights: Map<string, CatalogSyncFlight>
}

const registryKey = Symbol.for('rosie.catalogSyncFlightRegistry')
const globalWithRegistry = globalThis as typeof globalThis & {
  [registryKey]?: CatalogSyncFlightRegistry
}

function registry(): CatalogSyncFlightRegistry {
  globalWithRegistry[registryKey] ??= { flights: new Map() }
  return globalWithRegistry[registryKey]
}

function pruneExpiredFlights(now: number): void {
  for (const [key, flight] of registry().flights) {
    if (!flight.active && flight.expiresAt <= now) registry().flights.delete(key)
  }
}

export function catalogSyncRequestKey(
  subjects: string[],
  options: { mathOffset: number; mathLimit: number },
): string {
  return JSON.stringify({
    subjects: [...new Set(subjects)].sort(),
    mathOffset: options.mathOffset,
    mathLimit: options.mathLimit,
  })
}

export function runCatalogSyncSingleFlight<T>(args: {
  key: string
  subjects: string[]
  run: () => Promise<T>
  now?: () => number
}): { promise: Promise<T>; reused: boolean } {
  const now = args.now ?? Date.now
  const startedAt = now()
  pruneExpiredFlights(startedAt)

  const existing = registry().flights.get(args.key)
  if (existing) return { promise: existing.promise as Promise<T>, reused: true }

  const requestedSubjects = new Set(args.subjects)
  const conflictingSubjects = new Set<string>()
  for (const flight of registry().flights.values()) {
    if (!flight.active) continue
    for (const subject of flight.subjects) {
      if (requestedSubjects.has(subject)) conflictingSubjects.add(subject)
    }
  }
  if (conflictingSubjects.size > 0) {
    throw new CatalogSyncBusyError([...conflictingSubjects].sort())
  }

  const flight: CatalogSyncFlight<T> = {
    key: args.key,
    subjects: requestedSubjects,
    promise: Promise.resolve().then(args.run),
    active: true,
    expiresAt: Number.POSITIVE_INFINITY,
  }
  registry().flights.set(args.key, flight)

  void flight.promise.then(
    () => {
      flight.active = false
      flight.expiresAt = now() + CATALOG_SYNC_RESULT_TTL_MS
    },
    () => {
      if (registry().flights.get(args.key) === flight) registry().flights.delete(args.key)
    },
  )

  return { promise: flight.promise, reused: false }
}

export function resetCatalogSyncFlightsForTests(): void {
  registry().flights.clear()
}
