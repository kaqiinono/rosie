import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AiAssistantPage } from '@rosie/ai'

describe('full AI page embedded renderer slot', () => {
  it('uses the app-composed chat panel when provided', () => {
    render(<AiAssistantPage chatPanel={<div>学科原生交互面板</div>} />)
    expect(screen.getByText('学科原生交互面板')).toBeInTheDocument()
  })
})
