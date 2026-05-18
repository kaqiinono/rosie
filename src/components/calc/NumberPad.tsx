'use client'

interface Props {
  value: string
  onChange: (next: string) => void
  onSubmit: () => void
  disabled?: boolean
}

const KEYS: Array<{ label: string; action: 'digit' | 'del' | 'submit'; payload?: string }> = [
  { label: '1', action: 'digit', payload: '1' },
  { label: '2', action: 'digit', payload: '2' },
  { label: '3', action: 'digit', payload: '3' },
  { label: '4', action: 'digit', payload: '4' },
  { label: '5', action: 'digit', payload: '5' },
  { label: '6', action: 'digit', payload: '6' },
  { label: '7', action: 'digit', payload: '7' },
  { label: '8', action: 'digit', payload: '8' },
  { label: '9', action: 'digit', payload: '9' },
  { label: '⌫', action: 'del' },
  { label: '0', action: 'digit', payload: '0' },
  { label: '✓', action: 'submit' },
]

export default function NumberPad({ value, onChange, onSubmit, disabled }: Props) {
  const handle = (k: typeof KEYS[number]) => {
    if (disabled) return
    if (k.action === 'digit' && k.payload !== undefined) {
      if (value.length >= 4) return
      const next = value === '0' ? k.payload : value + k.payload
      onChange(next)
    } else if (k.action === 'del') {
      onChange(value.slice(0, -1))
    } else if (k.action === 'submit') {
      onSubmit()
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {KEYS.map((k) => {
        const isSubmit = k.action === 'submit'
        const isDel = k.action === 'del'
        const inactive = disabled || (isSubmit && value.length === 0)
        return (
          <button
            key={k.label}
            type="button"
            onClick={() => handle(k)}
            disabled={inactive}
            className="h-14 rounded-2xl text-[24px] font-black transition-all select-none active:scale-[0.93]"
            style={
              isSubmit
                ? {
                    background: inactive
                      ? 'rgba(16,185,129,0.15)'
                      : 'linear-gradient(135deg, #059669, #10b981)',
                    color: inactive ? 'rgba(16,185,129,0.35)' : '#ffffff',
                    boxShadow: inactive ? 'none' : '0 4px 16px rgba(16,185,129,0.35)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    cursor: inactive ? 'not-allowed' : 'pointer',
                  }
                : isDel
                  ? {
                      background: 'rgba(239,68,68,0.1)',
                      color: disabled ? 'rgba(252,165,165,0.3)' : '#fca5a5',
                      border: '1px solid rgba(239,68,68,0.2)',
                    }
                  : {
                      background: 'rgba(255,255,255,0.05)',
                      color: disabled ? 'rgba(245,243,255,0.25)' : '#f5f3ff',
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
                    }
            }
          >
            {k.label}
          </button>
        )
      })}
    </div>
  )
}
