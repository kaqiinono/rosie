#!/usr/bin/env python3
"""Audit flash-card phrase coverage for every lesson in one or more Chinese books."""
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]

# 组词不含本字但经复核确认为教师材料（课课贴）原表印刷内容的例外（疑为「相亲相爱」拆印）
PHRASE_EXCEPTIONS = {"相亲"}


def load_json_export(path: Path, const_name: str):
    text = path.read_text(encoding="utf-8")
    match = re.search(rf"export const {const_name}.*?= (\[.*\])\n", text, re.S)
    if not match:
        raise SystemExit(f"cannot parse {path}")
    return json.loads(match.group(1))


def audit_book(book_slug: str) -> tuple[int, int, int, int, int, list[str]]:
    data_dir = PKG / "src" / "utils" / book_slug
    chars = load_json_export(data_dir / "chars.ts", "CHARS")
    groups = load_json_export(data_dir / "lesson-chars.ts", "LESSON_CHARS")
    lesson_phrases = load_json_export(data_dir / "phrases.ts", "PHRASES")
    profiles = {row["char"]: row for row in chars}
    used_chars = {
        char
        for group in groups
        for char in group.get("recognize", []) + group.get("write", [])
    }
    generated_phrases: dict[str, set[str]] = defaultdict(set)
    for row in chars:
        # phrases 条目可能是纯字符串或打标对象 {text, source}
        generated_phrases[row["char"]].update(
            text
            for text in (
                (phrase.get("text", "") if isinstance(phrase, dict) else str(phrase)).strip()
                for phrase in row.get("phrases", [])
            )
            if text
        )
    for row in lesson_phrases:
        phrase = row["phrase"].strip()
        if len(phrase) == 2:
            for char in phrase:
                if char in used_chars:
                    generated_phrases[char].add(phrase)
    issues: list[str] = []
    card_count = 0
    missing_profile_count = 0
    missing_phrase_count = 0
    unrelated_phrase_count = 0

    for group in groups:
        lesson_chars = list(dict.fromkeys(group.get("recognize", []) + group.get("write", [])))
        if not lesson_chars:
            continue
        card_count += len(lesson_chars)
        missing_profiles: list[str] = []
        missing_phrases: list[str] = []
        unrelated_phrases: list[str] = []

        for char in lesson_chars:
            profile = profiles.get(char)
            if profile is None:
                missing_profiles.append(char)
                continue
            phrases = sorted(generated_phrases[char])
            if not phrases:
                missing_phrases.append(char)
            elif any(char not in phrase and phrase not in PHRASE_EXCEPTIONS for phrase in phrases):
                unrelated_phrases.append(char)

        prefix = f"{book_slug}/{group['lessonKey']}《{group['lessonTitle']}》"
        if missing_profiles:
            missing_profile_count += len(missing_profiles)
            issues.append(f"{prefix} missing-profile: {' '.join(missing_profiles)}")
        if missing_phrases:
            missing_phrase_count += len(missing_phrases)
            issues.append(f"{prefix} missing-phrases: {' '.join(missing_phrases)}")
        if unrelated_phrases:
            unrelated_phrase_count += len(unrelated_phrases)
            issues.append(f"{prefix} phrase-without-char: {' '.join(unrelated_phrases)}")

    return (
        len(groups),
        card_count,
        missing_profile_count,
        missing_phrase_count,
        unrelated_phrase_count,
        issues,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("books", nargs="*", default=["g1b", "g2a", "g2b"])
    args = parser.parse_args()

    all_issues: list[str] = []
    for book in args.books:
        (
            lesson_count,
            card_count,
            missing_profile_count,
            missing_phrase_count,
            unrelated_phrase_count,
            issues,
        ) = audit_book(book)
        all_issues.extend(issues)
        affected_lessons = len({issue.split(" ", 1)[0] for issue in issues})
        print(
            f"[{book}] lessons={lesson_count} cards={card_count} "
            f"affected_lessons={affected_lessons} missing_profiles={missing_profile_count} "
            f"missing_phrases={missing_phrase_count} unrelated_phrases={unrelated_phrase_count}"
        )

    if all_issues:
        print("\nDETAILS:")
        for issue in all_issues:
            print(f" - {issue}")
        return 1

    print("\nOK: all flash cards have character-specific phrases")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
