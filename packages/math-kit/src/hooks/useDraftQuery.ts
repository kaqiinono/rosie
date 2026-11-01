'use client'

import { useEffect, useState } from 'react'

/** Only publish results for the current problem/user and requested refresh. */
export function useDraftQuery<T>(load: (() => Promise<T>) | null, revision: string | number = 0): T | undefined {
  const [result, setResult] = useState<{ load: () => Promise<T>; revision: number | string; value: T }>()
  useEffect(() => {
    if (!load) return
    let active = true
    void load().then((value) => {
      if (active) setResult({ load, revision, value })
    })
    return () => { active = false }
  }, [load, revision])
  return result && result.load === load && result.revision === revision ? result.value : undefined
}
