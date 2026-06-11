import type { CalcCategory, CalcLevel, CalcOp, CalcQuestion } from './type'

export type { CalcOp }

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export const OP_SYMBOL: Record<CalcOp, string> = {
  add: '+',
  sub: '−',
  mul: '×',
  div: '÷',
}

// Build a unary number node — represented as a number primitive in the AST
export type AstNode = number | { op: CalcOp; left: AstNode; right: AstNode }

export function evalAst(n: AstNode): number {
  if (typeof n === 'number') return n
  const l = evalAst(n.left)
  const r = evalAst(n.right)
  switch (n.op) {
    case 'add': return l + r
    case 'sub': return l - r
    case 'mul': return l * r
    case 'div': return l / r
  }
}

export function signatureOf(n: AstNode): string {
  if (typeof n === 'number') return String(n)
  return `${n.op}(${signatureOf(n.left)},${signatureOf(n.right)})`
}

export function precedence(op: CalcOp): number {
  return op === 'add' || op === 'sub' ? 1 : 2
}

/** Stringify AST with parens only where precedence requires them. */
export function renderAst(n: AstNode, parentPrec = 0): string {
  if (typeof n === 'number') return String(n)
  const p = precedence(n.op)
  const left = renderAst(n.left, p)
  const right = renderAst(n.right, p + 1)   // right-leaning: 10-(4-1) needs parens
  const inner = `${left} ${OP_SYMBOL[n.op]} ${right}`
  return p < parentPrec ? `(${inner})` : inner
}

export function arityOf(n: AstNode): number {
  if (typeof n === 'number') return 0
  return 1 + arityOf(n.left) + arityOf(n.right)
}

export function makeQuestion(
  ast: AstNode,
  level: CalcLevel,
  category: CalcCategory,
  coinBase: number,
  isChallenge = false,
): CalcQuestion {
  const display = `${renderAst(ast)} = ?`
  const signature = signatureOf(ast)
  const answer = evalAst(ast)
  const arity = arityOf(ast) as 1 | 2 | 3
  return { display, signature, arity, level, answer, isChallenge, category, coinBase }
}
