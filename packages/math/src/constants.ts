/** Supabase Storage bucket for uploaded math problem images. */
export const MATH_IMAGES_BUCKET = 'math'

export type MathImageKind = 'analysis' | 'figure' | 'summary'

export const MATH_IMAGE_KIND_LABEL: Record<MathImageKind, string> = {
  analysis: '题解图',
  figure: '题面图',
  summary: '内容总结图',
}

/** localStorage key for admin upload / PDF-slice default kind */
export const MATH_IMAGE_DEFAULT_KIND_KEY = 'rosie.math.imageDefaultKind'

export function readPersistedImageKind(): MathImageKind {
  if (typeof window === 'undefined') return 'analysis'
  const v = window.localStorage.getItem(MATH_IMAGE_DEFAULT_KIND_KEY)
  return v === 'figure' ? 'figure' : 'analysis'
}

export function persistImageKind(kind: MathImageKind): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(MATH_IMAGE_DEFAULT_KIND_KEY, kind)
}

export const MATH_IMAGE_KIND_HINT: Record<MathImageKind, string> = {
  analysis: '显示在「查看题解」解析面板内',
  figure: '显示在题目文字下方（题干区）',
  summary: '显示在本讲首页（标题区下方）',
}

/** Sentinel problem id for per-lesson summary image rows in `math_problem_images`. */
export function lessonSummaryProblemId(lessonId: string): string {
  return `${lessonId}__SUMMARY`
}

export function isLessonSummaryProblemId(problemId: string): boolean {
  return problemId.endsWith('__SUMMARY')
}

/** Storage object path, e.g. `analysis/41/41-P5.png` or `summaries/52/summary.png`. */
export function mathImageStoragePath(
  kind: MathImageKind,
  lessonId: string,
  problemId: string,
  ext: string,
): string {
  if (kind === 'summary') {
    return `summaries/${lessonId}/summary.${ext}`
  }
  const folder = kind === 'analysis' ? 'analysis' : 'figures'
  return `${folder}/${lessonId}/${problemId}.${ext}`
}

/** Parse lesson id from problem id like `41-P5` → `41`. */
export function lessonIdFromProblemId(problemId: string): string {
  return problemId.split('-')[0] ?? problemId
}
