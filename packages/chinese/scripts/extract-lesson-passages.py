#!/usr/bin/env python3
"""Write lesson-passages.ts from curated_passages_data.py (web + PDF verified)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from curated_passages_data import CURATED_PASSAGES, LESSON_ORDER  # noqa: E402

OUT = SCRIPT_DIR.parent / "src/utils/g1b/lesson-passages.ts"


def main() -> None:
    entries = [
        {"lessonKey": key, "paragraphs": CURATED_PASSAGES[key]}
        for key in LESSON_ORDER
    ]
    missing = set(LESSON_ORDER) - set(CURATED_PASSAGES)
    if missing:
        raise SystemExit(f"Missing curated passages: {sorted(missing)}")

    body = json.dumps(entries, ensure_ascii=False, indent=2)
    OUT.write_text(
        f"""// 部编版一年级下册课文原文 — 对照教材 PDF + 网络教辅人工校对
// 数据源: packages/chinese/scripts/curated_passages_data.py
// 重新生成: python3 packages/chinese/scripts/extract-lesson-passages.py

import type {{ LessonPassageEntry }} from './types'

export const LESSON_PASSAGES: LessonPassageEntry[] = {body}
""",
        encoding="utf-8",
    )
    total = sum(len(CURATED_PASSAGES[k]) for k in LESSON_ORDER)
    print(f"Wrote {OUT} ({len(LESSON_ORDER)} lessons, {total} paragraphs)")


if __name__ == "__main__":
    main()
