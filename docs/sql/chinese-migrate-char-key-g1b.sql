-- 增量迁移：char_key 前缀 g1-下:: → g1b::
-- 在 Supabase SQL Editor 执行一次即可（已有 g1b:: 的行不受影响）。
-- 执行前建议备份；执行后用户掌握度 / 错题本 key 与新版代码一致。

update public.chinese_char_entries
set char_key = replace(char_key, 'g1-下::', 'g1b::')
where char_key like 'g1-下::%';

update public.chinese_lesson_chars
set char_key = replace(char_key, 'g1-下::', 'g1b::')
where char_key like 'g1-下::%';

update public.chinese_char_mastery
set char_key = replace(char_key, 'g1-下::', 'g1b::')
where char_key like 'g1-下::%';

update public.chinese_wrong_items
set item_key = replace(item_key, 'g1-下::', 'g1b::')
where item_key like 'g1-下::%';

-- 校验：应返回 0
-- select count(*) from chinese_char_entries where char_key like 'g1-下::%';
