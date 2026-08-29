import type { CalcProblemState, MixedOp } from '@rosie/core'
import { parseSignature, type AstNode } from './calc-ast'
import { addHasCarry, subHasBorrow } from './calc-block-gens'
import { BLOCKS } from './calc-blocks'
import { SKELETONS } from './calc-mixed'
import { learningStatusOf, type LearningStatus } from './calc-coverage'
import { hasIndependentAttempt } from './calc-evidence'

export interface StructureCell {
  key: string
  label: string
}

export interface StructureModel {
  id: string
  label: string
  group: 'add' | 'sub' | 'mul' | 'div' | 'decimal' | 'fraction' | 'mixed'
  version: string
  cells: StructureCell[]
  classify(signature: string): string[]
}

export interface StructureCellProgress extends StructureCell {
  covered: boolean
  fluent: boolean
  mastered: boolean
  reviewDue: boolean
  sampleSignatures: string[]
}

export interface StructureCoverage {
  id: string
  label: string
  group: StructureModel['group']
  version: string
  total: number
  covered: number
  fluent: number
  mastered: number
  reviewDue: number
  cells: StructureCellProgress[]
}

type NumericNode = { op: 'add' | 'sub' | 'mul' | 'div'; left: number; right: number }

function numericNode(signature: string): NumericNode | null {
  try {
    const ast = parseSignature(signature)
    if (typeof ast === 'number' || typeof ast.left !== 'number' || typeof ast.right !== 'number')
      return null
    return ast as NumericNode
  } catch {
    return null
  }
}

function band(value: number, min: number, max: number): 'low' | 'mid' | 'high' {
  const ratio = max <= min ? 0 : (value - min) / (max - min)
  if (ratio < 1 / 3) return 'low'
  if (ratio < 2 / 3) return 'mid'
  return 'high'
}

const BAND_CELLS: StructureCell[] = [
  { key: 'left:low', label: '左数·低段' },
  { key: 'left:mid', label: '左数·中段' },
  { key: 'left:high', label: '左数·高段' },
  { key: 'right:low', label: '右数·低段' },
  { key: 'right:mid', label: '右数·中段' },
  { key: 'right:high', label: '右数·高段' },
]

function numericRangeModel(config: {
  id: string
  label: string
  group: StructureModel['group']
  left: [number, number]
  right: [number, number]
  baseCells?: StructureCell[]
  extraCells?: StructureCell[]
  extras?: (node: NumericNode) => string[]
}): StructureModel {
  const cells = [...(config.baseCells ?? BAND_CELLS), ...(config.extraCells ?? [])]
  const declaredKeys = new Set(cells.map((cell) => cell.key))
  return {
    id: config.id,
    label: config.label,
    group: config.group,
    version: 'v1',
    cells,
    classify(signature) {
      const node = numericNode(signature)
      if (!node) return []
      return [
        `left:${band(node.left, ...config.left)}`,
        `right:${band(node.right, ...config.right)}`,
        ...(config.extras?.(node) ?? []),
      ].filter((key) => declaredKeys.has(key))
    },
  }
}

function carryKeys(node: NumericNode): string[] {
  const keys = [addHasCarry(node.left, node.right) ? 'carry:yes' : 'carry:no']
  let left = node.left
  let right = node.right
  for (const place of ['ones', 'tens', 'hundreds', 'thousands'] as const) {
    if ((left % 10) + (right % 10) >= 10) keys.push(`carry-place:${place}`)
    left = Math.floor(left / 10)
    right = Math.floor(right / 10)
  }
  return keys
}

function borrowKeys(node: NumericNode): string[] {
  const keys = [subHasBorrow(node.left, node.right) ? 'borrow:yes' : 'borrow:no']
  let left = node.left
  let right = node.right
  let borrowed = 0
  for (const place of ['ones', 'tens', 'hundreds', 'thousands'] as const) {
    const digit = (left % 10) - borrowed
    if (digit < right % 10) {
      keys.push(`borrow-place:${place}`)
      borrowed = 1
    } else borrowed = 0
    left = Math.floor(left / 10)
    right = Math.floor(right / 10)
  }
  return keys
}

const ADD_PLACE_CELLS: StructureCell[] = [
  { key: 'carry-place:ones', label: '个位进位' },
  { key: 'carry-place:tens', label: '十位进位' },
  { key: 'carry-place:hundreds', label: '百位进位' },
  { key: 'carry-place:thousands', label: '千位进位' },
]

const SUB_PLACE_CELLS: StructureCell[] = [
  { key: 'borrow-place:ones', label: '个位退位' },
  { key: 'borrow-place:tens', label: '十位退位' },
  { key: 'borrow-place:hundreds', label: '百位退位' },
  { key: 'borrow-place:thousands', label: '千位退位' },
]

function trailingZeros(value: number): number {
  if (!Number.isInteger(value) || value === 0) return 0
  let count = 0
  let n = Math.abs(value)
  while (n % 10 === 0) {
    count++
    n /= 10
  }
  return count
}

const MODELS: StructureModel[] = [
  numericRangeModel({
    id: 'add:100a',
    label: '100 以内不进位',
    group: 'add',
    left: [10, 89],
    right: [0, 89],
    extraCells: [{ key: 'carry:no', label: '不进位' }],
    extras: carryKeys,
  }),
  numericRangeModel({
    id: 'add:100b',
    label: '100 以内进位',
    group: 'add',
    left: [10, 89],
    right: [10, 89],
    extraCells: [{ key: 'carry:yes', label: '有进位' }, ...ADD_PLACE_CELLS.slice(0, 1)],
    extras: carryKeys,
  }),
  numericRangeModel({
    id: 'add:1000',
    label: '1000 以内（竖式能力）',
    group: 'add',
    left: [100, 899],
    right: [50, 500],
    extraCells: [
      { key: 'carry:no', label: '不进位' },
      { key: 'carry:yes', label: '有进位' },
      ...ADD_PLACE_CELLS.slice(0, 2),
    ],
    extras: carryKeys,
  }),
  numericRangeModel({
    id: 'add:10000',
    label: '万以内（竖式能力）',
    group: 'add',
    left: [1000, 8000],
    right: [500, 3000],
    extraCells: [
      { key: 'carry:no', label: '不进位' },
      { key: 'carry:yes', label: '有进位' },
      ...ADD_PLACE_CELLS.slice(0, 3),
    ],
    extras: carryKeys,
  }),
  numericRangeModel({
    id: 'sub:100a',
    label: '100 以内不退位',
    group: 'sub',
    left: [20, 99],
    right: [0, 99],
    extraCells: [{ key: 'borrow:no', label: '不退位' }],
    extras: borrowKeys,
  }),
  numericRangeModel({
    id: 'sub:100b',
    label: '100 以内退位',
    group: 'sub',
    left: [21, 100],
    right: [11, 99],
    extraCells: [{ key: 'borrow:yes', label: '有退位' }, ...SUB_PLACE_CELLS.slice(0, 2)],
    extras: borrowKeys,
  }),
  numericRangeModel({
    id: 'sub:round',
    label: '整百/整千减多位数',
    group: 'sub',
    left: [100, 1000],
    right: [11, 999],
    baseCells: BAND_CELLS.filter((cell) => cell.key !== 'left:mid'),
    extraCells: [
      { key: 'round:100', label: '100 减' },
      { key: 'round:1000', label: '1000 减' },
    ],
    extras: (node) => [node.left === 100 ? 'round:100' : 'round:1000'],
  }),
  numericRangeModel({
    id: 'sub:1000',
    label: '1000 以内（竖式能力）',
    group: 'sub',
    left: [100, 999],
    right: [50, 998],
    extraCells: [
      { key: 'borrow:no', label: '不退位' },
      { key: 'borrow:yes', label: '有退位' },
      ...SUB_PLACE_CELLS.slice(0, 2),
    ],
    extras: borrowKeys,
  }),
  numericRangeModel({
    id: 'sub:10000',
    label: '万以内（竖式能力）',
    group: 'sub',
    left: [1000, 9999],
    right: [100, 9998],
    extraCells: [
      { key: 'borrow:no', label: '不退位' },
      { key: 'borrow:yes', label: '有退位' },
      ...SUB_PLACE_CELLS.slice(0, 3),
    ],
    extras: borrowKeys,
  }),
  ...['mul:1012', 'mul:1319', 'mul:219'].map((id) =>
    numericRangeModel({
      id,
      label: BLOCKS.find((b) => b.id === id)?.label ?? id,
      group: 'mul',
      left: [2, 19],
      right: [2, 19],
      baseCells:
        id === 'mul:1012' ? BAND_CELLS.filter((cell) => !cell.key.endsWith(':high')) : BAND_CELLS,
      extraCells: [
        { key: 'order:small-left', label: '较小数在左' },
        { key: 'order:large-left', label: '较大数在左' },
      ],
      extras: (node) => [node.left <= node.right ? 'order:small-left' : 'order:large-left'],
    }),
  ),
  ...['mul:2d1d-nc', 'mul:2d1d-c'].map((id) =>
    numericRangeModel({
      id,
      label: BLOCKS.find((b) => b.id === id)?.label ?? id,
      group: 'mul',
      left: [11, 99],
      right: [2, 9],
      baseCells: id.endsWith('-nc')
        ? BAND_CELLS.filter((cell) => cell.key !== 'left:high')
        : BAND_CELLS,
      extraCells: Array.from({ length: 8 }, (_, i) => ({
        key: `factor:${i + 2}`,
        label: `×${i + 2}`,
      })),
      extras: (node) => [`factor:${node.right}`],
    }),
  ),
  ...['mul:3d1d-nc', 'mul:3d1d-c'].map((id) =>
    numericRangeModel({
      id,
      label: BLOCKS.find((b) => b.id === id)?.label ?? id,
      group: 'mul',
      left: [100, 999],
      right: [2, 9],
      baseCells: id.endsWith('-nc')
        ? BAND_CELLS.filter((cell) => cell.key !== 'left:high')
        : BAND_CELLS,
      extraCells: Array.from({ length: 8 }, (_, i) => ({
        key: `factor:${i + 2}`,
        label: `×${i + 2}`,
      })),
      extras: (node) => [`factor:${node.right}`],
    }),
  ),
  numericRangeModel({
    id: 'mul:zeros',
    label: '整十/整百乘法',
    group: 'mul',
    left: [2, 900],
    right: [2, 900],
    extraCells: [
      { key: 'zeros:1', label: '共1个尾零' },
      { key: 'zeros:2', label: '共2个尾零' },
    ],
    extras: (node) => [
      `zeros:${Math.min(2, trailingZeros(node.left) + trailingZeros(node.right))}`,
    ],
  }),
  numericRangeModel({
    id: 'mul:2d',
    label: '两位数×两位数',
    group: 'mul',
    left: [11, 99],
    right: [11, 99],
    extraCells: [
      { key: 'order:small-left', label: '较小数在左' },
      { key: 'order:large-left', label: '较大数在左' },
    ],
    extras: (node) => [node.left <= node.right ? 'order:small-left' : 'order:large-left'],
  }),
  ...['div:1012', 'div:1319', 'div:219', 'div:multi', 'div:2d1d-borrow'].map((id) => {
    const isMulti = id === 'div:multi' || id === 'div:2d1d-borrow'
    return numericRangeModel({
      id,
      label: BLOCKS.find((b) => b.id === id)?.label ?? id,
      group: 'div',
      left: [10, 9999],
      right: [2, 19],
      baseCells: [],
      extraCells: [
        { key: 'divisor:low', label: isMulti ? '除数 2～5' : '除数低段' },
        { key: 'divisor:high', label: isMulti ? '除数 6～9' : '除数高段' },
        ...(!isMulti ? [{ key: 'quotient:1d', label: '一位商' }] : []),
        { key: 'quotient:2d', label: '两位商' },
      ],
      extras: (node) => [
        `divisor:${node.right <= (isMulti ? 5 : id === 'div:1012' ? 10 : id === 'div:1319' ? 15 : 9) ? 'low' : 'high'}`,
        `quotient:${node.left / node.right < 10 ? '1d' : '2d'}`,
      ],
    })
  }),
  numericRangeModel({
    id: 'div:zeros',
    label: '整十/整百除法',
    group: 'div',
    left: [10, 9999],
    right: [2, 900],
    extraCells: [
      { key: 'divisor:1d', label: '除数一位' },
      { key: 'divisor:10s', label: '除数整十/百' },
    ],
    extras: (node) => [node.right < 10 ? 'divisor:1d' : 'divisor:10s'],
  }),
  numericRangeModel({
    id: 'div:rem',
    label: '有余数除法',
    group: 'div',
    left: [5, 89],
    right: [2, 9],
    extraCells: [
      { key: 'remainder:small', label: '余数小于除数一半' },
      { key: 'remainder:large', label: '余数接近除数' },
    ],
    extras: (node) => [
      node.left % node.right < node.right / 2 ? 'remainder:small' : 'remainder:large',
    ],
  }),
]

function decimalModels(): StructureModel[] {
  return ['dec:add1', 'dec:add2', 'dec:mulInt', 'dec:divInt'].map((id) => {
    const allowedOps =
      id === 'dec:add1' || id === 'dec:add2'
        ? ['add', 'sub']
        : id === 'dec:mulInt'
          ? ['mul']
          : ['div']
    return {
      id,
      label: BLOCKS.find((b) => b.id === id)?.label ?? id,
      group: 'decimal',
      version: 'v1',
      cells: [
        { key: 'op:add', label: '小数加法' },
        { key: 'op:sub', label: '小数减法' },
        { key: 'op:mul', label: '小数乘法' },
        { key: 'op:div', label: '小数除法' },
        { key: 'magnitude:lt1', label: '结果小于1' },
        { key: 'magnitude:1to10', label: '结果1～10' },
        { key: 'magnitude:gt10', label: '结果大于10' },
      ].filter((cell) => {
        if (cell.key.startsWith('op:')) return allowedOps.includes(cell.key.slice(3))
        if (cell.key === 'magnitude:lt1') return id === 'dec:add1' || id === 'dec:add2'
        if (cell.key === 'magnitude:gt10') return id !== 'dec:divInt'
        return true
      }),
      classify(signature) {
        const node = numericNode(signature)
        if (!node) return []
        const value =
          node.op === 'add'
            ? node.left + node.right
            : node.op === 'sub'
              ? node.left - node.right
              : node.op === 'mul'
                ? node.left * node.right
                : node.left / node.right
        return [`op:${node.op}`, `magnitude:${value < 1 ? 'lt1' : value <= 10 ? '1to10' : 'gt10'}`]
      },
    }
  })
}

function fractionModels(): StructureModel[] {
  return BLOCKS.filter((block) => block.group === 'fraction').map((block) => {
    const allowedOps = block.id.startsWith('frac:add')
      ? ['add', 'sub']
      : block.id.startsWith('frac:mul')
        ? ['mul']
        : ['div']
    return {
      id: block.id,
      label: block.label,
      group: 'fraction',
      version: 'v1',
      cells: [
        { key: 'den:small', label: '小分母（2～3）' },
        { key: 'den:mid', label: '中分母（4～6）' },
        { key: 'den:large', label: '大分母（7～9）' },
        { key: 'op:add', label: '加法' },
        { key: 'op:sub', label: '减法' },
        { key: 'op:mul', label: '乘法' },
        { key: 'op:div', label: '除法' },
      ].filter((cell) => {
        if (cell.key.startsWith('op:')) return allowedOps.includes(cell.key.slice(3))
        if (cell.key === 'den:large')
          return block.id === 'frac:add-same' || block.id.endsWith('-int')
        return true
      }),
      classify(signature) {
        const match = signature.match(/^frac:(add|sub|mul|div)\((\d+)\/(\d+),(.+)\)$/)
        if (!match) return []
        const denominator = Number(match[3])
        return [
          `op:${match[1]}`,
          `den:${denominator <= 3 ? 'small' : denominator <= 6 ? 'mid' : 'large'}`,
        ]
      },
    }
  })
}

function astDepth(node: AstNode): number {
  if (typeof node === 'number') return 0
  return 1 + Math.max(astDepth(node.left), astDepth(node.right))
}

export function mixedStructureModels(ops: MixedOp[]): StructureModel[] {
  return ops
    .filter((op) => op.enabled)
    .map((op) => {
      const skeleton = SKELETONS.find((item) => item.id === op.skeleton)
      const rootKey =
        op.skeleton === 'as' || op.skeleton === 'asm' || op.skeleton === 'asmd'
          ? 'root:addsub'
          : 'root:muldiv'
      const depthKeys =
        op.skeleton === 'md'
          ? ['depth:2', 'depth:3']
          : op.skeleton === 'asmd' || op.skeleton === 'asmd_paren'
            ? ['depth:3']
            : ['depth:2']
      return {
        id: `mixed:${op.id}`,
        label: op.label ?? skeleton?.label ?? op.skeleton,
        group: 'mixed',
        version: 'v1',
        cells: [
          rootKey === 'root:addsub'
            ? { key: 'root:addsub', label: '根运算为加减' }
            : { key: 'root:muldiv', label: '根运算为乘除' },
          ...depthKeys.map((key) => ({
            key,
            label: key === 'depth:3' ? '三层及以上' : '一至两层运算',
          })),
        ],
        classify(signature: string) {
          try {
            const ast = parseSignature(signature)
            if (typeof ast === 'number') return []
            return [
              ast.op === 'add' || ast.op === 'sub' ? 'root:addsub' : 'root:muldiv',
              astDepth(ast) >= 3 ? 'depth:3' : 'depth:2',
            ]
          } catch {
            return []
          }
        },
      }
    })
}

MODELS.push(...decimalModels(), ...fractionModels())

export function structureCoverageModels(): StructureModel[] {
  return MODELS
}

function statusFlags(status: LearningStatus) {
  return {
    fluent: status === 'fluent' || status === 'mastered',
    mastered: status === 'mastered',
    reviewDue: status === 'review-due',
  }
}

export function calculateStructureCoverage(
  model: StructureModel,
  states: Iterable<CalcProblemState>,
): StructureCoverage {
  const progress = new Map<string, StructureCellProgress>(
    model.cells.map((cell) => [
      cell.key,
      {
        ...cell,
        covered: false,
        fluent: false,
        mastered: false,
        reviewDue: false,
        sampleSignatures: [],
      },
    ]),
  )
  for (const state of states) {
    const expectedSource = model.id.startsWith('mixed:')
      ? state.mixedOpId === model.id.slice(6)
      : state.blockId === model.id
    if (!expectedSource || !hasIndependentAttempt(state)) continue
    const status = learningStatusOf(state)
    const flags = statusFlags(status)
    for (const key of model.classify(state.signature)) {
      const cell = progress.get(key)
      if (!cell) continue
      cell.covered = true
      cell.fluent ||= flags.fluent
      cell.mastered ||= flags.mastered
      cell.reviewDue ||= flags.reviewDue
      if (cell.sampleSignatures.length < 3) cell.sampleSignatures.push(state.signature)
    }
  }
  const cells = [...progress.values()]
  return {
    id: model.id,
    label: model.label,
    group: model.group,
    version: model.version,
    total: cells.length,
    covered: cells.filter((cell) => cell.covered).length,
    fluent: cells.filter((cell) => cell.fluent).length,
    mastered: cells.filter((cell) => cell.mastered).length,
    reviewDue: cells.filter((cell) => cell.reviewDue).length,
    cells,
  }
}

export function calculateAllStructureCoverage(
  states: Map<string, CalcProblemState>,
  mixedOps: MixedOp[],
): StructureCoverage[] {
  const models = [...MODELS, ...mixedStructureModels(mixedOps)]
  return models.map((model) => calculateStructureCoverage(model, states.values()))
}
