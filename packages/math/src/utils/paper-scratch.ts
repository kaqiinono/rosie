'use client'

import { supabase } from '@rosie/core'
import {
  MATH_IMAGES_BUCKET,
  lessonIdFromProblemId,
  scratchDraftImagePath,
} from '@rosie/math/constants'
import type {
  ScratchImageObject,
  ScratchObject,
} from '@rosie/math/components/shared/ScratchPad/scratch-pad-types'
import {
  fitFigureLayout,
  loadHtmlImage,
} from '@rosie/math/components/shared/ScratchPad/scratch-pad-figure'
import {
  fetchScratchWorking,
  insertPracticeAttempt,
  insertScratchDraft,
  upsertScratchWorking,
  upsertWrongWithAttempt,
} from '@rosie/math/utils/math-scratch-db'
import { submitPracticeAttempt } from '@rosie/math/utils/submitPracticeAttempt'
import { getMathImagePublicUrl } from '@rosie/math/hooks/useMathProblemImages'

export const SCRATCH_WORKING_CANVAS = { width: 390, height: 700 }

/** Stored in `math_scratch_working.answer_draft` when paper photos are uploaded. */
export const PAPER_MARKED_CORRECT_KEY = '__paperMarkedCorrect'

const ACCEPTED_IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif'])

function normalizeImageExt(file: File): string | null {
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase()
  if (ext === 'jpeg') return 'jpg'
  if (!ACCEPTED_IMAGE_EXT.has(ext)) return null
  return ext
}

export function mergePaperMarkedCorrect(answerDraft: unknown, correct: boolean): Record<string, unknown> {
  if (answerDraft && typeof answerDraft === 'object' && !Array.isArray(answerDraft)) {
    return { ...(answerDraft as Record<string, unknown>), [PAPER_MARKED_CORRECT_KEY]: correct }
  }
  return { [PAPER_MARKED_CORRECT_KEY]: correct }
}

export function readPaperMarkedCorrect(answerDraft: unknown): boolean | null {
  if (answerDraft && typeof answerDraft === 'object' && !Array.isArray(answerDraft)) {
    const v = (answerDraft as Record<string, unknown>)[PAPER_MARKED_CORRECT_KEY]
    if (typeof v === 'boolean') return v
  }
  return null
}

export function workingHasPaperImages(objects: ScratchObject[]): boolean {
  return objects.some((o) => o.kind === 'image')
}

function newScratchObjectId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function uploadScratchDraftImage(
  lessonId: string,
  problemId: string,
  file: File,
): Promise<{ error: string | null; url: string | null }> {
  const ext = normalizeImageExt(file)
  if (!ext) return { error: '仅支持 PNG / JPG / WEBP / GIF', url: null }

  const imageId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const storagePath = scratchDraftImagePath(lessonId, problemId, imageId, ext)

  const { error } = await supabase.storage
    .from(MATH_IMAGES_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: file.type || undefined })

  if (error) return { error: error.message, url: null }
  return { error: null, url: getMathImagePublicUrl(storagePath) }
}

export async function loadImageNaturalSize(src: string): Promise<{ width: number; height: number }> {
  const img = await loadHtmlImage(src)
  return { width: img.naturalWidth, height: img.naturalHeight }
}

export function createScratchImageObject(
  src: string,
  naturalW: number,
  naturalH: number,
  existingImageCount: number,
  canvasW = SCRATCH_WORKING_CANVAS.width,
  canvasH = SCRATCH_WORKING_CANVAS.height,
): ScratchImageObject {
  const layout = fitFigureLayout(naturalW, naturalH, canvasW, canvasH)
  const offset = existingImageCount * 20
  return {
    id: newScratchObjectId(),
    kind: 'image',
    src,
    x: layout.x + offset,
    y: layout.y + offset,
    w: layout.w,
    h: layout.h,
  }
}

export function createFullScratchImageObject(
  src: string,
  naturalW: number,
  naturalH: number,
): ScratchImageObject {
  return {
    id: newScratchObjectId(),
    kind: 'image',
    src,
    x: 0,
    y: 0,
    w: naturalW,
    h: naturalH,
  }
}

/** Detail page / scratch pad: append photo to in-progress working (not archived yet). */
export async function appendPaperImageToWorking(
  userId: string,
  problemId: string,
  file: File,
  paperMarkedCorrect: boolean,
  paperId: string | null = null,
): Promise<{ error: string | null }> {
  const lessonId = lessonIdFromProblemId(problemId)
  const { error, url } = await uploadScratchDraftImage(lessonId, problemId, file)
  if (error || !url) return { error: error ?? '上传失败' }

  const { width, height } = await loadImageNaturalSize(url)
  const row = await fetchScratchWorking(userId, problemId, paperId)
  const existing = row?.objects ?? []
  const imageCount = existing.filter((o) => o.kind === 'image').length
  const imageObj = createScratchImageObject(url, width, height, imageCount)
  const answerDraft = mergePaperMarkedCorrect(row?.answerDraft ?? null, paperMarkedCorrect)

  await upsertScratchWorking(userId, problemId, paperId, [...existing, imageObj], answerDraft)
  return { error: null }
}

/** Archive in-progress paper working using the marked 对/错 (no app answer check). */
export async function submitPaperWorkingArchive(input: {
  userId: string
  problemId: string
  section: string
  paperId?: string | null
}): Promise<{ error: string | null; correct: boolean | null }> {
  const row = await fetchScratchWorking(input.userId, input.problemId, input.paperId ?? null)
  if (!row?.objects?.length || !workingHasPaperImages(row.objects)) {
    return { error: '没有可提交的纸质草稿', correct: null }
  }
  const marked = readPaperMarkedCorrect(row.answerDraft)
  if (marked === null) {
    return { error: '请先标记这次练习做对或做错', correct: null }
  }

  await submitPracticeAttempt({
    userId: input.userId,
    problem: { id: input.problemId } as import('@rosie/core').Problem,
    section: input.section,
    correct: marked,
    objects: row.objects,
    answerSnapshot: row.answerDraft,
    paperId: input.paperId ?? null,
  })

  return { error: null, correct: marked }
}

/** Admin slice matcher: archive paper draft directly (skip working). */
export async function submitArchivedPaperScratchDraft(input: {
  userId: string
  problemId: string
  blob: Blob
  correct: boolean
  section?: string
}): Promise<{ error: string | null }> {
  const lessonId = lessonIdFromProblemId(input.problemId)
  const file = new File([input.blob], `${input.problemId}.png`, { type: 'image/png' })
  const { error, url } = await uploadScratchDraftImage(lessonId, input.problemId, file)
  if (error || !url) return { error: error ?? '上传失败' }

  const { width, height } = await loadImageNaturalSize(url)
  const objects: ScratchObject[] = [createFullScratchImageObject(url, width, height)]
  const section = input.section ?? 'paper'

  const draftId = await insertScratchDraft(input.userId, input.problemId, section, objects)
  if (!draftId) return { error: '草稿保存失败' }

  const attemptId = await insertPracticeAttempt(
    input.userId,
    input.problemId,
    section,
    input.correct,
    draftId,
    null,
    null,
  )

  if (!input.correct) {
    await upsertWrongWithAttempt(input.userId, input.problemId, attemptId)
  } else {
    const now = new Date().toISOString()
    await supabase
      .from('math_wrong')
      .update({ resolved: true, resolved_at: now })
      .eq('user_id', input.userId)
      .eq('problem_id', input.problemId)
  }

  return { error: null }
}
