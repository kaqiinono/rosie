#!/usr/bin/env python3
"""Write every lesson-passages.ts from web + textbook-page verified sources."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from curated_passages_data import CURATED_PASSAGES, LESSON_ORDER  # noqa: E402
from curated_g2_passages import CURATED_G2_PASSAGES  # noqa: E402

OUT_ROOT = SCRIPT_DIR.parent / "src/utils"


def write_passages(book: str, entries: list[dict[str, object]], source: str) -> None:
    out = OUT_ROOT / book / "lesson-passages.ts"
    body = json.dumps(entries, ensure_ascii=False, indent=2)
    out.write_text(
        f"""// 部编版课文原文 — 对照现行教材页面 + 独立网络来源人工校对
// 数据源: packages/chinese/scripts/{source}
// 重新生成: python3 packages/chinese/scripts/extract-lesson-passages.py

import type {{ LessonPassageEntry }} from './types'

export const LESSON_PASSAGES: LessonPassageEntry[] = {body}
""",
        encoding="utf-8",
    )
    paragraph_count = sum(len(entry["paragraphs"]) for entry in entries)
    print(f"Wrote {out} ({len(entries)} lessons, {paragraph_count} paragraphs)")


def main() -> None:
    g1b_entries = [
        {"lessonKey": key, "paragraphs": CURATED_PASSAGES[key]}
        for key in LESSON_ORDER
    ]
    missing = set(LESSON_ORDER) - set(CURATED_PASSAGES)
    if missing:
        raise SystemExit(f"Missing curated passages: {sorted(missing)}")

    write_passages("g1b", g1b_entries, "curated_passages_data.py")

    for book, expected_count in (("g2a", 27), ("g2b", 28)):
        prefix = f"{book}::"
        keys = sorted(
            (key for key in CURATED_G2_PASSAGES if key.startswith(prefix)),
            key=lambda key: tuple(
                int(part[1:]) for part in key.split("::", 1)[1].split("-")
            ),
        )
        if len(keys) != expected_count:
            raise SystemExit(
                f"Expected {expected_count} curated passages for {book}, got {len(keys)}"
            )
        entries = [
            {
                "lessonKey": key.split("::", 1)[1],
                "paragraphs": CURATED_G2_PASSAGES[key],
            }
            for key in keys
        ]
        write_passages(book, entries, "curated_g2_passages.py")


if __name__ == "__main__":
    main()
