'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { MathImageKind } from '@rosie/math/constants'
import {
  deleteMathProblemImage,
  fetchLessonProblemImages,
  getMathImagePublicUrl,
  invalidateLessonImageCache,
  uploadMathProblemImage,
  type MathProblemImage,
} from '@rosie/math/hooks/useMathProblemImages'

export function useMathProblemImagesAdmin(user: User | null, lessonId: string | null) {
  const [images, setImages] = useState<MathProblemImage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const reload = useCallback(async () => {
    if (!lessonId) {
      setImages([])
      return
    }
    setIsLoading(true)
    const rows = await fetchLessonProblemImages(lessonId)
    setImages(rows)
    setIsLoading(false)
  }, [lessonId])

  useEffect(() => {
    void reload()
  }, [reload])

  const getImageUrl = useCallback((storagePath: string) => getMathImagePublicUrl(storagePath), [])

  const findImage = useCallback(
    (problemId: string, kind: MathImageKind): MathProblemImage | undefined =>
      images.find((img) => img.problemId === problemId && img.imageKind === kind),
    [images],
  )

  const uploadImage = useCallback(
    async (
      problemId: string,
      kind: MathImageKind,
      file: File,
    ): Promise<{ error: string | null }> => {
      if (!user || !lessonId) return { error: '请先登录并选择讲次' }
      setIsUploading(true)
      const { error, image } = await uploadMathProblemImage(user.id, lessonId, problemId, kind, file)
      setIsUploading(false)
      if (error || !image) return { error: error ?? '上传失败' }
      setImages((prev) => {
        const next = prev.filter(
          (row) => !(row.problemId === image.problemId && row.imageKind === image.imageKind),
        )
        return [...next, image]
      })
      invalidateLessonImageCache(lessonId)
      return { error: null }
    },
    [user, lessonId],
  )

  const removeImage = useCallback(
    async (image: MathProblemImage): Promise<{ error: string | null }> => {
      const { error } = await deleteMathProblemImage(image)
      if (error) return { error }
      setImages((prev) =>
        prev.filter(
          (row) =>
            !(
              row.problemId === image.problemId &&
              row.imageKind === image.imageKind &&
              row.lessonId === image.lessonId
            ),
        ),
      )
      invalidateLessonImageCache(image.lessonId)
      return { error: null }
    },
    [],
  )

  return {
    images,
    isLoading,
    isUploading,
    reload,
    getImageUrl,
    findImage,
    uploadImage,
    removeImage,
  }
}
