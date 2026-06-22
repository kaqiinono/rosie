import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpellTiles } from '@rosie/english'

function setup(word: string) {
  const onSubmit = vi.fn<(val: string) => void>()
  const utils = render(
    <SpellTiles word={word} onSubmit={onSubmit} answered={false} isCorrect={null} />,
  )
  return { onSubmit, ...utils }
}

async function clickPoolLetter(user: ReturnType<typeof userEvent.setup>, letter: string) {
  // Pool letter tiles are <button>letter</button>. Use the first one with that
  // accessible name (slot tiles are <div>, so they won't be matched).
  const candidates = screen.getAllByRole('button', { name: letter })
  await user.click(candidates[0])
}

function findSpaceTile(): HTMLButtonElement {
  // The space tile is a <button> with no accessible name (no text content).
  const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[]
  const space = buttons.find(b => !b.textContent || b.textContent.trim() === '')
  if (!space) throw new Error('space tile not found')
  return space
}

async function clickConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /确认/ }))
}

describe('SpellTiles', () => {
  it('REGRESSION: submits the user-placed letters, not the correct answer', async () => {
    // Bug fixed in c235796: handleConfirm was calling onSubmit(segments.join(''))
    // which always equals `word` regardless of what the user placed, so every
    // input was accepted. This test pins the contract.
    const user = userEvent.setup()
    const { onSubmit } = setup('abc')

    // Deliberately place letters in the WRONG order
    await clickPoolLetter(user, 'c')
    await clickPoolLetter(user, 'b')
    await clickPoolLetter(user, 'a')
    await clickConfirm(user)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith('cba')
    expect(onSubmit).not.toHaveBeenCalledWith('abc')
  })

  it('submits the correct answer when letters are placed in order', async () => {
    const user = userEvent.setup()
    const { onSubmit } = setup('abc')

    await clickPoolLetter(user, 'a')
    await clickPoolLetter(user, 'b')
    await clickPoolLetter(user, 'c')
    await clickConfirm(user)

    expect(onSubmit).toHaveBeenCalledWith('abc')
  })

  it('confirm button is not rendered until every slot is filled', async () => {
    const user = userEvent.setup()
    setup('abc')

    expect(screen.queryByRole('button', { name: /确认/ })).toBeNull()
    await clickPoolLetter(user, 'a')
    expect(screen.queryByRole('button', { name: /确认/ })).toBeNull()
    await clickPoolLetter(user, 'b')
    expect(screen.queryByRole('button', { name: /确认/ })).toBeNull()
    await clickPoolLetter(user, 'c')
    expect(screen.queryByRole('button', { name: /确认/ })).not.toBeNull()
  })

  it('handles phrases with the space tile', async () => {
    const user = userEvent.setup()
    const { onSubmit } = setup('ab cd')

    await clickPoolLetter(user, 'a')
    await clickPoolLetter(user, 'b')
    await user.click(findSpaceTile())
    await clickPoolLetter(user, 'c')
    await clickPoolLetter(user, 'd')
    await clickConfirm(user)

    expect(onSubmit).toHaveBeenCalledWith('ab cd')
  })

  it('removes a placed letter when its slot is tapped', async () => {
    const user = userEvent.setup()
    const { container, onSubmit } = setup('abc')

    await clickPoolLetter(user, 'a')
    await clickPoolLetter(user, 'b')
    await clickPoolLetter(user, 'c')

    // Tap the first filled slot to clear it
    const slots = container.querySelectorAll('[class*="border-2"][class*="text-[#f0f0ff]"]')
    const firstFilledSlot = Array.from(slots).find(el => el.textContent === 'a') as HTMLElement
    expect(firstFilledSlot).toBeDefined()
    await user.click(firstFilledSlot)

    // Confirm button disappears because slot[0] is empty again
    expect(screen.queryByRole('button', { name: /确认/ })).toBeNull()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
