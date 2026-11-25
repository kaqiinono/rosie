# 影视工具

## 批量转换本地音视频和提取字幕

需要 `ffmpeg` 和 `ffprobe`。把媒体文件放在 `scripts/tools/movie/files/`，在仓库根目录运行：

```bash
bash scripts/tools/movie/convert-audio.sh
```

也可以显式传入一个或多个路径，或者指定只转 MP3 或 AAC：

```bash
bash scripts/tools/movie/convert-audio.sh all '/path/to/影片.mkv' '/path/to/影片续集.mov'
bash scripts/tools/movie/convert-audio.sh mp3 '/path/to/影片.mp4'
bash scripts/tools/movie/convert-audio.sh aac
```

默认 `all` 模式取第一条音轨，导出双声道、192 kbps 的 `.mp3` 和 `.aac`。
非 MP4 视频另生成同名 H.264 MP4，使用第一条音轨作为 AAC 音频。
可转换的内嵌文字字幕按轨道导出为 `.srt`，PGS 图像字幕保留为 `.sup`，例如 `影片.zho.s1.srt`。
字幕缺少语言标记时使用 `und`。没有内嵌字幕时照常转换音视频。

输出保存在源文件旁，同名文件会跳过。默认目录只扫描当前层的常见媒体文件。
已有的 `.mp3` 和 `.aac` 可通过显式路径作为输入，默认扫描会跳过它们。

## 导出百度网盘字幕

`baidu-share-subtitles.py` 使用 Python 3 标准库，接受单个视频的百度网盘分享链接和提取码。它只读取分享信息和字幕数据，将百度网盘播放器已有的 AI 字幕按语言导出为 `.srt`。MKV 内封字幕轨不在导出范围内。

在仓库根目录运行：

```bash
python3 scripts/tools/movie/baidu-share-subtitles.py \
  'https://pan.baidu.com/s/1EXAMPLE' 'AB12'
```

链接带有 `?pwd=...` 时，第二个参数可以省略。默认写入系统临时目录下的 `baidu-share-subtitles/<分享ID>/`，也可以指定输出目录：

```bash
python3 scripts/tools/movie/baidu-share-subtitles.py \
  'https://pan.baidu.com/s/1EXAMPLE?pwd=AB12' \
  --output-dir ~/Downloads/subtitles
```

导出后终端会列出各字幕文件的绝对路径和条数。文件名格式为 `视频名.字幕语言.baidu-ai.srt`。如果目标文件与本次导出内容不同，脚本会提示改用其他目录。如果分享里没有可导出的 AI 字幕，脚本会显示原因。

## 生成剧场 MP4 播放副本

当网页无法播放 MKV，或百度网盘暂未提供 RMVB 转码流时，可用本机的 FFmpeg 生成 H.264/AAC 播放副本。在仓库根目录运行：

```bash
python3 scripts/tools/movie/make-theater-playback.py '/path/to/影片.rmvb'
```

默认输出 `影片.playback.mp4` 到原文件旁。可以用 `--output-dir` 指定输出目录，或用 `--audio-track 2` 选择第二条音轨。将播放副本放到原片所在的百度网盘目录，再到「同步管理 → 电影剧场」点击「关联 MP4 副本」。建议选与字幕对应的原声音轨。
