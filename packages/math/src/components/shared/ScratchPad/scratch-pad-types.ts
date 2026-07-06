export type ScratchPoint = { x: number; y: number }

export type ScratchTool =
  | 'select-box'
  | 'select-lasso'
  | 'pen'
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
}

export type ScratchEllipseObject = ScratchObjectBase & {
  kind: 'ellipse'
  cx: number
  cy: number
  rx: number
  ry: number
}

export type ScratchTriangleObject = ScratchObjectBase & {
  kind: 'triangle'
  x1: number
  y1: number
  x2: number
  y2: number
  x3: number
  y3: number
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
