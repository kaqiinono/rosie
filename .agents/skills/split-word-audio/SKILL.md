---
name: split-word-audio
description: Split a vocabulary-teaching MP3 (each unit = word + definition + example sentence) into one complete MP3 per word, cut about 1 second before each word starts. Use when the user asks to 拆分单词音频、分割词汇音频、一个单词一个文件、把单词录音按词切开, or /split-word-audio.
version: 1.1.0
trigger: /split-word-audio
---

# 单词音频按词分割

每个教学单元 = 单词 + 英文释义 + 例句,输出文件必须完整包含这三部分,切点在单词开始前约 1 秒的静音处。句子级听记/跟读切片请用 add-listening,不要用本流程。

## 工具链

统一使用 `scripts/split-word-audio.py`(子命令 probe / transcribe / analyze / cut / verify,参数见 `--help`)。依赖:macOS 或 Linux、Python 3.8+、curl、faster-whisper、imageio-ffmpeg(`pip3 install --user faster-whisper imageio-ffmpeg`)。

- 导出 MP3 需要带 **libmp3lame** 的 ffmpeg。LosslessCut 内置的 ffmpeg 只能分析、没有 MP3 编码器;脚本会自动挑选可用编码器,不要手动指定 LosslessCut 版本。
- whisper small 模型缓存在 `~/.cache/rosie-word-split/fw-small`,首次从 hf-mirror.com 下载(huggingface.co 在本机不可达),脚本锁定模型版本，串行初始化缓存，按上游 Git blob ID 或 LFS SHA-256 校验文件，缓存完整时离线运行。不要手动复用来源不明或不完整的模型目录。

## 流程

1. **analyze**:`python3 scripts/split-word-audio.py analyze 音频.mp3 -o manifest.json --asr asr.json`。产出候选单元、完整词级 ASR、检测到的语音 burst 列表。ASR 缓存按源文件 SHA-256 复用。换录音或使用无指纹的旧缓存时会重新转写。旧 manifest 需重新 analyze 并复核。
2. **审查 manifest(必须,不可跳过)**:候选只是启发式草稿(词前静音 ≥1.5s、时长 ≤1.5s、词后静音 ≥1.0s),逐条对照 `context` 与 `asr` 全文:
   - 每个单元必须是完整的「词 + 释义 + 例句」。**释义碎片可能通过启发式**(短促的释义词组同样满足间隔条件),发现多出的单元要删掉。
   - 孤立短词常被误听:head for→"Headfall"、due→"Do you?"、spy→"SPOI"、capture→"Captcha"。用释义和例句反推正确单词,修正 `name`(小写下划线)。
   - 漏掉的单元从 ASR 全文补回;`name` 为空说明 ASR 时间戳漂移超阈值,按上下文推断。
   - `onset` 必须是 `speech` 数组里真实 burst 的起点,**不是 ASR 词时间戳**。
   - 确认首个 burst 对应首词。有片头且确实要略过时，选择真正首词的 onset，并设 `"skip_intro": true`。全部复核后把 `status` 从 `needs_review` 改为 `reviewed`。
3. **cut**:`python3 scripts/split-word-audio.py cut -m manifest.json -o 输出目录`。脚本强制校验:切点落在单元间静音内、onset 单调、连续覆盖;在临时目录完成所有切片后，一次发布 `NN_word.mp3` 和 `cut_report.json`。目标目录已有内容时，自动使用同级的 `输出目录-2`、`输出目录-3` 等。以命令末尾的 Published 路径为准。校验失败时修正 manifest 或减小 `--lead`,不要绕过。
4. **verify**:`python3 scripts/split-word-audio.py verify 实际发布目录 --asr`。脚本对照报告检查文件集合、时长、语音和前导静音。默认从音频起点保留首段，后续切片按 lead 留白。逐条核对转写，确认词、释义和例句完整，并排查相邻单元串入。抽查试听首尾和低置信片段。

## 已知陷阱(全部实际踩过)

| 陷阱 | 事实 | 正确做法 |
|---|---|---|
| 只靠静音阈值分段 | 单元内停顿可达 2.3s,单元间最短仅 1.9s,区间重叠 | ASR 识别单元 + 声学 burst 定位,二者缺一不可 |
| 直接用 ASR 词时间戳做切点 | whisper 词级时间戳漂移可达 ~1.1s | onset 一律取 silencedetect burst 起点 |
| 候选列表当最终结果 | 释义碎片能通过全部启发式条件 | 逐条审查,见流程第 2 步 |
| ASR 没识别出首词 = 缺词 | whisper 常丢切片开头的孤立词 | 先查能量再下结论(见下) |
| 并发/残留模型下载 | tokenizer.json 截断、缓存只有 refs 没有权重 | 用脚本的校验下载,不手工拼缓存 |

首词能量检查（示例适用于约 1 秒前导静音，其他切片按报告中的 expected_lead 调整窗口）：

```bash
ffmpeg -ss 0.8 -t 1.2 -i 切片.mp3 -af volumedetect -f null - 2>&1 | grep mean_volume
```

能量只能帮助定位有声片段。若 ASR 漏掉首词，试听对应窗口，确认读出的单词及词头完整后再交付。

## 红线

- 跳过 manifest 审查直接 cut = 返工。
- 未跑 verify 就交付 = 未完成。
- 切点不在静音内时强行导出 = 会切掉相邻单元的尾音或词头。
- 交付时报告:文件数、输出目录、cut_report 位置、仍存疑待试听的片段。