#!/usr/bin/env python3
"""Verify grade-1-down data in packages/chinese (no pypinyin dependency)."""
from __future__ import annotations

import json
import re
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
LESSON_CHARS_TS = PKG / "src/utils/g1b/lesson-chars.ts"
POEMS_TS = PKG / "src/utils/g1b/poems.ts"
PHRASES_TS = PKG / "src/utils/g1b/phrases.ts"

POLYPHONIC_RELEARN = frozenset({"得", "乐", "背"})


def load_json_export(path: Path, const_name: str):
    text = path.read_text(encoding="utf-8")
    m = re.search(rf"export const {const_name}.*?= (\[.*\])\n", text, re.S)
    if not m:
        raise SystemExit(f"cannot parse {path}")
    return json.loads(m.group(1))


def main() -> int:
    errors: list[str] = []
    groups = load_json_export(LESSON_CHARS_TS, "LESSON_CHARS")
    poems = load_json_export(POEMS_TS, "POEMS")
    phrases = load_json_export(PHRASES_TS, "PHRASES")

    all_r: list[str] = []
    all_w: list[str] = []
    for g in groups:
        key = g["lessonKey"]
        for ch in g.get("recognize", []):
            if len(ch) != 1:
                errors.append(f"bad recognize char {key}: {ch!r}")
            all_r.append(ch)
        for ch in g.get("write", []):
            if len(ch) != 1:
                errors.append(f"bad write char {key}: {ch!r}")
            all_w.append(ch)
        # pinyin arrays must match char arrays
        if len(g.get("recognize", [])) != len(g.get("recognizePinyin", [])):
            errors.append(f"recognize/pinyin length mismatch: {key}")
        if len(g.get("write", [])) != len(g.get("writePinyin", [])):
            errors.append(f"write/pinyin length mismatch: {key}")

    r_set = set(all_r)
    w_set = set(all_w)
    official = len(r_set - POLYPHONIC_RELEARN)
    if official != 410:
        errors.append(f"recognize official unique {official}, expected 410")
    if len(w_set) != 200:
        errors.append(f"write unique {len(w_set)}, expected 200")

    if any(p.get("lessonKey") == "u3-l4" for p in phrases):
        errors.append("phrases wrongly on u3-l4")

    for p in poems:
        for line in p.get("lines", []):
            if not line.strip():
                errors.append(f"empty line in poem {p.get('title')}")

    if errors:
        print("FAIL:")
        for e in errors:
            print(" -", e)
        return 1

    print("OK: 数据校验通过（识字410/写字200/拼音长度一致）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
