'use client'

import { useCallback, useRef, useState } from 'react'
import FlipbookDuplicateDialog from '../components/FlipbookDuplicateDialog'
import type {
  FlipbookDuplicateAction,
  FlipbookDuplicatePrompt,
} from '../utils/flipbook-duplicate'

type Pending = {
  prompt: FlipbookDuplicatePrompt
  showApplyToRest: boolean
  resolve: (action: FlipbookDuplicateAction) => void
}

export function useFlipbookDuplicatePrompt() {
  const [pending, setPending] = useState<Pending | null>(null)
  const policyRef = useRef<FlipbookDuplicateAction | null>(null)

  const resetPolicy = useCallback(() => {
    policyRef.current = null
  }, [])

  const ask = useCallback(
    (prompt: FlipbookDuplicatePrompt, options?: { batch?: boolean }): Promise<FlipbookDuplicateAction> => {
      const policy = policyRef.current
      if (policy) return Promise.resolve(policy)

      return new Promise((resolve) => {
        setPending({
          prompt,
          showApplyToRest: options?.batch ?? false,
          resolve,
        })
      })
    },
    [],
  )

  const handleChoose = useCallback((action: FlipbookDuplicateAction, applyToRest: boolean) => {
    if (applyToRest) policyRef.current = action
    pending?.resolve(action)
    setPending(null)
  }, [pending])

  const dialog = pending ? (
    <FlipbookDuplicateDialog
      prompt={pending.prompt}
      showApplyToRest={pending.showApplyToRest}
      onChoose={handleChoose}
    />
  ) : null

  return { ask, resetPolicy, dialog }
}
