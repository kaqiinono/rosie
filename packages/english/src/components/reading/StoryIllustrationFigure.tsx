'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { projectMediaUrl, supabase } from '@rosie/core'
import type { StoryIllustration } from '../../utils/story-types'

export default function StoryIllustrationFigure({ illustration }: { illustration: StoryIllustration }) {
  const figure = useRef<HTMLElement>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [originalOnly, setOriginalOnly] = useState(false)
  const [failed, setFailed] = useState(false)
  const { path, alt, width, height } = illustration

  useEffect(() => {
    const element = figure.current
    if (!element) return
    const controller = new AbortController()
    let objectUrl: string | undefined

    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('story_illustration_requires_session')
        const response = await fetch(projectMediaUrl('reading', path), {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            Accept: originalOnly ? 'image/*' : 'application/json, image/*',
          },
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!response.ok) throw new Error('story_illustration_unavailable')
        if (!originalOnly && response.headers.get('content-type')?.startsWith('application/json')) {
          const { url } = await response.json()
          if (!controller.signal.aborted) setImageUrl(url)
          return
        }
        const blob = await response.blob()
        if (!controller.signal.aborted) {
          objectUrl = URL.createObjectURL(blob)
          setImageUrl(objectUrl)
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true)
      }
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      void load()
    }, { rootMargin: '360px 0px' })
    observer.observe(element)
    return () => {
      observer.disconnect()
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [path, originalOnly])

  return (
    <figure ref={figure} className="mx-auto max-w-full" style={{ width, aspectRatio: width / height }}>
      {imageUrl && !failed ? (
        <Image src={imageUrl} alt={alt} width={width} height={height} unoptimized referrerPolicy="no-referrer"
          className="h-auto w-full rounded-xl" onError={() => {
            if (imageUrl.startsWith('blob:')) {
              setFailed(true)
            } else {
              setImageUrl(null)
              setOriginalOnly(true)
            }
          }} />
      ) : failed ? (
        <figcaption className="grid h-full place-items-center rounded-xl bg-kid-paper px-4 text-center text-sm text-text-secondary">
          {alt}（插图暂时无法加载）
        </figcaption>
      ) : null}
    </figure>
  )
}
