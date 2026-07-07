'use client'

import { supabase } from '@rosie/core'
import {
  MATH_IMAGES_BUCKET,
  type MathImageKind,
  lessonSummaryContentImagePath,
  problemNoteContentImagePath,
  mathImageStoragePath,
} from '@rosie/math/constants'

type RawRow = {
  lesson_id: string
  problem_id: string
  image_kind: string
  storage_path: string
  user_id: string
  updated_at: string
}

export type MathProblemImage = {
  lessonId: string
  problemId: string
  imageKind: MathImageKind
  storagePath: string
  userId: string
  updatedAt: string
}

function rowToImage(r: RawRow): MathProblemImage {
  return {
    lessonId: r.lesson_id,
    problemId: r.problem_id,
    imageKind: r.image_kind as MathImageKind,
    storagePath: r.storage_path,
    userId: r.user_id,
    updatedAt: r.updated_at,
  }
}

function imageKey(problemId: string, kind: MathImageKind): string {
  return `${problemId}:${kind}`
}

type LessonImageMap = Map<string, string>

const lessonCache = new Map<string, Promise<LessonImageMap>>()

export function invalidateLessonImageCache(lessonId?: string): void {
  if (lessonId) {
    lessonCache.delete(lessonId)
    return
  }
  lessonCache.clear()
}

export function getMathImagePublicUrl(storagePath: string): string {
  const { data } = supabase.storage.from(MATH_IMAGES_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

async function fetchLessonImageMap(lessonId: string): Promise<LessonImageMap> {
  const { data, error } = await supabase
    .from('math_problem_images')
    .select('lesson_id, problem_id, image_kind, storage_path, user_id, updated_at')
    .eq('lesson_id', lessonId)

  const map: LessonImageMap = new Map()
  if (error || !data) return map

  for (const row of data as RawRow[]) {
    const img = rowToImage(row)
    map.set(imageKey(img.problemId, img.imageKind), img.storagePath)
  }
  return map
}

export function loadLessonImageMap(lessonId: string): Promise<LessonImageMap> {
  const existing = lessonCache.get(lessonId)
  if (existing) return existing

  const promise = fetchLessonImageMap(lessonId)
  lessonCache.set(lessonId, promise)
  return promise
}

export async function fetchAllMathProblemImages(): Promise<MathProblemImage[]> {
  const { data, error } = await supabase
    .from('math_problem_images')
    .select('lesson_id, problem_id, image_kind, storage_path, user_id, updated_at')
    .order('lesson_id')
    .order('problem_id')

  if (error || !data) return []
  return (data as RawRow[]).map(rowToImage)
}

export async function fetchLessonProblemImages(lessonId: string): Promise<MathProblemImage[]> {
  const { data, error } = await supabase
    .from('math_problem_images')
    .select('lesson_id, problem_id, image_kind, storage_path, user_id, updated_at')
    .eq('lesson_id', lessonId)
    .order('problem_id')

  if (error || !data) return []
  return (data as RawRow[]).map(rowToImage)
}

export async function uploadMathProblemImage(
  userId: string,
  lessonId: string,
  problemId: string,
  kind: MathImageKind,
  file: File,
): Promise<{ error: string | null; image: MathProblemImage | null }> {
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase()
  if (!['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    return { error: '仅支持 PNG / JPG / WEBP / GIF', image: null }
  }

  const storagePath = mathImageStoragePath(kind, lessonId, problemId, ext === 'jpeg' ? 'jpg' : ext)

  const { error: storageErr } = await supabase.storage
    .from(MATH_IMAGES_BUCKET)
    .upload(storagePath, file, { upsert: true, contentType: file.type || undefined })

  if (storageErr) return { error: storageErr.message, image: null }

  const updatedAt = new Date().toISOString()
  const { data, error: upsertErr } = await supabase
    .from('math_problem_images')
    .upsert(
      {
        lesson_id: lessonId,
        problem_id: problemId,
        image_kind: kind,
        storage_path: storagePath,
        user_id: userId,
        updated_at: updatedAt,
      },
      { onConflict: 'lesson_id,problem_id,image_kind' },
    )
    .select()
    .single()

  if (upsertErr || !data) {
    await supabase.storage.from(MATH_IMAGES_BUCKET).remove([storagePath])
    return { error: upsertErr?.message ?? '保存失败', image: null }
  }

  invalidateLessonImageCache(lessonId)
  return { error: null, image: rowToImage(data as RawRow) }
}

/** Move an uploaded image between analysis ↔ figure without re-cropping. */
export async function changeMathProblemImageKind(
  image: MathProblemImage,
  targetKind: MathImageKind,
): Promise<{ error: string | null; image: MathProblemImage | null }> {
  if (image.imageKind === targetKind) return { error: null, image }

  const ext = (image.storagePath.split('.').pop() ?? 'png').toLowerCase()
  const newPath = mathImageStoragePath(targetKind, image.lessonId, image.problemId, ext)

  const { data: blob, error: downloadErr } = await supabase.storage
    .from(MATH_IMAGES_BUCKET)
    .download(image.storagePath)

  if (downloadErr || !blob) {
    return { error: downloadErr?.message ?? '读取原图失败', image: null }
  }

  const { error: uploadErr } = await supabase.storage
    .from(MATH_IMAGES_BUCKET)
    .upload(newPath, blob, { upsert: true, contentType: blob.type || undefined })

  if (uploadErr) return { error: uploadErr.message, image: null }

  const updatedAt = new Date().toISOString()
  const { data, error: upsertErr } = await supabase
    .from('math_problem_images')
    .upsert(
      {
        lesson_id: image.lessonId,
        problem_id: image.problemId,
        image_kind: targetKind,
        storage_path: newPath,
        user_id: image.userId,
        updated_at: updatedAt,
      },
      { onConflict: 'lesson_id,problem_id,image_kind' },
    )
    .select()
    .single()

  if (upsertErr || !data) {
    await supabase.storage.from(MATH_IMAGES_BUCKET).remove([newPath])
    return { error: upsertErr?.message ?? '保存失败', image: null }
  }

  await supabase.storage.from(MATH_IMAGES_BUCKET).remove([image.storagePath])
  await supabase
    .from('math_problem_images')
    .delete()
    .eq('lesson_id', image.lessonId)
    .eq('problem_id', image.problemId)
    .eq('image_kind', image.imageKind)

  invalidateLessonImageCache(image.lessonId)
  return { error: null, image: rowToImage(data as RawRow) }
}

export async function deleteMathProblemImage(image: MathProblemImage): Promise<{ error: string | null }> {
  await supabase.storage.from(MATH_IMAGES_BUCKET).remove([image.storagePath])

  const { error } = await supabase
    .from('math_problem_images')
    .delete()
    .eq('lesson_id', image.lessonId)
    .eq('problem_id', image.problemId)
    .eq('image_kind', image.imageKind)

  if (error) return { error: error.message }

  invalidateLessonImageCache(image.lessonId)
  return { error: null }
}

export function resolveStoredImageUrl(
  map: LessonImageMap,
  problemId: string,
  kind: MathImageKind,
): string | null {
  const path = map.get(imageKey(problemId, kind))
  return path ? getMathImagePublicUrl(path) : null
}

const ACCEPTED_IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif'])

/** Upload an inline image for lesson summary rich text (storage only, no DB row). */
export async function uploadLessonSummaryContentImage(
  lessonId: string,
  file: File,
): Promise<{ error: string | null; url: string | null }> {
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase()
  if (!ACCEPTED_IMAGE_EXT.has(ext)) {
    return { error: '仅支持 PNG / JPG / WEBP / GIF', url: null }
  }

  const imageId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const storagePath = lessonSummaryContentImagePath(
    lessonId,
    imageId,
    ext === 'jpeg' ? 'jpg' : ext,
  )

  const { error } = await supabase.storage
    .from(MATH_IMAGES_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: file.type || undefined })

  if (error) return { error: error.message, url: null }
  return { error: null, url: getMathImagePublicUrl(storagePath) }
}

/** Upload an inline image for a problem note rich-text body (storage only). */
export async function uploadProblemNoteContentImage(
  lessonId: string,
  problemId: string,
  file: File,
): Promise<{ error: string | null; url: string | null }> {
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase()
  if (!ACCEPTED_IMAGE_EXT.has(ext)) {
    return { error: '仅支持 PNG / JPG / WEBP / GIF', url: null }
  }

  const imageId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const storagePath = problemNoteContentImagePath(
    lessonId,
    problemId,
    imageId,
    ext === 'jpeg' ? 'jpg' : ext,
  )

  const { error } = await supabase.storage
    .from(MATH_IMAGES_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: file.type || undefined })

  if (error) return { error: error.message, url: null }
  return { error: null, url: getMathImagePublicUrl(storagePath) }
}
