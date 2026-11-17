'use client'

import { useState } from 'react'
import { StickerCard } from '@rosie/ui'
import { Flex, Text } from '@rosie/ui/themes'
import { useExamImageFocus } from './ExamImageFocusContext'

/** Reserve the authored footprint through loading, missing media and failures. */
export function ExamMaterialImage({ src, alt, aspectRatio, message, displayWidth }: {
  src?: string | null; alt: string; aspectRatio?: number; message?: string; displayWidth?: number
}) {
  const [loaded, setLoaded] = useState<string | null>(null)
  const { expanded } = useExamImageFocus()
  const [intrinsic, setIntrinsic] = useState<{ src: string; ratio: number } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const ready = !!src && loaded === src && failed !== src
  return <div className="relative w-full" style={{ maxWidth: expanded ? undefined : displayWidth, aspectRatio: aspectRatio ?? (intrinsic && intrinsic.src === src ? intrinsic.ratio : 4 / 3) }}>
    {!ready && <StickerCard tone="paper" elevation="flat" size="sm" className="absolute inset-0 flex items-center justify-center">
      <Flex direction="column" gap="2" align="center">
        <Text size="2" role="status">{message ?? (!src ? '图片待补充' : failed === src ? '图片暂时无法读取' : '正在读取图片…')}</Text>
        <Text size="2" align="center">{alt}</Text>
      </Flex>
    </StickerCard>}
    {/* eslint-disable-next-line @next/next/no-img-element -- authenticated exam media URL */}
    {src && failed !== src && <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-contain"
      hidden={!ready} onLoad={event => {
        const image = event.currentTarget
        if (image.naturalWidth && image.naturalHeight) setIntrinsic({ src, ratio: image.naturalWidth / image.naturalHeight })
        setLoaded(src)
      }} onError={() => setFailed(src)} />}
  </div>
}
