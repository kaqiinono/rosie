#!/usr/bin/env python3
"""Generate docs/sql/chinese-<book>/*.sql from TS backup + hanzi metadata.

Usage: python3 scripts/generate-chinese-upsert.py g1b [g2a g2b ...]
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
REPO = PKG.parents[1]
DICT_CACHE = REPO / "docs/chinese/makemeahanzi-dictionary.txt"
CHAR_BATCH_COUNT = 6
LC_BATCH_SIZE = 200

BOOKS: dict[str, dict[str, object]] = {
    "g1b": {"grade": 1, "semester": "下", "label": "一年级下册"},
    "g2a": {"grade": 2, "semester": "上", "label": "二年级上册"},
    "g2b": {"grade": 2, "semester": "下", "label": "二年级下册"},
}


def db_lesson_key(local_key: str, book_slug: str) -> str:
    """chinese_lessons PK; g1b legacy rows use unprefixed keys."""
    if book_slug == "g1b":
        return local_key
    return f"{book_slug}::{local_key}"

IDS_STRUCTURE = {
    "\u2ff0": "左右",
    "\u2ff1": "上下",
    "\u2ff2": "上中下",
    "\u2ff3": "上中下",
    "\u2ff4": "全包围",
    "\u2ff5": "半包围",
    "\u2ff6": "半包围",
    "\u2ff7": "半包围",
    "\u2ff8": "半包围",
    "\u2ff9": "半包围",
    "\u2ffa": "半包围",
    "\u2ffb": "独体",
}


def load_json_export(path: Path, const_name: str):
    text = path.read_text(encoding="utf-8")
    m = re.search(rf"export const {const_name}.*?= (\[.*\])\n", text, re.S)
    if not m:
        raise SystemExit(f"cannot parse {path}")
    return json.loads(m.group(1))


def hanzi_writer_dir() -> Path:
    out = subprocess.check_output(
        [
            "node",
            "-e",
            "console.log(require('path').dirname(require.resolve('hanzi-writer-data/一.json')))",
        ],
        cwd=str(PKG),
        text=True,
    ).strip()
    return Path(out)


def load_makemeahanzi() -> dict[str, dict]:
    if not DICT_CACHE.exists():
        print(f"Downloading makemeahanzi dictionary → {DICT_CACHE}", file=sys.stderr)
        DICT_CACHE.parent.mkdir(parents=True, exist_ok=True)
        url = "https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt"
        urllib.request.urlretrieve(url, DICT_CACHE)
    by_char: dict[str, dict] = {}
    for line in DICT_CACHE.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        ch = row.get("character")
        if ch and len(ch) == 1:
            by_char[ch] = row
    return by_char


def load_radical_names(data_dir: Path) -> dict[str, str]:
    radicals_path = data_dir / "radicals.ts"
    names: dict[str, str] = {}
    if radicals_path.exists():
        radicals = load_json_export(radicals_path, "RADICALS")
        names = {r["radical"]: r["name"] for r in radicals}
    g1b_radicals = PKG / "src/utils/g1b/radicals.ts"
    if g1b_radicals.exists() and not names:
        radicals = load_json_export(g1b_radicals, "RADICALS")
        names = {r["radical"]: r["name"] for r in radicals}
    extra = {
        "一": "一字旁",
        "二": "二字旁",
        "十": "十字旁",
        "人": "单人旁",
        "亻": "单人旁",
        "口": "口字旁",
        "土": "土字旁",
        "女": "女字旁",
        "子": "子字旁",
        "宀": "宝盖头",
        "寸": "寸字旁",
        "小": "小字头",
        "山": "山字旁",
        "工": "工字旁",
        "巾": "巾字旁",
        "干": "干字旁",
        "幺": "幺字旁",
        "广": "广字头",
        "弓": "弓字旁",
        "心": "心字底",
        "忄": "竖心旁",
        "戈": "戈字旁",
        "手": "手字旁",
        "扌": "提手旁",
        "文": "文字旁",
        "日": "日字旁",
        "月": "月字旁",
        "木": "木字旁",
        "欠": "欠字旁",
        "止": "止字旁",
        "歹": "歹字旁",
        "比": "比字旁",
        "毛": "毛字旁",
        "气": "气字头",
        "水": "水字旁",
        "氵": "三点水",
        "火": "火字旁",
        "灬": "四点底",
        "父": "父字头",
        "牛": "牛字旁",
        "犬": "反犬旁",
        "犭": "反犬旁",
        "王": "王字旁",
        "玉": "玉字旁",
        "瓜": "瓜字旁",
        "瓦": "瓦字旁",
        "甘": "甘字旁",
        "生": "生字旁",
        "田": "田字旁",
        "疋": "衣字旁",
        "白": "白字旁",
        "皮": "皮字旁",
        "目": "目字旁",
        "石": "石字旁",
        "禾": "禾木旁",
        "穴": "穴宝盖",
        "立": "立字旁",
        "竹": "竹字头",
        "米": "米字旁",
        "糸": "绞丝旁",
        "纟": "绞丝旁",
        "羊": "羊字旁",
        "羽": "羽字旁",
        "老": "老字头",
        "而": "而字旁",
        "耳": "耳字旁",
        "肉": "肉字旁",
        "臣": "臣字旁",
        "自": "自字头",
        "至": "至字旁",
        "舌": "舌字旁",
        "舟": "舟字旁",
        "色": "色字旁",
        "艹": "草字头",
        "虫": "虫字旁",
        "血": "血字旁",
        "行": "行字旁",
        "衣": "衣字旁",
        "西": "西字旁",
        "见": "见字旁",
        "角": "角字旁",
        "言": "言字旁",
        "讠": "言字旁",
        "谷": "谷字旁",
        "豆": "豆字旁",
        "豕": "豕字旁",
        "豸": "豸字旁",
        "贝": "贝字旁",
        "赤": "赤字旁",
        "走": "走字旁",
        "足": "足字旁",
        "身": "身字旁",
        "车": "车字旁",
        "辛": "辛字旁",
        "辰": "辰字旁",
        "辶": "走之底",
        "邑": "右耳旁",
        "酉": "酉字旁",
        "釆": "采字头",
        "里": "里字旁",
        "金": "金字旁",
        "钅": "金字旁",
        "长": "长字旁",
        "门": "门字旁",
        "阜": "左耳旁",
        "隶": "隶字旁",
        "雨": "雨字头",
        "青": "青字旁",
        "非": "非字旁",
        "面": "面字旁",
        "革": "革字旁",
        "韦": "韦字旁",
        "韭": "韭字旁",
        "音": "音字旁",
        "页": "页字旁",
        "风": "风字旁",
        "飞": "飞字旁",
        "食": "食字旁",
        "饣": "食字旁",
        "首": "首字旁",
        "香": "香字旁",
        "马": "马字旁",
        "骨": "骨字旁",
        "高": "高字头",
        "髟": "髟字旁",
        "斗": "斗字旁",
        "鬯": "鬯字旁",
        "鬲": "鬲字旁",
        "鬼": "鬼字旁",
        "鱼": "鱼字旁",
        "鸟": "鸟字旁",
        "卤": "卤字旁",
        "鹿": "鹿字旁",
        "麻": "麻字旁",
        "黄": "黄字旁",
        "黍": "黍字旁",
        "黑": "黑字旁",
        "黹": "黹字旁",
        "黾": "黾字旁",
        "鼎": "鼎字旁",
        "鼓": "鼓字旁",
        "鼠": "鼠字旁",
        "鼻": "鼻字旁",
        "齐": "齐字旁",
        "齿": "齿字旁",
        "龙": "龙字旁",
        "龟": "龟字旁",
        "龠": "龠字旁",
    }
    names.update(extra)
    return names


def infer_structure(ch: str, ck: str, char_structure: dict[str, str], mm: dict | None) -> str:
    existing = (char_structure.get(ck) or "").strip()
    if existing:
        return existing
    decomp = (mm or {}).get("decomposition") or ""
    if decomp:
        prefix = decomp[0]
        if prefix in IDS_STRUCTURE:
            return IDS_STRUCTURE[prefix]
    return "独体"


def radical_name_for(radical: str, names: dict[str, str]) -> str:
    if radical in names:
        return names[radical]
    return f"{radical}部"


def sql_str(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def sql_text_array(items: list[str]) -> str:
    if not items:
        return "array[]::text[]"
    return "array[" + ", ".join(sql_str(x) for x in items) + "]::text[]"


def sql_json(obj: object) -> str:
    return sql_str(json.dumps(obj, ensure_ascii=False)) + "::jsonb"


def chunk_rows(rows: list[str], size: int) -> list[list[str]]:
    return [rows[i : i + size] for i in range(0, len(rows), size)]


def write_sql(path: Path, lines: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_batched_inserts(
    out_dir: Path,
    prefix: str,
    table: str,
    columns: str,
    rows: list[str],
    batch_size: int,
) -> list[Path]:
    paths: list[Path] = []
    chunks = chunk_rows(rows, batch_size)
    width = max(2, len(str(len(chunks))))
    for i, chunk in enumerate(chunks, start=1):
        name = f"{prefix}-{i:0{width}d}.sql"
        path = out_dir / name
        write_sql(
            path,
            [
                f"-- AUTO-GENERATED — {table} batch {i}/{len(chunks)}",
                f"insert into public.{table} (",
                columns,
                ") values",
                ",\n".join(chunk) + ";",
            ],
        )
        paths.append(path)
    return paths


def write_verify_sql(
    out_dir: Path,
    grade: int,
    semester: str,
    label: str,
    char_count: int,
    lesson_count: int,
    lc_count: int,
) -> None:
    sem = sql_str(semester)
    lines = [
        f"-- {label}灌库完整性校验（导入全部分片后运行）",
        f"-- 预期：{char_count} 字 · {lesson_count} 课 · {lc_count} 条课字编排",
        "",
        "select 'chinese_lessons' as tbl, count(*) as cnt, "
        + f"{lesson_count} as expected, count(*) = {lesson_count} as ok",
        "from public.chinese_lessons",
        f"where grade = {grade} and semester = {sem}",
        "",
        "union all",
        "",
        f"select 'chinese_char_entries', count(*), {char_count}, count(*) = {char_count}",
        "from public.chinese_char_entries",
        f"where grade = {grade} and semester = {sem}",
        "",
        "union all",
        "",
        f"select 'chinese_lesson_chars', count(*), {lc_count}, count(*) = {lc_count}",
        "from public.chinese_lesson_chars lc",
        "join public.chinese_lessons l on l.lesson_key = lc.lesson_key",
        f"where l.grade = {grade} and l.semester = {sem};",
    ]
    write_sql(out_dir / "99-verify.sql", lines)


def generate_book(book_slug: str, hanzi_dir: Path, mm_dict: dict[str, dict]) -> int:
    if book_slug not in BOOKS:
        print(f"Unknown book slug: {book_slug}", file=sys.stderr)
        return 1

    meta = BOOKS[book_slug]
    grade = int(meta["grade"])
    semester = str(meta["semester"])
    label = str(meta["label"])
    out_dir = REPO / f"docs/sql/chinese-{book_slug}"
    char_key_prefix = f"{book_slug}::"
    data_dir = PKG / f"src/utils/{book_slug}"

    if not data_dir.is_dir():
        print(f"Missing data dir: {data_dir}", file=sys.stderr)
        return 1

    lesson_groups = load_json_export(data_dir / "lesson-chars.ts", "LESSON_CHARS")
    char_backup = load_json_export(data_dir / "chars.ts", "CHARS")
    phrases = load_json_export(data_dir / "phrases.ts", "PHRASES")
    units = load_json_export(data_dir / "units.ts", "UNITS")
    char_structure: dict[str, str] = {c["charKey"]: c.get("structure", "") for c in char_backup}
    unit_type_by_num = {u["unit"]: u["unitType"] for u in units}
    radical_names = load_radical_names(data_dir)

    char_pinyin: dict[str, str] = {}
    char_pinyin_alt: dict[str, set[str]] = defaultdict(set)
    char_tiers: dict[str, set[str]] = defaultdict(set)
    char_phrases: dict[str, set[str]] = defaultdict(set)
    lesson_recall: dict[str, set[str]] = defaultdict(set)

    for g in lesson_groups:
        for track, chars_key, py_key in (
            ("recognize", "recognize", "recognizePinyin"),
            ("write", "write", "writePinyin"),
        ):
            chars = g.get(chars_key, [])
            pys = g.get(py_key, [])
            for ch, py in zip(chars, pys, strict=True):
                ck = f"{char_key_prefix}{ch}"
                char_tiers[ck].add(track)
                if ck not in char_pinyin:
                    char_pinyin[ck] = py
                elif char_pinyin[ck] != py:
                    char_pinyin_alt[ck].add(py)
                    char_pinyin_alt[ck].add(char_pinyin[ck])

    for p in phrases:
        phrase = p["phrase"]
        lk = p["lessonKey"]
        if len(phrase) == 2 and all(len(c) == 1 for c in phrase):
            for ch in phrase:
                ck = f"{char_key_prefix}{ch}"
                if ck in char_tiers or ck in char_pinyin:
                    char_phrases[ck].add(phrase)
        else:
            lesson_recall[lk].add(phrase)

    all_char_keys = sorted(set(char_tiers.keys()) | set(char_pinyin.keys()))
    errors: list[str] = []
    inferred_count = 0

    char_rows: list[str] = []
    for ck in all_char_keys:
        ch = ck.split("::")[-1]
        mm = mm_dict.get(ch)
        hw_path = hanzi_dir / f"{ch}.json"
        if not hw_path.exists():
            errors.append(f"missing hanzi-writer-data for {ch}")
            continue
        hw = json.loads(hw_path.read_text(encoding="utf-8"))
        strokes = hw.get("strokes")
        medians = hw.get("medians")
        if not strokes or not medians:
            errors.append(f"empty hanzi-writer-data for {ch}")
            continue
        radical = (mm or {}).get("radical") or ch
        rname = radical_name_for(radical, radical_names)
        tiers = sorted(char_tiers.get(ck, set()))
        pinyin = char_pinyin.get(ck, "")
        if not pinyin:
            errors.append(f"missing pinyin for {ch}")
            continue
        alt = sorted(char_pinyin_alt.get(ck, set()) - {pinyin})
        phrases_list = sorted(char_phrases.get(ck, set()))
        structure = infer_structure(ch, ck, char_structure, mm)
        if not (char_structure.get(ck) or "").strip():
            inferred_count += 1
        char_rows.append(
            "  ("
            + ", ".join(
                [
                    sql_str(ck),
                    sql_str(ch),
                    str(grade),
                    sql_str(semester),
                    sql_str(pinyin),
                    sql_text_array(alt),
                    sql_str(radical),
                    sql_str(rname),
                    sql_str(structure),
                    str(len(strokes)),
                    sql_text_array(phrases_list),
                    sql_text_array(tiers),
                ]
            )
            + ")"
        )

    lesson_rows: list[str] = []
    for sort_i, g in enumerate(lesson_groups):
        lk = db_lesson_key(g["lessonKey"], book_slug)
        ut = unit_type_by_num.get(g["unit"])
        recall = sorted(lesson_recall.get(lk, set()))
        lesson_rows.append(
            "  ("
            + ", ".join(
                [
                    sql_str(lk),
                    str(grade),
                    sql_str(semester),
                    str(g["unit"]),
                    str(g["lesson"]),
                    sql_str(g["lessonTitle"]),
                    sql_str(g.get("lessonKind", "lesson")),
                    sql_str(ut) if ut else "null",
                    str(sort_i),
                    sql_text_array(recall),
                ]
            )
            + ")"
        )

    lc_rows: list[str] = []
    for g in lesson_groups:
        lk = db_lesson_key(g["lessonKey"], book_slug)
        for track, chars_key, py_key in (
            ("recognize", "recognize", "recognizePinyin"),
            ("write", "write", "writePinyin"),
        ):
            chars = g.get(chars_key, [])
            pys = g.get(py_key, [])
            for i, (ch, py) in enumerate(zip(chars, pys, strict=True)):
                ck = f"{char_key_prefix}{ch}"
                lc_rows.append(
                    "  ("
                    + ", ".join(
                        [
                            sql_str(lk),
                            sql_str(ck),
                            sql_str(track),
                            str(i),
                            sql_str(py),
                        ]
                    )
                    + ")"
                )

    if errors:
        print(f"FAIL — cannot generate upsert for {book_slug}:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1

    sem = sql_str(semester)
    delete_sql = [
        f"-- AUTO-GENERATED — delete {label} content before re-import",
        "-- ⚠️ 仅重建该册时使用；首次增量灌库请跳过此文件",
        "",
        "delete from public.chinese_lesson_chars where lesson_key in (",
        f"  select lesson_key from public.chinese_lessons where grade = {grade} and semester = {sem}",
        ");",
        f"delete from public.chinese_char_entries where grade = {grade} and semester = {sem};",
        f"delete from public.chinese_lessons where grade = {grade} and semester = {sem};",
    ]
    write_sql(out_dir / "00-delete.sql", delete_sql)

    write_sql(
        out_dir / "01-lessons.sql",
        [
            f"-- AUTO-GENERATED — chinese_lessons ({label})",
            "insert into public.chinese_lessons (",
            "  lesson_key, grade, semester, unit, lesson, lesson_title, lesson_kind, unit_type, sort_order, recall_phrases",
            ") values",
            ",\n".join(lesson_rows) + ";",
        ],
    )

    char_cols = (
        "  char_key, char, grade, semester, pinyin, pinyin_alt, radical, radical_name,\n"
        "  structure, stroke_count, phrases, tiers"
    )
    char_batch_size = max(1, (len(char_rows) + CHAR_BATCH_COUNT - 1) // CHAR_BATCH_COUNT)
    char_paths = write_batched_inserts(
        out_dir,
        "02-chars",
        "chinese_char_entries",
        char_cols,
        char_rows,
        char_batch_size,
    )

    lc_cols = "  lesson_key, char_key, track, sort_order, pinyin_in_lesson"
    lc_paths = write_batched_inserts(
        out_dir,
        "03-lesson-chars",
        "chinese_lesson_chars",
        lc_cols,
        lc_rows,
        LC_BATCH_SIZE,
    )

    write_verify_sql(out_dir, grade, semester, label, len(char_rows), len(lesson_rows), len(lc_rows))

    run_order = ["00-delete.sql", "01-lessons.sql"]
    run_order += [p.name for p in char_paths]
    run_order += [p.name for p in lc_paths]

    readme = [
        f"# {label}字库灌库（分片 SQL）",
        "",
        "**首次灌库：** 跳过 `00-delete.sql`，从 `01-lessons.sql` 起按顺序执行。",
        "**重建该册：** 先跑 `00-delete.sql`，再跑其余分片。",
        "",
    ]
    for i, name in enumerate(run_order, start=1):
        readme.append(f"{i}. `{name}`")
    readme += [
        "",
        "**校验：** `99-verify.sql`",
        "",
        f"共 {len(char_rows)} 字 · {len(lesson_rows)} 课 · {len(lc_rows)} 条课字编排",
        f"（其中 {inferred_count} 字的 structure 由 IDS 分解推断）",
        "",
        f"重新生成：`python3 packages/chinese/scripts/generate-chinese-upsert.py {book_slug}`",
    ]
    write_sql(out_dir / "README.md", readme)

    for stale in out_dir.glob("[0-9][0-9]-*.sql"):
        if stale.name == "99-verify.sql":
            continue
        if stale.name not in run_order:
            stale.unlink()

    print(
        f"[{book_slug}] Wrote {len(run_order) + 1} files under {out_dir} "
        f"({len(char_rows)} chars, {inferred_count} inferred structures)"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate chinese SQL upserts from TS backup")
    parser.add_argument(
        "books",
        nargs="*",
        default=["g1b"],
        help="book slugs: g1b, g2a, g2b",
    )
    args = parser.parse_args()

    hanzi_dir = hanzi_writer_dir()
    mm_dict = load_makemeahanzi()

    rc = 0
    for book in args.books:
        if generate_book(book, hanzi_dir, mm_dict) != 0:
            rc = 1
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
