'use client'

import type { ComponentProps, CSSProperties } from 'react'
import type { Material } from '../types/content'
import { ExamMaterialBlocks } from './ExamMaterialBlocks'
import { useExamImageFocus } from './ExamImageFocusContext'

/** Explicit source relationships; legacy materials retain their ordered blocks. */
export function ExamReadingMaterial({ material, ...props }: {
  material: Material
} & Omit<ComponentProps<typeof ExamMaterialBlocks>, 'blocks'>) {
  const { expanded } = useExamImageFocus()
  if (!material.layout) return <ExamMaterialBlocks blocks={material.blocks} {...props} />
  const blocks = (ids: readonly string[]) => ids.flatMap(id => material.blocks.filter(block => block.id === id))
  return <div className="@container"><div className="flex flex-col gap-6">
    {material.layout.map(row => {
      const image = material.blocks.find(block => block.id === row.imageBlockId)
      const width = image?.kind === 'image' ? image.displayWidth ?? 192 : 192
      return <section key={row.id} className="flex flex-col gap-3" style={{ '--exam-image-width': `${width}px` } as CSSProperties}>
      {row.headingBlockId && <ExamMaterialBlocks blocks={blocks([row.headingBlockId])} {...props} />}
      {row.imageBlockId ? <div className={expanded ? 'grid grid-cols-1 gap-5' : row.imageSide === 'left'
        ? 'grid items-start gap-5 @[36rem]:grid-cols-[min(45%,var(--exam-image-width))_minmax(0,1fr)]'
        : 'grid items-start gap-5 @[36rem]:grid-cols-[minmax(0,1fr)_min(45%,var(--exam-image-width))]'}>
        <div style={{ maxWidth: expanded ? undefined : width }} className={`w-full justify-self-center ${!expanded && row.imageSide === 'right' ? '@[36rem]:order-2' : ''}`}>
          <ExamMaterialBlocks blocks={blocks([row.imageBlockId])} {...props} />
        </div>
        <div className="min-w-0"><ExamMaterialBlocks blocks={blocks(row.bodyBlockIds)} {...props} /></div>
      </div> : <ExamMaterialBlocks blocks={blocks(row.bodyBlockIds)} {...props} />}
    </section>})}
  </div></div>
}
