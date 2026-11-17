'use client'

import { useId } from 'react'
import './rainbow.css'

export const RAINBOW_COLORS = ['#ff6685', '#ffab48', '#ffe26a', '#7cdb87', '#64cffa', '#8e9cff', '#ce8df4']

/** Shared SVG artwork: coordinates are centered on the fruit, like AppleShape. */
export default function RainbowAppleArt() {
  const fillId = useId()
  return (
    <g className="tg-prize-fruit">
      {/* visual-ok: 彩虹果插画 */}
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0.7" y2="1">
          {RAINBOW_COLORS.map((color, index) => <stop key={color} offset={`${index * 100 / 6}%`} stopColor={color} />)}
        </linearGradient>
      </defs>
      <circle r="24" fill="#fff1b8" opacity="0.65" />
      <g className="tg-prize-orbit" fill="none" strokeWidth="2.8" strokeLinecap="round">
        {RAINBOW_COLORS.map((color, index) => (
          <circle key={color} r="26" stroke={color} strokeDasharray="17 147" transform={`rotate(${index * 360 / 7})`} />
        ))}
      </g>
      <g className="tg-prize-sparkles" fill="#fff3a1" stroke="#bd7413" strokeWidth="0.7">
        <path d="M-26 -21 l2 -5 2 5 5 2 -5 2 -2 5 -2 -5 -5 -2Z" />
        <path d="M24 -15 l2 -5 2 5 5 2 -5 2 -2 5 -2 -5 -5 -2Z" />
        <path d="M18 24 l1.5 -4 1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5Z" />
      </g>
      <path d="M0 -10 C-18 -20 -23 0 -14 13 C-8 22 -3 17 0 18 C4 17 9 22 15 12 C24 -2 17 -20 0 -10Z"
        fill={`url(#${fillId})`} stroke="#77378d" strokeWidth="2" strokeLinejoin="round" />
      <path d="M0 -10 Q1 -18 5 -21" fill="none" stroke="#704024" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M3 -16 Q12 -25 17 -15 Q9 -11 3 -16Z" fill="#8de080" stroke="#287141" strokeWidth="1.2" />
      <ellipse cx="-9" cy="-4" rx="3" ry="6" fill="white" opacity="0.8" transform="rotate(20 -9 -4)" />
      <path d="M0 -4 l1.8 4.5 4.8 .3 -3.7 3 1.2 4.7 -4.1 -2.6 -4.1 2.6 1.2 -4.7 -3.7 -3 4.8 -.3Z"
        fill="#fff8d6" stroke="#a86510" strokeWidth="0.8" />
    </g>
  )
}
