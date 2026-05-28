'use client'

import clsx from 'clsx'

type NumberPadProps = {
  onInput: (digit: string) => void
  onDelete: () => void
  onConfirm: () => void
  disabled?: boolean
}

function NumberPad({ onInput, onDelete, onConfirm, disabled = false }: NumberPadProps) {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

  return (
    <div className="grid grid-cols-3 gap-2 w-full max-w-xs mx-auto">
      {digits.map((d) => (
        <button
          key={d}
          type="button"
          disabled={disabled}
          onClick={() => onInput(d)}
          className={clsx(
            'min-h-[48px] rounded-xl bg-white shadow text-xl font-bold',
            'transition-colors select-none',
            disabled
              ? 'opacity-40 cursor-not-allowed'
              : 'hover:bg-gray-50 active:bg-gray-100'
          )}
        >
          {d}
        </button>
      ))}

      {/* Row 4: backspace, 0, confirm */}
      <button
        type="button"
        disabled={disabled}
        onClick={onDelete}
        className={clsx(
          'min-h-[48px] rounded-xl bg-white shadow text-xl font-bold',
          'transition-colors select-none',
          disabled
            ? 'opacity-40 cursor-not-allowed'
            : 'hover:bg-gray-50 active:bg-gray-100'
        )}
        aria-label="删除"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6 mx-auto"
        >
          <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
          <line x1="18" y1="9" x2="12" y2="15" />
          <line x1="12" y1="9" x2="18" y2="15" />
        </svg>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onInput('0')}
        className={clsx(
          'min-h-[48px] rounded-xl bg-white shadow text-xl font-bold',
          'transition-colors select-none',
          disabled
            ? 'opacity-40 cursor-not-allowed'
            : 'hover:bg-gray-50 active:bg-gray-100'
        )}
      >
        0
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={onConfirm}
        className={clsx(
          'min-h-[48px] rounded-xl bg-blue-500 text-white shadow text-xl font-bold',
          'transition-colors select-none',
          disabled
            ? 'opacity-40 cursor-not-allowed'
            : 'hover:bg-blue-600 active:bg-blue-700'
        )}
        aria-label="确认"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6 mx-auto"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    </div>
  )
}

export default NumberPad
