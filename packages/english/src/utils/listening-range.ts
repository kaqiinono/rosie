export function toggleListeningRange(selected: readonly number[], index: number): number[] {
  const first = selected[0]
  const last = selected.at(-1)
  if (first === undefined || last === undefined) return [index]

  const start = index === first ? first + 1 : Math.min(first, index)
  const end = index > first && index <= last ? index - 1 : Math.max(last, index)
  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset)
}
