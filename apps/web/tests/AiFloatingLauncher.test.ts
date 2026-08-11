import { describe, expect, it } from 'vitest'
import { shouldShowAiAssistant, subjectFromPathname } from '@rosie/ai'

describe('AI floating launcher visibility', () => {
  it('shows on learning pages', () => {
    expect(shouldShowAiAssistant('/', false)).toBe(true)
    expect(shouldShowAiAssistant('/math/ny/3/12', false)).toBe(true)
    expect(shouldShowAiAssistant('/english/words/cards', false)).toBe(true)
  })

  it('hides where the global entry would be distracting or redundant', () => {
    expect(shouldShowAiAssistant('/ai', false)).toBe(false)
    expect(shouldShowAiAssistant('/auth/reset', false)).toBe(false)
    expect(shouldShowAiAssistant('/admin/words', false)).toBe(false)
    expect(shouldShowAiAssistant('/math', true)).toBe(false)
  })

  it('derives the subject context from the current learning route', () => {
    expect(subjectFromPathname('/english/words/cards')).toBe('english')
    expect(subjectFromPathname('/chinese/g2a/chars')).toBe('chinese')
    expect(subjectFromPathname('/math/ny/3/12')).toBe('math')
    expect(subjectFromPathname('/calc/session')).toBe('math')
    expect(subjectFromPathname('/today')).toBeUndefined()
  })
})
