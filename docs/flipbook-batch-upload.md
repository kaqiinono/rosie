# 绘本批量上传与文件配对

## 配对规则（核心）

系统用**文件名主干**（去掉扩展名、忽略大小写）把三类文件配成一本：

| 类型 | 示例 |
|------|------|
| PDF | `第43讲-课前测.pdf` → 主干 `第43讲-课前测` |
| 音频 | `第43讲-课前测.mp3` → 主干 `第43讲-课前测` |
| 同步 | `第43讲-课前测.sync.json` → 主干 `第43讲-课前测` |

**同一主干 = 同一本书。** 书名默认用主干（`-`/`_` 会换成空格），可在上传前在列表里改。

### 命名建议

```
资料/
  第43讲-课前测.pdf
  第43讲-课前测.mp3
  第43讲-课前测.sync.json
  第44讲-课后测.pdf
  第44讲-课后测.mp3
```

- 不要只靠「都在一个文件夹里」配对，**文件名必须一致**（扩展名可以不同）。
- 只有 PDF、没有音频：可以，阅读器仅翻页。
- 有音频但没有 sync.json：可以播放，但**不会按时间自动翻页**（需手写 sync 或后续用打点工具）。

## 应用内批量上传

1. 打开 `/flipbook/admin`
2. 滚动到 **批量上传**
3. 分别多选所有 PDF、所有 MP3、所有 sync.json（后两项可选）
4. 点击 **预览配对**，检查列表里每行的 PDF / 音频 / sync 是否正确
5. 修改书名（可选）→ **开始上传 N 本**

未配上的音频或 sync 会在黄色提示里列出，请检查文件名是否写错。

## 单本上传

页面上方的 **单本上传** 仍可用：一次选一本 PDF + 一个音频 + 一个 sync，不依赖文件名，适合临时补一本。

## Supabase 后台 / CLI（不进网页）

路径格式（与代码一致）：

```
flipbook/books/{slug}/pages/0001.webp（仅页图，不存 PDF）
flipbook/books/{slug}/narration.mp3
flipbook/books/{slug}/pages/0001.webp
```

1. 在 Storage 上传文件（建议按 `books/{slug}` 组织）
2. 在 `flipbook_books` 表插入一行，`slug` / `pdf_path`（页图目录前缀）/ `audio_path` / `sync_manifest` 填好

批量时通常写脚本：读本地目录 → 按主干配对 → 生成可读 `slug` → upload + insert。应用内批量上传已封装同样逻辑，一般无需手写脚本。

## sync.json 与页码

`sync.json` 里的 `page` 是 **PDF 页码**（从 1 开始），必须与该书 PDF 页数一致。参见 `docs/flipbook-sync.example.json`。

## 用脚本自动生成 sync.json

可以从 PDF + 音频**推算**时间轴，但无法保证 100% 准确（取决于老师是否在翻页处停顿、是否有封面页等）。推荐流程：**脚本出草稿 → 播放器试听 → 手改 JSON**。

### 1. 均分模式（零配置，草稿）

```bash
node scripts/generate-flipbook-sync.mjs \
  --pdf "第43讲-课前测.pdf" \
  --audio "第43讲-课前测.mp3" \
  --mode equal
```

输出同目录下的 `第43讲-课前测.sync.json`（按 PDF 页数把音频时长平均切段）。

### 2. 静音切分（讲题之间有停顿时更合适）

需安装 [ffmpeg](https://ffmpeg.org/)：

```bash
node scripts/generate-flipbook-sync.mjs \
  --pdf "第43讲-课前测.pdf" \
  --audio "第43讲-课前测.mp3" \
  --mode silence \
  --min-silence 0.8 \
  --noise -35dB
```

在较长静音处切分；若静音点不够，会回退为均分。

### 3. 批量生成（与批量上传同名规则）

```bash
node scripts/generate-flipbook-sync.mjs --dir ./资料 --mode silence
```

对目录内每个 `*.pdf` 找同名 `.mp3`，写出 `*.sync.json`，再进 `/flipbook/admin` 批量上传。

### 4. 只同步部分页（例如 PDF 10 页但只有 5 道题）

```bash
node scripts/generate-flipbook-sync.mjs \
  --pdf 讲义.pdf --audio 讲解.mp3 \
  --pages 2,4,6,8,10 \
  --mode silence
```

### 准确度说明

| 方法 | 依赖 | 适用场景 |
|------|------|----------|
| `equal` | ffprobe | 快速草稿、每页讲解时长相近 |
| `silence` | ffmpeg | 页与页/题与题之间有明显停顿 |
| Whisper 对齐 | OpenAI / 本地 Whisper + PDF 文字 | 按讲义 OCR 与语音对齐（未内置，可二期加） |

生成的 JSON 含 `_generatedBy`、`_note` 字段，应用会忽略未知字段；上传前可删掉。

## Python 一键上传（files 目录 → Supabase）

在 `PycharmProjects/pythonProject/flipbook/` 中：

```bash
pip install -r flipbook/requirements.txt
python flipbook/setup_env.py

python flipbook/generate_sync.py --mode align   # 可选：先生成 sync
python flipbook/upload.py                        # 自动读 Rosie/.env.local
python flipbook/upload.py --dry-run
```

资料目录：`flipbook/files/`（PDF/MD + MP3 + sync.json）。

**无需复制 env**：上传脚本会查找本仓库 `.env.local`（`~/workspace/outer/rosie` 等路径）。请在其中增加：

```env
FLIPBOOK_UPLOAD_EMAIL=...
FLIPBOOK_UPLOAD_PASSWORD=...
```

`files/` 内同名主干示例：`课前测.pdf` + `课前测.mp3` + `课前测.sync.json`。仅有 `.md` 时会自动转成 PDF 再上传。
