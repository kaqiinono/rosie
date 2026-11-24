#!/usr/bin/env python3
"""Create a browser-compatible MP4 copy for the Rosie theater."""

import argparse
import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="为本地 MKV 或 RMVB 生成剧场可关联的 MP4 播放副本。")
    parser.add_argument("source", type=Path, help="本地影片路径")
    parser.add_argument("--output-dir", type=Path, help="输出目录，默认与原文件相同")
    parser.add_argument("--audio-track", type=int, default=1, help="要保留的音轨编号，从 1 开始")
    args = parser.parse_args()

    source = args.source.expanduser().resolve()
    if source.suffix.lower() not in (".mkv", ".rmvb") or not source.is_file():
        parser.error("请提供可读取的 MKV 或 RMVB 文件")
    if args.audio_track < 1:
        parser.error("音轨编号须大于或等于 1")
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        parser.error("请先在本机安装 FFmpeg")

    directory = (args.output_dir or source.parent).expanduser().resolve()
    target = directory / f"{source.stem}.playback.mp4"
    try:
        directory.mkdir(parents=True, exist_ok=True)
        if target.exists() or target.is_symlink():
            parser.error(f"播放副本已存在 {target}")
        with tempfile.TemporaryDirectory(dir=directory) as temp:
            staged = Path(temp) / "playback.mp4"
            audio = f"0:a:{args.audio_track - 1}" + ("?" if args.audio_track == 1 else "")
            subprocess.run([
                ffmpeg, "-hide_banner", "-nostdin", "-n", "-i", str(source),
                "-map", "0:V:0", "-map", audio,
                "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-pix_fmt", "yuv420p",
                "-c:v", "libx264", "-preset", "fast", "-crf", "20",
                "-c:a", "aac", "-b:a", "160k", "-ac", "2",
                "-map_metadata", "-1", "-map_chapters", "-1", "-movflags", "+faststart", str(staged),
            ], check=True)
            os.link(staged, target)
    except (subprocess.CalledProcessError, OSError) as error:
        parser.exit(1, f"生成播放副本失败：{error}\n")
    print(target)


if __name__ == "__main__":
    main()
