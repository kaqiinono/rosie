-- 口算系统重构 · 数据迁移
-- 手动在 Supabase SQL Editor 执行(本项目无自动迁移)。
-- 设计文档:docs/superpowers/specs/2026-06-11-calc-redesign-design.md
--
-- 说明:
--  - 新增列均带默认值 / 可空,旧列保留不删(便于回滚)。
--  - calc_level_state / calc_event_log 表停止写入,但不 DROP(非破坏)。
--  - 跑完此脚本后,/calc 的设置、出题加权、错题补练、报告才能正常读写。

-- calc_settings:单运算块多选 + 混合编排
alter table calc_settings add column if not exists selected_blocks jsonb default '["add:10"]'::jsonb;
alter table calc_settings add column if not exists mixed_ops jsonb default '[]'::jsonb;

-- calc_problem_state:熟练度归属(哪个积木块 / 哪条混合配置)
alter table calc_problem_state add column if not exists block_id text;
alter table calc_problem_state add column if not exists mixed_op_id text;

-- calc_mistakes:跨次错题补练(标记错题归属的 session)
alter table calc_mistakes add column if not exists session_no integer;
