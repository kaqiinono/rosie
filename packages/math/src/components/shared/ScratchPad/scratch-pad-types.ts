export type ScratchPoint = { x: number; y: number }

export type ScratchTool =
  | 'select-box'
  | 'select-lasso'
  | 'pan'
  | 'pen'
  | 'highlighter'
  | 'line'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'eraser'

export type ScratchStrokeWidth = 2 | 4 | 8

export type ScratchColorId =
  | 'slate'
  | 'indigo'
  | 'sky'
  | 'emerald'
  | 'rose'
  | 'amber'
  | 'violet'
  | 'coral'

export const SCRATCH_COLORS: ReadonlyArray<{ id: ScratchColorId; hex: string; label: string }> = [
  { id: 'slate', hex: '#334155', label: '墨' },
  { id: 'indigo', hex: '#6366f1', label: '靛' },
  { id: 'sky', hex: '#0ea5e9', label: '天' },
  { id: 'emerald', hex: '#10b981', label: '翠' },
  { id: 'rose', hex: '#f43f5e', label: '玫' },
  { id: 'amber', hex: '#f59e0b', label: '杏' },
  { id: 'violet', hex: '#8b5cf6', label: '紫' },
  { id: 'coral', hex: '#fb7185', label: '珊' },
] as const

export const SCRATCH_STROKE_WIDTHS: ScratchStrokeWidth[] = [2, 4, 8]

export type ScratchHighlightColorId = 'yellow' | 'green' | 'pink' | 'blue'

export const SCRATCH_HIGHLIGHT_COLORS: ReadonlyArray<{
  id: ScratchHighlightColorId
  hex: string
  label: string
}> = [
  { id: 'yellow', hex: '#fde047', label: '黄' },
  { id: 'green', hex: '#86efac', label: '绿' },
  { id: 'pink', hex: '#f9a8d4', label: '粉' },
  { id: 'blue', hex: '#93c5fd', label: '蓝' },
] as const

export type ScratchHighlightWidth = 16 | 24 | 36

export const SCRATCH_HIGHLIGHT_WIDTHS: ScratchHighlightWidth[] = [16, 24, 36]

/** 荧光笔不透明度 */
export const SCRATCH_HIGHLIGHT_ALPHA = 0.42

/** 图形半透明填充不透明度 */
export const SCRATCH_SHAPE_FILL_ALPHA = 0.28

export type ScratchTriangleVariant = 'right' | 'isosceles' | 'equilateral'

export const SCRATCH_TRIANGLE_VARIANTS: ReadonlyArray<{
  id: ScratchTriangleVariant
  label: string
}> = [
  { id: 'right', label: '直角' },
  { id: 'isosceles', label: '等腰' },
  { id: 'equilateral', label: '等边' },
] as const

/** 橡皮擦半径（px），比画笔更粗 */
export type ScratchEraserWidth = 12 | 24 | 40

export const SCRATCH_ERASER_WIDTHS: ScratchEraserWidth[] = [12, 24, 40]

type ScratchObjectBase = {
  id: string
  color: string
  lineWidth: number
}

export type ScratchStrokeObject = ScratchObjectBase & {
  kind: 'stroke'
  points: ScratchPoint[]
}

export type ScratchHighlightObject = ScratchObjectBase & {
  kind: 'highlight'
  points: ScratchPoint[]
}

export type ScratchLineObject = ScratchObjectBase & {
  kind: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
}

export type ScratchRectObject = ScratchObjectBase & {
  kind: 'rect'
  x: number
  y: number
  w: number
  h: number
  filled?: boolean
}

export type ScratchEllipseObject = ScratchObjectBase & {
  kind: 'ellipse'
  cx: number
  cy: number
  rx: number
  ry: number
  filled?: boolean
}

export type ScratchTriangleObject = ScratchObjectBase & {
  kind: 'triangle'
  x1: number
  y1: number
  x2: number
  y2: number
  x3: number
  y3: number
  filled?: boolean
}

/** 题面图 / 导入图片 */
export type ScratchImageObject = {
  id: string
  kind: 'image'
  src: string
  x: number
  y: number
  w: number
  h: number
}

export type ScratchObject =
  | ScratchStrokeObject
  | ScratchHighlightObject
  | ScratchLineObject
  | ScratchRectObject
  | ScratchEllipseObject
  | ScratchTriangleObject
  | ScratchImageObject

export type ScratchBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type ScratchSnapshot = {
  objects: ScratchObject[]
  selectedIds: string[]
}
