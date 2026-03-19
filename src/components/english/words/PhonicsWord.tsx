'use client'

import { buildPhonicsSegments, type PhonicsSegment } from '@/utils/phonics'

interface PhonicsWordProps {
  text: string
  className?: string
}

function SimpleSpan({ seg }: { seg: PhonicsSegment }) {
  return (
    <>
      {seg.syllableDotBefore && (
        <span className="text-white/25 text-[0.42em] align-middle mx-px font-black">·</span>
      )}
      <span className={seg.cls}>{seg.text}</span>
    </>
  )
}

function GroupSpan({ group }: { group: PhonicsSegment[] }) {
  const arcStartIdx = group.findIndex(s => s.magicArcStart)
  const arcEndIdx   = group.findIndex(s => s.magicArcEnd)

  // No magic-E: render flat inline
  if (arcStartIdx === -1 || arcEndIdx === -1) {
    return (
      <>
        {group.map((seg, i) => <SimpleSpan key={i} seg={seg} />)}
      </>
    )
  }

  const before  = group.slice(0, arcStartIdx)
  const arcSegs = group.slice(arcStartIdx, arcEndIdx + 1)
  const after   = group.slice(arcEndIdx + 1)

  // Outer wrapper: pt-3 reserves space above ALL chars for the arc,
  // items-end aligns all chars at the same baseline.
  // Inner wrapper: positions the SVG over just the arcStart→arcEnd chars.
  // SVG uses top: -0.75rem to "climb back" into the outer pt-3 space.
  return (
    <span className="relative inline-flex items-end pt-3">
      {before.map((seg, i) => <SimpleSpan key={`b${i}`} seg={seg} />)}
      <span className="relative inline-flex items-end">
        {arcSegs.map((seg, i) => <SimpleSpan key={`a${i}`} seg={seg} />)}
        <svg
          className="absolute left-0 w-full h-3 pointer-events-none overflow-visible"
          style={{ top: '-0.75rem' }}
          viewBox="0 0 100 12"
          preserveAspectRatio="none"
        >
          <path
            d="M5,10 Q50,1 95,10"
            stroke="#f7dc6f"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {after.map((seg, i) => <SimpleSpan key={`c${i}`} seg={seg} />)}
    </span>
  )
}

export default function PhonicsWord({ text, className = '' }: PhonicsWordProps) {
  const wordGroups = buildPhonicsSegments(text)

  return (
    <span className={className}>
      {wordGroups.map((group, gi) => (
        <span key={gi}>
          {gi > 0 && <span className="ph-plain"> </span>}
          <GroupSpan group={group} />
        </span>
      ))}
    </span>
  )
}
