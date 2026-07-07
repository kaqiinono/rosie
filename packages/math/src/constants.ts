/** Supabase Storage bucket for uploaded math problem images. */
export const MATH_IMAGES_BUCKET = 'math'

export type MathImageKind = 'analysis' | 'figure' | 'summary'

export const MATH_IMAGE_KIND_LABEL: Record<MathImageKind, string> = {
  analysis: '题解图',
  figure: '题面图',
  summary: '内容总结',
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

/** 素材分片类型：题解/题面走 `math_problem_images`，笔记/总结走富文本，草稿走练习记录。 */
export type PdfSliceKind = 'analysis' | 'figure' | 'note' | 'summary' | 'draft'

export const PDF_SLICE_KINDS: PdfSliceKind[] = [
  'analysis',
  'figure',
  'note',
  'summary',
  'draft',
]

export const PDF_SLICE_KIND_LABEL: Record<PdfSliceKind, string> = {
  analysis: '题解图',
  figure: '题面图',
  note: '笔记',
  summary: '总结',
  draft: '草稿',
}

export const PDF_SLICE_KIND_HINT: Record<PdfSliceKind, string> = {
  analysis: '显示在「查看题解」解析面板内',
  figure: '显示在题目文字下方（题干区）',
  note: '插入到题目笔记（富文本插图）',
  summary: '插入到本讲内容总结（富文本插图）',
  draft: '补录纸上练习草稿；匹配题目后须标记做对/做错，再提交',
}

export function readPersistedPdfSliceKind(): PdfSliceKind {
  if (typeof window === 'undefined') return 'analysis'
  const v = window.localStorage.getItem(MATH_IMAGE_DEFAULT_KIND_KEY)
  if (v === 'figure' || v === 'note' || v === 'summary' || v === 'draft') return v
  return 'analysis'
}

export function persistPdfSliceKind(kind: PdfSliceKind): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(MATH_IMAGE_DEFAULT_KIND_KEY, kind)
}

export function isProblemBoundSliceKind(kind: PdfSliceKind): boolean {
  return kind === 'analysis' || kind === 'figure' || kind === 'note' || kind === 'draft'
}

export const MATH_IMAGE_KIND_HINT: Record<MathImageKind, string> = {
  analysis: '显示在「查看题解」解析面板内',
  figure: '显示在题目文字下方（题干区）',
  summary: '显示在本讲首页（标题区下方），支持加粗与列表',
}

/** Sentinel problem id for per-lesson summary rows in `math_problem_notes`. */
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

/** Inline image embedded in a lesson summary rich-text body. */
export function lessonSummaryContentImagePath(
  lessonId: string,
  imageId: string,
  ext: string,
): string {
  return `summaries/${lessonId}/content/${imageId}.${ext}`
}

/** Inline image embedded in a problem note rich-text body. */
export function problemNoteContentImagePath(
  lessonId: string,
  problemId: string,
  imageId: string,
  ext: string,
): string {
  return `notes/${lessonId}/${problemId}/${imageId}.${ext}`
}

/** Archived scratch draft image (paper practice photos). */
export function scratchDraftImagePath(
  lessonId: string,
  problemId: string,
  imageId: string,
  ext: string,
): string {
  return `drafts/${lessonId}/${problemId}/${imageId}.${ext}`
}

/** Parse lesson id from problem id like `41-P5` → `41`, or `52__SUMMARY` → `52`. */
export function lessonIdFromProblemId(problemId: string): string {
  if (isLessonSummaryProblemId(problemId)) {
    return problemId.slice(0, -'__SUMMARY'.length)
  }
  return problemId.split('-')[0] ?? problemId
}
