'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { MathImageKind } from '@rosie/math/constants'
import { lessonIdFromProblemId } from '@rosie/math/constants'
import {
  deleteMathProblemImage,
  changeMathProblemImageKind,
  fetchLessonProblemImages,
  getMathImagePublicUrl,
  invalidateLessonImageCache,
  uploadMathProblemImage,
  type MathProblemImage,
} from '@rosie/math/hooks/useMathProblemImages'

function normalizeLessonIds(lessonId: string | string[] | null): string[] {
  if (lessonId === null) return []
  return Array.isArray(lessonId) ? lessonId : [lessonId]
}

export function useMathProblemImagesAdmin(user: User | null, lessonId: string | string[] | null) {
  const lessonIds = normalizeLessonIds(lessonId)
  const lessonIdsKey = lessonIds.join(',')

  const [images, setImages] = useState<MathProblemImage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const reload = useCallback(async () => {
    const ids = lessonIdsKey ? lessonIdsKey.split(',') : []
    if (ids.length === 0) {
      setImages([])
      return
    }
    setIsLoading(true)
    const rows = await Promise.all(ids.map(fetchLessonProblemImages))
    setImages(rows.flat())
    setIsLoading(false)
  }, [lessonIdsKey])

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
      if (!user || lessonIds.length === 0) return { error: '请先登录并选择讲次' }
      const targetLessonId = lessonIdFromProblemId(problemId)
      setIsUploading(true)
      const { error, image } = await uploadMathProblemImage(
        user.id,
        targetLessonId,
        problemId,
        kind,
        file,
      )
      setIsUploading(false)
      if (error || !image) return { error: error ?? '上传失败' }
      setImages((prev) => {
        const next = prev.filter(
          (row) => !(row.problemId === image.problemId && row.imageKind === image.imageKind),
        )
        return [...next, image]
      })
      invalidateLessonImageCache(targetLessonId)
      return { error: null }
    },
    [user, lessonIdsKey, lessonIds.length],
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

  const moveImageKind = useCallback(
    async (
      image: MathProblemImage,
      targetKind: MathImageKind,
    ): Promise<{ error: string | null }> => {
      const { error, image: moved } = await changeMathProblemImageKind(image, targetKind)
      if (error || !moved) return { error: error ?? '移动失败' }
      setImages((prev) => {
        const without = prev.filter(
          (row) =>
            !(
              row.problemId === image.problemId &&
              row.lessonId === image.lessonId &&
              (row.imageKind === image.imageKind || row.imageKind === targetKind)
            ),
        )
        return [...without, moved]
      })
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
    moveImageKind,
  }
}
