/** Supabase Storage bucket for uploaded math problem images. */
export const MATH_IMAGES_BUCKET = 'math'

export type MathImageKind = 'analysis' | 'figure'

export const MATH_IMAGE_KIND_LABEL: Record<MathImageKind, string> = {
  analysis: '题解图',
  figure: '题面图',
}

/** Storage object path, e.g. `analysis/41/41-P5.png`. */
export function mathImageStoragePath(
  kind: MathImageKind,
  lessonId: string,
  problemId: string,
  ext: string,
): string {
  const folder = kind === 'analysis' ? 'analysis' : 'figures'
  return `${folder}/${lessonId}/${problemId}.${ext}`
}

/** Parse lesson id from problem id like `41-P5` → `41`. */
export function lessonIdFromProblemId(problemId: string): string {
  return problemId.split('-')[0] ?? problemId
}
