#!/usr/bin/env python3
"""Reflow recognized ebook pages and create a draft of cropped story media."""

import argparse
import json
import re
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps


def folded(text):
    return ''.join(char.lower() for char in text if char.isalnum())


def line_order(lines):
    def baseline(row):
        return row['y'] + min(row['h'], .039)

    ordered = sorted(lines, key=baseline)
    groups = []
    for line in ordered:
        position = baseline(line)
        if not groups or position - groups[-1][0] > .013:
            groups.append((position, []))
        groups[-1][1].append(line)
    return [row for _, rows in groups for row in sorted(rows, key=lambda row: row['x'])]


def chapter_heading(box, title):
    text = folded(box['text'])
    name = folded(title)
    if not text or len(text) < 3 or not .075 <= box['y'] <= .71:
        return False
    if box['h'] < .043 and not box['text'].isupper():
        return False
    if text in name:
        return True
    return any(
        SequenceMatcher(None, text, name[i:i + len(text)]).ratio() >= .79
        for i in range(max(1, len(name) - len(text) + 1))
    )


def collect_prose(lines, heading_cutoff, opening=False):
    selected = []
    for row in lines:
        x, y, w, h, text = (row[k] for k in ('x', 'y', 'w', 'h', 'text'))
        if not heading_cutoff <= y <= .919 or h < .017:
            continue
        if x < .07 or x + w > .94 or not re.search(r'[A-Za-z]', text):
            continue
        offset = (y + h - .108) / .0402
        min_words = len(re.findall(r"\b[A-Za-z][A-Za-z'’]+\b", text))
        if re.fullmatch(r'[A-Z][A-Z ]{1,24}', text.strip()) and w < .27:
            continue
        if h > .055:
            if opening and y >= .38 and x <= .24 and h <= .119 and min_words >= 3:
                selected.append(row)
            continue
        normal_position = abs(offset - round(offset)) <= .36
        if (normal_position and min_words >= 1) or (min_words >= 4 and h < .041):
            selected.append(row)
    return line_order(selected)


def read_layer(text, lines):
    if not lines:
        return text
    by_text = {folded(line): line for line in lines if len(folded(line)) > 3}
    return by_text.get(folded(text), text)


def clean_text(text):
    text = text.replace('\u00ad', '').replace('\u00a0', ' ')
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r"(?<=[A-Za-z])'(?=[A-Za-z])", '’', text)
    text = re.sub(r'(?<!\S)"(?=\S)', '“', text).replace('"', '”')
    text = re.sub(r'(?:\s*\.){3}', ' …', text)
    text = re.sub(r'\s*—\s*|\s+-{1,2}\s+', ' — ', text)
    text = re.sub(r' +([,.!?;:”])', r'\1', text)
    text = re.sub(r'(?<=[a-z])([,.!?])(?=[A-Z])', r'\1 ', text)
    text = re.sub(r'(?<=[,”])(?=[A-Z])', ' ', text)
    return text.strip()


def initial_text(text, source_lines, cap):
    left = re.sub(r'^[^A-Za-z]+', '', text)
    if not left:
        return text
    word = re.match(r'[A-Za-z’]+', left)[0]
    folded_line = folded(text)
    for index, source in enumerate(source_lines):
        if folded(source) == folded_line and index and re.fullmatch(r'[A-Z]', source_lines[index - 1]):
            return clean_text(source_lines[index - 1] + source.lstrip())
        if len(folded(source)) >= 12 and folded(source)[1:] == folded_line:
            return clean_text(source)
    common = {
        'rake': 'Drake', 'he': 'The', 'hey': 'They', 'his': 'This', 'hen': 'Then', 'hat': 'That',
        'fter': 'After', 'ust': 'Just', 'uddenly': 'Suddenly', 'ori': 'Rori', 'na': 'Ana', 'epri': 'Kepri',
        'orm': 'Worm', 'ulcan': 'Vulcan', 'riffith': 'Griffith', 'iego': 'Diego', 'eru': 'Heru',
        'arlos': 'Carlos', 'anawa': 'Manawa', 'ina': 'Mina', 'etra': 'Petra', 'ady': 'Lady',
        'here': 'There', 'epri’s': 'Kepri’s', 'rake’s': 'Drake’s', 'ina’s': 'Mina’s',
        'teady': 'Steady', 'ooking': 'Looking', 'oing': 'Going', 'nside': 'Inside', 'efore': 'Before',
        'e': 'We', 'oday’s': 'Today’s', 'ant': 'Want', 'yes': 'Yes', 'here’s': 'There’s',
        'vori': 'Rori', 'leru': 'Heru', 'triffith': 'Griffith', 'alo': 'Lalo', 'top': 'Stop',
        'ing': 'King', 'oments': 'Moments', 'es': 'Yes', 'excellent': 'Excellent',
        'am': 'I am', 'said': 'I said', 'want': 'I want',
    }
    replacement = common.get(word.lower()) if not word[0].isupper() else {
        'Vori': 'Rori', 'Leru': 'Heru', 'Triffith': 'Griffith',
    }.get(word)
    if word == 'hat' and re.match(r'hat (do|did|is|are|was|has|have|would|will|about|happ)', left):
        replacement = 'What'
    if cap and not word[0].isupper():
        replacement = cap + word
    if not replacement:
        return text
    starts_speech = text.count('”') > text.count('“')
    return ('“' if starts_speech or text.startswith('“') else '') + replacement + left[len(word):]


def join_lines(rows, source_lines, opening, cap=None):
    paragraphs = []
    previous = None
    for row in rows:
        text = clean_text(read_layer(row['text'], source_lines))
        if not paragraphs and opening:
            text = initial_text(text, source_lines, cap)
        if not text:
            continue
        indent = .143 <= row['x'] <= .214 if row['x'] < .24 else (
            previous is not None and .028 <= row['x'] - previous['x'] <= .077
        )
        starts = paragraphs and indent and paragraphs[-1]['text'].rstrip('”’').endswith(('.', '!', '?', '…', '—', ':'))
        if not paragraphs or starts:
            paragraphs.append({'y': row['y'], 'text': text})
        else:
            last = paragraphs[-1]['text']
            if last.endswith('-') and text[0].islower():
                paragraphs[-1]['text'] += text
            else:
                paragraphs[-1]['text'] += ' ' + text
        previous = row
    for paragraph in paragraphs:
        text = paragraph['text']
        if '”' in text and not text.startswith('”') and text.find('”') < (
            text.find('“') if '“' in text else len(text)
        ):
            paragraph['text'] = '“' + text
    return paragraphs


def figure_bounds(image, guide):
    grey = np.asarray(ImageOps.grayscale(image))
    mask = grey < (210 if guide else 222)
    if guide:
        rgb = np.asarray(image).astype(np.int16)
        mask |= (rgb.max(axis=2) - rgb.min(axis=2) > 43) & (grey < 218)
    binary = Image.fromarray(mask).convert('L')
    density = np.asarray(binary.filter(ImageFilter.BoxBlur(5)))
    # Suppress isolated bits of print left by masks before finding the illustration.
    retained = (density >= 55) & mask
    height, width = retained.shape
    tile = 12
    padded = np.pad(retained, ((0, -height % tile), (0, -width % tile)))
    blocks = padded.reshape(padded.shape[0] // tile, tile, padded.shape[1] // tile, tile).sum((1, 3))
    filled = set(zip(*np.where(blocks >= 14)))
    components = []
    while filled:
        start = filled.pop()
        cluster = [start]
        queue = [start]
        while queue:
            y, x = queue.pop()
            for dy, dx in ((-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)):
                point = y + dy, x + dx
                if point in filled:
                    filled.remove(point)
                    queue.append(point)
                    cluster.append(point)
        if len(cluster) >= 8 and sum(blocks[p] for p in cluster) >= 460:
            components.extend(cluster)
    if not components:
        return None
    ys, xs = zip(*components)
    padding = 9
    return (
        max(0, min(xs) * tile - padding), max(0, min(ys) * tile - padding),
        min(width, (max(xs) + 1) * tile + padding), min(height, (max(ys) + 1) * tile + padding),
    )


def mask_and_crop(path, lines, prose, headings, opening, guide):
    with Image.open(path) as page:
        image = page.convert('RGB')
    image.thumbnail((850, 1240), Image.Resampling.LANCZOS)
    width, height = image.size
    draw = ImageDraw.Draw(image)
    for box in prose + headings:
        x, y, w, h = (box[k] for k in ('x', 'y', 'w', 'h'))
        draw.rectangle((int(x * width) - 5, int(y * height) - 4,
                        round((x + w) * width) + 5, round((y + h) * height) + 4), fill='white')
    if opening and prose:
        first_line = min(row['y'] for row in prose)
        draw.rectangle((0, round((first_line - .057) * height), round(.216 * width), height), fill='white')
        draw.rectangle((0, round((first_line + .004) * height), width, height), fill='white')
    elif not guide and (
        any(row['y'] > .912 and .26 < row['x'] < .70 and re.search(r'\d', row['text']) for row in lines)
        or np.asarray(ImageOps.grayscale(image).crop(
            (round(.2 * width), round(.93 * height), round(.8 * width), height)
        )).mean() > 239
    ):
        draw.rectangle((round(.29 * width), round(.923 * height), round(.71 * width), height), fill='white')
    bounds = figure_bounds(image, guide)
    if not bounds:
        return None
    return image.crop(bounds), (bounds[1] + bounds[3]) / (2 * height)


def guide_prose(lines):
    return line_order([
        row for row in lines
        if .045 < row['y'] < .94 and re.search(r'[A-Za-z]{2}', row['text'])
        and row['confidence'] >= .22
    ])


def guide_paragraphs(prose):
    groups = []
    for row in sorted(prose, key=lambda item: (item['y'], item['x'])):
        text = clean_text(row['text'])
        heading = text.isupper() or text.startswith('•')
        continuation = next((
            group for group in reversed(groups)
            if not heading and not group['heading'] and abs(row['x'] - group['x']) < .049
            and .012 < row['y'] - group['last'] < .056
            and not group['text'].endswith(('.', '!', '?', '”'))
        ), None)
        if continuation:
            continuation['text'] += ' ' + text
            continuation['last'] = row['y']
        else:
            groups.append({'text': text, 'x': row['x'], 'y': row['y'], 'last': row['y'], 'heading': heading})
    return [{'y': group['y'], 'text': group['text']} for group in groups]


def prepare_volume(directory, source, text_only):
    guide = source['number'] == 0
    starts = {chapter['page']: chapter for chapter in source['chapters']}
    art_root = directory / 'art'
    art_root.mkdir(exist_ok=True)
    previous = json.loads((directory / 'draft.json').read_text()) if text_only else None
    all_pages = []
    for page in source['pages']:
        page_number = page['index']
        lines = json.loads((directory / 'ocr' / (Path(page['file']).stem + '.json')).read_text())
        opening = starts.get(page_number)
        headings = [row for row in lines if opening and chapter_heading(row, opening['title'])]
        threshold = max((row['y'] + row['h'] for row in headings), default=.39) if opening else .040
        prose = guide_prose(lines) if guide else collect_prose(lines, threshold, bool(opening))
        cap = next((
            row['text'] for row in lines
            if opening and prose and re.fullmatch(r'[A-Z]', row['text'])
            and row['x'] < prose[0]['x'] and abs(row['y'] - prose[0]['y']) <= .072
        ), None)
        groups = join_lines(prose, page['lines'], bool(opening), cap)
        if guide:
            groups = guide_paragraphs(prose)
        result = None if text_only else mask_and_crop(
            directory / 'pages' / page['file'], lines, prose, headings, bool(opening), guide,
        )
        artwork = previous[page_number - 1]['art'] if previous else None
        if result:
            image, y = result
            image.thumbnail((820, 940), Image.Resampling.LANCZOS)
            name = f'{page_number:03d}.webp'
            image.save(art_root / name, quality=84, method=4)
            artwork = {'file': name, 'position': y, 'width': image.width, 'height': image.height}
        extras = [
            row['text'] for row in lines if row not in prose and row not in headings and
            len(re.findall(r'\b[A-Za-z]{2,}\b', row['text'])) >= 4
        ]
        all_pages.append({
            'index': page_number, 'paragraphs': groups, 'art': artwork, 'extra': extras,
            'openingOcr': prose[0]['text'] if opening and prose else None,
        })
    (directory / 'draft.json').write_text(json.dumps(all_pages, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"{source['number']:02d}: {len(all_pages)} pages prepared, "
          f"{sum(bool(page['art']) for page in all_pages)} crops", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work', type=Path, required=True)
    parser.add_argument('--text-only', action='store_true', help='Preserve the existing crops and their hashes.')
    parser.add_argument('volumes', nargs='+', type=int)
    args = parser.parse_args()
    for volume in args.volumes:
        directory = args.work / f'{volume:02d}'
        source = json.loads((directory / 'source.json').read_text())
        prepare_volume(directory, source, args.text_only)


if __name__ == '__main__':
    main()
