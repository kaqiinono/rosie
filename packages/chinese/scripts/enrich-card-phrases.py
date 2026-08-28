#!/usr/bin/env python3
"""Resumable, dual-source enrichment for Chinese flash-card phrases."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import urllib.request
from collections import defaultdict
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
REPO = PKG.parents[1]
CACHE = REPO / "docs" / "chinese" / "phrase-enrichment"
JIEBA_PATH = CACHE / "jieba-dict.txt"
CEDICT_GZ_PATH = CACHE / "cedict.txt.gz"
EDU_WORDS_PATH = CACHE / "compulsory-education-words.tsv"
REPORT_PATH = CACHE / "report.json"
AI_REVIEW_PATH = CACHE / "ai-review-v2.json"

JIEBA_URL = "https://raw.githubusercontent.com/fxsjy/jieba/master/jieba/dict.txt"
CEDICT_URL = "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz"
EDU_WORDS_URL = (
    "https://raw.githubusercontent.com/zispace/hanzi-words-cycb/master/"
    "%E4%B9%89%E5%8A%A1%E6%95%99%E8%82%B2%E5%B8%B8%E7%94%A8%E8%AF%8D%E8%A1%A8"
    "%EF%BC%88%E8%8D%89%E6%A1%88%EF%BC%89.tsv"
)
BOOKS = ("g1b", "g2a", "g2b")
CJK_WORD = re.compile(r"^[\u3400-\u9fff]{2,4}$")
CEDICT_LINE = re.compile(r"^(\S+) (\S+) \[(.+?)] /(.+)/$")
BLOCKED_POS = ("nr", "ns", "nt", "nz")
BLOCKED_DEFINITIONS = (
    "surname ",
    "variant of",
    "old variant",
    "archaic variant",
    "county",
    "province",
    "prefecture",
    "district",
    "city in",
    "person name",
    "japanese",
)
BLOCKED_WORDS = {
    "临床", "息肉", "导弹", "营销", "裹挟", "裹胁", "鲜血", "性交",
    "怀孕", "流产", "癌症", "肿瘤", "尸体", "自杀", "枪支", "弹药",
}
MANUAL_OVERRIDES: dict[str, list[str]] = {
    "g1b::吴": ["吴国", "姓吴"],
    "g1b::很": ["很好", "很多"],
    "g1b::扛": ["扛着", "扛起"],
    "g1b::汤": ["喝汤", "米汤"],
    "g1b::吗": ["好吗", "是吗"],
    "g1b::吧": ["好吧", "走吧"],
    "g1b::呢": ["好呢", "你呢"],
    "g1b::啊": ["好啊", "是啊"],
    "g1b::棵": ["一棵"],
    "g2a::很": ["很好", "很多"],
    "g2a::刘": ["刘胡兰", "姓刘"],
    "g2a::湾": ["海湾", "河湾"],
    "g2a::柏": ["柏树", "松柏"],
    "g2a::吧": ["好吧", "走吧"],
    "g2a::棵": ["一棵"],
    "g2a::朱": ["朱红", "朱德"],
    "g2a::兰": ["兰花", "玉兰"],
    "g2a::泽": ["沼泽", "光泽"],
    "g2a::庐": ["庐山", "草庐"],
    "g2a::晒": ["晒太阳", "晾晒"],
    "g2a::呢": ["好呢", "你呢"],
    "g2a::祥": ["吉祥", "祥和"],
    "g2b::邓": ["邓小平", "姓邓"],
    "g2b::冈": ["山冈", "高冈"],
    "g2b::叼": ["叼着", "叼走"],
    "g2b::吴": ["东吴", "吴国"],
    "g2b::甫": ["杜甫"],
    "g2b::咦": ["咦"],
    "g2b::杜": ["杜鹃", "杜甫"],
    "g2b::鹃": ["杜鹃"],
    "g2b::啊": ["好啊", "是啊"],
    "g2b::芬": ["芬芳"],
    "g2b::艾": ["艾草", "艾叶"],
    "g2b::伯": ["伯伯", "大伯"],
    "g2b::哩": ["哩"],
    "g2b::趴": ["趴下", "趴着"],
    "g2b::茵": ["绿茵", "草茵"],
    "g2b::桑": ["桑树", "桑叶"],
}


def load_json_export(path: Path, const_name: str):
    text = path.read_text(encoding="utf-8")
    match = re.search(rf"export const {const_name}.*?= (\[.*\])\n", text, re.S)
    if not match:
        raise SystemExit(f"cannot parse {path}")
    return json.loads(match.group(1))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch(url: str, destination: Path) -> None:
    if destination.exists() and destination.stat().st_size > 0:
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_suffix(destination.suffix + ".partial")
    print(f"Downloading {url} -> {destination}")
    urllib.request.urlretrieve(url, partial)
    partial.replace(destination)


def fetch_sources() -> None:
    fetch(JIEBA_URL, JIEBA_PATH)
    fetch(CEDICT_URL, CEDICT_GZ_PATH)
    fetch(EDU_WORDS_URL, EDU_WORDS_PATH)


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def extract_json_object(text: str) -> dict[str, object]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.S)
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("AI response contains no JSON object")
    return json.loads(text[start : end + 1])


def review_with_ai(
    pending: list[dict[str, object]],
    candidate_map: dict[str, list[dict[str, object]]],
) -> dict[str, list[str]]:
    env = load_env(REPO / "apps" / "web" / ".env.local")
    api_key = env.get("AI_CHAT_API_KEY") or env.get("AI_EMBED_API_KEY")
    if not api_key:
        raise SystemExit("AI_CHAT_API_KEY/AI_EMBED_API_KEY is required for --ai-review")
    base_url = (
        env.get("AI_CHAT_BASE_URL")
        or env.get("AI_EMBED_BASE_URL")
        or "https://dashscope.aliyuncs.com/compatible-mode/v1"
    ).rstrip("/")
    model = env.get("AI_CHAT_MODEL") or "qwen-plus"
    cache = (
        json.loads(AI_REVIEW_PATH.read_text(encoding="utf-8"))
        if AI_REVIEW_PATH.exists()
        else {}
    )

    for offset in range(0, len(pending), 35):
        batch = [row for row in pending[offset : offset + 35] if row["charKey"] not in cache]
        if not batch:
            continue
        payload_rows = []
        for row in batch:
            char_key = str(row["charKey"])
            payload_rows.append(
                {
                    "charKey": char_key,
                    "char": row["char"],
                    "pinyin": row["pinyin"],
                    "lessonTitle": row["lessonTitle"],
                    "candidates": [
                        {
                            "word": candidate["word"],
                            "educationLevel": candidate["educationLevel"],
                            "textbookHit": candidate["textbookHit"],
                            "definition": candidate["definition"],
                        }
                        for candidate in candidate_map.get(str(row["char"]), [])[:14]
                    ],
                }
            )
        prompt = (
            "你是小学一二年级语文教材词语审校员。请为每个生字从 candidates 中选择2个最适合6-8岁儿童的常用词。"
            "优先textbookHit=true、具体生活词和educationLevel 1/2；排除成人、医学、军事、粗俗、生僻、歧义读音和不自然搭配。"
            "只能原样选择候选词，不得创造或改写。只返回JSON对象，格式为 {\"charKey\":[\"词1\",\"词2\"]}。\n"
            + json.dumps(payload_rows, ensure_ascii=False)
        )
        request = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=json.dumps(
                {
                    "model": model,
                    "temperature": 0,
                    "max_tokens": 5000,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": "你只输出有效JSON，严格从候选中选择。"},
                        {"role": "user", "content": prompt},
                    ],
                },
                ensure_ascii=False,
            ).encode("utf-8"),
            headers={"content-type": "application/json", "Authorization": f"Bearer {api_key}"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=120) as response:
            body = json.load(response)
        parsed = extract_json_object(body["choices"][0]["message"]["content"])
        for row in batch:
            char_key = str(row["charKey"])
            allowed = {str(item["word"]) for item in candidate_map.get(str(row["char"]), [])}
            selected = parsed.get(char_key, [])
            if not isinstance(selected, list):
                continue
            valid = [str(word) for word in selected if str(word) in allowed]
            if valid:
                cache[char_key] = valid[:2]
        AI_REVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
        AI_REVIEW_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"AI review progress: {min(offset + 35, len(pending))}/{len(pending)}")
    return {key: list(value) for key, value in cache.items()}


def load_jieba() -> dict[str, tuple[int, str]]:
    words: dict[str, tuple[int, str]] = {}
    with JIEBA_PATH.open(encoding="utf-8") as source:
        for line in source:
            parts = line.rstrip().split(" ")
            if len(parts) < 2:
                continue
            word = parts[0]
            if not CJK_WORD.fullmatch(word) or word in BLOCKED_WORDS:
                continue
            frequency = int(parts[1])
            pos = parts[2] if len(parts) > 2 else ""
            if pos.startswith(BLOCKED_POS):
                continue
            words[word] = (frequency, pos)
    return words


def load_cedict() -> dict[str, tuple[str, str]]:
    words: dict[str, tuple[str, str]] = {}
    with gzip.open(CEDICT_GZ_PATH, "rt", encoding="utf-8") as source:
        for line in source:
            if line.startswith("#"):
                continue
            match = CEDICT_LINE.match(line.rstrip())
            if not match:
                continue
            _, simplified, pinyin, definition = match.groups()
            if not CJK_WORD.fullmatch(simplified):
                continue
            lowered = definition.lower()
            if any(blocked in lowered for blocked in BLOCKED_DEFINITIONS):
                continue
            words[simplified] = (pinyin, definition)
    return words


def load_education_words() -> dict[str, int]:
    words: dict[str, int] = {}
    with EDU_WORDS_PATH.open(encoding="utf-8-sig") as source:
        for line in source:
            columns = line.rstrip("\n").split("\t")
            if not columns:
                continue
            word = columns[0].strip()
            if not CJK_WORD.fullmatch(word):
                continue
            level = next(
                (int(value) for value in columns[1:] if value.strip() in {"1", "2", "3", "4"}),
                9,
            )
            words[word] = min(words.get(word, 9), level)
    return words


def load_textbook_corpus() -> str:
    paragraphs: list[str] = []
    for book in BOOKS:
        path = PKG / "src" / "utils" / book / "lesson-passages.ts"
        for passage in load_json_export(path, "LESSON_PASSAGES"):
            paragraphs.extend(str(value) for value in passage.get("paragraphs", []))
    return "\n".join(paragraphs)


def rank_candidate(
    char: str,
    word: str,
    frequency: int,
    education_level: int,
    textbook_hit: bool,
) -> tuple[int, int, int, int, int, int, str]:
    return (
        0 if textbook_hit else 1,
        0 if education_level <= 2 else 1,
        0 if len(word) == 2 else 1,
        0 if word.startswith(char) else 1,
        education_level,
        -frequency,
        word,
    )


def build_candidates(chars: set[str]) -> dict[str, list[dict[str, object]]]:
    jieba = load_jieba()
    cedict = load_cedict()
    education_words = load_education_words()
    textbook_corpus = load_textbook_corpus()
    by_char: dict[str, list[dict[str, object]]] = defaultdict(list)
    for word, (frequency, pos) in jieba.items():
        cedict_row = cedict.get(word)
        if cedict_row is None:
            continue
        pinyin, definition = cedict_row
        for char in set(word) & chars:
            by_char[char].append(
                {
                    "word": word,
                    "frequency": frequency,
                    "pos": pos,
                    "pinyin": pinyin,
                    "definition": definition,
                    "educationLevel": education_words.get(word, 9),
                    "textbookHit": word in textbook_corpus,
                    "sources": ["jieba", "cc-cedict"],
                }
            )
    for char, candidates in by_char.items():
        candidates.sort(
            key=lambda row: rank_candidate(
                char,
                str(row["word"]),
                int(row["frequency"]),
                int(row["educationLevel"]),
                bool(row["textbookHit"]),
            )
        )
    return by_char


def write_chars(path: Path, rows: list[dict[str, object]]) -> None:
    original = path.read_text(encoding="utf-8")
    prefix = original.split("export const CHARS", 1)[0]
    rendered = json.dumps(rows, ensure_ascii=False, indent=2)
    path.write_text(f"{prefix}export const CHARS: CharEntry[] = {rendered}\n", encoding="utf-8")


def apply_report(books: list[str]) -> int:
    if not REPORT_PATH.exists():
        raise SystemExit(f"missing reviewed report: {REPORT_PATH}")
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    for book in books:
        book_report = report.get("books", {}).get(book)
        if not isinstance(book_report, dict) or book_report.get("unresolved"):
            raise SystemExit(f"report for {book} is missing or still has unresolved characters")
        selections = book_report.get("selections", {})
        path = PKG / "src" / "utils" / book / "chars.ts"
        rows = load_json_export(path, "CHARS")
        applied = 0
        for row in rows:
            if row.get("phrases"):
                continue
            selected = selections.get(str(row["charKey"]), [])
            words = [str(item["word"]) for item in selected if isinstance(item, dict)]
            if not words or any(str(row["char"]) not in word for word in words):
                continue
            row["phrases"] = words
            applied += 1
        write_chars(path, rows)
        print(f"[{book}] applied reviewed phrases to {applied} char profiles")
    return 0


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def write_phrase_sql(books: list[str], destination: Path) -> int:
    updates: dict[str, set[str]] = defaultdict(set)
    chars_by_book: dict[str, set[str]] = {}
    for book in books:
        data_dir = PKG / "src" / "utils" / book
        rows = load_json_export(data_dir / "chars.ts", "CHARS")
        known_chars = {str(row["char"]) for row in rows}
        chars_by_book[book] = known_chars
        for row in rows:
            char = str(row["char"])
            for phrase in row.get("phrases", []):
                word = str(phrase).strip()
                if word:
                    if char not in word:
                        raise SystemExit(f"invalid phrase for {row['charKey']}: {word}")
                    updates[str(row["charKey"])].add(word)
        for phrase_row in load_json_export(data_dir / "phrases.ts", "PHRASES"):
            word = str(phrase_row["phrase"]).strip()
            if len(word) != 2:
                continue
            for char in word:
                char_key = f"{book}::{char}"
                if char in known_chars:
                    updates[char_key].add(word)

    missing = sorted(key for key, phrases in updates.items() if not phrases)
    if missing:
        raise SystemExit(f"missing phrases for {len(missing)} entries")
    values = []
    for char_key, phrases in sorted(updates.items()):
        book, char = char_key.split("::", 1)
        grade = int(book[1])
        semester = "上" if book.endswith("a") else "下"
        array = "ARRAY[" + ", ".join(sql_literal(word) for word in sorted(phrases)) + "]::text[]"
        values.append(
            f"    ({grade}, {sql_literal(semester)}, {sql_literal(char)}, {array})"
        )
    expected = {book: sum(1 for key in updates if key.startswith(f"{book}::")) for book in books}
    book_checks = "\n".join(
        f"    or (grade = {int(book[1])} and semester = {sql_literal('上' if book.endswith('a') else '下')})"
        for book in books
    ).removeprefix("    or ")
    sql = f"""-- Generated by packages/chinese/scripts/enrich-card-phrases.py --write-sql.
-- Phrase-only, idempotent update: all other character metadata is preserved.
begin;

with reviewed(grade, semester, char, phrases) as (
  values
{',\n'.join(values)}
)
update public.chinese_char_entries as target
set phrases = reviewed.phrases
from reviewed
where target.grade = reviewed.grade
  and target.semester = reviewed.semester
  and target.char = reviewed.char;

do $$
declare
  expected_count integer := {len(updates)};
  matched_count integer;
  invalid_count integer;
begin
  select count(*) into matched_count
  from public.chinese_char_entries
  where {book_checks};
  if matched_count <> expected_count then
    raise exception 'Chinese phrase sync count mismatch: expected %, found %', expected_count, matched_count;
  end if;

  select count(*) into invalid_count
  from public.chinese_char_entries
  where ({book_checks})
    and (cardinality(phrases) = 0 or exists (
      select 1 from unnest(phrases) phrase where strpos(phrase, char) = 0
    ));
  if invalid_count <> 0 then
    raise exception 'Chinese phrase validation failed for % rows', invalid_count;
  end if;
end $$;

commit;
"""
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(sql, encoding="utf-8")
    print(f"Wrote {len(updates)} phrase-only updates to {destination}; per book={expected}")
    return 0


def enrich(books: list[str], apply: bool, ai_review: bool) -> int:
    fetch_sources()
    book_rows: dict[str, list[dict[str, object]]] = {}
    all_chars: set[str] = set()
    for book in books:
        path = PKG / "src" / "utils" / book / "chars.ts"
        rows = load_json_export(path, "CHARS")
        phrase_rows = load_json_export(path.with_name("phrases.ts"), "PHRASES")
        known_chars = {str(row["char"]) for row in rows}
        effective_phrases: dict[str, set[str]] = defaultdict(set)
        for row in rows:
            effective_phrases[str(row["char"])].update(
                str(phrase).strip() for phrase in row.get("phrases", []) if str(phrase).strip()
            )
        for phrase_row in phrase_rows:
            phrase = str(phrase_row["phrase"]).strip()
            if len(phrase) == 2:
                for char in phrase:
                    if char in known_chars:
                        effective_phrases[char].add(phrase)
        book_rows[book] = rows
        for row in rows:
            row["_effectivePhrases"] = sorted(effective_phrases[str(row["char"])])
            if not row["_effectivePhrases"]:
                all_chars.add(str(row["char"]))

    candidates = build_candidates(all_chars)
    pending_rows = [
        row
        for rows in book_rows.values()
        for row in rows
        if not row.get("_effectivePhrases")
        and str(row["charKey"]) not in MANUAL_OVERRIDES
        and candidates.get(str(row["char"]))
    ]
    reviewed = review_with_ai(pending_rows, candidates) if ai_review else {}
    report: dict[str, object] = {
        "sources": {
            "jieba": {"url": JIEBA_URL, "sha256": sha256(JIEBA_PATH)},
            "cc-cedict": {"url": CEDICT_URL, "sha256": sha256(CEDICT_GZ_PATH)},
            "compulsory-education-words": {
                "url": EDU_WORDS_URL,
                "sha256": sha256(EDU_WORDS_PATH),
            },
        },
        "books": {},
    }
    unresolved_total = 0

    for book in books:
        rows = book_rows[book]
        filled = 0
        unresolved: list[str] = []
        selections: dict[str, list[dict[str, object]]] = {}
        for row in rows:
            effective = row.pop("_effectivePhrases", [])
            if effective:
                continue
            char_key = str(row["charKey"])
            manual = MANUAL_OVERRIDES.get(char_key)
            if manual:
                row["phrases"] = manual
                selections[char_key] = [
                    {
                        "word": word,
                        "sources": ["textbook-context", "manual-review"],
                        "educationLevel": 1,
                        "textbookHit": True,
                    }
                    for word in manual
                ]
                filled += 1
                continue
            char = str(row["char"])
            candidate_rows = candidates.get(char, [])
            reviewed_words = reviewed.get(str(row["charKey"]), [])
            selected = (
                [candidate for word in reviewed_words for candidate in candidate_rows if candidate["word"] == word]
                if reviewed_words
                else candidate_rows[:2]
            )
            if not selected:
                unresolved.append(char)
                continue
            row["phrases"] = [str(candidate["word"]) for candidate in selected]
            selections[str(row["charKey"])] = selected
            filled += 1

        unresolved_total += len(unresolved)
        report["books"][book] = {
            "filled": filled,
            "unresolved": unresolved,
            "selections": selections,
        }
        print(f"[{book}] dual-source filled={filled} unresolved={len(unresolved)}")
        if apply:
            write_chars(PKG / "src" / "utils" / book / "chars.ts", rows)

    CACHE.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Report: {REPORT_PATH}")
    return 0 if unresolved_total == 0 else 2


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("books", nargs="*", choices=BOOKS, default=list(BOOKS))
    parser.add_argument("--apply", action="store_true", help="write validated selections to chars.ts")
    parser.add_argument("--fetch-only", action="store_true")
    parser.add_argument("--ai-review", action="store_true")
    parser.add_argument("--apply-report", action="store_true")
    parser.add_argument("--write-sql", type=Path, help="write a phrase-only idempotent SQL update")
    args = parser.parse_args()
    fetch_sources()
    if args.fetch_only:
        return 0
    if args.apply_report:
        return apply_report(args.books)
    if args.write_sql:
        return write_phrase_sql(args.books, args.write_sql)
    return enrich(args.books, args.apply, args.ai_review)


if __name__ == "__main__":
    raise SystemExit(main())
