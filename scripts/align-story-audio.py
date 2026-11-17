"""Generate Rosie Story WebVTT metadata locally from a bound English recording."""
import argparse
import difflib
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPORT = """
import {createJiti} from 'jiti';
const jiti = createJiti(import.meta.url);
const {storySeries} = await jiti.import('./packages/english/src/utils/story-data.ts');
const {splitStorySentences} = await jiti.import('./packages/english/src/utils/story-types.ts');
const series = storySeries.find(s => s.slug === process.argv[1] && s.language === 'en');
const volume = series?.volumes.find(v => v.slug === process.argv[2]);
if (!volume) throw Error('找不到对应的英文故事书');
console.log(JSON.stringify(volume.chapters.map(ch => ({
  number: ch.number, key: ch.key, sentences: splitStorySentences(ch).flat()
}))));
"""


def tokens(text):
    return re.findall(r"[a-z0-9]+", text.lower().replace("’", "").replace("'", ""))


def timestamp(ms):
    seconds, ms = divmod(ms, 1000)
    minutes, seconds = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    return f"{hours:02}:{minutes:02}:{seconds:02}.{ms:03}"


def align(sentences, segments):
    reference = [tokens(s["text"]) for s in sentences]
    heard, times = [], []
    for segment in segments:
        words = tokens(segment["text"])
        offsets = segment["offsets"]
        heard.extend(words)
        times.extend([(offsets["from"], offsets["to"])] * len(words))
    matcher = difflib.SequenceMatcher(None, [w for sentence in reference for w in sentence],
                                      heard, autojunk=False)
    mapped = {}
    for block in matcher.get_matching_blocks():
        for i in range(block.size):
            mapped[block.a + i] = block.b + i
    lines, review = ["WEBVTT", ""], []
    offset, previous_end = 0, 0
    for sentence, words in zip(sentences, reference):
        matched = [mapped[i] for i in range(offset, offset + len(words)) if i in mapped]
        anchored = offset in mapped and offset + len(words) - 1 in mapped
        offset += len(words)
        if matched:
            first, last = matched[0], matched[-1]
            start, end = times[first][0], times[last][1]
            coverage = len(matched) / max(len(words), last - first + 1)
            if anchored and coverage >= 0.85 and previous_end <= start < end:
                lines.extend([sentence["id"], f"{timestamp(start)} --> {timestamp(end)}",
                              sentence["id"], ""])
                previous_end = end
                continue
        review.append({**sentence, "approx_ms": times[matched[0]][0] if matched else None})
    return "\n".join(lines) + "\n", review


def generate(audio, sentences, target, work, model, force):
    work.mkdir(parents=True, exist_ok=True)
    report = work / (target.stem + '.review.json')
    digest = hashlib.sha256()
    with audio.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    digest.update(json.dumps(sentences, ensure_ascii=False).encode())
    digest.update(f"v1:{model.resolve()}:{model.stat().st_mtime_ns}".encode())
    signature = digest.hexdigest()
    if not force and target.exists() and report.exists():
        if json.loads(report.read_text()).get("signature") == signature:
            print(f"跳过 {audio.name}", flush=True)
            return
    print(f"对齐 {audio.name}", flush=True)
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=work) as temp:
        wav = Path(temp) / "speech.wav"
        prefix = Path(temp) / "transcript"
        subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-i", str(audio),
                        "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(wav)], check=True)
        command = ["whisper-cli", "-m", str(model), "-f", str(wav), "-l", "en",
                   "-ml", "1", "-sow", "-oj", "-of", str(prefix)]
        try:
            subprocess.run(command, check=True)
        except subprocess.CalledProcessError:
            print(f"{audio.name}：使用 CPU 重试转写", flush=True)
            subprocess.run([*command, "-ng"], check=True)
        raw = prefix.with_suffix(".json")
        raw.replace(work / (target.stem + ".transcript.json"))
        segments = json.loads((work / (target.stem + ".transcript.json")).read_text())["transcription"]
        vtt, review = align(sentences, segments)
        if len(review) == len(sentences):
            raise ValueError(f"{audio.name} 没有可定位的句子，请核对录音版本和章节")
        with tempfile.NamedTemporaryFile(mode='w', dir=target.parent, delete=False, encoding='utf8') as out:
            out.write(vtt)
        Path(out.name).replace(target)
        report.write_text(json.dumps({"signature": signature, "review": review}, ensure_ascii=False, indent=2))
        print(f"{target.name}：{len(sentences)-len(review)}/{len(sentences)} 句已定位，待复核 {report}", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--series", default="roald-dahl")
    parser.add_argument("--book", default="charlie-and-the-chocolate-factory")
    inputs = parser.add_mutually_exclusive_group()
    inputs.add_argument("--audio-dir", type=Path, help="以辑号开头的音频目录")
    inputs.add_argument("--audio-file", type=Path, help="单辑录音，配合 --chapter 指定辑号")
    inputs.add_argument("--full", type=Path, help="独立整本录音")
    parser.add_argument("--chapter", type=int, help="仅处理指定辑号")
    parser.add_argument("--model", type=Path, default=ROOT / "output/listening/models/ggml-small.en.bin")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    if not (args.audio_dir or args.audio_file or args.full):
        if (args.series, args.book) != ("roald-dahl", "charlie-and-the-chocolate-factory"):
            parser.error("其他故事书请指定 --audio-dir、--audio-file 或 --full")
        args.audio_dir = Path.home() / "rosie" / "Charlie and the Chocolate Factory"
    if args.audio_dir and args.audio_dir.is_file():
        args.audio_file = args.audio_dir
    if args.audio_file:
        if not args.audio_file.is_file():
            parser.error(f"找不到音频文件：{args.audio_file}")
        if args.chapter is None:
            parser.error("单辑录音需要指定 --chapter 辑号")
    for tool in ("node", "ffmpeg", "whisper-cli"):
        if not shutil.which(tool):
            parser.error(f"缺少 {tool}")
    if not args.model.is_file():
        parser.error("找不到 Whisper 英文模型，请用 --model 指定本地 ggml 模型文件")
    chapters = json.loads(subprocess.check_output(
        ["node", "--input-type=module", "-e", EXPORT, args.series, args.book], cwd=ROOT))
    folder = ROOT / "apps/web/public/story-timings" / args.series / args.book
    work = ROOT / "output/story-alignment" / args.series / args.book
    if args.full:
        if args.chapter is not None:
            parser.error("--full 与 --chapter 不能同时使用")
        jobs = [(args.full, "full", [s for ch in chapters for s in ch["sentences"]])]
    elif args.audio_file:
        chapter = next((ch for ch in chapters if ch["number"] == args.chapter), None)
        if chapter is None:
            parser.error(f"本书没有第 {args.chapter} 辑")
        jobs = [(args.audio_file, chapter["key"], chapter["sentences"])]
    else:
        if not args.audio_dir.is_dir():
            parser.error(f"音频目录不存在：{args.audio_dir}")
        files = {}
        for path in sorted(args.audio_dir.iterdir()):
            if not path.is_file() or path.suffix.lower() not in {".mp3", ".m4a", ".wav", ".aac", ".ogg", ".flac", ".webm"}:
                continue
            number = re.match(r"^(?:(?:ch(?:apter)?|track|第)\s*)?(\d+)(?!\d)", path.stem.strip(), re.I)
            if number:
                files.setdefault(int(number[1]), []).append(path)
        jobs = []
        for chapter in chapters:
            n = chapter["number"]
            if args.chapter is not None and args.chapter != n:
                continue
            paths = files.get(n, [])
            if len(paths) > 1:
                parser.error(f"第 {n} 辑有多条音频：{paths}")
            if paths:
                jobs.append((paths[0], chapter["key"], chapter["sentences"]))
            else:
                print(f"第 {n} 辑缺少音频", file=sys.stderr)
        if not jobs:
            parser.error("没有找到可处理的分辑音频")
    failed = []
    for index, (path, key, sentences) in enumerate(jobs, 1):
        print(f"[{index}/{len(jobs)}] {path.name} → {key}.vtt", flush=True)
        try:
            generate(path, sentences, folder / (key + ".vtt"), work, args.model, args.force)
        except (OSError, ValueError, subprocess.CalledProcessError) as error:
            print(f"{key} 处理失败：{error}", file=sys.stderr, flush=True)
            failed.append(key)
    if failed:
        sys.exit("以下章节处理失败，再次运行可重试：" + "、".join(failed))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        sys.exit(str(error))
