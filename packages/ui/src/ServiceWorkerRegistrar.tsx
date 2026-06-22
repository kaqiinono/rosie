'use client'

import { useServiceWorker } from '@rosie/core'

export default function ServiceWorkerRegistrar() {
  useServiceWorker()
  return null
}
