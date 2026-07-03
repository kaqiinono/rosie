-- 一年级下册灌库完整性校验（导入全部 12 片后运行）
-- 预期：495 字 · 36 课 · 619 条课字编排；部首/结构/笔顺不得为空

-- ── 1. 行数 ────────────────────────────────────────────────────────────────

select 'chinese_lessons' as tbl, count(*) as cnt, 36 as expected,
  count(*) = 36 as ok
from public.chinese_lessons
where grade = 1 and semester = '下'

union all

select 'chinese_char_entries', count(*), 495, count(*) = 495
from public.chinese_char_entries
where grade = 1 and semester = '下'

union all

select 'chinese_lesson_chars', count(*), 619, count(*) = 619
from public.chinese_lesson_chars lc
join public.chinese_lessons l on l.lesson_key = lc.lesson_key
where l.grade = 1 and l.semester = '下';

-- ── 2. 必填字段（部首 / 结构 / 笔顺 / 拼音）────────────────────────────────

select 'null_radical' as check_name, count(*) as bad_rows
from public.chinese_char_entries
where grade = 1 and semester = '下'
  and (radical is null or radical = '' or radical_name is null or radical_name = '')

union all

select 'null_structure', count(*)
from public.chinese_char_entries
where grade = 1 and semester = '下'
  and (structure is null or structure = '')

union all

select 'null_stroke_order', count(*)
from public.chinese_char_entries
where grade = 1 and semester = '下'
  and (stroke_order is null or stroke_count is null or stroke_count < 1)

union all

select 'null_pinyin', count(*)
from public.chinese_char_entries
where grade = 1 and semester = '下'
  and (pinyin is null or pinyin = '');

-- ── 3. 笔顺 JSON 结构（strokes 数量应等于 stroke_count）────────────────────

select char_key, char, stroke_count,
  jsonb_array_length(stroke_order->'strokes') as strokes_in_json
from public.chinese_char_entries
where grade = 1 and semester = '下'
  and (
    stroke_order->'strokes' is null
    or jsonb_array_length(stroke_order->'strokes') <> stroke_count
  );
-- 应返回 0 行

-- ── 4. 外键 / 孤儿行 ─────────────────────────────────────────────────────

select 'orphan_lesson_chars' as issue, count(*) as cnt
from public.chinese_lesson_chars lc
left join public.chinese_char_entries ce on ce.char_key = lc.char_key
where ce.char_key is null

union all

select 'orphan_lesson_chars_lesson', count(*)
from public.chinese_lesson_chars lc
left join public.chinese_lessons l on l.lesson_key = lc.lesson_key
where l.lesson_key is null;

-- ── 5. 每课应有识字/会写编排 ─────────────────────────────────────────────

select l.lesson_key, l.lesson_title,
  count(*) filter (where lc.track = 'recognize') as recognize_cnt,
  count(*) filter (where lc.track = 'write') as write_cnt
from public.chinese_lessons l
left join public.chinese_lesson_chars lc on lc.lesson_key = l.lesson_key
where l.grade = 1 and l.semester = '下'
group by l.lesson_key, l.lesson_title, l.sort_order
order by l.sort_order;
-- 每课 recognize_cnt 应 > 0；部分课 write_cnt 可为 0（如快乐读书吧）

-- ── 6. 识字表 / 写字表去重规模（与教材核对）────────────────────────────────

select track, count(distinct lc.char_key) as unique_chars
from public.chinese_lesson_chars lc
join public.chinese_lessons l on l.lesson_key = lc.lesson_key
where l.grade = 1 and l.semester = '下'
group by track;
-- 预期约：recognize 413 个不同 char_key（含得/乐/背多课重学），write 200

-- ── 7. 一键汇总（全绿即完整）──────────────────────────────────────────────

with
  lessons as (
    select count(*) as n from public.chinese_lessons
    where grade = 1 and semester = '下'
  ),
  chars as (
    select count(*) as n from public.chinese_char_entries
    where grade = 1 and semester = '下'
  ),
  lc as (
    select count(*) as n
    from public.chinese_lesson_chars lc
    join public.chinese_lessons l on l.lesson_key = lc.lesson_key
    where l.grade = 1 and l.semester = '下'
  ),
  bad as (
    select count(*) as n from public.chinese_char_entries
    where grade = 1 and semester = '下'
      and (
        coalesce(radical, '') = ''
        or coalesce(radical_name, '') = ''
        or coalesce(structure, '') = ''
        or coalesce(pinyin, '') = ''
        or stroke_order is null
        or stroke_count < 1
        or jsonb_array_length(stroke_order->'strokes') is distinct from stroke_count
      )
  ),
  orphans as (
    select count(*) as n
    from public.chinese_lesson_chars lc
    left join public.chinese_char_entries ce on ce.char_key = lc.char_key
    where ce.char_key is null
  )
select
  (select n from lessons) = 36 as lessons_ok,
  (select n from chars) = 495 as chars_ok,
  (select n from lc) = 619 as lesson_chars_ok,
  (select n from bad) = 0 as fields_ok,
  (select n from orphans) = 0 as fk_ok,
  (
    (select n from lessons) = 36
    and (select n from chars) = 495
    and (select n from lc) = 619
    and (select n from bad) = 0
    and (select n from orphans) = 0
  ) as import_complete;
