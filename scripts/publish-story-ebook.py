#!/usr/bin/env python3
"""Plan Story image keys and emit the volume data after the Baidu read-back checks."""

import argparse
import collections
import hashlib
import json
import re
from pathlib import Path


GUIDE_SECTIONS = (
    (1, 'A Letter from Griffith'),
    (2, 'Wizards and Magical Tools'),
    (12, 'Bracken and King Roland’s Castle'),
    (22, 'Dragon Stones and Dragon Care'),
    (30, 'Drake, Worm, and the Farmers’ Village'),
    (38, 'Rori, Vulcan, and the Crafters’ Village'),
    (46, 'Bo, Shu, and the Kingdom of Emperor Song'),
    (54, 'Ana, Kepri, Heru, and Wati'),
    (66, 'Petra, Zera, and the Southern Lands'),
    (74, 'Carlos, Lalo, and Aragon'),
    (84, 'Mina, Frost, and the Far North'),
    (92, 'Obi, Dayo, and Ifri'),
    (100, 'Jean, Argent, and Gallia'),
    (106, 'Darma, Hema, and Suvarna'),
    (112, 'Uri, Zelda, and the Naga'),
    (118, 'Breen, Fallyn, and Inis Banba'),
    (126, 'Eko, Neru, and Dragon Mages'),
    (132, 'A Message from King Roland'),
    (134, 'Dark Forces and Maldred'),
    (140, 'The World of the Dragon Masters'),
)

DESCRIPTIONS = {
    0: 'Griffith introduces the wizards, dragons, Dragon Masters, and kingdoms of their world.',
    3: 'A visitor sneaks into the castle, and Bo and Shu take the Dragon Masters across the world.',
    4: 'When trouble reaches King Roland’s castle, Rori and Vulcan put their fire powers to the test.',
    5: 'Petra meets Zera, a four-headed dragon whose song holds a surprise.',
    6: 'The Dragon Masters travel to the Land of Pyramids to look for a way to save the Dragon Stone.',
    7: 'Drake and his friends search for a young dragon who moves as fast as lightning.',
    8: 'A parade of dragons takes an unexpected turn when Eko arrives in Bracken.',
    9: 'Mina asks the Dragon Masters for help against an Ice Giant in the Far North.',
    10: 'The Dragon Masters travel to Ifri to find a Rainbow Dragon who can bring rain.',
    11: 'A missing wizard and a silver key lead the Dragon Masters to Jean and Argent.',
    12: 'The Dragon Masters race to protect a gold key guarded by a dragon named Hema.',
    13: 'The Dragon Masters seek the Naga, a powerful dragon who can shake the earth.',
    14: 'When Bracken needs help, the Dragon Masters search for a rare flower and meet Fallyn.',
    15: 'The Dragon Masters set out on a rescue mission and confront a threat from the past.',
    16: 'Trouble in Remus leads the Dragon Masters to a dragon with the power of sound.',
    17: 'The Dragon Masters seek help from wizard sisters and face the power of stone.',
    18: 'When Worm needs help, Drake and his friends search for a Lava Dragon.',
    19: 'Drake and his friends travel to the islands to ask a Sea Dragon for help.',
    20: 'The Dragon Masters go looking for a Wind Dragon and find more than they expected.',
    21: 'A dragon visitor leads Drake and his friends into a new adventure with Wildroot.',
    22: 'The Dragon Masters have to find and protect dragons that are almost impossible to see.',
    23: 'A strange shadow sets the Dragon Masters on the trail of a dangerous curse.',
    24: 'A new quest takes the Dragon Masters to a crystal castle in search of a Light Dragon.',
}

TITLE_19 = (
    'The Wizard in the Bubble', 'My Spell', 'Don’t Touch the Thorns!', 'Keep It Safe', 'Manawa',
    'Enemies, Not Friends', 'Astrid Attacks!', 'A Hard Choice', 'Tricked!', 'Fire and Water',
    'They Won’t Listen!', 'Save the Village!', 'The Big Wave', 'Peace at Last?',
    'What’s Wrong, Worm?', 'A Feast',
)


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, data):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def sections(source):
    if source['number'] == 0:
        return [{'number': i, 'title': title, 'page': page}
                for i, (page, title) in enumerate(GUIDE_SECTIONS, 1)]
    return [
        {
            **entry,
            'title': TITLE_19[i] if source['number'] == 19 else entry['title'].replace("'", '’'),
        }
        for i, entry in enumerate(source['chapters'])
    ]


def extract_seed_glossary(root):
    terms = {}
    escape_string = r'("(?:[^"\\]|\\.)*")'
    pattern = re.compile(
        r'\{ word: ' + escape_string + r', ipa: ' + escape_string
        + r', meaningCn: ' + escape_string + r', meaningEn: ' + escape_string
    )
    for name in ('story-dragon-masters.ts', 'story-dragon-masters-saving-the-sun-dragon.ts'):
        file = root / 'packages' / 'english' / 'src' / 'utils' / name
        for item in pattern.finditer(file.read_text(encoding='utf-8')):
            word, ipa, zh, en = map(json.loads, item.groups())
            terms.setdefault(word.lower(), {'word': word, 'ipa': ipa, 'meaningCn': zh, 'meaningEn': en})
    return terms


def read_glossary(root, dictionary_path, custom_path):
    authored = extract_seed_glossary(root)
    if custom_path:
        for line in custom_path.read_text(encoding='utf-8').splitlines():
            if not line or line.startswith('#'):
                continue
            word, ipa, zh, en = [column.strip() for column in line.split('|')]
            authored[word.lower()] = {'word': word, 'ipa': f'/{ipa}/', 'meaningCn': zh, 'meaningEn': en}
    review = {}
    if dictionary_path:
        for entry in load(dictionary_path):
            word = entry['key']
            fields = entry['fields']
            if entry.get('reviewed') and fields.get('ipa') and fields.get('chinese_def') \
               and fields.get('explanation') and len(entry['content'].get('senses', [])) == 1:
                review[word.lower()] = {'word': word, 'ipa': fields['ipa'], 'meaningCn': fields['chinese_def'],
                                        'meaningEn': fields['explanation']}
    return authored, review


def glossary_for(text, authored, reviewed, frequency):
    body = text.lower()
    words = set(re.findall(r'[a-z]+(?:[’\-][a-z]+)*', body))
    matches = []
    for word, entry in authored.items():
        if word not in words and not (' ' in word and re.search(r'(?<!\w)' + re.escape(word) + r'(?!\w)', body)):
            continue
        if len(word) >= 4 or word in {'orb', 'hut'}:
            matches.append((frequency[word], -len(word), entry))
    matches.sort(key=lambda match: (match[0], match[1], match[2]['word']))
    result = [entry for _, _, entry in matches[:8]]
    if len(result) < 6:
        used = {term['word'].lower() for term in result}
        eligible = [
            word for word in words
            if word in reviewed and word not in used and len(word) >= 6
            and word not in {'dragon', 'master', 'called', 'looked', 'wanted', 'always', 'really', 'castle', 'started'}
        ]
        eligible.sort(key=lambda word: (frequency[word], -len(word), word))
        result.extend(reviewed[word] for word in eligible[:6 - len(result)])
    return result


def pages_for(start, stop, draft, edits):
    for page in draft[start - 1:stop - 1]:
        override = edits.get(str(page['index']), {})
        paragraphs = [dict(paragraph) for paragraph in page['paragraphs']]
        if 'paragraphs' in override:
            paragraphs = [{'text': text, 'y': y} for y, text in override['paragraphs']]
        paragraphs.extend({'text': text, 'y': y} for y, text in override.get('append', []))
        if paragraphs and 'opening' in override:
            before, after = override['opening']
            if not paragraphs[0]['text'].startswith(before):
                raise ValueError(f"Stale opening correction on page {page['index']}")
            paragraphs[0]['text'] = after + paragraphs[0]['text'][len(before):]
        for before, after in override.get('replace', []):
            hit = False
            for entry in paragraphs:
                if before in entry['text']:
                    entry['text'] = entry['text'].replace(before, after)
                    hit = True
            if not hit:
                raise ValueError(f"Stale text correction on page {page['index']}: {before}")
        yield {**page, 'paragraphs': paragraphs}


def volume_data(source, draft, edits, author_words, reviewed_words, frequency):
    number = source['number']
    slug = source['slug']
    title = source['title'].replace("'", '’')
    result = {'slug': slug, 'number': number, 'title': title,
              'description': DESCRIPTIONS[number], 'chapters': []}
    media = {'slug': slug, 'files': []}
    prefix = 'stories/dragon-masters/' + slug
    boundaries = sections(source)
    for i, section in enumerate(boundaries):
        start = section['page']
        stop = boundaries[i + 1]['page'] if i + 1 < len(boundaries) else len(draft) + 1
        key = f"ch{section['number']:02d}"
        chapter = {'key': key, 'number': section['number'], 'title': section['title'],
                   'paragraphs': [], 'illustrations': []}
        for page in pages_for(start, stop, draft, edits):
            base = len(chapter['paragraphs']) - 1
            lines = page['paragraphs']
            for paragraph in lines:
                text = paragraph['text'].strip()
                if text:
                    chapter['paragraphs'].append(text)
            art = page['art']
            if not art:
                continue
            position = art['position']
            after = -1 if page['index'] == start and number else base + sum(
                line['y'] <= position and bool(line['text'].strip()) for line in lines
            )
            name = f"{key}-p{page['index'] - start + 1:02d}.webp"
            chapter['illustrations'].append({
                'afterParagraph': after, 'path': f'{prefix}/{name}',
                'alt': f"《{section['title']}》原书{'图解' if number == 0 else '插图'}（第 {page['index']} 页）",
                'width': art['width'], 'height': art['height'],
            })
            media['files'].append({'local': art['file'], 'remote': name})
        body = ' '.join(chapter['paragraphs'])
        chapter['glossary'] = glossary_for(body, author_words, reviewed_words, frequency)
        if not body.strip():
            raise ValueError(f'Empty text in {title} / {key}')
        positions = [illustration['afterParagraph'] for illustration in chapter['illustrations']]
        if positions != sorted(positions) or any(not -1 <= index < len(chapter['paragraphs']) for index in positions):
            raise ValueError(f'Invalid illustration order in {title} / {key}')
        result['chapters'].append(chapter)
    return result, media


def verify_art(directory, media):
    receipt = directory / 'baidu-receipts.jsonl'
    published = {entry['path']: entry['sha256']
                 for line in receipt.read_text().splitlines() if (entry := json.loads(line))}
    prefix = '/airosie/english/story/dragon-masters/pics/' + media['slug']
    for item in media['files']:
        local = directory / 'art' / item['local']
        digest = hashlib.sha256(local.read_bytes()).hexdigest()
        if published.get(prefix + '/' + item['remote']) != digest:
            raise ValueError(f'Artwork not verified: {media["slug"]}/{item["remote"]}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work', type=Path, required=True)
    parser.add_argument('--dictionary', type=Path)
    parser.add_argument('--glossary', type=Path)
    parser.add_argument('--edits', type=Path, help='Reviewed wording and page-specific corrections.')
    parser.add_argument('--target', type=Path)
    parser.add_argument('volumes', nargs='+', type=int)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    authored, reviewed = read_glossary(repo, args.dictionary, args.glossary)
    corrections = load(args.edits) if args.edits else {}
    corpus = '\n'.join(
        line['text'].lower()
        for draft in args.work.glob('*/draft.json')
        for page in load(draft)
        for line in page['paragraphs']
    )
    frequency = collections.Counter(re.findall(r'[a-z]+(?:[’\-][a-z]+)*', corpus))
    for number in args.volumes:
        directory = args.work / f'{number:02d}'
        source = load(directory / 'source.json')
        draft = load(directory / 'draft.json')
        edits = corrections.get(f'{number:02d}', {})
        result, media = volume_data(source, draft, edits, authored, reviewed, frequency)
        write(directory / 'media.json', media)
        if args.target:
            if any(not chapter['glossary'] for chapter in result['chapters']):
                raise ValueError(f'Review the glossary source for {source["title"]}')
            verify_art(directory, media)
            args.target.mkdir(parents=True, exist_ok=True)
            write(args.target / f'{number:02d}-{source["slug"]}.json', result)
        else:
            write(directory / 'volume-draft.json', result)
        print(f'{number:02d}: {len(result["chapters"])} sections, {len(media["files"])} images, '
              f'{sum(len(chapter["glossary"]) for chapter in result["chapters"])} glossary entries', flush=True)


if __name__ == '__main__':
    main()
