# Monorepo migration — bugs, mistakes & lessons

A record of every bug and mistake made during the 2026-06 pnpm/Turborepo migration
(single Next.js app → `apps/web` + `packages/{core,ui,rewards,player,calc,math,english,flipbook,audio}`),
so we don't repeat them. Ordered roughly by how much pain they caused.

> **#1 meta-lesson — a green build does NOT mean it works.**
> `pnpm typecheck` and `pnpm build` passed at *every* phase, yet the homepage was visibly
> broken (see Tailwind bug below). Compile success ≠ correct runtime/render. **For any change
> that affects the UI, look at the rendered page** (`pnpm dev`, or screenshot it), not just the
> build exit code.

---

## 1. Tailwind v4 stopped styling package components  ⚠️ highest impact

**Symptom:** after extracting components into `packages/*`, the homepage (and every page using
`@rosie/*` components) rendered **unstyled** — "首页大变样". Build was green the whole time.

**Cause:** Tailwind v4's automatic content detection only scans `apps/web`. Utility classes used
**only inside package components** (`OrbBackground`, `ModuleCard`, …) were never generated. Built
CSS was ~132 KB when it should be ~302 KB — half the classes silently missing.

**Fix:** add `@source` directives in `apps/web/src/app/globals.css` for every package:
```css
@import "tailwindcss";
@source "../../../../packages/core/src";
@source "../../../../packages/ui/src";
/* … all 9 packages … */
```

**Rule:** in a Tailwind-v4 monorepo, **every new `packages/<x>/src` that contains JSX must get an
`@source` line.** A class miss never fails the build — verify the rendered UI.

---

## 2. Deep-subpath package resolution (`@rosie/math`)

`@rosie/math` uses deep subpaths (`@rosie/math/components/lesson35/HomePage`) because every lesson
shares export names (`HomePage`/`PROBLEMS`), so a barrel collides. Getting both `tsc` and webpack
to resolve mixed `.ts`/`.tsx` deep subpaths took three tries:

- ❌ `exports: { "./*": "./src/*" }` (extensionless) → **tsc fails** (TS won't append extensions to
  bare exports wildcards) — 763 errors.
- ❌ `exports: { "./*": ["./src/*.ts","./src/*.tsx"] }` (array) → **tsc passes but webpack fails**
  on `.tsx` (enhanced-resolve doesn't fall through the array).
- ✅ **Working combo (all three needed):**
  - package `exports: { "./*": "./src/*" }` (extensionless — webpack appends the ext)
  - `apps/web/tsconfig.json` `paths`: `"@rosie/math/*": ["../../packages/math/src/*"]` (app tsc)
  - `packages/math/tsconfig.json` `paths`: `"@rosie/math/*": ["./src/*"]` (the package's own
    scoped tsc — a package can't resolve its own name via node_modules)

**Rule:** prefer a **barrel** (like every other package). Only use deep subpaths when export names
collide, and then wire up all three resolution pieces. See `packages/math/CLAUDE.md`.

**Related mistake:** I told the math subagent to repoint imports to `@rosie/math/*` "everywhere,
including inside the package." That created 288 **self-referential** imports needing the
package-level paths alias. Inside a package, prefer **relative** imports (what calc/english did).

---

## 3. Reading refLink mismatch (refactor correctness)

When refactoring reading to build its own play queue, I set the track `refLink` to
`reading/${key}`, but the page's "playing" highlight compared against
`/english/words/reading/${key}`. Mismatch → the highlight silently never fired.

**Rule:** when refactoring, **preserve the exact values other code compares against** (grep for
the literal before changing it).

---

## 4. Subagent workflow

- The **math subagent hit its own session limit mid-task** and didn't commit — leaving a half-done,
  uncommitted, partially-broken tree. Its final report was truncated/misleading.
- **Rule:** brief subagents to **commit as soon as green** and **report exactly where they stopped**.
  Always **verify the subagent's actual repo state yourself** (`git status`, `git log`, typecheck) —
  don't trust the summary. Be ready to finish their work.
- The english/flipbook+audio subagents (tighter briefs, "commit-when-green") completed cleanly.

---

## 5. BSD sed (macOS) pitfalls

- Used `|` as the `s#…#…#` delimiter while the pattern contained `|` (a `(a|b|c)` alternation) →
  `RE error: parentheses not balanced`, and sed **aborted the whole pass silently** (no edits).
  → **Use a delimiter not present in the pattern** (`#` worked).
- Backreference `\1` **in the ERE pattern** (not the replacement) is unsupported in BSD sed — it
  silently didn't match. → don't rely on it.
- Import styles came in **both single and double quotes** (`from '…'` and `from "…"`); a
  single-quote-only sed missed the double-quoted ones. → handle both.

**Rule:** after any scripted repoint, `grep` for leftovers and run typecheck — never assume the
sed did what you intended.

---

## 6. Per-package dependency / config gaps (caught by scoped typecheck)

- `@rosie/math` imported `@supabase/supabase-js` but didn't declare it; `@rosie/core` used
  `process.env` (needs `@types/node`) and `next/navigation` (needs `next`).
- `@rosie/english/flipbook/audio` needed a `src/styled-jsx.d.ts`
  (`/// <reference types="styled-jsx" />`) + `styled-jsx` devDep so isolated `tsc` resolves the
  `<style jsx>` `jsx` prop (it follows imports into english's source).

**Rule:** **each package must declare every npm dep its files import.** Run
`pnpm --filter @rosie/<x> typecheck` (scoped) — it catches missing deps the app build hides.

---

## 7. Smaller things

- Pre-existing broken `/calc/demo` (three empty committed files) failed the build independently of
  the migration — deleted per the owner's decision. Lesson: when a build fails, separate
  *pre-existing* breakage from breakage you introduced (check `master`).
- `add-lesson` skill had a malformed frontmatter key (`说明description:` → `description:`) — fixed
  while moving skills into the project.

---

## The short checklist for extracting the next module into a package

1. Move `components/hooks/utils` into `packages/<x>/src`; **routes stay in `apps/web/src/app`**.
2. Internal imports → **relative**. External → `@rosie/<dep>` (only along the dependency DAG).
3. `package.json`: declare **every** npm dep the files import; deps on other `@rosie/*` as
   `workspace:*`. Barrel `exports: { ".": "./src/index.ts" }` unless export names collide.
4. Add the package to `apps/web` deps + `transpilePackages` in `next.config.ts`.
5. **Add `@source "../../../../packages/<x>/src";` to `globals.css`.** ← easy to forget, breaks styling.
6. Repoint consumers (default→named for barrel); `grep` for leftovers.
7. Verify: `pnpm --filter @rosie/<x> typecheck` → `pnpm --filter web typecheck` → `pnpm build`
   → **open the affected pages in a browser** and look at them.
8. Write `packages/<x>/CLAUDE.md`; commit.
