type Props = {
  name: 'play' | 'diagram' | 'pencil' | 'upload' | 'heart' | 'chevron'
  filled?: boolean
  className?: string
}

export const PROBLEM_ACTION_BUTTON_CLASS = 'inline-flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-blue disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none'

/** One size, stroke and optical alignment for all math card actions. */
export default function ProblemActionIcon({ name, filled = false, className = '' }: Props) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={`h-[18px] w-[18px] shrink-0 ${className}`}>
      {name === 'play' && <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m10 8 6 4-6 4Z" /></>}
      {name === 'diagram' && <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1" /><path d="m3 17 5-5 4 4 4-6 5 7" /></>}
      {name === 'pencil' && <><path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15l-1 6Z" /><path d="M13 21h8" /></>}
      {name === 'upload' && <><path d="M12 16V3m-4 4 4-4 4 4M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></>}
      {name === 'heart' && <path fill={filled ? 'currentColor' : 'none'} d="M20.4 5.6a5.5 5.5 0 0 0-7.8 0l-.6.6-.6-.6a5.5 5.5 0 0 0-7.8 7.8L12 21l8.4-7.6a5.5 5.5 0 0 0 0-7.8Z" />}
      {name === 'chevron' && <path d="m6 9 6 6 6-6" />}
    </svg>
  )
}
