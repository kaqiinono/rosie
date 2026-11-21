#!/usr/bin/env python3
"""Extract the source page sequence for the Dragon Masters story imports."""

import argparse
import hashlib
import html
import json
import posixpath
import re
import sys
import zipfile
from pathlib import Path
from urllib.parse import unquote
from xml.etree import ElementTree

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))
from story_kindle import read_kindle


CHAPTER_COUNTS = {
    3: 14, 4: 14, 5: 15, 6: 15, 7: 15, 8: 14, 9: 14, 10: 14, 11: 16,
    12: 15, 13: 15, 14: 15, 15: 15, 16: 14, 17: 14, 18: 15, 19: 16,
    20: 15, 21: 15, 22: 15, 23: 15, 24: 15,
}
ORDINALS = dict(zip(
    'One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen Fourteen Fifteen Sixteen'.split(),
    range(1, 17),
))


def member(base, href):
    path = posixpath.normpath(posixpath.join(base, unquote(href.split('#')[0])))
    if path.startswith('../') or path.startswith('/'):
        raise ValueError(f'Unexpected EPUB member {path}')
    return path


def read_epub(path):
    with zipfile.ZipFile(path) as book:
        container = ElementTree.fromstring(book.read('META-INF/container.xml'))
        opf = container.find('.//{*}rootfile').get('full-path')
        base = posixpath.dirname(opf)
        package = ElementTree.fromstring(book.read(opf))
        manifest = {item.get('id'): item.attrib for item in package.findall('.//{*}manifest/{*}item')}
        spine = [
            member(base, manifest[item.get('idref')]['href'])
            for item in package.findall('.//{*}spine/{*}itemref')
        ]
        ncx = next(item for item in manifest.values() if item.get('media-type') == 'application/x-dtbncx+xml')
        navigation_path = member(base, ncx['href'])
        nav_base = posixpath.dirname(navigation_path)
        navigation = ElementTree.fromstring(book.read(navigation_path))
        toc = [
            (
                ''.join(point.find('./{*}navLabel/{*}text').itertext()).strip(),
                spine.index(member(nav_base, point.find('./{*}content').get('src'))),
            )
            for point in navigation.findall('.//{*}navPoint')
        ]
        pages = []
        for item in spine:
            page = ElementTree.fromstring(book.read(item))
            images = [node for node in page.iter() if node.tag.rsplit('}', 1)[-1] in ('img', 'image')]
            if len(images) != 1:
                raise ValueError(f'Expected a single illustrated page in {item}')
            href = images[0].get('src') or images[0].get('{http://www.w3.org/1999/xlink}href')
            pages.append((book.read(member(posixpath.dirname(item), href)), []))
    return pages, toc


def read_numbered_chapters(number, navigation):
    chapters = []
    for label, page in navigation:
        label = html.unescape(label).strip()
        match = re.fullmatch(r'(?:Chapter ([A-Za-z]+):|(\d+)[.:]?)\s+(.+)', label, re.I)
        if not match:
            continue
        name, digit, title = match.groups()
        ordinal = int(digit) if digit else ORDINALS[name.title()]
        if title.isupper():
            title = title.capitalize()
        chapters.append({'number': ordinal, 'title': title, 'page': page})
    if number == 19 and not any(chapter['number'] == 6 for chapter in chapters):
        # The EPUB's navigation omits this chapter. The heading is on printed page 29.
        chapters.append({'number': 6, 'title': 'Enemies, Not Friends', 'page': chapters[0]['page'] + 28})
    if number == 22:
        # The final EPUB link opens the following page. The printed chapter starts on page 84.
        chapter_one = next(c['page'] for c in chapters if c['number'] == 1)
        next(c for c in chapters if c['number'] == 15)['page'] = chapter_one + 83
    chapters.sort(key=lambda chapter: chapter['number'])
    if [c['number'] for c in chapters] != list(range(1, CHAPTER_COUNTS[number] + 1)):
        raise ValueError(f'Unexpected chapter sequence in volume {number}')
    return chapters


def extract_volume(number, directory, work):
    extension = '.mobi' if number == 3 else '.azw3' if 4 <= number <= 9 else '.epub'
    source, = sorted(directory.glob('*' + extension))
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    out = work / f'{number:02d}'
    manifest = out / 'source.json'
    if manifest.exists() and json.loads(manifest.read_text())['sha256'] == source_hash:
        return
    pages, navigation = read_epub(source) if extension == '.epub' else read_kindle(source)
    title = re.sub(r'^\[Dragon Masters \d+\]\s*-\s*', '', directory.name).split('(')[0].strip()
    if number == 17:
        title = 'Fortress of the Stone Dragon'
    slug = re.sub(r'[^a-z0-9]+', '-', title.lower().replace("'", '')).strip('-')
    tail = next((page for label, page in navigation if label.lower().startswith('about the author')), None)
    chapters = read_numbered_chapters(number, navigation) if number else []
    start = chapters[0]['page'] if chapters else 2  # The guide opens with Griffith's letter.
    if tail is None and chapters:
        tail = start + 90
    if tail is None or not 0 <= start < tail <= len(pages):
        raise ValueError(f'Unresolved page range in {source.name}')
    if chapters and (
        tail - start != 90
        or any(not start <= c['page'] < tail for c in chapters)
        or any(a['page'] >= b['page'] for a, b in zip(chapters, chapters[1:]))
    ):
        raise ValueError(f'Unexpected chapter boundaries in {source.name}: {start}, {tail}, {chapters}')
    image_root = out / 'pages'
    image_root.mkdir(parents=True, exist_ok=True)
    if (out / 'ocr').exists():
        raise ValueError(f'Source changed for volume {number}. Use a fresh work directory.')
    extracted = []
    for index, (image, lines) in enumerate(pages[start:tail], 1):
        suffix = '.jpg' if image.startswith(b'\xff\xd8') else '.png' if image.startswith(b'\x89PNG') else None
        if not suffix:
            raise ValueError(f'Unrecognized image in {source.name} on page {index}')
        file = f'{index:03d}{suffix}'
        (image_root / file).write_bytes(image)
        extracted.append({'index': index, 'file': file, 'lines': lines})
    for chapter in chapters:
        chapter['page'] += 1 - start
    data = {'number': number, 'title': title, 'slug': slug, 'sha256': source_hash,
            'file': source.name, 'chapters': chapters, 'pages': extracted}
    pending = manifest.with_suffix('.tmp')
    pending.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    pending.replace(manifest)
    print(f'{number:02d} {title}: {len(chapters)} indexed chapters, {len(extracted)} pages', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--work', type=Path, required=True)
    parser.add_argument('volumes', nargs='+', type=int, choices=[0] + list(CHAPTER_COUNTS))
    args = parser.parse_args()
    folders = {
        int(match[1]): directory
        for directory in args.source.iterdir()
        if directory.is_dir() and (match := re.match(r'^\[Dragon Masters (\d+)\]', directory.name))
    }
    failed = []
    for number in args.volumes:
        try:
            extract_volume(number, folders[number], args.work)
        except (ValueError, IndexError, KeyError, StopIteration) as error:
            print(f'{number:02d}: {error}', file=sys.stderr)
            failed.append(number)
    return int(bool(failed))


if __name__ == '__main__':
    sys.exit(main())
