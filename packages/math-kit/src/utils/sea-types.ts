// Pure type declarations for the 海域 sea bank, deliberately free of any runtime
// import (no lesson data, no aggregators). Foundation-layer files (e.g. shared
// FilterPanel) type-import from here instead of `sea-data`, so they don't depend
// on the cross-lesson aggregator. See docs/math/math-package-split-design.md (Phase 0).

import type { Problem, ProblemSet } from '@rosie/core'

/** A lesson entry in the 海域 sea bank. */
export interface SeaLessonMeta {
  id: string
  title: string
  shortTitle: string
  icon: string
  badgeClass: string // tailwind classes for lesson badge
  tagStyle: Record<string, string>
  types: { tag: string; label: string }[]
  problems: ProblemSet
}

/** A single problem flattened out of a sea lesson, with its route. */
export interface SeaProblem {
  problem: Problem
  lessonId: string
  section: string
  href: string
}
