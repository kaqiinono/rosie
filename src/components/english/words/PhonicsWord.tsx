'use client'

import { buildPhonicsSegments, type PhonicsSegment } from '@/utils/phonics'

interface PhonicsWordProps {
  text: string
  className?: string
}

function SegmentSpan({ seg }: { seg: PhonicsSegment }) {
  return (
    <>
      {seg.syllableDotBefore && (
        <span className="text-white/25 text-[0.42em] align-middle mx-px font-black">·</span>
      )}
      {seg.magicArcStart && (
        <span className="relative inline-flex items-end pt-3">
          <span className={seg.cls}>{seg.text}</span>
        </span>
      )}
      {!seg.magicArcStart && !seg.magicArcEnd && (
        <span className={seg.cls}>{seg.text}</span>
      )}
      {seg.magicArcEnd && (
        <>
          <span className={seg.cls}>{seg.text}</span>
          <svg
            className="absolute top-0 left-0 w-full h-3 pointer-events-none overflow-visible"
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
        </>
      )}
    </>
  )
}

export default function PhonicsWord({ text, className = '' }: PhonicsWordProps) {
  const wordGroups = buildPhonicsSegments(text)
  const hasMagic = wordGroups.some(group =>
    group.some(s => s.magicArcStart || s.magicArcEnd)
  )

  return (
    <span className={className}>
      {wordGroups.map((group, gi) => (
        <span key={gi}>
          {gi > 0 && <span className="ph-plain"> </span>}
          {hasMagic ? (
            <span className="relative inline-flex items-end pt-3">
              {group.map((seg, si) => (
                <SegmentSpan key={si} seg={seg} />
              ))}
            </span>
          ) : (
            group.map((seg, si) => (
              <SegmentSpan key={si} seg={seg} />
            ))
          )}
        </span>
      ))}
    </span>
  )
}
