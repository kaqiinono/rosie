'use client'

type VerticalDigitPadProps = {
  complete: boolean
  disabled?: boolean
  onDigit: (digit: number) => void
  onDelete: () => void
  onAction: () => void
  variant?: 'dark' | 'light'
}

const DARK_DIGIT = {
  background: 'rgba(255,255,255,0.05)',
  color: '#f5f3ff',
  border: '1px solid rgba(255,255,255,0.1)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
}

const LIGHT_DIGIT = {
  background: '#ffffff',
  color: '#0f172a',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}

const DARK_DEL = {
  background: 'rgba(239,68,68,0.1)',
  color: '#fca5a5',
  border: '1px solid rgba(239,68,68,0.2)',
}

const LIGHT_DEL = {
  background: '#fef2f2',
  color: '#dc2626',
  border: '1px solid #fecaca',
}

export default function VerticalDigitPad({
  complete,
  disabled = false,
  onDigit,
  onDelete,
  onAction,
  variant = 'dark',
}: VerticalDigitPadProps) {
  const isLight = variant === 'light'
  const digitStyle = isLight ? LIGHT_DIGIT : DARK_DIGIT
  const delStyle = isLight ? LIGHT_DEL : DARK_DEL
  const disabledColor = isLight ? '#94a3b8' : 'rgba(245,243,255,0.25)'

  const keyClass =
    'h-14 rounded-2xl text-[24px] font-black transition-all select-none active:scale-[0.93]'

  return (
    <div className="mx-auto grid w-full max-w-[320px] grid-cols-3 gap-2.5">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
        <button
          key={d}
          type="button"
          disabled={disabled}
          onClick={() => onDigit(d)}
          className={keyClass}
          style={{
            ...digitStyle,
            color: disabled ? disabledColor : digitStyle.color,
          }}
        >
          {d}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={onDelete}
        className={keyClass}
        style={{
          ...delStyle,
          color: disabled ? disabledColor : delStyle.color,
        }}
        aria-label="删除"
      >
        ⌫
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDigit(0)}
        className={keyClass}
        style={{
          ...digitStyle,
          color: disabled ? disabledColor : digitStyle.color,
        }}
      >
        0
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onAction}
        className={`${keyClass} ${!complete ? 'text-[15px]' : 'text-[24px]'}`}
        style={
          !complete
            ? isLight
              ? {
                  background: '#e0f2fe',
                  color: '#0369a1',
                  border: '1px solid #7dd3fc',
                }
              : {
                  background: 'rgba(139,92,246,0.18)',
                  color: '#c4b5fd',
                  border: '1px solid rgba(139,92,246,0.4)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
                }
            : {
                background: 'linear-gradient(135deg, #059669, #10b981)',
                color: '#ffffff',
                boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
                border: '1px solid rgba(16,185,129,0.25)',
              }
        }
      >
        {!complete ? 'Enter' : '✓'}
      </button>
    </div>
  )
}
