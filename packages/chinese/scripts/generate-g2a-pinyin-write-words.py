#!/usr/bin/env python3
"""Generate packages/chinese/src/utils/g2a/pinyin-write-words.ts from g2a-words.pdf answers."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

try:
    from pypinyin import Style, pinyin
except ImportError:
    print("pip install pypinyin", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[3]
PDF = ROOT / "docs/tmp/chinese/g2a-words.pdf"
OUT = Path(__file__).resolve().parents[1] / "src/utils/g2a/pinyin-write-words.ts"

LESSON_NUM_MAP = {
    1: ("u1-l1", "小蝌蚪找妈妈", 1),
    2: ("u1-l2", "我是什么", 1),
    3: ("u1-l3", "植物妈妈有办法", 1),
    4: ("u3-l4", "彩虹", 3),
    5: ("u3-l5", "去外婆家", 3),
    6: ("u3-l6", "数星星的孩子", 3),
    7: ("u3-l6", "数星星的孩子", 3),
    8: ("u4-l7", "古诗二首", 4),
    9: ("u4-l8", "黄山奇石", 4),
    10: ("u4-l9", "日月潭", 4),
    11: ("u4-l10", "葡萄沟", 4),
    12: ("u5-l11", "坐井观天", 5),
    13: ("u5-l12", "寒号鸟", 5),
    14: ("u5-l13", "我要的是葫芦", 5),
    15: ("u6-l14", "八角楼上", 6),
    16: ("u6-l15", "朱德的扁担", 6),
    17: ("u6-l16", "难忘的泼水节", 6),
    18: ("u7-l18", "古诗二首", 7),
    19: ("u7-l19", "雾在哪里", 7),
    20: ("u7-l20", "雪孩子", 7),
    21: ("u8-l21", "称赞", 8),
    22: ("u8-l22", "纸船和风筝", 8),
    23: ("u8-l23", "快乐的小河", 8),
    24: ("u8-l23", "快乐的小河", 8),
    25: ("u8-l23", "快乐的小河", 8),
}
LITERACY_MAP = {
    1: ("u2-l1", "场景歌", 2),
    2: ("u2-l2", "树之歌", 2),
    3: ("u2-l3", "拍手歌", 2),
    4: ("u2-l4", "田家四季歌", 2),
}

NOISE = re.compile(r"更多免费|微信|vivian|vｉｖｉａｎ", re.I)
WORD_RE = re.compile(r"[\u4e00-\u9fff]{2,8}")


def word_pinyin(word: str) -> str:
    return " ".join(s[0] for s in pinyin(word, style=Style.TONE, heteronym=False))


def extract_text() -> str:
    result = subprocess.run(
        ["pdftotext", str(PDF), "-"],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout


def parse_answers(text: str) -> list[tuple[str, str, int, str]]:
    start = text.find("新人教版二年级上册生字扩词答案")
    if start < 0:
        raise SystemExit("answer section not found in PDF text")
    current = None
    seen: set[tuple[str, str]] = set()
    results: list[tuple[str, str, int, str]] = []

    for line in text[start:].splitlines():
        line = line.strip()
        if not line or NOISE.search(line) or line.startswith("新人教版"):
            continue
        lit = re.match(r"^识字\s*(\d+)", line)
        if lit:
            current = LITERACY_MAP.get(int(lit.group(1)))
            continue
        num = re.match(r"^(\d+)$", line)
        if num:
            current = LESSON_NUM_MAP.get(int(num.group(1)))
            continue
        if re.match(r"^[a-zāáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜńňǹ\s]+$", line, re.I):
            continue
        if current is None:
            continue
        key, title, unit = current
        for word in WORD_RE.findall(line):
            dedupe = (key, word)
            if dedupe in seen:
                continue
            seen.add(dedupe)
            results.append((key, title, unit, word))
    return results


def main() -> None:
    entries = parse_answers(extract_text())
    lines = [
        "// AUTO-GENERATED from docs/tmp/chinese/g2a-words.pdf answer section",
        "// 看拼音写词语 — 二年级上册",
        "// Regenerate: python3 packages/chinese/scripts/generate-g2a-pinyin-write-words.py",
        "",
        "import type { PinyinWriteWordEntry } from '../g1b/pinyin-write-words'",
        "",
        "export const PINYIN_WRITE_WORDS: PinyinWriteWordEntry[] = [",
    ]
    for key, title, unit, word in entries:
        py = word_pinyin(word)
        lines.append(
            f'  {{ lessonKey: "{key}", lessonTitle: "{title}", unit: {unit}, word: "{word}", pinyin: "{py}" }},'
        )
    lines.append("]")
    lines.append(f"// Total: {len(entries)} words")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {len(entries)} entries to {OUT}")


if __name__ == "__main__":
    main()
