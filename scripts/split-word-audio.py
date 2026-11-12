#!/usr/bin/env python3
"""Split a vocabulary-teaching audio (word + definition + example per unit) into
one MP3 per word. See .agents/skills/split-word-audio/SKILL.md for the workflow.

Commands:
  probe      <audio>                     duration / speech bursts / silences (JSON)
  transcribe <audio> -o asr.json         word-level ASR (faster-whisper, local)
  analyze    <audio> -o manifest.json    probe + ASR + candidate units -> review manifest
  cut        <audio> -m manifest.json -o outdir [--lead 1.0]   validate + export MP3s
  verify     <outdir> [--asr]            per-clip lead-in / burst check (+ optional ASR)

The analyze step only proposes candidates; a human/agent MUST review the manifest
before cut. Silence thresholds alone cannot segment this kind of audio.
"""
import argparse
import errno
import fcntl
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HF_BASE = os.environ.get("WORD_SPLIT_HF_BASE", "https://hf-mirror.com")
MODEL_REPO = "Systran/faster-whisper-small"
MODEL_REVISION = "536b0662742c02347bc0e980a01041f333bce120"
CACHE_DIR = Path(os.environ.get("WORD_SPLIT_CACHE",
                                Path.home() / ".cache" / "rosie-word-split")) / "fw-small"
# Published Git blob IDs for regular files and LFS SHA-256 for model.bin.
MODEL_FILES = {
    "config.json": "e5047537059bd8f182d9ca64c470201585015187",
    "tokenizer.json": "7818adb6de9fa3064d3ff81226fdd675be1f6344",
    "vocabulary.txt": "c9074644d9d1205686f16d411564729461324b75",
    "model.bin": "3e305921506d8872816023e4c273e75d2419fb89b24da97b4fe7bce14170d671",
}
SILENCE_FILTER = "silencedetect=noise=-30dB:d=0.25"
LEAD_TOLERANCE = 0.15  # seconds, allow detector/MP3 frame variation


def file_digest(path, git_blob=False):
    path = Path(path)
    digest = hashlib.sha1() if git_blob else hashlib.sha256()
    with path.open("rb") as src:
        if git_blob:
            digest.update(f"blob {os.fstat(src.fileno()).st_size}\0".encode())
        for chunk in iter(lambda: src.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path, data):
    path = Path(path)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as tmp:
        try:
            tmp.write(json.dumps(data, ensure_ascii=False, indent=1).encode())
            tmp.close()
            os.replace(tmp.name, path)
        finally:
            Path(tmp.name).unlink(missing_ok=True)


def find_ffmpeg():
    """First ffmpeg that actually has libmp3lame. LosslessCut's bundled ffmpeg
    can decode/analyze but has NO MP3 encoder — existence alone is not enough."""
    candidates = []
    which = shutil.which("ffmpeg")
    if which:
        candidates.append(which)
    try:
        import imageio_ffmpeg
        candidates.append(imageio_ffmpeg.get_ffmpeg_exe())
    except ImportError:
        pass
    candidates += ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]
    for ff in candidates:
        try:
            enc = subprocess.run([ff, "-hide_banner", "-encoders"],
                                 capture_output=True, text=True, timeout=30)
            if "libmp3lame" in enc.stdout:
                return ff
        except (OSError, subprocess.TimeoutExpired):
            continue
    sys.exit("No ffmpeg with libmp3lame found. Install one of:\n"
             "  pip3 install --user imageio-ffmpeg\n"
             "  brew install ffmpeg\n"
             "(LosslessCut's bundled ffmpeg cannot encode MP3.)")


FF = None


def ffmpeg():
    global FF
    if FF is None:
        FF = find_ffmpeg()
    return FF


def probe(path):
    """Return (duration, speech_bursts, silence_intervals) via silencedetect."""
    p = subprocess.run([ffmpeg(), "-hide_banner", "-nostdin", "-xerror", "-i", str(path), "-af",
                        SILENCE_FILTER, "-f", "null", "-"],
                       capture_output=True, text=True)
    log = p.stderr
    if p.returncode:
        sys.exit(f"Cannot decode {path}:\n{log[-1200:]}")
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", log)
    if not m:
        sys.exit(f"Cannot read duration of {path}:\n{log[-800:]}")
    dur = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    sil = [(float(a), float(b)) for a, b in
           re.findall(r"silence_start: (\S+).*?silence_end: (\S+)", log, re.S)]
    speech, cur = [], 0.0
    for s, e in sil:
        if s > cur + 0.05:
            speech.append((cur, s))
        cur = e
    if cur < dur - 0.05:
        speech.append((cur, dur))
    return dur, speech, sil


def ensure_model():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with (CACHE_DIR / ".download.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        for name, expected in MODEL_FILES.items():
            dest = CACHE_DIR / name
            git_blob = name != "model.bin"
            if dest.is_file() and file_digest(dest, git_blob) == expected:
                continue
            url = f"{HF_BASE}/{MODEL_REPO}/resolve/{MODEL_REVISION}/{name}"
            tmp = dest.with_suffix(dest.suffix + ".part")
            print(f"Downloading {name} ...", flush=True)
            try:
                subprocess.run(["curl", "-fL", "--retry", "3", "-o", str(tmp), url], check=True)
                if file_digest(tmp, git_blob) != expected:
                    sys.exit(f"Unexpected model file digest: {name}")
                os.replace(tmp, dest)
            finally:
                tmp.unlink(missing_ok=True)
    return str(CACHE_DIR)


def transcribe(audio, model_dir=None):
    from faster_whisper import WhisperModel
    model = WhisperModel(model_dir or ensure_model(), device="cpu", compute_type="int8")
    segments, info = model.transcribe(str(audio), word_timestamps=True,
                                      condition_on_previous_text=False, vad_filter=False)
    out = []
    for s in segments:
        out.append({"start": round(s.start, 3), "end": round(s.end, 3),
                    "text": s.text.strip(),
                    "words": [{"w": w.word.strip(), "s": round(w.start, 3),
                               "e": round(w.end, 3)} for w in (s.words or [])]})
    print(f"ASR done: {len(out)} segments, lang={info.language} "
          f"prob={info.language_probability:.2f}", flush=True)
    return out


def slug(text):
    text = re.sub(r"[^\w\s-]", "", text.strip().lower())
    return re.sub(r"[\s-]+", "_", text) or "word"


def cmd_probe(args):
    dur, speech, sil = probe(args.audio)
    print(json.dumps({"source": str(args.audio), "duration": round(dur, 3),
                      "speech": [[round(s, 3), round(e, 3)] for s, e in speech],
                      "silences": [[round(s, 3), round(e, 3)] for s, e in sil]},
                     ensure_ascii=False, indent=1))


def cmd_transcribe(args):
    check_output_paths(args.audio, args.out)
    source_hash = file_digest(args.audio)
    write_json(args.out, {"source_sha256": source_hash, "segments": transcribe(args.audio)})
    print(f"Wrote {args.out}")


def check_output_paths(*paths):
    resolved = [Path(path).resolve() for path in paths if path]
    if len(resolved) != len(set(resolved)):
        sys.exit("Audio, ASR and manifest paths must be distinct.")


def cmd_analyze(args):
    check_output_paths(args.audio, args.out, args.asr)
    source_hash = file_digest(args.audio)
    dur, speech, sil = probe(args.audio)
    asr = None
    if args.asr and Path(args.asr).exists():
        cached = json.loads(Path(args.asr).read_text())
        if isinstance(cached, dict) and cached.get("source_sha256") == source_hash:
            asr = cached.get("segments")
            print(f"Reusing ASR from {args.asr}")
    if asr is None:
        asr = transcribe(args.audio)
        if args.asr:
            write_json(args.asr, {"source_sha256": source_hash, "segments": asr})

    words = [w for seg in asr for w in seg["words"]]
    units = []
    for i, (s, e) in enumerate(speech):
        gap_before = s - speech[i - 1][1] if i else s
        gap_after = speech[i + 1][0] - e if i + 1 < len(speech) else float("inf")
        # Draft heuristic only: definition fragments can also pass it.
        if i == 0 or (gap_before >= 1.5 and e - s <= 1.5 and gap_after >= 1.0):
            near = min(words, key=lambda w: abs(w["s"] - s)) if words else None
            guess = slug(near["w"]) if near and abs(near["s"] - s) < 1.5 else ""
            context = " ".join(seg["text"] for seg in asr
                               if seg["end"] >= s - 1 and seg["start"] <= s + 14)
            units.append({"name": guess, "onset": round(s, 3),
                          "burst": [round(s, 3), round(e, 3)],
                          "gap_before": round(gap_before, 3),
                          "gap_after": round(gap_after, 3) if gap_after != float("inf") else None,
                          "context": context})
    manifest = {"source": str(Path(args.audio).resolve()), "duration": round(dur, 3),
                "source_sha256": source_hash, "lead_in": args.lead, "skip_intro": False,
                "status": "needs_review", "units": units,
                "speech": [[round(s, 3), round(e, 3)] for s, e in speech],
                "asr": asr}
    write_json(args.out, manifest)
    print(f"\n{len(units)} candidate units -> {args.out}")
    for i, u in enumerate(units):
        print(f"{i+1:02d} {u['name'] or '?':<20} onset={u['onset']:8.3f} "
              f"dur={u['burst'][1]-u['burst'][0]:5.2f} gap_before={u['gap_before']:5.2f}")
    print("\nREVIEW REQUIRED: candidates may include definition fragments or miss "
          "units; short words are often misheard. Check each unit against its "
          "context (word + definition + example) before running cut.")


def cmd_cut(args):
    manifest = json.loads(Path(args.manifest).read_text())
    if manifest.get("status") != "reviewed":
        sys.exit("Review every unit and set status to reviewed before cutting.")
    units = manifest["units"]
    if not units:
        sys.exit("Manifest has no units.")
    lead = args.lead if args.lead is not None else manifest.get("lead_in", 1.0)
    src = args.audio or manifest["source"]
    if not math.isfinite(lead) or lead <= 0:
        sys.exit("Lead-in must be finite and positive.")
    if file_digest(src) != manifest.get("source_sha256"):
        sys.exit("Source fingerprint missing or changed. Re-analyze and review the manifest.")
    dur, speech, _ = probe(src)
    if not speech:
        sys.exit("Source contains no detected speech.")

    onsets = []
    for u in units:
        if not u.get("name"):
            sys.exit(f"Unit at {u.get('onset')} has no name — review the manifest first.")
        best = min(speech, key=lambda b: abs(b[0] - u["onset"]))
        if not math.isfinite(u["onset"]) or abs(best[0] - u["onset"]) > 0.001:
            sys.exit(f"{u['name']}: onset {u['onset']} is not near any speech burst "
                     f"(closest {best}). Use burst starts from probe/analyze.")
        onsets.append(best[0])
    if any(b <= a for a, b in zip(onsets, onsets[1:])):
        sys.exit("Onsets are not strictly increasing (duplicate or out-of-order units).")

    first_cut = 0.0
    if onsets[0] != speech[0][0]:
        if manifest.get("skip_intro") is not True:
            sys.exit("Speech precedes the first unit. Restore it or review and mark skip_intro.")
        first_cut = onsets[0] - lead
        intro_end = max(e for s, e in speech if s < onsets[0])
        if not intro_end < first_cut < onsets[0]:
            sys.exit("Intro cut is outside the silence before the first word. Reduce --lead.")
    cuts = [first_cut] + [o - lead for o in onsets[1:]] + [dur]
    for i in range(1, len(units)):
        prev_end = max(e for s, e in speech if e <= onsets[i])
        if not (prev_end < cuts[i] < onsets[i]):
            sys.exit(f"{units[i]['name']}: cut {cuts[i]:.3f}s is not inside the silence "
                     f"before its onset {onsets[i]:.3f}s (prev speech ends {prev_end:.3f}s). "
                     "Reduce --lead or fix the unit boundary.")
        if cuts[i] <= cuts[i - 1]:
            sys.exit(f"{units[i]['name']}: cut overlaps the previous unit.")

    outdir = Path(args.outdir).absolute()
    outdir.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=outdir.parent, prefix=".word-split-") as tmp:
        stage = Path(tmp) / "clips"
        stage.mkdir()
        files = export_clips(src, units, onsets, cuts, stage)
        # Publish a whole run at once, including concurrent re-runs of the same lesson.
        candidate = outdir
        suffix = 1
        while True:
            report = {"source": str(src), "outdir": str(candidate), "lead_in": lead,
                      "source_sha256": manifest["source_sha256"], "files": files}
            write_json(stage / "cut_report.json", report)
            try:
                stage.rename(candidate)
                break
            except OSError as exc:
                if exc.errno not in (errno.ENOTEMPTY, errno.EEXIST, errno.ENOTDIR):
                    raise
                suffix += 1
                candidate = outdir.with_name(f"{outdir.name}-{suffix}")
    print(f"Published {len(files)} clips -> {candidate}\nReport: {candidate / 'cut_report.json'}")


def export_clips(src, units, onsets, cuts, outdir):
    files = []
    for i, u in enumerate(units):
        name = slug(u["name"])
        out = outdir / f"{i+1:02d}_{name}.mp3"
        subprocess.run([ffmpeg(), "-hide_banner", "-loglevel", "error", "-y",
                        "-ss", f"{cuts[i]:.3f}", "-i", str(src),
                        "-t", f"{cuts[i+1]-cuts[i]:.3f}",
                        "-c:a", "libmp3lame", "-b:a", "80k", str(out)], check=True)
        vd, vs, _ = probe(out)
        lead_measured = vs[0][0] if vs else -1
        expected_lead = onsets[i] - cuts[i]
        check_clip(out, vd, vs, cuts[i+1] - cuts[i], expected_lead)
        files.append({"file": out.name, "name": name,
                                "cut": round(cuts[i], 3), "end": round(cuts[i+1], 3),
                                "expected_lead": round(expected_lead, 3),
                                "duration": round(vd, 3),
                                "lead_in": round(lead_measured, 3), "bursts": len(vs)})
        print(f"{out.name:<28} cut={cuts[i]:8.3f}s len={vd:6.2f}s "
              f"lead={lead_measured:5.2f}s bursts={len(vs)}")
    return files


def check_clip(path, duration, speech, expected_duration, expected_lead):
    if not speech:
        sys.exit(f"{path.name}: no speech detected.")
    if abs(duration - expected_duration) > LEAD_TOLERANCE:
        sys.exit(f"{path.name}: duration {duration:.3f}s, expected {expected_duration:.3f}s.")
    measured = speech[0][0]
    if measured == 0 and expected_lead < 0.25:
        return  # silencedetect ignores pauses shorter than 250 ms.
    if abs(measured - expected_lead) > LEAD_TOLERANCE:
        sys.exit(f"{path.name}: lead-in {measured:.3f}s, expected {expected_lead:.3f}s.")


def cmd_verify(args):
    outdir = Path(args.outdir)
    report_path = outdir / "cut_report.json"
    if not report_path.is_file():
        sys.exit(f"Missing cut report in {outdir}")
    files = json.loads(report_path.read_text())["files"]
    expected = {row["file"] for row in files}
    actual = {clip.name for clip in outdir.glob("*.mp3") if clip.is_file()}
    if not files or len(expected) != len(files) or expected != actual:
        sys.exit(f"Clip inventory mismatch: missing={sorted(expected-actual)}, "
                 f"unexpected={sorted(actual-expected)}, report rows={len(files)}.")
    model = None
    if args.asr:
        from faster_whisper import WhisperModel
        model = WhisperModel(ensure_model(), device="cpu", compute_type="int8")
    results = []
    for entry in files:
        clip = outdir / entry["file"]
        dur, speech, sil = probe(clip)
        check_clip(clip, dur, speech, entry["end"] - entry["cut"],
                   entry.get("expected_lead", entry["lead_in"]))
        lead = sil[0][1] if sil and sil[0][0] <= 0.05 else 0.0
        row = {"file": clip.name, "duration": round(dur, 3),
               "lead_in": round(lead, 3), "bursts": len(speech)}
        if args.asr:
            segs, _ = model.transcribe(str(clip), condition_on_previous_text=False,
                                       vad_filter=False)
            row["asr"] = " ".join(s.text.strip() for s in segs)
        results.append(row)
        print(f"{clip.name:<28} len={dur:6.2f}s lead={lead:5.2f}s bursts={len(speech)}"
              + (f"\n    ASR: {row['asr']}" if args.asr else ""))
    if args.asr:
        write_json(outdir / "verify_asr.json", results)
    print("\nCheck: every clip starts with ~lead_in silence then the word; ASR text "
          "must contain word + definition + example. If ASR drops the leading word, "
          "verify energy first (see SKILL.md) before assuming it is missing.")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("probe", help="duration / speech bursts / silences (JSON)")
    p.add_argument("audio")
    p.set_defaults(fn=cmd_probe)

    p = sub.add_parser("transcribe", help="word-level ASR via faster-whisper")
    p.add_argument("audio")
    p.add_argument("-o", "--out", required=True)
    p.set_defaults(fn=cmd_transcribe)

    p = sub.add_parser("analyze", help="probe + ASR + candidate units -> manifest")
    p.add_argument("audio")
    p.add_argument("-o", "--out", required=True)
    p.add_argument("--asr", help="reuse/save ASR JSON at this path")
    p.add_argument("--lead", type=float, default=1.0)
    p.set_defaults(fn=cmd_analyze)

    p = sub.add_parser("cut", help="validate reviewed manifest and export MP3s")
    p.add_argument("audio", nargs="?", help="defaults to manifest.source")
    p.add_argument("-m", "--manifest", required=True)
    p.add_argument("-o", "--outdir", required=True)
    p.add_argument("--lead", type=float, help="seconds of lead-in before each word (default 1.0)")
    p.set_defaults(fn=cmd_cut)

    p = sub.add_parser("verify", help="per-clip lead-in / burst check")
    p.add_argument("outdir")
    p.add_argument("--asr", action="store_true", help="also transcribe each clip")
    p.set_defaults(fn=cmd_verify)

    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
