-- 口算 per-type 重构：新增列。手动在 Supabase SQL editor 执行。
-- selected_blocks / mixed_ops 仍是 jsonb，形状由客户端升级，无需 DDL。
alter table public.calc_settings
  add column if not exists count_mode text not null default 'auto';

alter table public.calc_sessions
  add column if not exists question_log jsonb not null default '[]'::jsonb;

-- last_time_limit / time_limit_overrides 列保留但停用（不再读写）。
