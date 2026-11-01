begin;

alter table public.baidu_sync_directories add unique (account_id, id);

-- File snapshots belong to directories. Publishing a lesson is a separate transaction.
create table public.math_replay_scans (
  directory_id uuid primary key references public.baidu_sync_directories(id) on delete cascade,
  version uuid not null default gen_random_uuid(),
  synced_at timestamptz not null default now(),
  files jsonb not null check (jsonb_typeof(files) = 'object')
);
create table public.math_replay_lessons (
  account_id text not null,
  lesson_key text not null,
  directory_id uuid,
  revision uuid not null default gen_random_uuid(),
  saved_at timestamptz not null default now(),
  review_names text[] not null default '{}',
  primary key (account_id, lesson_key),
  foreign key (account_id, directory_id) references public.baidu_sync_directories(account_id, id)
);
create index math_replay_lessons_directory on public.math_replay_lessons(directory_id);
create table public.math_replay_bindings (
  account_id text not null,
  lesson_key text not null,
  problem_id text not null,
  fs_id text check (fs_id ~ '^[1-9][0-9]{0,19}$'),
  filename text not null check (position('/' in filename) = 0 and filename ~* '\.mp4$'),
  primary key (account_id, problem_id),
  unique (account_id, fs_id),
  foreign key (account_id, lesson_key) references public.math_replay_lessons(account_id, lesson_key) on delete cascade
);
create index math_replay_bindings_lesson on public.math_replay_bindings(account_id, lesson_key);

alter table public.math_replay_scans enable row level security;
alter table public.math_replay_lessons enable row level security;
alter table public.math_replay_bindings enable row level security;
revoke all on public.math_replay_scans, public.math_replay_lessons, public.math_replay_bindings from public, anon, authenticated;
grant select, insert, update, delete on public.math_replay_scans, public.math_replay_lessons, public.math_replay_bindings to service_role;

-- Pin the old archive to the verified shared account at upgrade, never to a future login.
do $$ begin
  perform 1 from public.baidu_oauth_credentials where id='primary' for share;
  if exists (select 1 from public.math_video_lesson_catalog where cardinality(keys) > 0)
     and not exists (select 1 from public.baidu_oauth_credentials where id='primary' and account_id is not null) then
    raise exception 'Verify the shared Baidu account before migrating existing math replays';
  end if;
end $$;
insert into public.baidu_sync_directories(account_id,path)
select account_id,'/airosie/math/ny' from public.baidu_oauth_credentials
where id='primary' and account_id is not null and exists (select 1 from public.math_video_lesson_catalog)
on conflict (account_id,path) do nothing;
insert into public.math_replay_lessons(account_id,lesson_key,directory_id,saved_at,review_names)
select d.account_id, c.lesson_key, d.id, c.synced_at,
  array(select distinct substr(p,length(d.path)+2) from unnest(c.file_paths) p
        where left(p,length(d.path)+1)=d.path||'/' and substr(p,length(d.path)+2) ~* '^[^/]+\.mp4$')
from public.math_video_lesson_catalog c
join public.baidu_oauth_credentials a on a.id='primary'
join public.baidu_sync_directories d on d.account_id=a.account_id and d.path='/airosie/math/ny';

-- A frozen (real ID suffix = legacy video suffix) index from the registered question banks.
-- Only unique aliases with BOTH an old confirmed key and exact saved path are promoted.
with banks(lesson_key,pairs) as (values
  ('1-12','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 L1=L1a L2=L1b L3=L1-1 L4=L1-2 L5=L2 L6=L2-1 L7=L3a L8=L3b L9=L3-1 L10=L3-2 L11=L4a L12=L4b L13=L4-1 L14=L4-2 L15=L5a L16=L5b L17=L5-1 L18=L5-2 L19=L6 L20=L6-1 L21=L21 L22=L22 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 H7=H7 H8=H8 H9=H9 H10=H10 W1=W1 W2=W2 W3=W3 W4=W4 W5=W5 W6=W6 W7=W7 W8=W8 W9=W9 W10=W10 W11=W11 W12=W12 W13=W13 W14=W14 W15=W15'),
  ('1-13','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 L1=L1 L2=L1-1 L3=L2a L4=L2b L5=L2c L6=L2-1 L7=L3 L8=L3-1 L9=L4 L10=L4-1 L11=L11 L12=L12 L13=L5 L14=L5-1 L15=L6 L16=L6-1 L17=L17 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 W1=W1 W2=W2 W3=W3 W4=W4 W5=W5 W6=W6 W7=W7 W8=W8 W9=W9 W10=W10 W11=W11 W12=W12'),
  ('1-15','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 L1=L1 L2=L1-1 L3=L2 L4=L2-1 L5=L3 L6=L3-1 L7=L4 L8=L4-1 L9=L5 L10=L5-1 L11=L6 L12=L6-1 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 W1=W1 W2=W2 W3=W3 W4=W4 W5=W5 W6=W6 W7=W7 W8=W8 W9=W9'),
  ('1-18','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 L1=L1a L2=L1b L3=L1-1 L4=L2 L5=L2-1 L6=L3 L7=L3-1 L8=L4a L9=L4b L10=L4-1 L11=L5 L12=L5-1 L13=L6 L14=L6-1 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 W1=W1 W2=W2 W3=W3 W4=W4 W5=W5 W6=W6 W7=W7 W8=W8 W9=W9 W10=W10 W11=W11 W12=W12'),
  ('1-23','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 L1=L1 L2=L1-1 L3=L2 L4=L2-1 L5=L3 L6=L3-1 L7=L4 L8=L4-1 L9=L5 L10=L5-1 L11=L6 L12=L6-1 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 W1=W1 W2=W2 W3=W3 W4=W4 W5=W5 W6=W6 W7=W7 W8=W8 W9=W9 W10=W10 W11=W11 W12=W12'),
  ('1-29','L1=L1a L2=L1b L3=L1c L4=L1d L5=L1-1 L6=L1-2 L7=L2a L8=L2b L9=L2c L10=L2d L11=L2-1 L12=L2-4 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6'),
  ('1-30','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 L1=L1 L2=L1-1 L3=L2 L4=L2-1 L5=L3 L6=L3-1 L7=L4 L8=L4-1 L9=L5 L10=L5-1 L11=L6 L12=L6-1 W1=W1 W2=W2 W3=W3 W4=W4 W5=W5 W6=W6 W7=W7 W8=W8 W9=W9 W10=W10 W11=W11 W12=W12'),
  ('1-34','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 P6=P6 P7=P7 P8=P8 P9=P9 P10=P10 L1=L1 L2=L2 L3=L3 L4=L4 L5=L5 L6=L6 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 H7=H7 H8=H8 H9=H9 H10=H10 H11=H11 W1=W1 W2=W2 W3=W3 W4=W4 W5=W5 W6=W6 W7=W7 W8=W8 W9=W9 W10=W10 W11=W11 W12=W12 S1=S1 S2=S2 S3=S3 S4=S4 S5=S5 S6=S6 S7=S7 S8=S8 S9=S9 S10=S10 S11=S11 S12=S12 S13=S13 S14=S14 S15=S15 S16=S16 S17=S17 S18=S18 S19=S19 S20=S20 S21=S21 S22=S22 S23=S23 S24=S24 S25=S25 S26=S26 S27=S27 S28=S28 S29=S29 S30=S30 S31=S31 S32=S32 S33=S33 S34=S34 S35=S35 S36=S36 S37=S37 S38=S38 S39=S39 S40=S40 S41=S41 S42=S42 S43=S43 S44=S44 S45=S45 S46=S46 S47=S47 S48=S48 S49=S49 S50=S50 S51=S51 S52=S52 S53=S53 S54=S54 S55=S55 S56=S56 S57=S57 S58=S58 S59=S59 S60=S60 S61=S61 S62=S62 S63=S63 S64=S64 S65=S65 S66=S66 S67=S67 S68=S68 S69=S69 S70=S70 S71=S71 S72=S72 S73=S73 S74=S74 S75=S75 S76=S76 S77=S77 S78=S78 S79=S79 S80=S80 S81=S81 S82=S82 S83=S83 S84=S84 S85=S85 S86=S86 S87=S87 S88=S88 S89=S89 S90=S90 S91=S91 S92=S92 S93=S93 S94=S94 S95=S95 S96=S96 S97=S97 S98=S98 S99=S99 S100=S100'),
  ('1-35','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 L1=L1 L2=L2 L3=L3 L4=L4 L5=L5 L6=L6 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 W1=W1 W2=W2 W3=W3 W4=W4 W5=W5 W6=W6 W7=W7 W8=W8 W9=W9 W10=W10 W11=W11 W12=W12'),
  ('1-36','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 L1=L1a L2=L1b L3=L2 L4=L3 L5=L4 L6=L5 L7=L6 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 W1=W1 W2=W2 W3=W3 W4=W4 W5=W5 W6=W6 W7=W7 W8=W8 W9=W9 W10=W10 W11=W11 W12=W12'),
  ('1-37','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 L1=L1 L2=L1-1 L3=L2 L4=L2-1 L5=L3 L6=L3-1 L7=L4 L8=L4-1 L9=L5 L10=L5-1 L11=L6 L12=L6-1 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 W1=W1 W2=W2 W3=W3 W4=W4 W5=W5 W6=W6 W7=W7 W8=W8 W9=W9 W10=W10 W11=W11 W12=W12 S1=S1 S2=S2 S3=S3 S4=S4 S5=S5'),
  ('1-38','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 L1=L1 L2=L2 L3=L3 L4=L4 L5=L5 L6=L6 L7=L1-1 L8=L2-1 L9=L3-1 L10=L4-1 L11=L5-1 L12=L6-1 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 W1=W1 W2=W2 W3=W3 W4=W4 W5=W5 W6=W6 W7=W7 W8=W8 W9=W9 W10=W10 W11=W11 W12=W12 S1=S1 S2=S2 S3=S3 S4=S4 S5=S5'),
  ('1-39','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 L1=L1 L2=L1-1 L3=L2 L4=L2-1 L5=L3 L6=L3-1 L7=L4 L8=L4-1 L9=L5 L10=L5-1 L11=L6 L12=L6-1 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 W1=W1 W2=W2 W3=W3 W4=W4 W5=W5 W6=W6 W7=W7 W8=W8 W9=W9 W10=W10 W11=W11 W12=W12 S1=S1 S2=S2 S3=S3 S4=S4'),
  ('1-40','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 L1=L1 L2=L1-1 L3=L2 L4=L2-1 L5=L3 L6=L3-1 L7=L4 L8=L4-1 L9=L5 L10=L5-1 L11=L6 L12=L6-1 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 W1=W1 W2=W2 W3=W3 W4=W4 W5=W5 W6=W6 W7=W7 W8=W8 W9=W9 W10=W10 W11=W11 W12=W12 S1=S1 S2=S2 S3=S3'),
  ('1-41','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 P6=P6 P7=P7 L1=L1 L2=L1-1 L3=L2 L4=L2-1 L5=L3 L6=L3-1 L7=L4 L8=L4-1 L9=L5 L10=L5-1 L11=L6 L12=L6-1 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 W1=W1 W2=W2 W3=W3 W4=W4 W5=W5 W6=W6 W7=W7 W8=W8 W9=W9 W10=W10 W11=W11 W12=W12'),
  ('1-42','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 L1=L1 L2=L1-1 L3=L2 L4=L2-1 L5=L3 L6=L3-1 L7=L4 L8=L4-1 L9=L5 L10=L5-1 L11=L6 L12=L6-1 L13=L13 L14=L14 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 W1=W1 W2=W2 W3=W3 W4=W4 W5=W5 W6=W6 W7=W7 W8=W8 W9=W9 W10=W10 W11=W11 W12=W12 S1=S1 S2=S2 S3=S3 S4=S4 S5=S5 S6=S6'),
  ('1-43','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 L1=L1 L2=L1-1 L3=L2 L4=L2-1 L5=L3 L6=L3-1 L7=L4 L8=L4-1 L9=L5 L10=L5-1 L11=L6 L12=L6-1 L13=L13 L14=L14 L15=L15 L16=L16 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 W1=W1 W2=W2 W3=W3 W4=W4 W5=W5 W6=W6 W7=W7 W8=W8 W9=W9 W10=W10 W11=W11 W12=W12 W13=W13 W14=W14 S1=S1 S2=S2 S3=S3 S4=S4 S5=S5 S6=S6 S7=S7 S8=S8'),
  ('1-44','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 L1=L1 L2=L1-1 L3=L2 L4=L2-1 L5=L3 L6=L3-1 L7=L4 L8=L4-1 L9=L5 L10=L5-1 L11=L6 L12=L6-1 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 W1=W1 W2=W2 W3=W3 W4=W4 W5=W5 W6=W6 W7=W7 W8=W8 W9=W9 W10=W10 W11=W11 W12=W12 S1=S1 S2=S2 S3=S3 S4=S4 S5=S5'),
  ('1-46','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 P6=P6 P7=P7 P8=P8 P9=P9 P10=P10 L1=L1 L2=L1-1 L3=L2 L4=L2-1 L5=L5 L6=L6 L7=L3-1 L8=L8 L9=L9 L10=L4-1 L11=L4-2 L12=L12 L13=L5-1 L14=L14 L15=L15 L16=L16 L17=L6-1 L18=L6-2 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 W1=W1 W2=W2 W3=W3 W4=W4 W5=W5 W6=W6 W7=W7 W8=W8 W9=W9 W10=W10 W11=W11 W12=W12 W13=W13 S1=S1 S2=S2'),
  ('1-47','L1=L1 L2=L1-1 L3=L2 L4=L2-1 L5=L3 L6=L3-1 L7=L4 L8=L4-1 L9=L5 L10=L5-1 L11=L6 L12=L6-1 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 W1=W1 W2=W2 W3=W3 W4=W4 W5=W5 W6=W6 W7=W7 W8=W8 W9=W9 W10=W10 W11=W11 W12=W12'),
  ('2-2','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 P6=P6 P7=P7 P8=P8 P9=P9 P10=P10 L1=L1 L2=L2 L3=L3 L4=L4 L5=L5 L6=L5-1 L7=L6 L8=L7 L9=L8 L10=L9 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 H7=H7 H8=H8 H9=H9 H10=H10 H11=H11 H12=H12 S1=S1 S2=S2 S3=S3 S4=S4 S5=S5'),
  ('2-1','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 P6=P6 P7=P7 P8=P8 L1=L1a L2=L1b L3=L1-1a L4=L1-1b L5=L2a L6=L2b L7=L3 L8=L4 L9=L5a L10=L5b L11=L6 L12=L6-1 L13=L7a L14=L7b L15=L7c L16=L7d L17=L8a L18=L8b L19=L9a L20=L9b L21=L10a L22=L10b L23=L11a L24=L11b L25=L12 L26=L12-1 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 H7=H7 H8=H8 H9=H9 H10=H10 H11=H11 H12=H12 H13=H13 H14=H14 H15=H15 H16=H16 S1=S1 S2=S2 S3=S3 S4=S4 S5=S5 S6=S6'),
  ('2-7','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 P6=P6 L1=L1a L2=L1b L3=L1c L4=L2a L5=L2b L6=L2c L7=L3 L8=L4 L9=L5 L10=L6 L11=L7 L12=L8 L13=L9 L14=L10 L15=L11a L16=L11b L17=L11c L18=L12 L19=L13 L20=L14 L21=L15 L22=L16 L23=L17 L24=L18 L25=L19a L26=L19b H1=L1a H2=L1b H3=L1c H4=L2a H5=L2b H6=L2c H7=L3 H8=L4 H9=L5 H10=L6 H11=L7 H12=L8 H13=L9 H14=L10 H15=L11a H16=L11b H17=L11c H18=L12 H19=L13 H20=L14 H21=L15 H22=L16 H23=L17 H24=L18 H25=L19a H26=L19b S1=S1 S2=S2 S3=S3 S4=S4 S5=S5 S6=S6 S7=S7 S8=S8 S9=S9 S10=S10 S11=S11 S12=S12 S13=S13 S14=S14 S15=S15 S16=S16 S17=S17 S18=S18'),
  ('2-9','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 P6=P6 P7=P7 L1=L1a L2=L1b L3=L1c L4=L1d L5=L2a L6=L2b L7=L2c L8=L2-1 L9=L2-2 L10=L3a L11=L3b L12=L4a L13=L4b L14=L5 L15=L6 L16=L7a L17=L7b L18=L8a L19=L8b L20=L8d L21=L8-1 L22=L9a L23=L9b L24=L9-1a L25=L9-1b L26=L10a L27=L10b L28=L11a L29=L11b L30=L12a L31=L12b L32=L13a L33=L13b L34=L14a L35=L14b L36=L15a L37=L15b L38=L16 L39=L17a L40=L17b L41=L17c L42=L17d L43=L17e L44=L17f L45=L17g L46=L17h L47=L17i L48=L17j L49=L18a L50=L18b L51=L18c L52=L18d L53=L18e L54=L18f L55=L18g L56=L19a L57=L19b L58=L19c L59=L20a L60=L20b L61=L20c L62=L20d L63=L20e L64=L20f L65=L21a L66=L21b L67=L21c L68=L21d L69=L21e L70=L21f L71=L21g L72=L21h L73=L21i L74=L21j L75=L22a L76=L22b L77=L22c L78=L22d L79=L22e L80=L23a L81=L23b L82=L23c L83=L23d L84=L24a L85=L24b L86=L24c H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 H7=H7 H8=H8 H9=H9 H10=H10 H11=H11 H12=H12 H13=H13 H14=H14 H15=H15 H16=H16 H17=H17 H18=H18 H19=H19 H20=H20 H21=H21 H22=H22 H23=H23 H24=H24 H25=H25 H26=H26 H27=H27 H28=H28 H29=H29 H30=H30 H31=H31 H32=H32 H33=H33 H34=H34 H35=H35 H36=H36 H37=H37 H38=H38 H39=H39 H40=H40 H41=H41'),
  ('2-10','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 P6=P6 P7=P7 P8=P8 P9=P9 P10=P10 P11=P11 L1=L1 L2=L1-1 L3=L2 L4=L2-1 L5=L3 L6=L3-1 L11=L4 L12=L4-1 L7=L5 L8=L5-1 L9=L6 L10=L7 L13=L8 L14=L9 L15=L10 L16=L11 L17=L12 L18=L13 L19=L14 L20=L15 L21=L16 L22=L17 L23=L18 L24=L19 L25=L20 L26=L21 L27=L22 L28=L23 L29=L24 L30=L25 L31=L26 L32=L27 L33=L28 L34=L29 L35=L30 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 H7=H7 H8=H8 H9=H9 H10=H10 H11=H11 H12=H12 H13=H13 H14=H14 H15=H15 H16=H16 H17=H17 H18=H18 H19=H19 H20=H20 H21=H21 H22=H22 H23=H23 H24=H24 S1=S1 S2=S2 S3=S3 S4=S4 S7=S7 S8=S8'),
  ('2-12','L1=L1 L1-1a=L1-1a L1-1b=L1-1b L2a=L2a L2b=L2b L2-1a=L2-1a L2-1b=L2-1b L3a=L3a L3b=L3b L3-1a=L3-1a L3-1b=L3-1b L4a=L4a L4b=L4b L5=L5 L5-1=L5-1 L6=L6 L7=L7 L8=L8 L9=L9 L10=L10 L11=L11 L12=L12 L13=L13 L14=L14'),
  ('2-6','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 P6=P6 P7=P7 P8=P8 P9=P9 P10=P10 P11=P11 P12=P12 P13=P13 L1=L1 L2=L2 L3=L3 L4=L4 L5=L5a L6=L5b L7=L5c L8=L6 L9=L7 L10=L8 L11=L9a L12=L9b L13=L9c L14=L9d L15=L9e L16=L9f L17=L10a L18=L10b L19=L10c L20=L10d L21=L10e L22=L11a L23=L11b L24=L11c L25=L12a L26=L12b L27=L12c L28=L12d L29=L12e L30=L12f L31=L13a L32=L13b L33=L13c L34=L14 L35=L15 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 H7=H7 H8=H8 H9=H9 H10=H10 H11=H11 H12=H12 H13=H13 H14=H14 H15=H15 H16=H16 H17=H17 H18=H18 S1=S1 S2=S2 S3=S3 S4=S4 S5=S5 S6=S6 S7=S7 S8=S8 S9=S9 S10=S10 S11=S11 S12=S12 S13=S13'),
  ('2-5','L1=L1a L2=L1b L3=L1c L4=L2a L5=L2b L6=L2c L7=L3a L8=L3b L9=L3c L10=L4a L11=L4b L12=L5a L13=L5b L14=L6 L15=L7a L16=L7b L17=L8a L18=L8b L19=L9a L20=L9b L21=L10 L22=L11 L23=L12 L24=L13 L25=L14 L26=L15 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 H7=H7 H8=H8 H9=H9 H10=H10 H11=H11 H12=H12 H13=H13 H14=H14 H15=H15 H16=H16 H17=H17 H18=H18 H19=H19 H20=H20 H21=H21 S1=S1 S2=S2 S3=S3 S4=S4 S5=S5 S6=S6 S7=S7 S8=S8 S9=S9 S10=S10'),
  ('2-4','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 P6=P6 P7=P7 P8=P8 P9=P9 P10=P10 P11=P11 P12=P12 P13=P13 P14=P14 L1=L1 L2=L2 L3=L3 L4=L4 L5=L5 L6=L6 L7=L7 L8=L8 L9=L9 L10=L10 L11=L11 L12=L12 L13=L13 L14=L14 L15=L15 L16=L16 L17=L17 L18=L18 L19=L19 L20=L20 L21=L21 L22=L22 L23=L23 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 H7=H7 H8=H8 H9=H9 H10=H10 H11=H11 H12=H12 H13=H13 H14=H14 H15=H15 H16=H16 H17=H17 H18=H18 H19=H19 H20=H20 H21=H21 H22=H22 H23=H23 S1=S1 S2=S2 S3=S3 S4=S4 S5=S5 S6=S6'),
  ('2-3','P1=P1 P2=P2 P3=P3 P4=P4 P5=P5 P6=P6 L1=L1 L2=L1-1 L3=L3 L4=L2-1 L5=L5 L6=L4 L7=L7 L8=L8 L9=L9 L10=L10 L11=L11 L12=L12 L13=L13 L14=L14 H1=H1 H2=H2 H3=H3 H4=H4 H5=H5 H6=H6 H7=H7 H8=H8 H9=H9 H10=H10 H11=H11 H12=H12 H13=H13 H14=H14 S1=S1 S2=S2 S3=S3 S4=S4 S5=S5 S6=S6 S7=S7')
), candidates as (
  select banks.lesson_key, banks.lesson_key||'-'||split_part(pair,'=',1) as problem_id,
         banks.lesson_key||'-'||split_part(pair,'=',2) as video_key
  from banks cross join lateral regexp_split_to_table(pairs,' +') pair
), matches as (
  select lesson_key, video_key, min(problem_id) as problem_id from candidates
  group by lesson_key,video_key having count(distinct problem_id)=1
), unique_problems as (
  select lesson_key, problem_id from candidates
  group by lesson_key,problem_id having count(distinct video_key)=1
)
insert into public.math_replay_bindings(account_id,lesson_key,problem_id,filename)
select l.account_id,l.lesson_key,m.problem_id,m.video_key||'.mp4'
from public.math_replay_lessons l join matches m using (lesson_key)
join public.math_video_lesson_catalog c using (lesson_key)
join unique_problems u on u.lesson_key=m.lesson_key and u.problem_id=m.problem_id
where m.video_key=any(c.keys) and (m.video_key||'.mp4')=any(l.review_names);
update public.math_replay_lessons l set review_names=array(
  select n from unnest(l.review_names) n where not exists (
    select 1 from public.math_replay_bindings b where b.account_id=l.account_id and b.lesson_key=l.lesson_key and b.filename=n
  )
) where cardinality(review_names)>0;

create view public.math_replay_resolved with (security_invoker=true) as
select b.*, d.id as directory_id,d.path as directory,
  coalesce(s.files->>b.fs_id,b.filename) as current_name,
  (s.version is null or coalesce(s.files ? b.fs_id,false)) as available
from public.math_replay_bindings b
join public.baidu_oauth_credentials a on a.id='primary' and a.account_id=b.account_id
join public.math_replay_lessons l on l.account_id=b.account_id and l.lesson_key=b.lesson_key
join public.baidu_sync_directories d on d.id=l.directory_id and d.account_id=b.account_id
left join public.math_replay_scans s on s.directory_id=d.id;
revoke all on public.math_replay_resolved from public,anon,authenticated;
grant select on public.math_replay_resolved to service_role;

create function public.math_replay_catalog(p_lesson text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('lessonKey',p_lesson,'keys',coalesce((
    select jsonb_agg(r.problem_id order by r.problem_id) from public.math_replay_resolved r
    where r.lesson_key=p_lesson and r.available),'[]'),'syncedAt',(
    select l.saved_at from public.math_replay_lessons l join public.baidu_oauth_credentials a
      on a.id='primary' and a.account_id=l.account_id where l.lesson_key=p_lesson))
$$;
revoke all on function public.math_replay_catalog(text) from public,anon,authenticated;
grant execute on function public.math_replay_catalog(text) to service_role;

create function public.math_replay_editor(p_lesson text, p_directory uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'generation',a.account_generation,
    'directories',coalesce((select jsonb_agg(jsonb_build_object('id',id,'path',path) order by path)
      from public.baidu_sync_directories where account_id=a.account_id),'[]'),
    'directoryId',l.directory_id,'revision',l.revision,'savedAt',l.saved_at,
    'reviewNames',coalesce(to_jsonb(l.review_names),'[]'),
    'selectedId',d.id,'version',s.version,'syncedAt',s.synced_at,'files',coalesce(s.files,'{}'),
    'bindings',coalesce((select jsonb_agg(jsonb_build_object('problemId',problem_id,'fileId',fs_id,
        'name',current_name,'available',available)) from public.math_replay_resolved
      where account_id=a.account_id and lesson_key=p_lesson),'[]'),
    'occupied',coalesce((select jsonb_object_agg(b.fs_id,jsonb_build_object('lessonKey',b.lesson_key,'problemId',b.problem_id))
      from public.math_replay_bindings b where b.account_id=a.account_id and b.lesson_key<>p_lesson and s.files ? b.fs_id),'{}')
  )
  from public.baidu_oauth_credentials a
  left join public.math_replay_lessons l on l.account_id=a.account_id and l.lesson_key=p_lesson
  left join public.baidu_sync_directories d on d.account_id=a.account_id and d.id=coalesce(p_directory,l.directory_id)
  left join public.math_replay_scans s on s.directory_id=d.id
  where a.id='primary' and a.account_id is not null and a.account_generation is not null
$$;

create function public.math_replay_store_scan(p_generation uuid,p_directory uuid,p_version uuid,p_files jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare acct text; old_version uuid;
begin
  select account_id into strict acct from public.baidu_oauth_credentials
    where id='primary' and account_generation=p_generation for update;
  perform 1 from public.baidu_sync_directories where id=p_directory and account_id=acct for key share;
  if not found then raise exception 'directory_changed'; end if;
  select version into old_version from public.math_replay_scans where directory_id=p_directory;
  if old_version is distinct from p_version then raise exception 'scan_changed'; end if;
  insert into public.math_replay_scans(directory_id,files) values(p_directory,p_files)
  on conflict(directory_id) do update set files=excluded.files,version=excluded.version,synced_at=excluded.synced_at;
  -- Only resolve previously published legacy paths. A new filename never creates a binding.
  update public.math_replay_bindings b set fs_id=f.key
  from public.math_replay_lessons l,jsonb_each_text(p_files) f
  where old_version is null and l.directory_id=p_directory and b.account_id=l.account_id and b.lesson_key=l.lesson_key
    and b.fs_id is null and b.filename=f.value
    and not exists (select 1 from public.math_replay_bindings used where used.account_id=acct and used.fs_id=f.key);
end $$;

create function public.math_replay_publish(p_generation uuid,p_lesson text,p_directory uuid,p_revision uuid,p_version uuid,p_picks jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare acct text; prev public.math_replay_lessons; scan public.math_replay_scans; rows_to_save jsonb;
begin
  select account_id into strict acct from public.baidu_oauth_credentials
    where id='primary' and account_generation=p_generation for update;
  select * into prev from public.math_replay_lessons where account_id=acct and lesson_key=p_lesson;
  if prev.revision is distinct from p_revision then raise exception 'lesson_changed'; end if;
  if p_directory is null then
    if p_picks <> '{}'::jsonb then raise exception 'invalid_file'; end if;
  else
    perform 1 from public.baidu_sync_directories where id=p_directory and account_id=acct for key share;
    if not found then raise exception 'directory_changed'; end if;
    select * into scan from public.math_replay_scans where directory_id=p_directory;
    if scan.version is null or scan.version is distinct from p_version then raise exception 'scan_changed'; end if;
  end if;
  -- A missing file may be retained on its original question, never newly assigned.
  select coalesce(jsonb_agg(jsonb_build_object('problem_id',p.key,
    'fs_id',case when scan.files ? p.value then p.value else b.fs_id end,
    'filename',coalesce(scan.files->>p.value,b.filename))), '[]')
  into rows_to_save from jsonb_each_text(p_picks) p
  left join public.math_replay_bindings b on b.account_id=acct and b.lesson_key=p_lesson and b.problem_id=p.key
    and prev.directory_id=p_directory and coalesce(b.fs_id,'legacy:'||b.filename)=p.value;
  if exists(select 1 from jsonb_array_elements(rows_to_save) r where r->>'filename' is null) then
    raise exception 'invalid_file';
  end if;
  insert into public.math_replay_lessons(account_id,lesson_key,directory_id,review_names)
  values(acct,p_lesson,p_directory,array(
    select n from unnest(prev.review_names) n where prev.directory_id=p_directory and not exists(
      select 1 from jsonb_array_elements(rows_to_save) r where r->>'filename'=n)))
  on conflict(account_id,lesson_key) do update set directory_id=excluded.directory_id,revision=excluded.revision,
    saved_at=excluded.saved_at,review_names=excluded.review_names;
  delete from public.math_replay_bindings where account_id=acct and lesson_key=p_lesson;
  insert into public.math_replay_bindings(account_id,lesson_key,problem_id,fs_id,filename)
    select acct,p_lesson,r.problem_id,r.fs_id,r.filename from jsonb_to_recordset(rows_to_save)
    as r(problem_id text,fs_id text,filename text);
end $$;

revoke all on function public.math_replay_editor(text,uuid),public.math_replay_store_scan(uuid,uuid,uuid,jsonb),
  public.math_replay_publish(uuid,text,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.math_replay_editor(text,uuid),public.math_replay_store_scan(uuid,uuid,uuid,jsonb),
  public.math_replay_publish(uuid,text,uuid,uuid,uuid,jsonb) to service_role;
commit;
