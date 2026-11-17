import { useId } from 'react'
import styles from './HomeworkTomatoMascot.module.css'

export default function HomeworkTomatoMascot({ focused, celebrating }: { focused: boolean; celebrating: boolean }) {
  const fillId = useId()
  const animation = celebrating ? styles.celebrating : focused ? styles.focused : styles.floating

  return (
    <svg viewBox="28 42 164 162" className="size-3/4 overflow-visible" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor="#FF8978" />
          <stop offset=".55" stopColor="#FF5F52" />
          <stop offset="1" stopColor="#E64133" />
        </linearGradient>
      </defs>
      <ellipse cx="110" cy="193" rx="52" ry="10" fill="#502D23" opacity=".12" />
      <g className={animation}>
        <g fill="#FF6B5B" stroke="#522B26" strokeWidth="3.8" strokeLinecap="round">
          <path d="M51 138 Q34 128 38 146 Q43 156 55 148" />
          <path d="M169 138 Q186 128 182 146 Q177 156 165 148" />
        </g>
        <ellipse cx="110" cy="130" rx="62" ry="54" fill={`url(#${fillId})`} stroke="#522B26" strokeWidth="4.2" />
        <ellipse cx="78" cy="100" rx="16" ry="8" transform="rotate(-26 78 100)" fill="#FFF" opacity=".45" />
        <circle cx="96" cy="91" r="3.8" fill="#FFF" opacity=".55" />
        <path d="M110 74 C96 58, 70 68, 74 82 C88 80, 97 82, 106 86 C100 94, 118 94, 114 86 C123 82, 132 80, 146 82 C150 68, 124 58, 110 74 Z"
          fill="#52C97A" stroke="#2D6A43" strokeWidth="3.4" strokeLinejoin="round" />
        <path d="M110 74 Q112 52 126 50" fill="none" stroke="#2D6A43" strokeWidth="4" strokeLinecap="round" />
        <g fill="#FFAFB0" opacity=".72">
          <ellipse cx="72" cy="134" rx="10" ry="6" />
          <ellipse cx="148" cy="134" rx="10" ry="6" />
        </g>
        <g className={styles.eyes} fill="#3B2521">
          <circle cx="88" cy="120" r="7.8" />
          <circle cx="132" cy="120" r="7.8" />
          <g fill="#FFF">
            <circle cx="85" cy="117" r="2.8" />
            <circle cx="91" cy="123" r="1.4" />
            <circle cx="129" cy="117" r="2.8" />
            <circle cx="135" cy="123" r="1.4" />
          </g>
        </g>
        <path d={focused ? 'M102 137 Q110 144 118 137' : 'M99 136 Q110 147 121 136'}
          fill="none" stroke="#422B27" strokeWidth="3.8" strokeLinecap="round" />
        {focused && (
          <g opacity=".95">
            <g fill="#FFF" fillOpacity=".22" stroke="#6B4C43" strokeWidth="3">
              <circle cx="88" cy="120" r="13.5" />
              <circle cx="132" cy="120" r="13.5" />
              <path d="M101.5 120 H118.5" />
            </g>
            <g transform="translate(152 138) rotate(12)">
              <rect width="26" height="20" rx="4" fill="#FFFDF5" stroke="#5E433B" strokeWidth="2.5" />
              <path d="M13 2 V18" stroke="#D1C1B8" strokeWidth="2" />
              <path d="M4 7 H10" stroke="#FF8A7A" strokeWidth="2" strokeLinecap="round" />
              <path d="M16 7 H22" stroke="#68D391" strokeWidth="2" strokeLinecap="round" />
            </g>
          </g>
        )}
      </g>
    </svg>
  )
}
