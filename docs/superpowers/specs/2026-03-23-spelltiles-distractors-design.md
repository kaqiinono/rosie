# SpellTiles Distractor Tiles — Design Spec

## Overview

Add distractor (fake) letter tiles to the SpellTiles component pool so that the correct answer cannot be identified simply by inspecting the available letters.

## Scope

Single file change: `src/components/english/words/SpellTiles.tsx`. No interface or prop changes.

## Distractor Count Formula

```
distractorCount =
  totalLetters >= 10
    ? 0
    : Math.min(Math.ceil(totalLetters * 0.5), 10 - totalLetters)
```

Examples:
- 4-letter word → 2 distractors (6 total)
- 6-letter word → 3 distractors (9 total)
- 8-letter word → 2 distractors (capped at 10)
- 10+ letter word → 0 distractors

## Distractor Letter Selection

- Build a `Set` of all unique letters in the word
- Shuffle the 26-letter alphabet
- Take the first `distractorCount` letters that are NOT in the word's letter set

## Pool Construction

1. Build real-letter tiles as today: `{ letter, id }` with IDs 0…(n-1)
2. Append distractor tiles with IDs continuing from n
3. Shuffle the combined array (real + distractors) using Fisher-Yates
4. Store in the existing `pool` state — no type changes needed

## Display

- Remove the `uppercase` Tailwind class from both pool tiles and answer slots so all letters render as lowercase.
- Distractor tiles look identical to real tiles; no visual distinction.

## Submit Logic

Unchanged. Slots map to pool tile IDs; placing a distractor letter in a slot causes the assembled answer to mismatch the target word, resulting in a wrong answer.

## Out of Scope

- No prop changes to SpellTiles
- No changes to QuizCard or any other file
- No hint system or distractor highlighting
