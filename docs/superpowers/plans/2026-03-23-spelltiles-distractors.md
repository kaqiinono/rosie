# SpellTiles Distractor Tiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add distractor letter tiles to SpellTiles so the pool contains extra wrong letters, preventing the correct answer from being identified by inspection.

**Architecture:** Single-file change in `SpellTiles.tsx`. Distractor generation is added to the existing `pool` useState initializer — no prop or interface changes. Display is updated to lowercase by removing the `uppercase` Tailwind class from slots and pool tiles.

**Tech Stack:** React, TypeScript, Tailwind CSS v4, Next.js 15

---

### Task 1: Add distractor generation to pool initializer

**Files:**
- Modify: `src/components/english/words/SpellTiles.tsx`

- [ ] **Step 1: Update the `pool` useState initializer**

Replace the pool initializer (lines 29–37) with one that appends distractor tiles after the real letters, then shuffles everything together:

```tsx
const [pool] = useState<{ letter: string; id: number }[]>(() => {
  const letters = word.replace(/ /g, '').split('')
  const arr = letters.map((letter, id) => ({ letter, id }))

  // Generate distractors: proportional count, capped so total <= 10
  const distractorCount =
    letters.length >= 10
      ? 0
      : Math.min(Math.ceil(letters.length * 0.5), 10 - letters.length)

  if (distractorCount > 0) {
    const wordLetterSet = new Set(letters)
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('')
    // Shuffle alphabet to get random order
    for (let i = alphabet.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[alphabet[i], alphabet[j]] = [alphabet[j], alphabet[i]]
    }
    let added = 0
    for (const ch of alphabet) {
      if (added >= distractorCount) break
      if (!wordLetterSet.has(ch)) {
        arr.push({ letter: ch, id: letters.length + added })
        added++
      }
    }
  }

  // Fisher-Yates shuffle of full pool (real + distractors)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
})
```

- [ ] **Step 2: Remove `uppercase` from answer slot tiles**

In the answer slot `div` (around line 106), remove `uppercase` from the className:

Before:
```tsx
className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center font-nunito font-black text-[1.1rem] text-[#f0f0ff] uppercase transition-all select-none ${cls}`}
```

After:
```tsx
className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center font-nunito font-black text-[1.1rem] text-[#f0f0ff] transition-all select-none ${cls}`}
```

- [ ] **Step 3: Remove `uppercase` from pool tile buttons**

In the pool tile `button` (around line 126), remove `uppercase` from the className:

Before:
```tsx
className={`w-10 h-10 rounded-lg border-2 font-nunito font-black text-[1.1rem] uppercase transition-all ${...}`}
```

After:
```tsx
className={`w-10 h-10 rounded-lg border-2 font-nunito font-black text-[1.1rem] transition-all ${...}`}
```

- [ ] **Step 4: Run lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/english/words/SpellTiles.tsx
git commit -m "feat: add distractor tiles to SpellTiles pool"
```
