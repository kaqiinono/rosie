"""Read plaintext Kindle page images, transcriptions, and navigation.

Record layout reference: https://github.com/kevinhendricks/KindleUnpack/tree/master/lib
"""

import bisect
import html
import re
import struct


def u16(data, offset):
    return struct.unpack_from('>H', data, offset)[0]


def u32(data, offset):
    return struct.unpack_from('>I', data, offset)[0]


def records_from_book(data):
    if data[60:68] != b'BOOKMOBI':
        raise ValueError('Expected a Kindle BOOKMOBI file')
    offsets = [u32(data, 78 + 8 * index) for index in range(u16(data, 76))]
    return [data[start:end] for start, end in zip(offsets, offsets[1:] + [len(data)])]


def palm_doc(data):
    result = bytearray()
    at = 0
    while at < len(data):
        value = data[at]
        at += 1
        if 1 <= value <= 8:
            result.extend(data[at:at + value])
            at += value
        elif value < 128:
            result.append(value)
        elif value >= 192:
            result.extend((32, value ^ 128))
        else:
            offset = (value << 8) | data[at]
            at += 1
            distance = (offset >> 3) & 0x7ff
            if not distance or distance > len(result):
                raise ValueError('Invalid PalmDOC backreference')
            for _ in range((offset & 7) + 3):
                result.append(result[-distance])
    return bytes(result)


def huff_decoder(records):
    index = next(i for i, record in enumerate(records) if record.startswith(b'HUFF\x00\x00\x00\x18'))
    header = records[index]
    primary, secondary = struct.unpack_from('>II', header, 8)

    def limit(code, length):
        return ((code + 1) << (32 - length)) - 1

    short_codes = [
        (value & 31, bool(value & 128), limit(value >> 8, value & 31))
        for value in struct.unpack_from('>256I', header, primary)
    ]
    thresholds = struct.unpack_from('>64I', header, secondary)
    minimum = [0] + [value << (31 - i) for i, value in enumerate(thresholds[::2])]
    maximum = [0] + [limit(value, i + 1) for i, value in enumerate(thresholds[1::2])]
    dictionary = []
    for record in records[index + 1:]:
        if not record.startswith(b'CDIC\x00\x00\x00\x10'):
            break
        total, bits = struct.unpack_from('>II', record, 8)
        count = min(1 << bits, total - len(dictionary))
        for offset in struct.unpack_from(f'>{count}H', record, 16):
            length = u16(record, 16 + offset)
            start = 18 + offset
            dictionary.append((record[start:start + (length & 32767)], bool(length & 32768)))

    def decode(data):
        bits = 8 * len(data)
        encoded = int.from_bytes(data + b'\0' * 4, 'big')
        result = bytearray()
        while bits:
            code = (encoded >> bits) & 0xffffffff
            length, terminal, upper = short_codes[code >> 24]
            if not terminal:
                while code < minimum[length]:
                    length += 1
                upper = maximum[length]
            bits -= length
            if bits < 0:
                break
            slot = (upper - code) >> (32 - length)
            value, literal = dictionary[slot]
            if not literal:
                value = decode(value)
                dictionary[slot] = (value, True)
            result.extend(value)
        return bytes(result)

    return decode


def unpack_markup(records):
    header = records[0]
    if u16(header, 12):
        raise ValueError('Encrypted source')
    compression = u16(header, 0)
    decode = {1: bytes, 2: palm_doc}.get(compression)
    if compression == 17480:
        decode = huff_decoder(records)
    if decode is None:
        raise ValueError(f'Unknown Kindle compression {compression}')
    extra = u16(header, 242) if u32(header, 20) >= 228 else 0
    result = bytearray()
    for record in records[1:1 + u16(header, 8)]:
        for _ in range(bin(extra >> 1).count('1')):
            size = 0
            for value in record[-4:]:
                if value & 128:
                    size = 0
                size = (size << 7) | (value & 127)
            record = record[:-size]
        if extra & 1:
            record = record[:-(1 + (record[-1] & 3))]
        result.extend(decode(record))
    if len(result) < u32(header, 4):
        raise ValueError('Truncated Kindle text')
    return bytes(result[:u32(header, 4)])


def variable_int(data, offset):
    value = 0
    while True:
        byte = data[offset]
        offset += 1
        value = (value << 7) | (byte & 127)
        if byte & 128:
            return value, offset


def navigation_index(records):
    index = u32(records[0], 244)
    header = records[index]
    table = u32(header, 4)
    count = u32(header, 24)
    if header[:4] != b'INDX' or header[table:table + 4] != b'TAGX':
        raise ValueError('Missing Kindle navigation table')
    limit = table + u32(header, table + 4)
    control_count = u32(header, table + 8)
    fields = [header[at:at + 4] for at in range(table + 12, limit, 4)]
    labels = {}
    for section in range(u32(header, 52)):
        data = records[index + 1 + count + section]
        cursor = 0
        while cursor < len(data) and data[cursor]:
            start = cursor
            size, cursor = variable_int(data, cursor)
            labels[(section << 16) + start] = html.unescape(data[cursor:cursor + size].decode('utf-8'))
            cursor += size
    result = []
    for data in records[index + 1:index + 1 + count]:
        offsets = u32(data, 20)
        if data[offsets:offsets + 4] != b'IDXT':
            raise ValueError('Missing Kindle navigation offsets')
        for row in range(u32(data, 24)):
            at = u16(data, offsets + 4 + 2 * row)
            controls_at = at + 1 + data[at]
            cursor = controls_at + control_count
            controls = 0
            counts = []
            for tag, values, mask, separator in fields:
                if separator:
                    controls += 1
                    continue
                value = data[controls_at + controls] & mask
                if not value:
                    continue
                if value == mask and mask & (mask - 1):
                    size, cursor = variable_int(data, cursor)
                    counts.append((tag, None, size))
                else:
                    amount = value // (mask & -mask)
                    counts.append((tag, amount * values, None))
            tags = {}
            for tag, amount, size in counts:
                numbers = []
                end = cursor + size if size is not None else None
                while cursor < end if end is not None else len(numbers) < amount:
                    value, cursor = variable_int(data, cursor)
                    numbers.append(value)
                tags[tag] = numbers
            if 1 in tags and 3 in tags:
                result.append((labels[tags[3][0]], tags[1][0]))
    return result


def extract_mobi(records, raw):
    toc = [(html.unescape(match[2].decode()), int(match[1])) for match in re.finditer(
        rb'<a[^>]*filepos=["\']?(\d+)[^>]*>(Chapter [^<]+: [^<]+|About the Author[^<]*)</a>', raw, re.I
    )]
    origin = u32(records[0], 108) - 1
    figures = list(re.finditer(rb'<img[^>]*recindex=["\']?(\d+)[^>]*>', raw, re.I))
    locations = [match.start() for match in figures]
    pages = []
    for i, figure in enumerate(figures):
        end = locations[i + 1] if i + 1 < len(figures) else len(raw)
        block = raw[figure.end():end]
        lines = [
            html.unescape(re.sub(rb'<[^>]+>', b'', match[1]).decode()).strip()
            for match in re.finditer(rb'<p[^>]*>(.*?)</p>', block, re.I | re.S)
        ]
        pages.append((records[origin + int(figure[1])], [line for line in lines if line]))
    return pages, [(label, bisect.bisect_left(locations, at)) for label, at in toc]


def extract_kf8(records, raw):
    origin = u32(records[0], 108) - 1
    figures = list(re.finditer(rb'<img\b[^>]*src=["\']kindle:embed:([0-9A-V]+)[^>]*>', raw, re.I))
    locations = [match.start() for match in figures]
    pages = []
    for i, figure in enumerate(figures):
        end = locations[i + 1] if i + 1 < len(figures) else len(raw)
        block = raw[figure.end():end].split(b'</body>', 1)[0]
        lines = [
            html.unescape(re.sub(rb'<[^>]+>', b'', match[1]).decode()).strip()
            for match in re.finditer(rb'<div\b[^>]*\btextframe\b[^>]*>(.*?)</div>', block, re.I | re.S)
        ]
        pages.append((records[origin + int(figure[1], 32)], [line for line in lines if line]))
    return pages, [(label, bisect.bisect_left(locations, at)) for label, at in navigation_index(records)]


def read_kindle(path):
    records = records_from_book(path.read_bytes())
    raw = unpack_markup(records)
    if u32(records[0], 36) >= 8:
        return extract_kf8(records, raw)
    return extract_mobi(records, raw)
