create table public.vocabulary_assessment_banks (
  version text primary key check (btrim(version) <> ''),
  published_at timestamptz not null default now(),
  content jsonb not null check (jsonb_typeof(content) = 'object')
);

create table public.vocabulary_assessment_attempts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  previous_id uuid,
  bank_version text not null references public.vocabulary_assessment_banks(version),
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  unique nulls not distinct (user_id, previous_id)
);

create unique index vocabulary_assessments_one_open
  on public.vocabulary_assessment_attempts (user_id) where submitted_at is null;
create index vocabulary_assessments_latest
  on public.vocabulary_assessment_attempts (user_id, created_at desc, id desc);
create index vocabulary_assessments_bank_history
  on public.vocabulary_assessment_attempts (bank_version, created_at, id);

alter table public.vocabulary_assessment_banks enable row level security;
alter table public.vocabulary_assessment_attempts enable row level security;
revoke all on public.vocabulary_assessment_banks, public.vocabulary_assessment_attempts
  from public, anon, authenticated, service_role;
grant select, insert on public.vocabulary_assessment_banks to service_role;
grant select, insert, update on public.vocabulary_assessment_attempts to service_role;
