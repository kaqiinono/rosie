#!/usr/bin/env python3
"""Verify Chinese TS backup for one or more book slugs."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]

POLYPHONIC_RELEARN = frozenset({"得", "乐", "背"})
SUSPICIOUS_PASSAGE_RE = re.compile(r"[\u2000-\u200f\u2028-\u202f\ufeff]")


def load_json_export(path: Path, const_name: str):
    text = path.read_text(encoding="utf-8")
    m = re.search(rf"export const {const_name}.*?= (\[.*\])\n", text, re.S)
    if not m:
        raise SystemExit(f"cannot parse {path}")
    return json.loads(m.group(1))


def verify_book(book_slug: str) -> list[str]:
    errors: list[str] = []
    data_dir = PKG / f"src/utils/{book_slug}"
    stats_path = data_dir / "stats.json"

    if not data_dir.is_dir():
        return [f"missing data dir: {data_dir}"]

    groups = load_json_export(data_dir / "lesson-chars.ts", "LESSON_CHARS")
    poems = load_json_export(data_dir / "poems.ts", "POEMS")
    phrases = load_json_export(data_dir / "phrases.ts", "PHRASES")
    units = load_json_export(data_dir / "units.ts", "UNITS")
    passages = load_json_export(data_dir / "lesson-passages.ts", "LESSON_PASSAGES")
    stats = json.loads(stats_path.read_text(encoding="utf-8")) if stats_path.exists() else {}

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
        if len(g.get("recognize", [])) != len(g.get("recognizePinyin", [])):
            errors.append(f"recognize/pinyin length mismatch: {key}")
        if len(g.get("write", [])) != len(g.get("writePinyin", [])):
            errors.append(f"write/pinyin length mismatch: {key}")

    r_set = set(all_r)
    w_set = set(all_w)

    if book_slug == "g1b":
        expected_r = stats.get("recognizeOfficialUnique") or stats.get("targetRecognizeTable")
    else:
        expected_r = stats.get("recognizeListUnique") or stats.get("targetRecognizeTable")
    expected_w = stats.get("writeListUnique") or stats.get("targetWriteTable")
    if expected_r is not None:
        official = len(r_set - POLYPHONIC_RELEARN) if book_slug == "g1b" else len(r_set)
        if official != expected_r:
            errors.append(
                f"[{book_slug}] recognize unique {official}, expected {expected_r} "
                f"(raw {len(r_set)})"
            )
    if expected_w is not None and len(w_set) != expected_w:
        errors.append(f"[{book_slug}] write unique {len(w_set)}, expected {expected_w}")

    for p in poems:
        for line in p.get("lines", []):
            if not line.strip():
                errors.append(f"empty line in poem {p.get('title')}")

    if book_slug == "g1b" and any(p.get("lessonKey") == "u3-l4" for p in phrases):
        errors.append("phrases wrongly on u3-l4")

    expected_passage_keys = {
        f"u{unit['unit']}-l{lesson['lesson']}"
        for unit in units
        for lesson in unit.get("lessons", [])
        if lesson.get("lesson", 0) > 0
    }
    passage_keys = [entry.get("lessonKey") for entry in passages]
    passage_by_key = {entry.get("lessonKey"): entry for entry in passages}
    duplicate_passage_keys = sorted(
        key for key in set(passage_keys) if passage_keys.count(key) > 1
    )
    missing_passages = sorted(expected_passage_keys - set(passage_by_key))
    extra_passages = sorted(set(passage_by_key) - expected_passage_keys)
    if missing_passages:
        errors.append(f"[{book_slug}] missing passages: {', '.join(missing_passages)}")
    if extra_passages:
        errors.append(f"[{book_slug}] unknown passages: {', '.join(extra_passages)}")
    if duplicate_passage_keys:
        errors.append(
            f"[{book_slug}] duplicate passages: {', '.join(duplicate_passage_keys)}"
        )

    for key, entry in passage_by_key.items():
        paragraphs = entry.get("paragraphs", [])
        if not paragraphs or any(not paragraph.strip() for paragraph in paragraphs):
            errors.append(f"[{book_slug}] empty passage/paragraph: {key}")
            continue
        joined = "".join(paragraphs)
        if SUSPICIOUS_PASSAGE_RE.search(joined):
            errors.append(f"[{book_slug}] suspicious whitespace/control character: {key}")
        if len(joined) >= 180 and len(paragraphs) == 1:
            errors.append(f"[{book_slug}] long passage is not split into paragraphs: {key}")
        if len(joined) >= 60 and not re.search(r"[。！？；…]", joined):
            errors.append(f"[{book_slug}] long passage has no sentence punctuation: {key}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("books", nargs="*", default=["g1b"])
    args = parser.parse_args()

    all_errors: list[str] = []
    for book in args.books:
        all_errors.extend(verify_book(book))

    if all_errors:
        print("FAIL:")
        for e in all_errors:
            print(" -", e)
        return 1

    print(
        f"OK: 结构校验通过（{', '.join(args.books)}；"
        "组词完整性请运行 audit-card-phrases）"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
