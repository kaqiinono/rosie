'use client'

import { useState } from 'react'
import { readValuesDraft } from './utils'

function givenValues(grid: number[][]) {
  return grid.map((row) => row.map((digit) => digit > 0 ? String(digit) : ''))
}

export function useSudokuValues(grid: number[][], initialState: unknown) {
  const board = JSON.stringify(grid)
  const [previous, setPrevious] = useState({ board, hasDraft: !!initialState })
  const [values, setValues] = useState(() => readValuesDraft(initialState) ?? givenValues(grid))
  if (board !== previous.board || !!initialState !== previous.hasDraft) {
    setPrevious({ board, hasDraft: !!initialState })
    if (board !== previous.board || !initialState) {
      setValues(readValuesDraft(initialState) ?? givenValues(grid))
    }
  }
  return { values, setValues, givenValues: () => givenValues(grid) }
}
