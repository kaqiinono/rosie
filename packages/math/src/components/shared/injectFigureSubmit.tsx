import React from 'react'

type FigureGridCallbacks = {
  onSubmit?: (state: unknown) => void
  onStateChange?: (state: unknown) => void
  initialState?: unknown
}

export function injectFigureSubmit(
  figureNode: React.ReactNode,
  onSubmit: (state: unknown) => void,
): React.ReactNode {
  return injectFigureGridCallbacks(figureNode, { onSubmit })
}

export function injectFigureGridCallbacks(
  figureNode: React.ReactNode,
  callbacks: FigureGridCallbacks,
): React.ReactNode {
  if (!figureNode || !React.isValidElement(figureNode)) {
    return figureNode
  }
  return React.cloneElement(figureNode, callbacks as Record<string, unknown>)
}
