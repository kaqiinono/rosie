"""Merge independently authored PET sentence reviews; no database writes.
Preserves extracted source evidence and existing question IDs. Safe to rerun.
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'docs/pet/data'
BACKUP = ROOT / 'output/pet/sentence-extraction-backup.json'
path = DATA / 'sentence-sets.json'
if not BACKUP.exists():
    BACKUP.parent.mkdir(parents=True, exist_ok=True)
    BACKUP.write_bytes(path.read_bytes())
original = json.loads(BACKUP.read_text())
current = json.loads(path.read_text())
original_by_id = {entry['id']: entry for entry in original}
by_id = {entry['id']: entry for entry in current}
words = {entry['key']: entry for entry in json.loads((DATA / 'reviewed-words.json').read_text())}
source_fields = ['source', 'answerSource', 'sourceCells', 'sourceCompletedSentence', 'sourceAnswer', 'sourcePoolRows']
seen = set()
for file in sorted(DATA.glob('sentence-review-*.json')):
    if not re.fullmatch(r'sentence-review-\d+-\d+\.json', file.name):
        continue
    reviews = json.loads(file.read_text())
    for group in reviews:
        key = group['id']
        assert key != 'pet-sentence-01' and key in original_by_id and key not in seen, key
        seen.add(key)
        source = original_by_id[key]
        assert [item['id'] for item in group['items']] == [item['id'] for item in source['items']], key
        assert len(group['items']) == 10 and group['kind'] == 'sentence', key
        if not group.get('reviewed'):
            continue
        for item, raw in zip(group['items'], source['items']):
            ident = item['id']
            assert item.get('reviewed') is True, ident
            assert item.get('wordKey') in words, (ident, item.get('wordKey'))
            assert all(item.get(field) == raw.get(field) for field in source_fields), ('Source evidence changed', ident)
            assert item.get('explanation', '').strip() and item.get('translation', '').strip(), ident
            if item.get('senseId'):
                assert any(s['id'] == item['senseId'] for s in words[item['wordKey']]['content']['senses']), ident
            blanks = len(re.findall(r'_{3,}', item['prompt']))
            answers = item['acceptedAnswerSets']
            assert blanks > 0 and answers and all(len(answer) == blanks and all(isinstance(v, str) and v.strip() for v in answer) for answer in answers), ident
            assert len({tuple(answer) for answer in answers}) == len(answers), ident
            if item.get('options'):
                assert blanks == 1 and all(answer[0] in item['options'] for answer in answers), ident
            changes = {field: {'original': raw.get(field), 'reviewed': item.get(field)}
                       for field in ['prompt', 'acceptedAnswerSets', 'translation'] if raw.get(field) != item.get(field)}
            item['reviewChanges'] = changes
            item.setdefault('review', {})['method'] = 'local-assistant-source-comparison'
            item['review']['decisionFile'] = file.name
            item['review']['sourceQuestion'] = raw['source']['question']
        group['sourceWordPool'] = source['word_pool']
        group['revision'] = '2'
        group['review'] = {'method': 'local-assistant-source-comparison', 'decisionFile': file.name,
                           'decisionSha256': hashlib.sha256(file.read_bytes()).hexdigest()}
        by_id[key] = group

merged = [by_id[group['id']] for group in current]
tmp = path.with_suffix('.json.tmp')
tmp.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + '\n')
tmp.replace(path)
reviewed = [g for g in merged if g.get('reviewed') and g['id'] != 'pet-sentence-01']
audit = {'reviewedNewSets': len(reviewed), 'reviewedNewItems': sum(len(g['items']) for g in reviewed),
         'remainingNewItems': 490 - sum(len(g['items']) for g in reviewed),
         'sourceBackup': str(BACKUP.relative_to(ROOT)),
         'changedItems': [{'id': i['id'], 'changes': i['reviewChanges']} for g in reviewed for i in g['items'] if i['reviewChanges']],
         'questionIds': [i['id'] for g in reviewed for i in g['items']]}
(DATA / 'sentence-review-audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({key: audit[key] for key in ['reviewedNewSets', 'reviewedNewItems', 'remainingNewItems']}))
