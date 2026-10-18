ALTER TABLE public.word_entries
ADD COLUMN word_forms jsonb;

ALTER TABLE public.word_entries
ADD CONSTRAINT word_entries_word_forms_is_object
CHECK (word_forms IS NULL OR jsonb_typeof(word_forms) = 'object');

COMMENT ON COLUMN public.word_entries.word_forms IS
  'Explicit irregular/special surface forms only. Keys: plural, thirdPerson, presentParticiple, past, pastParticiple, comparative, superlative, other, disableGenerated; values are text arrays.';

-- Backfill the existing catalog. For phrasal entries, replace the leading
-- inflectable word and retain the rest (`take off` -> `took off`). Regular
-- forms remain generated in application code and are intentionally not stored.
WITH form_map(base, plural, third_person, present_participle, past, past_participle, comparative, superlative, other_forms, disabled) AS (
  VALUES
    ('bad', NULL::text[], NULL::text[], NULL::text[], NULL::text[], NULL::text[], ARRAY['worse'], ARRAY['worst'], NULL::text[], NULL::text[]),
    ('be', NULL, ARRAY['is'], ARRAY['being'], ARRAY['was','were'], ARRAY['been'], NULL, NULL, ARRAY['am','are'], ARRAY['plural','comparative','superlative']),
    ('bleed', NULL, NULL, NULL, ARRAY['bled'], ARRAY['bled'], NULL, NULL, NULL, NULL),
    ('break', NULL, NULL, NULL, ARRAY['broke'], ARRAY['broken'], NULL, NULL, NULL, NULL),
    ('bring', NULL, NULL, NULL, ARRAY['brought'], ARRAY['brought'], NULL, NULL, NULL, NULL),
    ('burn', NULL, NULL, NULL, ARRAY['burnt'], ARRAY['burnt'], NULL, NULL, NULL, NULL),
    ('buy', NULL, NULL, NULL, ARRAY['bought'], ARRAY['bought'], NULL, NULL, NULL, NULL),
    ('can', NULL, NULL, NULL, NULL, NULL, NULL, NULL, ARRAY['could'], ARRAY['plural','thirdPerson','presentParticiple','past','pastParticiple','comparative','superlative']),
    ('catch', NULL, NULL, NULL, ARRAY['caught'], ARRAY['caught'], NULL, NULL, NULL, NULL),
    ('child', ARRAY['children'], NULL, NULL, NULL, NULL, NULL, NULL, NULL, ARRAY['thirdPerson','presentParticiple','past','pastParticiple','comparative','superlative']),
    ('come', NULL, NULL, NULL, ARRAY['came'], ARRAY['come'], NULL, NULL, NULL, NULL),
    ('do', NULL, NULL, NULL, ARRAY['did'], ARRAY['done'], NULL, NULL, NULL, NULL),
    ('draw', NULL, NULL, NULL, ARRAY['drew'], ARRAY['drawn'], NULL, NULL, NULL, NULL),
    ('drink', NULL, NULL, NULL, ARRAY['drank'], ARRAY['drunk'], NULL, NULL, NULL, NULL),
    ('drive', NULL, NULL, NULL, ARRAY['drove'], ARRAY['driven'], NULL, NULL, NULL, NULL),
    ('eat', NULL, NULL, NULL, ARRAY['ate'], ARRAY['eaten'], NULL, NULL, NULL, NULL),
    ('fall', NULL, NULL, NULL, ARRAY['fell'], ARRAY['fallen'], NULL, NULL, NULL, NULL),
    ('far', NULL, NULL, NULL, NULL, NULL, ARRAY['farther','further'], ARRAY['farthest','furthest'], NULL, NULL),
    ('feel', NULL, NULL, NULL, ARRAY['felt'], ARRAY['felt'], NULL, NULL, NULL, NULL),
    ('find', NULL, NULL, NULL, ARRAY['found'], ARRAY['found'], NULL, NULL, NULL, NULL),
    ('fly', NULL, NULL, NULL, ARRAY['flew'], ARRAY['flown'], NULL, NULL, NULL, NULL),
    ('foot', ARRAY['feet'], NULL, NULL, NULL, NULL, NULL, NULL, NULL, ARRAY['thirdPerson','presentParticiple','past','pastParticiple','comparative','superlative']),
    ('get', NULL, NULL, NULL, ARRAY['got'], ARRAY['got','gotten'], NULL, NULL, NULL, NULL),
    ('give', NULL, NULL, NULL, ARRAY['gave'], ARRAY['given'], NULL, NULL, NULL, NULL),
    ('go', NULL, NULL, NULL, ARRAY['went'], ARRAY['gone'], NULL, NULL, NULL, NULL),
    ('good', NULL, NULL, NULL, NULL, NULL, ARRAY['better'], ARRAY['best'], NULL, NULL),
    ('grow', NULL, NULL, NULL, ARRAY['grew'], ARRAY['grown'], NULL, NULL, NULL, NULL),
    ('hang', NULL, NULL, NULL, ARRAY['hung'], ARRAY['hung'], NULL, NULL, NULL, NULL),
    ('have', NULL, ARRAY['has'], NULL, ARRAY['had'], ARRAY['had'], NULL, NULL, NULL, NULL),
    ('hear', NULL, NULL, NULL, ARRAY['heard'], ARRAY['heard'], NULL, NULL, NULL, NULL),
    ('keep', NULL, NULL, NULL, ARRAY['kept'], ARRAY['kept'], NULL, NULL, NULL, NULL),
    ('knife', ARRAY['knives'], NULL, NULL, NULL, NULL, NULL, NULL, NULL, ARRAY['thirdPerson','presentParticiple','past','pastParticiple','comparative','superlative']),
    ('know', NULL, NULL, NULL, ARRAY['knew'], ARRAY['known'], NULL, NULL, NULL, NULL),
    ('lay', NULL, NULL, NULL, ARRAY['laid'], ARRAY['laid'], NULL, NULL, NULL, NULL),
    ('leaf', ARRAY['leaves'], NULL, NULL, NULL, NULL, NULL, NULL, NULL, ARRAY['thirdPerson','presentParticiple','past','pastParticiple','comparative','superlative']),
    ('learn', NULL, NULL, NULL, ARRAY['learnt'], ARRAY['learnt'], NULL, NULL, NULL, NULL),
    ('leave', NULL, NULL, NULL, ARRAY['left'], ARRAY['left'], NULL, NULL, NULL, NULL),
    ('lie', NULL, NULL, ARRAY['lying'], ARRAY['lay'], ARRAY['lain'], NULL, NULL, NULL, NULL),
    ('make', NULL, NULL, NULL, ARRAY['made'], ARRAY['made'], NULL, NULL, NULL, NULL),
    ('mouse', ARRAY['mice'], NULL, NULL, NULL, NULL, NULL, NULL, NULL, ARRAY['thirdPerson','presentParticiple','past','pastParticiple','comparative','superlative']),
    ('pay', NULL, NULL, NULL, ARRAY['paid'], ARRAY['paid'], NULL, NULL, NULL, NULL),
    ('ride', NULL, NULL, NULL, ARRAY['rode'], ARRAY['ridden'], NULL, NULL, NULL, NULL),
    ('run', NULL, NULL, NULL, ARRAY['ran'], ARRAY['run'], NULL, NULL, NULL, NULL),
    ('show', NULL, NULL, NULL, NULL, ARRAY['shown'], NULL, NULL, NULL, NULL),
    ('sing', NULL, NULL, NULL, ARRAY['sang'], ARRAY['sung'], NULL, NULL, NULL, NULL),
    ('sink', NULL, NULL, NULL, ARRAY['sank','sunk'], ARRAY['sunk'], NULL, NULL, NULL, NULL),
    ('sit', NULL, NULL, NULL, ARRAY['sat'], ARRAY['sat'], NULL, NULL, NULL, NULL),
    ('spend', NULL, NULL, NULL, ARRAY['spent'], ARRAY['spent'], NULL, NULL, NULL, NULL),
    ('steal', NULL, NULL, NULL, ARRAY['stole'], ARRAY['stolen'], NULL, NULL, NULL, NULL),
    ('swim', NULL, NULL, NULL, ARRAY['swam'], ARRAY['swum'], NULL, NULL, NULL, NULL),
    ('take', NULL, NULL, NULL, ARRAY['took'], ARRAY['taken'], NULL, NULL, NULL, NULL),
    ('teach', NULL, NULL, NULL, ARRAY['taught'], ARRAY['taught'], NULL, NULL, NULL, NULL),
    ('think', NULL, NULL, NULL, ARRAY['thought'], ARRAY['thought'], NULL, NULL, NULL, NULL),
    ('throw', NULL, NULL, NULL, ARRAY['threw'], ARRAY['thrown'], NULL, NULL, NULL, NULL),
    ('tooth', ARRAY['teeth'], NULL, NULL, NULL, NULL, NULL, NULL, NULL, ARRAY['thirdPerson','presentParticiple','past','pastParticiple','comparative','superlative']),
    ('wake', NULL, NULL, NULL, ARRAY['woke'], ARRAY['woken'], NULL, NULL, NULL, NULL),
    ('wear', NULL, NULL, NULL, ARRAY['wore'], ARRAY['worn'], NULL, NULL, NULL, NULL),
    ('well', NULL, NULL, NULL, NULL, NULL, ARRAY['better'], ARRAY['best'], NULL, NULL),
    ('wife', ARRAY['wives'], NULL, NULL, NULL, NULL, NULL, NULL, NULL, ARRAY['thirdPerson','presentParticiple','past','pastParticiple','comparative','superlative']),
    ('win', NULL, NULL, NULL, ARRAY['won'], ARRAY['won'], NULL, NULL, NULL, NULL),
    ('write', NULL, NULL, NULL, ARRAY['wrote'], ARRAY['written'], NULL, NULL, NULL, NULL)
), matched AS (
  SELECT w.id, w.word, m.*
  FROM public.word_entries w
  JOIN form_map m
    ON lower(trim(w.word)) = m.base
    OR lower(trim(w.word)) LIKE m.base || ' %'
    OR lower(trim(w.word)) LIKE m.base || ' (%'
  WHERE lower(trim(w.word)) <> 'hang glider'
), prepared AS (
  SELECT id, jsonb_strip_nulls(jsonb_build_object(
    'plural', (SELECT jsonb_agg(regexp_replace(word, '^' || base, form, 'i')) FROM unnest(plural) form),
    'thirdPerson', (SELECT jsonb_agg(regexp_replace(word, '^' || base, form, 'i')) FROM unnest(third_person) form),
    'presentParticiple', (SELECT jsonb_agg(regexp_replace(word, '^' || base, form, 'i')) FROM unnest(present_participle) form),
    'past', (SELECT jsonb_agg(regexp_replace(word, '^' || base, form, 'i')) FROM unnest(past) form),
    'pastParticiple', (SELECT jsonb_agg(regexp_replace(word, '^' || base, form, 'i')) FROM unnest(past_participle) form),
    'comparative', (SELECT jsonb_agg(regexp_replace(word, '^' || base, form, 'i')) FROM unnest(comparative) form),
    'superlative', (SELECT jsonb_agg(regexp_replace(word, '^' || base, form, 'i')) FROM unnest(superlative) form),
    'other', (SELECT jsonb_agg(regexp_replace(word, '^' || base, form, 'i')) FROM unnest(other_forms) form),
    'disableGenerated', to_jsonb(disabled)
  )) AS forms
  FROM matched
)
UPDATE public.word_entries AS target
SET word_forms = prepared.forms
FROM prepared
WHERE target.id = prepared.id;
