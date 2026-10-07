'use client'

interface Props {
  value: string
  onChange: (next: string) => void
  onSubmit: () => void
  disabled?: boolean
  /** When true, show a decimal-point key (✓ moves to a full-width button below the grid). */
  allowDecimal?: boolean
}

const keyPressAnimations = new WeakMap<HTMLButtonElement, Animation>()

/** Keep the full candy-button squash and rebound visible after a quick tap. */
function playKeyPressEffect(button: HTMLButtonElement) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  keyPressAnimations.get(button)?.cancel()
  const animation = button.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(0.91, 1.1)', offset: 0.3 },
      { transform: 'scale(1.08, 0.93)', offset: 0.6 },
      { transform: 'scale(0.98, 1.02)', offset: 0.8 },
      { transform: 'scale(1)' },
    ],
    { duration: 260, easing: 'ease-out' },
  )
  keyPressAnimations.set(button, animation)
  animation.addEventListener('finish', () => {
    if (keyPressAnimations.get(button) === animation) keyPressAnimations.delete(button)
  })
}

export default function NumberPad({ value, onChange, onSubmit, disabled, allowDecimal = false }: Props) {
  const maxDigits = allowDecimal ? 6 : 4
  // In decimal mode the 12th grid slot is '.', and ✓ becomes a separate full-width button.
  const gridKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', allowDecimal ? '.' : '✓']

  const press = (key: string) => {
    if (disabled) return
    if (key === '✓') {
      if (value.length > 0) onSubmit()
      return
    }
    if (key === '⌫') {
      onChange(value.slice(0, -1))
      return
    }
    if (key === '.') {
      if (!allowDecimal || value.includes('.')) return
      onChange(value === '' ? '0.' : value + '.')
      return
    }
    if (value.replace('.', '').length >= maxDigits) return
    onChange(value === '0' ? key : value + key)
  }

  const keyStyle = (key: string): React.CSSProperties => {
    const isSubmit = key === '✓'
    const isDel = key === '⌫'
    const inactive = disabled || (isSubmit && value.length === 0)
    if (isSubmit) {
      return {
        background: inactive ? 'rgba(16,185,129,0.15)' : 'linear-gradient(135deg, #059669, #10b981)',
        color: inactive ? 'rgba(16,185,129,0.35)' : '#ffffff',
        boxShadow: inactive ? 'none' : '0 4px 16px rgba(16,185,129,0.35)',
        border: '1px solid rgba(16,185,129,0.25)',
        cursor: inactive ? 'not-allowed' : 'pointer',
      }
    }
    if (isDel) {
      return {
        background: 'rgba(239,68,68,0.1)',
        color: disabled ? 'rgba(252,165,165,0.3)' : '#fca5a5',
        border: '1px solid rgba(239,68,68,0.2)',
      }
    }
    return {
      background: 'rgba(255,255,255,0.05)',
      color: disabled ? 'rgba(245,243,255,0.25)' : '#f5f3ff',
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
    }
  }

  const keyButton = (key: string) => {
    const inactive = disabled || (key === '✓' && value.length === 0)
    return (
      <button
        key={key}
        type="button"
        onClick={() => press(key)}
        onPointerDown={(event) => playKeyPressEffect(event.currentTarget)}
        onKeyDown={(event) => {
          if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) {
            playKeyPressEffect(event.currentTarget)
          }
        }}
        disabled={inactive}
        className="h-14 touch-manipulation rounded-2xl text-[24px] font-black transition-all select-none [-webkit-tap-highlight-color:transparent] active:scale-[0.93]"
        style={keyStyle(key)}
      >
        {key}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-3 gap-2.5">{gridKeys.map(keyButton)}</div>
      {allowDecimal && (
        <button
          type="button"
          onClick={() => press('✓')}
          onPointerDown={(event) => playKeyPressEffect(event.currentTarget)}
          onKeyDown={(event) => {
            if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) {
              playKeyPressEffect(event.currentTarget)
            }
          }}
          disabled={disabled || value.length === 0}
          className="h-14 w-full touch-manipulation rounded-2xl text-[24px] font-black transition-all select-none [-webkit-tap-highlight-color:transparent] active:scale-[0.93]"
          style={keyStyle('✓')}
        >
          ✓
        </button>
      )}
    </div>
  )
}
