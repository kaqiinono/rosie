'use client'

import { forwardRef, memo } from 'react'

type FlipbookPageProps = {
  pageNumber: number
  /** Resolved URL; when set, show image (parent keeps URL stable after first load). */
  imageUrl: string | null
}

const FlipbookPage = memo(
  forwardRef<HTMLDivElement, FlipbookPageProps>(function FlipbookPage(
    { imageUrl, pageNumber },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className="flipbook-page-surface h-full w-full overflow-hidden"
        data-page={pageNumber}
      >
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- storage URLs */
          <img
            src={imageUrl}
            alt={`第 ${pageNumber} 页`}
            className="h-full w-full object-contain"
            draggable={false}
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-400">
            <span className="font-mono text-xs tracking-[0.2em] uppercase">
              {String(pageNumber).padStart(2, '0')}
            </span>
          </div>
        )}
      </div>
    )
  }),
)

FlipbookPage.displayName = 'FlipbookPage'

export default FlipbookPage
