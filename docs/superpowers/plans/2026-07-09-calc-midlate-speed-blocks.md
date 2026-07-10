# Calc mid-late speed blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cognitively split mid-late speed calc blocks (凑整 / 整百减 / 2d·3d×1d 进位拆分 / 满十除法 / 整十整百×÷), wire Finite coverage for 凑整, migrate away from coarse `mul:2d1d`, and narrow `div:multi`.

**Architecture:** Pure generators + predicates in `calc-block-gens.ts`; catalog entries in `calc-blocks.ts`; Finite enum in `calc-finite.ts`; time bands in `calc-time-targets.ts`; settings id normalize on load. No DB schema change. Lagging / mastery algorithms unchanged.

**Tech Stack:** TypeScript, `@rosie/calc`, Vitest via `apps/web` (`pnpm --filter web test`), existing `BLOCKS` + `buildSession` engine.

**Spec:** [`docs/superpowers/specs/2026-07-09-calc-midlate-speed-blocks-design.md`](../specs/2026-07-09-calc-midlate-speed-blocks-design.md)

## Global Constraints

- Replace picker `mul:2d1d` with `mul:2d1d-nc` + `mul:2d1d-c`; normalize legacy settings on load (no SQL wipe)
- `add:100-comp` is Finite (two-digit complements to 100); all other new blocks Infinite
- `mul:3d1d-c` requires **≥2 adjacent** digit carries; zero digits never count as carry
- `div:multi` and `div:2d1d-borrow` partition by mid-remainder (tens digit `% divisor === 0` vs `!== 0`)
- `sub:round` P0 minuends **only** `{100, 1000}` (P2 recall evolution out of scope)
- `mul:zeros` / `div:zeros` excluded from `VERTICAL_BLOCK_IDS`
- Generator rejection: retry cap then known-good fallback — never hang / never empty pair
- No mixed-skeleton redesign; no DELETE/TRUNCATE/重灌
- Before claiming done: `pnpm --filter @rosie/calc typecheck` and `pnpm --filter web test -- calc-block`

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/calc/src/utils/calc-block-gens.ts` | Create | Predicates + pair generators + complement enum + zeros gens |
| `packages/calc/src/utils/calc-settings-normalize.ts` | Create | `normalizeSelectedBlocks` (`mul:2d1d` → nc+c) |
| `packages/calc/src/utils/calc-blocks.ts` | Modify | Wire new/changed blocks; update `VERTICAL_BLOCK_IDS`; remove `mul:2d1d` |
| `packages/calc/src/utils/calc-finite.ts` | Modify | Finite id + `enumerateFinite` for `add:100-comp` |
| `packages/calc/src/utils/calc-time-targets.ts` | Modify | New TIME_TARGETS; delete `mul:2d1d` |
| `packages/calc/src/hooks/useCalcSettings.ts` | Modify | Apply normalize on fetch / before persist |
| `packages/calc/src/pages/settings.tsx` | Modify | Vertical-mode description copy |
| `packages/calc/FAQ.md` | Modify | Parent-facing bullets for new types |
| `packages/calc/src/pages/faq.tsx` | Modify | Mirror FAQ bullets if listed as examples |
| `packages/calc/CLAUDE.md` | Modify | Catalog note + `mul:2d1d` removal |
| `packages/calc/src/index.ts` | Modify | Export pure helpers needed by Vitest |
| `apps/web/tests/calc-block-gens.test.ts` | Create | Predicate / partition / normalize / finite U tests |
| `apps/web/tests/calc-settings-normalize.test.ts` | Create | Settings migration tests |

---

### Task 1: Predicates + generators (`calc-block-gens.ts`)

**Files:**
- Create: `packages/calc/src/utils/calc-block-gens.ts`
- Create: `apps/web/tests/calc-block-gens.test.ts`
- Modify: `packages/calc/src/index.ts` (export test surface)

**Interfaces:**
- Produces:
  - `digitsOf(n: number): number[]` — ones-first `[ones, tens, …]`
  - `mulCarryMask(a: number, k: number): boolean[]` — per digit, `digit * k >= 10`
  - `hasAnyCarry(a: number, k: number): boolean`
  - `hasConsecutiveCarries(a: number, k: number, minRun?: number): boolean` — default `minRun = 2`; adjacent trues in mask; zero digits are `false`
  - `needsDivMidRemainder(dividend: number, divisor: number): boolean` — for 2-digit dividend: `Math.floor(dividend / 10) % divisor !== 0`
  - `enumerateComplementsTo100(): Array<[number, number]>` — all `a∈10..90`, `b=100-a`, `b∈10..90`; includes both orders when `a≠b`; `50,50` once
  - `genAdd100Comp(): [number, number]`
  - `genSubRound(): [number, number]`
  - `genMul2d1d(carry: boolean): [number, number]`
  - `genMul3d1d(carry: boolean): [number, number]` — when `carry===true`, require `hasConsecutiveCarries(a,k,2)`
  - `genDiv2d1d(borrow: boolean): [number, number]` — `[dividend, divisor]`; exact; `borrow` ↔ `needsDivMidRemainder`
  - `genZerosMul(): [number, number]`
  - `genZerosDiv(): [number, number]`
- Consumes: `randInt`, `pickOne` from `./calc-ast`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/tests/calc-block-gens.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  digitsOf,
  hasAnyCarry,
  hasConsecutiveCarries,
  needsDivMidRemainder,
  enumerateComplementsTo100,
  genMul3d1d,
  genDiv2d1d,
  genSubRound,
  genZerosMul,
  genZerosDiv,
} from '@rosie/calc'

describe('digitsOf / carry', () => {
  it('digitsOf is ones-first', () => {
    expect(digitsOf(412)).toEqual([2, 1, 4])
  })

  it('412×2 is single-carry only (not consecutive)', () => {
    expect(hasAnyCarry(412, 2)).toBe(true)
    expect(hasConsecutiveCarries(412, 2, 2)).toBe(false)
  })

  it('38×3 has a carry; 42×2 has none', () => {
    expect(hasAnyCarry(38, 3)).toBe(true)
    expect(hasAnyCarry(42, 2)).toBe(false)
  })

  it('124×3 has consecutive carries', () => {
    expect(hasConsecutiveCarries(124, 3, 2)).toBe(true)
  })
})

describe('div mid-remainder', () => {
  it('72÷4 needs mid remainder; 84÷4 does not', () => {
    expect(needsDivMidRemainder(72, 4)).toBe(true) // tens 7 % 4 !== 0
    expect(needsDivMidRemainder(84, 4)).toBe(false) // tens 8 % 4 === 0
  })
})

describe('complements Finite U', () => {
  it('includes both orders and 50+50 once', () => {
    const pairs = enumerateComplementsTo100()
    expect(pairs).toContainEqual([34, 66])
    expect(pairs).toContainEqual([66, 34])
    expect(pairs.filter(([a, b]) => a === 50 && b === 50)).toHaveLength(1)
    expect(pairs.every(([a, b]) => a >= 10 && a <= 90 && b >= 10 && b <= 90 && a + b === 100)).toBe(true)
  })
})

describe('generators sample invariants', () => {
  it('genMul3d1d(true) always consecutive-carry', () => {
    for (let i = 0; i < 40; i++) {
      const [a, k] = genMul3d1d(true)
      expect(a).toBeGreaterThanOrEqual(100)
      expect(a).toBeLessThanOrEqual(999)
      expect(hasConsecutiveCarries(a, k, 2)).toBe(true)
    }
  })

  it('genDiv2d1d partitions by borrow flag', () => {
    for (let i = 0; i < 40; i++) {
      const [d, div] = genDiv2d1d(true)
      expect(d % div).toBe(0)
      expect(needsDivMidRemainder(d, div)).toBe(true)
      const [d2, div2] = genDiv2d1d(false)
      expect(d2 % div2).toBe(0)
      expect(needsDivMidRemainder(d2, div2)).toBe(false)
    }
  })

  it('genSubRound only 100 or 1000', () => {
    for (let i = 0; i < 30; i++) {
      const [a, b] = genSubRound()
      expect([100, 1000]).toContain(a)
      expect(b).toBeGreaterThan(0)
      expect(b).toBeLessThan(a)
    }
  })

  it('zeros mul/div are exact and use trailing zeros', () => {
    for (let i = 0; i < 20; i++) {
      const [a, b] = genZerosMul()
      expect(a * b).toBeGreaterThan(0)
      expect(a % 10 === 0 || b % 10 === 0).toBe(true)
      const [num, den] = genZerosDiv()
      expect(num % den).toBe(0)
      expect(num % 10 === 0 || den % 10 === 0).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL (module / exports missing)**

```bash
pnpm --filter web test -- calc-block-gens
```

Expected: FAIL resolving `@rosie/calc` exports or missing symbols.

- [ ] **Step 3: Implement `calc-block-gens.ts`**

```ts
// packages/calc/src/utils/calc-block-gens.ts
import { randInt, pickOne } from './calc-ast'

const RETRY = 48

/** Ones-first digit list. */
export function digitsOf(n: number): number[] {
  const d: number[] = []
  let x = Math.abs(Math.trunc(n))
  if (x === 0) return [0]
  while (x > 0) {
    d.push(x % 10)
    x = Math.floor(x / 10)
  }
  return d
}

export function mulCarryMask(a: number, k: number): boolean[] {
  return digitsOf(a).map((d) => d * k >= 10)
}

export function hasAnyCarry(a: number, k: number): boolean {
  return mulCarryMask(a, k).some(Boolean)
}

/** Adjacent run of carries of length >= minRun (default 2). Zero digits never carry. */
export function hasConsecutiveCarries(a: number, k: number, minRun = 2): boolean {
  const mask = mulCarryMask(a, k)
  let run = 0
  for (const c of mask) {
    run = c ? run + 1 : 0
    if (run >= minRun) return true
  }
  return false
}

/** 2-digit dividend: tens digit not divisible by divisor → mid-step remainder. */
export function needsDivMidRemainder(dividend: number, divisor: number): boolean {
  if (dividend < 10 || dividend > 99 || divisor < 2) return false
  return Math.floor(dividend / 10) % divisor !== 0
}

export function enumerateComplementsTo100(): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let a = 10; a <= 90; a++) {
    const b = 100 - a
    if (b < 10 || b > 90) continue
    out.push([a, b])
  }
  return out
}

function withFallback<T>(tryGen: () => T | null, fallback: T): T {
  for (let i = 0; i < RETRY; i++) {
    const v = tryGen()
    if (v != null) return v
  }
  return fallback
}

export function genAdd100Comp(): [number, number] {
  return pickOne(enumerateComplementsTo100())
}

export function genSubRound(): [number, number] {
  return withFallback(() => {
    const a = pickOne([100, 1000] as const)
    if (a === 100) {
      const b = randInt(11, 99)
      return [a, b]
    }
    const b = randInt(101, 999)
    return [a, b]
  }, [1000, 356])
}

export function genMul2d1d(carry: boolean): [number, number] {
  return withFallback(() => {
    const a = randInt(11, 99)
    const k = randInt(2, 9)
    if (hasAnyCarry(a, k) === carry) return [a, k]
    return null
  }, carry ? [38, 3] : [42, 2])
}

export function genMul3d1d(carry: boolean): [number, number] {
  return withFallback(() => {
    const a = randInt(100, 999)
    const k = randInt(2, 9)
    if (!carry) {
      if (!hasAnyCarry(a, k)) return [a, k]
      return null
    }
    if (hasConsecutiveCarries(a, k, 2)) return [a, k]
    return null
  }, carry ? [124, 3] : [234, 2])
}

export function genDiv2d1d(borrow: boolean): [number, number] {
  return withFallback(() => {
    const divisor = randInt(2, 9)
    const q = randInt(11, 99)
    const dividend = divisor * q
    if (dividend < 10 || dividend > 99) return null
    if (needsDivMidRemainder(dividend, divisor) === borrow) return [dividend, divisor]
    return null
  }, borrow ? [72, 4] : [84, 4])
}

export function genZerosMul(): [number, number] {
  return withFallback(() => {
    const coreA = randInt(2, 9)
    const coreB = randInt(2, 9)
    const zA = pickOne([1, 1, 2]) // prefer one trailing zero on left
    const zB = pickOne([0, 0, 1])
    const a = coreA * 10 ** zA
    const b = coreB * 10 ** zB
    if (a < 10 && b < 10) return null
    return Math.random() < 0.5 ? [a, b] : [b, a]
  }, [40, 6])
}

export function genZerosDiv(): [number, number] {
  return withFallback(() => {
    // Patterns: (core*10^z) ÷ coreK, or (core*10^z) ÷ (k*10^w) with exact int
    const kind = randInt(0, 2)
    if (kind === 0) {
      // 1200 ÷ 4
      const core = randInt(2, 9)
      const k = randInt(2, 9)
      const z = pickOne([1, 2, 3])
      const dividend = core * k * 10 ** z
      return [dividend, k]
    }
    if (kind === 1) {
      // 240 ÷ 60
      const q = randInt(2, 9)
      const core = randInt(2, 9)
      const z = pickOne([1, 2])
      const divisor = core * 10 ** z
      const dividend = q * divisor
      return [dividend, divisor]
    }
    // 800 ÷ 20
    const q = randInt(2, 9) * pickOne([10, 100])
    const divisor = randInt(2, 9) * 10
    const dividend = q * divisor
    if (dividend % 10 !== 0) return null
    return [dividend, divisor]
  }, [240, 60])
}
```

- [ ] **Step 4: Export from `packages/calc/src/index.ts`**

Add:

```ts
export {
  digitsOf,
  hasAnyCarry,
  hasConsecutiveCarries,
  needsDivMidRemainder,
  enumerateComplementsTo100,
  genMul3d1d,
  genDiv2d1d,
  genSubRound,
  genZerosMul,
  genZerosDiv,
  genAdd100Comp,
  genMul2d1d,
} from './utils/calc-block-gens'
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
pnpm --filter web test -- calc-block-gens
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/calc/src/utils/calc-block-gens.ts packages/calc/src/index.ts apps/web/tests/calc-block-gens.test.ts
git commit -m "$(cat <<'EOF'
feat(calc): add mid-late speed block generators and carry predicates

EOF
)"
```

---

### Task 2: Catalog + Finite + TIME_TARGETS + vertical set

**Files:**
- Modify: `packages/calc/src/utils/calc-blocks.ts`
- Modify: `packages/calc/src/utils/calc-finite.ts`
- Modify: `packages/calc/src/utils/calc-time-targets.ts`
- Create: `apps/web/tests/calc-blocks-catalog.test.ts`

**Interfaces:**
- Consumes: all `gen*` from Task 1
- Produces: updated `BLOCKS`, `VERTICAL_BLOCK_IDS`, `FINITE_BLOCK_IDS`, `TIME_TARGETS`, `missingTargetIds() === []`

- [ ] **Step 1: Write catalog / finite / targets tests**

```ts
// apps/web/tests/calc-blocks-catalog.test.ts
import { describe, it, expect } from 'vitest'
import {
  blockById,
  BLOCKS,
  VERTICAL_BLOCK_IDS,
  isFiniteBlock,
  enumerateFinite,
  missingTargetIds,
  needsDivMidRemainder,
} from '@rosie/calc'

describe('mid-late catalog', () => {
  it('removes mul:2d1d and adds split / new ids', () => {
    expect(blockById('mul:2d1d')).toBeUndefined()
    for (const id of [
      'add:100-comp', 'sub:round',
      'mul:2d1d-nc', 'mul:2d1d-c', 'mul:3d1d-nc', 'mul:3d1d-c',
      'div:2d1d-borrow', 'mul:zeros', 'div:zeros',
    ]) {
      expect(blockById(id)?.id).toBe(id)
    }
    expect(BLOCKS.some((b) => b.id === 'div:multi')).toBe(true)
  })

  it('add:100-comp is Finite with both-order U', () => {
    expect(isFiniteBlock('add:100-comp')).toBe(true)
    const U = enumerateFinite('add:100-comp')
    expect(U).toContain('add(34,66)')
    expect(U).toContain('add(66,34)')
    expect(U.filter((s) => s === 'add(50,50)')).toHaveLength(1)
  })

  it('vertical set includes multi-digit drills but not zeros', () => {
    expect(VERTICAL_BLOCK_IDS.has('mul:2d1d-nc')).toBe(true)
    expect(VERTICAL_BLOCK_IDS.has('mul:3d1d-c')).toBe(true)
    expect(VERTICAL_BLOCK_IDS.has('div:2d1d-borrow')).toBe(true)
    expect(VERTICAL_BLOCK_IDS.has('add:100-comp')).toBe(true)
    expect(VERTICAL_BLOCK_IDS.has('sub:round')).toBe(true)
    expect(VERTICAL_BLOCK_IDS.has('mul:zeros')).toBe(false)
    expect(VERTICAL_BLOCK_IDS.has('div:zeros')).toBe(false)
    expect(VERTICAL_BLOCK_IDS.has('mul:2d1d')).toBe(false)
  })

  it('div:multi samples have no mid remainder; borrow block does', () => {
    const multi = blockById('div:multi')!
    const borrow = blockById('div:2d1d-borrow')!
    for (let i = 0; i < 25; i++) {
      const q1 = multi.generateSingle()
      const m1 = /^(\d+) ÷ (\d+)/.exec(q1.display)!
      const d1 = Number(m1[1]), div1 = Number(m1[2])
      if (d1 >= 10 && d1 <= 99) expect(needsDivMidRemainder(d1, div1)).toBe(false)

      const q2 = borrow.generateSingle()
      const m2 = /^(\d+) ÷ (\d+)/.exec(q2.display)!
      expect(needsDivMidRemainder(Number(m2[1]), Number(m2[2]))).toBe(true)
    }
  })

  it('TIME_TARGETS cover all blocks', () => {
    expect(missingTargetIds()).toEqual([])
  })
})
```

Export from `@rosie/calc` index whatever the test imports (`blockById`, `BLOCKS`, `VERTICAL_BLOCK_IDS`, `isFiniteBlock`, `enumerateFinite`, `missingTargetIds`) if not already public.

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter web test -- calc-blocks-catalog
```

- [ ] **Step 3: Wire `calc-blocks.ts`**

Import gens. In `BLOCKS` array:

1. After `add:100b`, insert:
   `addBlock('add:100-comp', '100 以内凑整', genAdd100Comp)`
2. After `sub:100b` (or near sub:1000), insert:
   `subBlock('sub:round', '整百/整千减多位数', genSubRound)`
3. **Remove** `mulBlock('mul:2d1d', …)`
4. Insert before `mul:2d`:
   ```ts
   mulBlock('mul:2d1d-nc', '两位数×一位数（不进位）', () => genMul2d1d(false)),
   mulBlock('mul:2d1d-c', '两位数×一位数（进位）', () => genMul2d1d(true)),
   mulBlock('mul:3d1d-nc', '三位数×一位数（不进位）', () => genMul3d1d(false)),
   mulBlock('mul:3d1d-c', '三位数×一位数（进位）', () => genMul3d1d(true)),
   mulBlock('mul:zeros', '整十/整百乘法', genZerosMul),
   ```
5. Change `div:multi` generator to `() => genDiv2d1d(false)` (narrowed; still label「多位数÷一位数」).
6. Insert:
   ```ts
   divBlock('div:2d1d-borrow', '两位数÷一位数（满十）', () => genDiv2d1d(true)),
   divBlock('div:zeros', '整十/整百除法', genZerosDiv),
   ```

Update `VERTICAL_BLOCK_IDS`:

```ts
export const VERTICAL_BLOCK_IDS = new Set<string>([
  'add:100a', 'add:100b', 'add:100-comp', 'add:1000', 'add:10000',
  'sub:100a', 'sub:100b', 'sub:round', 'sub:1000', 'sub:10000',
  'mul:2d1d-nc', 'mul:2d1d-c', 'mul:3d1d-nc', 'mul:3d1d-c', 'mul:2d',
  'div:multi', 'div:2d1d-borrow',
])
```

- [ ] **Step 4: Wire Finite**

In `calc-finite.ts`:

```ts
export const FINITE_BLOCK_IDS = new Set([
  'mul:25', 'mul:34', 'mul:67', 'mul:89', 'mul:29',
  'div:25', 'div:34', 'div:69', 'div:29',
  'add:100-comp',
])
```

In `enumerateFinite`, add:

```ts
case 'add:100-comp': {
  // lazy import-safe: duplicate enum here or import enumerateComplementsTo100
  for (const [a, b] of enumerateComplementsTo100()) {
    out.push(signatureOf({ op: 'add', left: a, right: b } as AstNode))
  }
  break
}
```

Import `enumerateComplementsTo100` from `./calc-block-gens` and `signatureOf` already present.

Update file comment: P0 finite was 2–9 mul/div; P1 adds `add:100-comp`.

- [ ] **Step 5: TIME_TARGETS**

Delete `'mul:2d1d'` entry. Add:

```ts
'add:100-comp': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
'sub:round': { entry: [15, 20], stable: [12, 15], fluent: [8, 12], auto: [6, 8] },
'mul:2d1d-nc': { entry: [10, 12], stable: [7, 8], fluent: [5, 6], auto: [3, 4] },
'mul:2d1d-c': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
'mul:3d1d-nc': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
'mul:3d1d-c': { entry: [15, 18], stable: [10, 12], fluent: [8, 10], auto: [5, 6] },
'mul:zeros': { entry: [10, 12], stable: [7, 8], fluent: [5, 6], auto: [3, 4] },
'div:2d1d-borrow': { entry: [18, 22], stable: [12, 15], fluent: [10, 12], auto: [8, 8] },
'div:zeros': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
// keep existing div:multi bands
```

- [ ] **Step 6: Export catalog symbols from index if needed; run tests**

```bash
pnpm --filter web test -- calc-blocks-catalog
pnpm --filter @rosie/calc typecheck
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/calc/src/utils/calc-blocks.ts packages/calc/src/utils/calc-finite.ts packages/calc/src/utils/calc-time-targets.ts packages/calc/src/index.ts apps/web/tests/calc-blocks-catalog.test.ts
git commit -m "$(cat <<'EOF'
feat(calc): register mid-late speed blocks and finite 凑整 coverage

EOF
)"
```

---

### Task 3: Settings normalize (`mul:2d1d` → nc + c)

**Files:**
- Create: `packages/calc/src/utils/calc-settings-normalize.ts`
- Create: `apps/web/tests/calc-settings-normalize.test.ts`
- Modify: `packages/calc/src/hooks/useCalcSettings.ts`
- Modify: `packages/calc/src/index.ts`

**Interfaces:**
- Produces: `normalizeSelectedBlocks(blocks: BlockSel[]): BlockSel[]`
- Consumes: `BlockSel` from `@rosie/core`

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { normalizeSelectedBlocks } from '@rosie/calc'

describe('normalizeSelectedBlocks', () => {
  it('expands mul:2d1d into nc + c preserving counts', () => {
    expect(
      normalizeSelectedBlocks([
        { id: 'add:10', count: 10, seconds: 0 },
        { id: 'mul:2d1d', count: 15, seconds: 8 },
      ]),
    ).toEqual([
      { id: 'add:10', count: 10, seconds: 0 },
      { id: 'mul:2d1d-nc', count: 15, seconds: 8 },
      { id: 'mul:2d1d-c', count: 15, seconds: 8 },
    ])
  })

  it('dedupes if nc/c already present', () => {
    expect(
      normalizeSelectedBlocks([
        { id: 'mul:2d1d', count: 10, seconds: 0 },
        { id: 'mul:2d1d-nc', count: 5, seconds: 0 },
      ]),
    ).toEqual([
      { id: 'mul:2d1d-nc', count: 5, seconds: 0 },
      { id: 'mul:2d1d-c', count: 10, seconds: 0 },
    ])
  })

  it('is idempotent', () => {
    const once = normalizeSelectedBlocks([{ id: 'mul:2d1d', count: 20, seconds: 0 }])
    expect(normalizeSelectedBlocks(once)).toEqual(once)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter web test -- calc-settings-normalize
```

- [ ] **Step 3: Implement**

```ts
// packages/calc/src/utils/calc-settings-normalize.ts
import type { BlockSel } from '@rosie/core'

const LEGACY_MUL_2D1D = 'mul:2d1d'
const MUL_NC = 'mul:2d1d-nc'
const MUL_C = 'mul:2d1d-c'

export function normalizeSelectedBlocks(blocks: BlockSel[]): BlockSel[] {
  const out: BlockSel[] = []
  const seen = new Set<string>()

  const push = (b: BlockSel) => {
    if (seen.has(b.id)) return
    seen.add(b.id)
    out.push(b)
  }

  for (const b of blocks) {
    if (b.id !== LEGACY_MUL_2D1D) {
      push(b)
      continue
    }
    // Expand legacy; if nc already seen, only add missing c (and vice versa)
    push({ id: MUL_NC, count: b.count, seconds: b.seconds })
    push({ id: MUL_C, count: b.count, seconds: b.seconds })
  }
  return out
}
```

Note on dedupe test: if `mul:2d1d-nc` appears **before** legacy expand in the loop, `push(nc)` keeps count 5; then legacy tries `push(nc)` no-op and `push(c)` with count 10. Order in the test input is legacy first then nc — adjust either the implementation (prefer existing nc/c counts when already present) or the test expectation to match “first wins” semantics above.

**Preferred semantics (lock this):** first occurrence wins for an id. When expanding legacy, push nc then c with legacy’s count/seconds only if not already `seen`. Update the dedupe test to:

```ts
expect(
  normalizeSelectedBlocks([
    { id: 'mul:2d1d-nc', count: 5, seconds: 0 },
    { id: 'mul:2d1d', count: 10, seconds: 0 },
  ]),
).toEqual([
  { id: 'mul:2d1d-nc', count: 5, seconds: 0 },
  { id: 'mul:2d1d-c', count: 10, seconds: 0 },
])
```

- [ ] **Step 4: Hook into settings**

In `useCalcSettings.ts` `rowToSettings`:

```ts
selectedBlocks: normalizeSelectedBlocks((row.selected_blocks ?? ['add:10']).map(toBlockSel)),
```

In `persist` / `update`, normalize before write:

```ts
const normalized = { ...next, selectedBlocks: normalizeSelectedBlocks(next.selectedBlocks) }
```

(Apply inside `persist` so every save rewrites legacy ids out of Supabase.)

- [ ] **Step 5: Export + tests + typecheck**

```bash
pnpm --filter web test -- calc-settings-normalize
pnpm --filter @rosie/calc typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/calc/src/utils/calc-settings-normalize.ts packages/calc/src/hooks/useCalcSettings.ts packages/calc/src/index.ts apps/web/tests/calc-settings-normalize.test.ts
git commit -m "$(cat <<'EOF'
feat(calc): migrate legacy mul:2d1d settings to carry-split blocks

EOF
)"
```

---

### Task 4: Copy — settings, FAQ, CLAUDE

**Files:**
- Modify: `packages/calc/src/pages/settings.tsx` (vertical toggle description ~L295)
- Modify: `packages/calc/FAQ.md`
- Modify: `packages/calc/src/pages/faq.tsx` (optional example strings)
- Modify: `packages/calc/CLAUDE.md`

- [ ] **Step 1: Settings description**

Replace vertical toggle description with:

```ts
description="百以内 / 千以内 / 万以内加减、两·三位数×一位数、两位数×两位数、多位数÷一位数（含满十）用竖式格子作答"
```

- [ ] **Step 2: FAQ.md — add under「开始前：先选练什么」or a short new subsection**

```markdown
### 中后期提速题型（补充）

设置里还可勾选更细的计算梯度，例如：

- **100 以内凑整**（有限表）：优先练还没见过的补数。
- **两 / 三位数 × 一位数**：已拆成「不进位」与「进位」（三位数进位要求连续进位）。
- **两位数 ÷ 一位数（满十）**：与「多位数 ÷ 一位数」按是否需要中间余数分开练。
- **整十 / 整百乘法、除法**：练「剥零 → 口诀 → 回填零」。
- **整百 / 整千减多位数**：目前只练 `100−…` 与 `1000−…`。
```

Also update the Finite sentence in §系统怎么决定 if it still says only 2–9 乘除 — append「以及 100 以内凑整」.

- [ ] **Step 3: faq.tsx** — if examples list types, add one mid-late example (e.g. 凑整 / 进位拆分); keep short.

- [ ] **Step 4: CLAUDE.md engine blurb**

Add under Engine model / layout utils list: `calc-block-gens`, `calc-settings-normalize`. Note: `mul:2d1d` removed; Finite includes `add:100-comp`; P2 may evolve `sub:round` recall (not implemented).

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @rosie/calc typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/calc/src/pages/settings.tsx packages/calc/FAQ.md packages/calc/src/pages/faq.tsx packages/calc/CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(calc): document mid-late speed block splits for parents and agents

EOF
)"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full calc-related checks**

```bash
pnpm --filter @rosie/calc typecheck
pnpm --filter web test -- calc-block
pnpm --filter web test -- calc-settings-normalize
pnpm --filter web test -- calc-blocks-catalog
```

Expected: all PASS; `missingTargetIds()` covered by catalog test.

- [ ] **Step 2: Manual smoke (dev)**

1. Open `/calc/settings` — confirm no「两位数×一位数」coarse chip; new chips visible under 加/减/乘/除.
2. If local settings still had `mul:2d1d`, reload — should show nc+c selected.
3. Start a short session with `add:100-comp` + `mul:3d1d-c` + `div:2d1d-borrow` — spot-check displays match rules.

- [ ] **Step 3: Commit only if Step 2 found fixups; otherwise done**

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| `add:100-comp` Finite + both orders | T1 gens, T2 finite |
| `sub:round` {100,1000} only | T1 `genSubRound`, T2 catalog |
| Replace `mul:2d1d` with nc/c | T2 catalog, T3 normalize |
| `mul:3d1d-c` ≥2 adjacent carries | T1 predicate + sample test |
| Narrow `div:multi` + add borrow | T1 `genDiv2d1d`, T2 |
| `mul:zeros` / `div:zeros` split groups | T2 catalog |
| VERTICAL exclude zeros | T2 |
| TIME_TARGETS complete | T2 |
| Settings migration | T3 |
| FAQ / CLAUDE / settings copy | T4 |
| P2 sub:round evolution | **Out of scope** (documented only) |

## Placeholder / consistency self-review

- No TBD left; TIME_TARGETS numeric bands specified in Task 2.
- `genDiv2d1d(false)` is the narrowed `div:multi` generator (same id).
- Normalize semantics: first-wins; legacy expands to nc then c.
- Test imports go through `@rosie/calc` barrel exports added in Tasks 1–3.
