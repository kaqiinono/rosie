-- word_entries remains the durable course-position relation. Retired positions
-- are addressable by ID for published material and in-flight sessions.
create schema vocabulary_private;
revoke all on schema vocabulary_private from public, anon;
grant usage on schema vocabulary_private to authenticated, service_role;

create function vocabulary_private.clean(value text)
returns text language sql immutable strict set search_path = '' as $$
  select btrim(regexp_replace(translate(normalize(value, NFC), '‘’', chr(39) || chr(39)),
    '[[:space:]]+', ' ', 'g'))
$$;

create table vocabulary_private.identity_rules (
  match_key text collate "C" primary key,
  canonical_key text collate "C" not null,
  canonical_spelling text not null,
  -- A global identity alias is not by itself a grading equivalent.
  spelling_equivalent boolean not null default false
);

insert into vocabulary_private.identity_rules values
  ('exact:IT', 'exact:IT', 'IT', false),
  ('exact:May', 'exact:May', 'May', false),
  ('exact:Miss', 'exact:Miss', 'Miss', false),
  ('exact:Monday', 'exact:Monday', 'Monday', false),
  ('exact:Tuesday', 'exact:Tuesday', 'Tuesday', false),
  ('exact:Wednesday', 'exact:Wednesday', 'Wednesday', false),
  ('exact:Thursday', 'exact:Thursday', 'Thursday', false),
  ('exact:Friday', 'exact:Friday', 'Friday', false),
  ('exact:Saturday', 'exact:Saturday', 'Saturday', false),
  ('exact:Sunday', 'exact:Sunday', 'Sunday', false),
  ('exact:March', 'exact:March', 'March', false),
  ('exact:August', 'exact:August', 'August', false),
  ('exact:English', 'exact:English', 'English', false),
  ('fold:color', 'fold:colour', 'colour', true),
  ('fold:colour', 'fold:colour', 'colour', true);

create function vocabulary_private.identity(value text)
returns table(normalized_key text, spelling text)
language sql stable strict set search_path = '' as $$
  with cleaned as (
    select vocabulary_private.clean(regexp_replace(value,
      '\s*\((n\.|v\.|adj\.|adv\.|noun|verb|adjective|adverb|AmE [^()]+)\)\s*$',
      '', 'i')) as surface
  )
  select coalesce(exact_rule.canonical_key, folded_rule.canonical_key, 'fold:' || lower(c.surface)),
    coalesce(exact_rule.canonical_spelling, folded_rule.canonical_spelling, lower(c.surface))
  from cleaned c
  left join vocabulary_private.identity_rules exact_rule
    on exact_rule.match_key = 'exact:' || c.surface
  left join vocabulary_private.identity_rules folded_rule
    on folded_rule.match_key = 'fold:' || lower(c.surface)
  where c.surface <> ''
$$;

create table public.vocabulary_headwords (
  id uuid primary key default gen_random_uuid(),
  normalized_key text collate "C" not null unique,
  spelling text not null check (spelling <> ''),
  revision bigint not null default 1,
  created_at timestamptz not null default now()
);

create table public.vocabulary_senses (
  id uuid primary key default gen_random_uuid(),
  headword_id uuid not null references public.vocabulary_headwords(id),
  identity_key text collate "C" not null,
  written jsonb not null check (jsonb_typeof(written) = 'object'),
  verified boolean not null default false,
  cefr text check (cefr in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  cefr_source text,
  revision bigint not null default 1,
  constraint vocabulary_sense_cefr_evidence check (
    (cefr is null and cefr_source is null) or
    (cefr is not null and verified and nullif(btrim(cefr_source), '') is not null)
  ),
  unique (headword_id, identity_key),
  unique (headword_id, id)
);

create table public.vocabulary_usages (
  id uuid primary key default gen_random_uuid(),
  sense_id uuid not null references public.vocabulary_senses(id),
  usage text not null check (btrim(usage) <> ''),
  normalized_usage text collate "C" generated always as (lower(vocabulary_private.clean(usage))) stored,
  cefr text check (cefr in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  cefr_source text,
  constraint vocabulary_usage_cefr_evidence check (
    (cefr is null and cefr_source is null) or
    (cefr is not null and nullif(btrim(cefr_source), '') is not null)
  ),
  unique (sense_id, normalized_usage)
);

create table public.vocabulary_spelling_groups (
  id uuid primary key default gen_random_uuid(),
  headword_id uuid not null references public.vocabulary_headwords(id),
  group_key text collate "C" not null check (btrim(group_key) <> ''),
  answers text[] not null check (cardinality(answers) > 0),
  unique (headword_id, group_key),
  unique (headword_id, id)
);

alter table public.word_entries
  add column headword_id uuid references public.vocabulary_headwords(id),
  add column spelling_group_id uuid,
  add column preferred_spelling text,
  add column archived_at timestamptz,
  add column catalog_revision bigint not null default 1,
  add constraint vocabulary_position_spelling_group
    foreign key (headword_id, spelling_group_id) references public.vocabulary_spelling_groups(headword_id, id),
  add constraint vocabulary_position_identity unique (id, headword_id);

alter table public.word_entries
  alter column creator drop not null,
  drop constraint word_entries_user_id_fkey,
  add constraint word_entries_creator_fkey foreign key (creator) references auth.users(id) on delete set null;

create table public.vocabulary_position_senses (
  word_entry_id uuid not null,
  headword_id uuid not null,
  sense_id uuid not null,
  source_key text collate "C" not null,
  source jsonb not null default '{}' check (jsonb_typeof(source) = 'object'),
  primary key (word_entry_id, source_key),
  foreign key (word_entry_id, headword_id) references public.word_entries(id, headword_id),
  foreign key (headword_id, sense_id) references public.vocabulary_senses(headword_id, id)
);
create index vocabulary_position_senses_target on public.vocabulary_position_senses(sense_id);

create table public.vocabulary_position_usages (
  word_entry_id uuid not null references public.word_entries(id),
  usage_id uuid not null references public.vocabulary_usages(id),
  primary key (word_entry_id, usage_id)
);

create function vocabulary_private.prepare_position()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_key text;
  v_spelling text;
  v_answers text[];
  v_group text;
begin
  if tg_op = 'UPDATE' then
    new.catalog_revision := old.catalog_revision + 1;
    if new.word is not distinct from old.word and old.headword_id is not null then
      new.headword_id := old.headword_id;
      new.spelling_group_id := coalesce(new.spelling_group_id, old.spelling_group_id);
      new.preferred_spelling := coalesce(new.preferred_spelling, old.preferred_spelling);
      return new;
    end if;
  end if;

  select normalized_key, spelling into strict v_key, v_spelling
    from vocabulary_private.identity(new.word);
  if tg_op = 'UPDATE' and old.headword_id is not null and not exists (
    select 1 from public.vocabulary_headwords where id = old.headword_id and normalized_key = v_key
  ) then
    raise exception 'Create a new position when changing lexical identity' using errcode = '22023';
  end if;

  select id into new.headword_id from public.vocabulary_headwords where normalized_key = v_key;
  if not found then
    insert into public.vocabulary_headwords(normalized_key, spelling) values (v_key, v_spelling)
      on conflict (normalized_key) do nothing returning id into new.headword_id;
    if not found then
      select id into strict new.headword_id from public.vocabulary_headwords where normalized_key = v_key;
    end if;
  end if;

  new.preferred_spelling := vocabulary_private.clean(regexp_replace(new.word,
    '\s*\((n\.|v\.|adj\.|adv\.|noun|verb|adjective|adverb|AmE [^()]+)\)\s*$', '', 'i'));
  select array_agg(substr(r.match_key, 6) order by r.match_key) into v_answers
  from vocabulary_private.identity_rules r
  where r.canonical_key = v_key and r.spelling_equivalent and r.match_key like 'fold:%';

  v_group := 'lemma';
  -- Keep legacy editorial notation on its existing answer parser until reviewed.
  if new.preferred_spelling ~ '[()/]' then
    new.spelling_group_id := null;
    return new;
  end if;
  v_answers := coalesce(v_answers, array[v_spelling]);
  select id into new.spelling_group_id from public.vocabulary_spelling_groups
    where headword_id = new.headword_id and group_key = v_group;
  if not found then
    insert into public.vocabulary_spelling_groups(headword_id, group_key, answers)
      values (new.headword_id, v_group, v_answers)
      on conflict (headword_id, group_key) do nothing returning id into new.spelling_group_id;
    if not found then
      select id into strict new.spelling_group_id from public.vocabulary_spelling_groups
        where headword_id = new.headword_id and group_key = v_group;
    end if;
  end if;
  return new;
end;
$$;

create trigger vocabulary_prepare_position before insert or update on public.word_entries
for each row execute function vocabulary_private.prepare_position();

-- Populate stable keys before enforcing the live-position constraint.
update public.word_entries set headword_id = null;
alter table public.word_entries alter column headword_id set not null;

with ranked as (
  select id, row_number() over (partition by coalesce(stage, ''), unit, lesson, headword_id
    order by exists (select 1 from public.pet_word_content p where p.word_entry_id = word_entries.id) desc, id) as ordinal
  from public.word_entries
)
update public.word_entries w set archived_at = transaction_timestamp()
from ranked r where r.id = w.id and r.ordinal > 1;

create unique index vocabulary_active_position_key
  on public.word_entries ((coalesce(stage, '')), unit, lesson, headword_id) where archived_at is null;
create index vocabulary_position_headword on public.word_entries(headword_id);

create function vocabulary_private.sense_identity(p_written jsonb)
returns text language sql immutable set search_path = '' as $$
  select jsonb_build_array(coalesce((
    select array_agg(distinct lower(btrim(value)) order by lower(btrim(value)))
    from jsonb_array_elements_text(coalesce(p_written->'partOfSpeech', '[]'))
  ), '{}'), vocabulary_private.clean(coalesce(p_written->>'definitionEn', '')),
    vocabulary_private.clean(coalesce(p_written->>'definitionZh', '')))::text
$$;

create function vocabulary_private.save_sense(
  p_position uuid, p_source_key text, p_written jsonb, p_source jsonb, p_verified boolean,
  p_cefr text default null, p_cefr_source text default null
) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_headword uuid;
  v_identity text;
  v_sense uuid;
begin
  select headword_id into strict v_headword from public.word_entries where id = p_position;
  v_identity := vocabulary_private.sense_identity(p_written);
  insert into public.vocabulary_senses as existing
    (headword_id, identity_key, written, verified, cefr, cefr_source)
    values (v_headword, v_identity, p_written, p_verified, p_cefr, p_cefr_source)
    on conflict (headword_id, identity_key) do update set
      written = case when excluded.verified and not existing.verified then excluded.written else existing.written end,
      verified = existing.verified or excluded.verified,
      cefr = coalesce(existing.cefr, excluded.cefr),
      cefr_source = coalesce(existing.cefr_source, excluded.cefr_source),
      revision = existing.revision + case when (excluded.verified and not existing.verified)
        or (existing.cefr is null and excluded.cefr is not null) then 1 else 0 end
    returning id into v_sense;
  insert into public.vocabulary_position_senses(word_entry_id, headword_id, sense_id, source_key, source)
    values (p_position, v_headword, v_sense, p_source_key, p_source)
    on conflict (word_entry_id, source_key) do update set sense_id = excluded.sense_id, source = excluded.source;
  return v_sense;
end;
$$;

create function vocabulary_private.capture_legacy_definition()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.explanation, '') <> '' or coalesce(new.chinese_def, '') <> '' then
    perform vocabulary_private.save_sense(new.id, 'legacy', jsonb_build_object(
      'partOfSpeech', coalesce(to_jsonb(new.part_of_speech), '[]'::jsonb),
      'definitionEn', new.explanation, 'definitionZh', new.chinese_def
    ), '{}', false);
  end if;
  return new;
end;
$$;

create trigger vocabulary_legacy_definition
after insert or update of explanation, chinese_def, part_of_speech on public.word_entries
for each row execute function vocabulary_private.capture_legacy_definition();

update public.word_entries set explanation = explanation;

create function vocabulary_private.capture_pet_content()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_sense jsonb;
  v_id uuid;
  v_usage text;
begin
  if not new.published then return new; end if;
  for v_sense in select value from jsonb_array_elements(coalesce(new.content->'senses', '[]')) loop
    v_id := vocabulary_private.save_sense(new.word_entry_id, 'pet:' || (v_sense->>'id'),
      v_sense, jsonb_build_object('revision', new.revision, 'refs', new.content->'sources'), true);
    for v_usage in select value from jsonb_array_elements_text(coalesce(v_sense->'collocations', '[]')) loop
      if btrim(v_usage) <> '' then
        insert into public.vocabulary_usages(sense_id, usage) values (v_id, v_usage) on conflict do nothing;
        insert into public.vocabulary_position_usages(word_entry_id, usage_id)
          select new.word_entry_id, id from public.vocabulary_usages
          where sense_id = v_id and normalized_usage = lower(vocabulary_private.clean(v_usage))
          on conflict do nothing;
      end if;
    end loop;
  end loop;
  return new;
end;
$$;

create trigger vocabulary_pet_content after insert or update on public.pet_word_content
for each row execute function vocabulary_private.capture_pet_content();

update public.pet_word_content set content = content where published;

-- Keep references to duplicate legacy placements and expose their senses on
-- the surviving placement without changing the historical IDs.
insert into public.vocabulary_position_senses(word_entry_id, headword_id, sense_id, source_key, source)
select winner.id, link.headword_id, link.sense_id,
  'legacy-position:' || loser.id || ':' || link.source_key, link.source
from public.vocabulary_position_senses link
join public.word_entries loser on loser.id = link.word_entry_id and loser.archived_at is not null
join public.word_entries winner on winner.archived_at is null and winner.headword_id = loser.headword_id
  and coalesce(winner.stage, '') = coalesce(loser.stage, '') and winner.unit = loser.unit and winner.lesson = loser.lesson;

alter table public.vocabulary_headwords enable row level security;
alter table public.vocabulary_senses enable row level security;
alter table public.vocabulary_usages enable row level security;
alter table public.vocabulary_spelling_groups enable row level security;
alter table public.vocabulary_position_senses enable row level security;
alter table public.vocabulary_position_usages enable row level security;

revoke all on public.vocabulary_headwords, public.vocabulary_senses, public.vocabulary_usages,
  public.vocabulary_spelling_groups, public.vocabulary_position_senses, public.vocabulary_position_usages
  from public, anon, authenticated, service_role;
grant select on public.vocabulary_headwords, public.vocabulary_senses, public.vocabulary_usages,
  public.vocabulary_spelling_groups, public.vocabulary_position_senses, public.vocabulary_position_usages
  to authenticated, service_role;

create policy vocabulary_headwords_read on public.vocabulary_headwords for select to authenticated using (true);
create policy vocabulary_senses_read on public.vocabulary_senses for select to authenticated using (true);
create policy vocabulary_usages_read on public.vocabulary_usages for select to authenticated using (true);
create policy vocabulary_spelling_groups_read on public.vocabulary_spelling_groups for select to authenticated using (true);
create policy vocabulary_position_senses_read on public.vocabulary_position_senses for select to authenticated using (true);
create policy vocabulary_position_usages_read on public.vocabulary_position_usages for select to authenticated using (true);

create view public.vocabulary_positions with (security_invoker = true) as
select w.*, h.spelling as standard_spelling,
  coalesce(nullif(w.explanation, ''), (select string_agg(distinct s.written->>'definitionEn', ' / ')
    from public.vocabulary_position_senses l join public.vocabulary_senses s on s.id = l.sense_id
    where l.word_entry_id = w.id and s.verified), '') as display_explanation,
  coalesce(nullif(w.chinese_def, ''), (select string_agg(distinct s.written->>'definitionZh', ' / ')
    from public.vocabulary_position_senses l join public.vocabulary_senses s on s.id = l.sense_id
    where l.word_entry_id = w.id and s.verified)) as display_chinese_def,
  g.answers as accepted_spellings, (h.normalized_key like 'exact:%') as case_sensitive,
  array(
    select distinct s.id from public.vocabulary_position_senses x
    join public.vocabulary_senses s on s.id = x.sense_id and s.verified
    where x.word_entry_id = w.id order by s.id
  ) as verified_sense_ids,
  (select (array_agg(distinct s.id))[1]
    from public.vocabulary_position_senses l join public.vocabulary_senses s on s.id = l.sense_id
    where l.word_entry_id = w.id and s.verified
      and (nullif(w.chinese_def, '') is null or vocabulary_private.clean(w.chinese_def) = vocabulary_private.clean(s.written->>'definitionZh'))
      and (nullif(w.explanation, '') is null or vocabulary_private.clean(w.explanation) = vocabulary_private.clean(s.written->>'definitionEn'))
    having count(distinct s.id) = 1
  ) as practice_sense_id
from public.word_entries w
join public.vocabulary_headwords h on h.id = w.headword_id
left join public.vocabulary_spelling_groups g on g.id = w.spelling_group_id
where w.archived_at is null;

revoke all on public.vocabulary_positions from public, anon, authenticated, service_role;
grant select on public.vocabulary_positions to authenticated, service_role;

create function vocabulary_private.require_catalog_admin()
returns void language plpgsql stable set search_path = '' as $$
begin
  if (auth.jwt()->>'role') is distinct from 'service_role'
    and (auth.jwt()->'app_metadata'->>'role') is distinct from 'admin' then
    raise exception 'Vocabulary administration requires an administrator' using errcode = '42501';
  end if;
end;
$$;

create function vocabulary_private.write_positions(p_action text, p_rows jsonb)
returns uuid[] language plpgsql security definer set search_path = '' as $$
declare
  v_input jsonb;
  v_data public.word_entries;
  v_old public.word_entries;
  v_saved uuid;
  v_ids uuid[] := '{}';
begin
  perform vocabulary_private.require_catalog_admin();
  if p_action not in ('save', 'archive', 'archive_stage', 'rename_stage')
    or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 then
    raise exception 'Invalid vocabulary operation' using errcode = '22023';
  end if;
  -- Batches may update overlapping positions and headwords.
  perform pg_advisory_xact_lock(hashtextextended('rosie.vocabulary.catalog', 0));
  for v_input in select value from jsonb_array_elements(p_rows) loop
    if p_action = 'archive_stage' then
      update public.word_entries set archived_at = now()
        where stage = v_input->>'stage' and archived_at is null;
    elsif p_action = 'rename_stage' then
      if nullif(btrim(v_input->>'next_stage'), '') is null then
        raise exception 'Missing stage' using errcode = '22023';
      end if;
      update public.word_entries set stage = v_input->>'next_stage'
        where stage = v_input->>'stage' and archived_at is null;
    elsif p_action = 'archive' then
      update public.word_entries set archived_at = now() where id = (v_input->>'id')::uuid
        and archived_at is null;
    else
      if v_input ? 'id' then
        select * into strict v_old from public.word_entries where id = (v_input->>'id')::uuid
          and archived_at is null for update;
        if v_input ? 'expected_revision'
          and v_old.catalog_revision is distinct from (v_input->>'expected_revision')::bigint then
          raise exception 'Vocabulary position changed. Refresh and retry.' using errcode = '40001';
        end if;
      else
        select w.* into v_old from public.word_entries w
        where w.stage is not distinct from v_input->>'stage' and w.unit = v_input->>'unit'
          and w.lesson = v_input->>'lesson' and w.word = v_input->>'word' for update;
      end if;
      v_data := jsonb_populate_record(v_old, v_input - array[
        'id', 'creator', 'headword_id', 'spelling_group_id', 'preferred_spelling', 'archived_at', 'catalog_revision'
      ]);
      v_data.archived_at := null;
      if v_old.id is null then
        if coalesce(auth.uid(), (v_input->>'creator')::uuid) is null then
          raise exception 'Creator is required for a new vocabulary position' using errcode = '22023';
        end if;
        insert into public.word_entries(
          creator, stage, unit, lesson, word, explanation, chinese_def, ipa, example, phonics,
          syllables, keywords, vocab_type, part_of_speech, word_forms,
          image_path, image_match_score, image_match_query, image_source, image_pexels_id
        ) values (
          coalesce(auth.uid(), (v_input->>'creator')::uuid), v_data.stage, v_data.unit, v_data.lesson, v_data.word,
          coalesce(v_data.explanation, ''), v_data.chinese_def, v_data.ipa, v_data.example, v_data.phonics,
          v_data.syllables, v_data.keywords, v_data.vocab_type, v_data.part_of_speech, v_data.word_forms,
          v_data.image_path, v_data.image_match_score, v_data.image_match_query, v_data.image_source, v_data.image_pexels_id
        ) returning id into v_saved;
      else
        if v_data is distinct from v_old then
          update public.word_entries set archived_at = null, stage = v_data.stage, unit = v_data.unit, lesson = v_data.lesson,
            word = v_data.word, explanation = v_data.explanation, chinese_def = v_data.chinese_def,
            ipa = v_data.ipa, example = v_data.example, phonics = v_data.phonics, syllables = v_data.syllables,
            keywords = v_data.keywords, vocab_type = v_data.vocab_type, part_of_speech = v_data.part_of_speech,
            word_forms = v_data.word_forms, image_path = v_data.image_path, image_match_score = v_data.image_match_score,
            image_match_query = v_data.image_match_query, image_source = v_data.image_source,
            image_pexels_id = v_data.image_pexels_id where id = v_old.id;
        end if;
        v_saved := v_old.id;
      end if;
      v_ids := array_append(v_ids, v_saved);
    end if;
  end loop;
  return v_ids;
end;
$$;

create function public.write_vocabulary_positions(p_action text, p_rows jsonb)
returns uuid[] language sql set search_path = '' as $$
  select vocabulary_private.write_positions(p_action, p_rows)
$$;

-- Existing deployed clients retain their RLS-governed write grants during the
-- schema rollout. The triggers cover their inserts and updates. Revoke direct
-- grants only when the deployed app has switched to the catalog RPCs.
revoke execute on all functions in schema vocabulary_private from public, anon, authenticated, service_role;
grant execute on function vocabulary_private.clean(text) to authenticated, service_role;
revoke execute on function public.write_vocabulary_positions(text, jsonb) from public, anon, authenticated, service_role;
grant execute on function vocabulary_private.write_positions(text, jsonb),
  public.write_vocabulary_positions(text, jsonb) to authenticated, service_role;

-- An explicitly reviewed manifest can bind a broad legacy placement to
-- multiple shared senses, reuse an existing sense, or publish a new one.
create table vocabulary_private.source_receipts (
  source_key text collate "C" not null,
  source_revision text collate "C" not null,
  row_key text collate "C" not null,
  payload jsonb not null,
  word_entry_id uuid not null references public.word_entries(id),
  primary key (source_key, source_revision, row_key)
);

create function vocabulary_private.publish_reviewed_position(p_input jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_headword uuid;
  v_key text;
  v_source jsonb := p_input->'source';
  v_receipt vocabulary_private.source_receipts;
  v_sense jsonb;
  v_sense_id uuid;
  v_usage jsonb;
  v_usage_id uuid;
  v_spelling jsonb := p_input->'spelling';
  v_preferred text;
  v_group uuid;
  v_answers text[];
  v_sources text[] := '{}';
  v_index integer := 0;
begin
  perform vocabulary_private.require_catalog_admin();
  if jsonb_typeof(v_source) is distinct from 'object'
    or nullif(btrim(v_source->>'key'), '') is null
    or nullif(btrim(v_source->>'revision'), '') is null
    or nullif(btrim(v_source->>'row'), '') is null
    or jsonb_typeof(p_input->'position') is distinct from 'object'
    or jsonb_typeof(p_input->'senses') is distinct from 'array'
    or jsonb_array_length(p_input->'senses') not between 1 and 50 then
    raise exception 'A reviewed position requires source, position and senses' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('rosie.vocabulary.catalog', 0));
  select * into v_receipt from vocabulary_private.source_receipts
    where source_key = v_source->>'key' and source_revision = v_source->>'revision' and row_key = v_source->>'row';
  if found then
    if v_receipt.payload is distinct from p_input then
      raise exception 'Change the source revision after changing a reviewed row' using errcode = '40001';
    end if;
    return v_receipt.word_entry_id;
  end if;

  v_id := (vocabulary_private.write_positions('save', jsonb_build_array(p_input->'position')))[1];
  select headword_id into strict v_headword from public.word_entries where id = v_id;
  if v_spelling is not null then
    v_preferred := vocabulary_private.clean(v_spelling->>'preferred');
    select array_agg(distinct vocabulary_private.clean(value) order by vocabulary_private.clean(value))
      into v_answers from jsonb_array_elements_text(v_spelling->'answers');
    if nullif(btrim(v_spelling->>'key'), '') is null or v_preferred is null
      or coalesce(cardinality(v_answers), 0) = 0 or '' = any(v_answers) or not (v_preferred = any(v_answers)) then
      raise exception 'Invalid reviewed spelling group' using errcode = '22023';
    end if;
    insert into public.vocabulary_spelling_groups(headword_id, group_key, answers)
      values (v_headword, v_spelling->>'key', v_answers) on conflict (headword_id, group_key) do nothing;
    select id into v_group from public.vocabulary_spelling_groups
      where headword_id = v_headword and group_key = v_spelling->>'key'
        and (select array_agg(value order by value) from unnest(answers) as a(value)) = v_answers;
    if not found then raise exception 'Use a new reviewed group key when answer equivalence changes' using errcode = '40001'; end if;
    update public.word_entries set spelling_group_id = v_group, preferred_spelling = v_preferred where id = v_id;
  end if;
  for v_sense in select value from jsonb_array_elements(p_input->'senses') loop
    v_index := v_index + 1;
    v_key := 'review:' || jsonb_build_array(v_source->>'key', v_source->>'row', v_index)::text;
    v_sources := array_append(v_sources, v_key);
    if v_sense ? 'senseId' then
      v_sense_id := (v_sense->>'senseId')::uuid;
      if not exists (
        select 1 from public.vocabulary_senses where id = v_sense_id and headword_id = v_headword and verified
      ) then
        raise exception 'Referenced sense does not belong to this headword' using errcode = '22023';
      end if;
      if v_sense ? 'cefr' and v_sense->>'cefr' is not null then
        update public.vocabulary_senses set cefr = v_sense->>'cefr', cefr_source = v_sense->>'cefrSource',
          revision = revision + 1 where id = v_sense_id and cefr is null;
      end if;
      insert into public.vocabulary_position_senses(word_entry_id, headword_id, sense_id, source_key, source)
        values (v_id, v_headword, v_sense_id, v_key, v_source)
      on conflict (word_entry_id, source_key) do update set sense_id = excluded.sense_id, source = excluded.source;
    else
      if jsonb_typeof(v_sense->'partOfSpeech') is distinct from 'array'
        or jsonb_array_length(v_sense->'partOfSpeech') = 0
        or (nullif(btrim(v_sense->>'definitionEn'), '') is null and nullif(btrim(v_sense->>'definitionZh'), '') is null) then
        raise exception 'A new sense needs a part of speech and a definition' using errcode = '22023';
      end if;
      v_sense_id := vocabulary_private.save_sense(v_id, v_key,
        v_sense - array['cefr', 'cefrSource', 'usages'], v_source, true,
        v_sense->>'cefr', v_sense->>'cefrSource');
    end if;

    for v_usage in select value from jsonb_array_elements(coalesce(v_sense->'usages', '[]')) loop
      insert into public.vocabulary_usages as existing (sense_id, usage, cefr, cefr_source)
      values (v_sense_id, v_usage->>'text', v_usage->>'cefr', v_usage->>'cefrSource')
      on conflict (sense_id, normalized_usage) do update
        set cefr = coalesce(existing.cefr, excluded.cefr), cefr_source = coalesce(existing.cefr_source, excluded.cefr_source)
      returning id into v_usage_id;
      insert into public.vocabulary_position_usages(word_entry_id, usage_id) values (v_id, v_usage_id)
        on conflict do nothing;
    end loop;
  end loop;
  delete from public.vocabulary_position_senses
    where word_entry_id = v_id and source->>'key' = v_source->>'key'
      and source->>'row' = v_source->>'row' and not (source_key = any(v_sources));

  insert into vocabulary_private.source_receipts(source_key, source_revision, row_key, payload, word_entry_id)
    values (v_source->>'key', v_source->>'revision', v_source->>'row', p_input, v_id);
  return v_id;
end;
$$;

create function public.publish_reviewed_vocabulary_position(p_input jsonb)
returns uuid language sql set search_path = '' as $$
  select vocabulary_private.publish_reviewed_position(p_input)
$$;

revoke execute on function vocabulary_private.publish_reviewed_position(jsonb),
  public.publish_reviewed_vocabulary_position(jsonb) from public, anon, authenticated, service_role;
grant execute on function vocabulary_private.publish_reviewed_position(jsonb),
  public.publish_reviewed_vocabulary_position(jsonb) to authenticated, service_role;

create view public.vocabulary_search with (security_invoker = true) as
select distinct on (p.headword_id) p.*,
  coalesce((select string_agg(s.written->>'definitionEn', ' / ' order by s.id)
    from public.vocabulary_senses s where s.headword_id = p.headword_id and s.verified), p.explanation) as shared_explanation,
  coalesce((select string_agg(s.written->>'definitionZh', ' / ' order by s.id)
    from public.vocabulary_senses s where s.headword_id = p.headword_id and s.verified), p.chinese_def) as shared_chinese_def
from public.vocabulary_positions p
order by p.headword_id, (cardinality(p.verified_sense_ids) > 0) desc,
  (p.word = p.standard_spelling) desc, p.id;

revoke all on public.vocabulary_search from public, anon, authenticated, service_role;
grant select on public.vocabulary_search to authenticated, service_role;

create function vocabulary_private.find_headword(p_word text)
returns uuid language sql stable security definer set search_path = '' as $$
  select h.id from vocabulary_private.identity(p_word) i
  join public.vocabulary_headwords h on h.normalized_key = i.normalized_key
$$;

create function public.find_vocabulary_headword(p_word text)
returns uuid language sql stable set search_path = '' as $$
  select vocabulary_private.find_headword(p_word)
$$;

revoke execute on function vocabulary_private.find_headword(text), public.find_vocabulary_headword(text)
  from public, anon, authenticated, service_role;
grant execute on function vocabulary_private.find_headword(text), public.find_vocabulary_headword(text)
  to authenticated, service_role;

create function vocabulary_private.revise_sense(
  p_id uuid, p_expected_revision bigint, p_written jsonb, p_cefr text, p_cefr_source text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_written jsonb;
begin
  perform vocabulary_private.require_catalog_admin();
  perform pg_advisory_xact_lock(hashtextextended('rosie.vocabulary.catalog', 0));
  select written || p_written into v_written from public.vocabulary_senses
    where id = p_id and revision = p_expected_revision and verified for update;
  if not found then raise exception 'Sense changed. Refresh and retry.' using errcode = '40001'; end if;
  if jsonb_typeof(v_written->'partOfSpeech') is distinct from 'array'
    or jsonb_array_length(v_written->'partOfSpeech') = 0
    or (nullif(btrim(v_written->>'definitionEn'), '') is null and nullif(btrim(v_written->>'definitionZh'), '') is null) then
    raise exception 'A sense requires part of speech and a definition' using errcode = '22023';
  end if;
  update public.vocabulary_senses set written = v_written,
    identity_key = vocabulary_private.sense_identity(v_written),
    cefr = p_cefr, cefr_source = p_cefr_source, revision = revision + 1 where id = p_id;
end;
$$;

create function public.revise_vocabulary_sense(
  p_id uuid, p_expected_revision bigint, p_written jsonb, p_cefr text, p_cefr_source text
) returns void language sql set search_path = '' as $$
  select vocabulary_private.revise_sense(p_id, p_expected_revision, p_written, p_cefr, p_cefr_source)
$$;

revoke execute on function vocabulary_private.revise_sense(uuid,bigint,jsonb,text,text),
  public.revise_vocabulary_sense(uuid,bigint,jsonb,text,text) from public, anon, authenticated, service_role;
grant execute on function vocabulary_private.revise_sense(uuid,bigint,jsonb,text,text),
  public.revise_vocabulary_sense(uuid,bigint,jsonb,text,text) to authenticated, service_role;
