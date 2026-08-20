#!/usr/bin/env node

/**
 * Grammar unit extraction CLI — 《剑桥初级英语语法》内容提取 + 入库。
 *
 * Pipeline: PDF page → pdftoppm PNG → qwen-vl-max (高保真转录) → 组装 unit.json →
 * service-role upsert 到 grammar_units。幂等：重复执行覆盖同一 unit_number。
 *
 * Usage:
 *   node scripts/extract-grammar-unit.mjs --unit 1              提取 + 入库
 *   node scripts/extract-grammar-unit.mjs --range 1-3           批量（顺序执行）
 *   node scripts/extract-grammar-unit.mjs --unit 1 --no-upload  只落地 JSON
 *   node scripts/extract-grammar-unit.mjs --unit 1 --upload-only 跳过提取直接入库 unit.json
 *   node scripts/extract-grammar-unit.mjs --unit 1 --force      忽略 PNG/JSON 缓存
 *   node scripts/extract-grammar-unit.mjs --book intermediate --unit 1  指定书（默认 essential）
 *
 * 页码映射：按书分文件（essential → scripts/grammar-page-map.json，其他书 →
 * scripts/grammar-page-map-{book}.json；Phase 2 `--toc` 产物，格式
 * { "<unit>": { "pdf": [..], "book": [..] } }）；essential 缺失时用临时公式
 * pdfPages = bookPages = [19 + 2N, 20 + 2N] 并打印 WARN；其他书缺失直接报错
 * （临时公式是 essential 专用规律，禁止对新书兜底）。
 *
 * Env（apps/web/.env.local）：NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 * （入库时必需）；AI_EMBED_API_KEY / AI_EMBED_BASE_URL（提取时必需）。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildGrammarSearchText } from './grammar-search-text.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 已知语法书配置：新增书时在此追加 */
const BOOKS = {
  essential: { pdf: 'docs/english/剑桥初级英语语法.pdf', maxUnits: 115 },
  intermediate: { pdf: 'docs/english/剑桥中级英语语法.pdf', maxUnits: 145 },
  advanced: { pdf: 'docs/english/剑桥高级英语语法.pdf', maxUnits: 120 },
}
const DEFAULT_BOOK = 'essential'

/** page-map 按书分文件：essential 保留历史文件名，其他书 grammar-page-map-{book}.json */
function pageMapPathFor(book) {
  if (book === 'essential') return resolve(root, 'scripts/grammar-page-map.json')
  return resolve(root, `scripts/grammar-page-map-${book}.json`)
}
const PAGES_DIR = resolve(root, 'output/grammar-pages')
const UNITS_BASE_DIR = resolve(root, 'output/grammar-units')
const KEYS_DIR_NAME = '_keys'
const VISION_MODEL = process.env.GRAMMAR_VISION_MODEL || 'qwen-vl-max'
const DPI = 300

// ── BACKMATTER 注册表 ──────────────────────────────────────────────────────
// 书尾内容（essential）：延展位 116-169，unit_number 仅作延展位主键，
// title/category 承载原类型名。书页码 = PDF 页 - 7。
// kind：appendix（附录）/ supp（补充练习）/ guide（学习指导）/ answers（答案页）/ index（练习表）
// 按书隔离：intermediate/advanced 接入时按各自原书结构追加
const BACKMATTER_BY_BOOK = {
  essential: [
  { key: 'appendix-1', unit: 116, kind: 'appendix', title: '附录 1 主动语态与被动语态比较', categoryZh: '附录', pdf: [251] },
  { key: 'appendix-2', unit: 117, kind: 'appendix', title: '附录 2 不规则动词表', categoryZh: '附录', pdf: [252] },
  { key: 'appendix-3', unit: 118, kind: 'appendix', title: '附录 3 不规则动词分类表', categoryZh: '附录', pdf: [253] },
  { key: 'appendix-4', unit: 119, kind: 'appendix', title: "附录 4 缩略形式（he's / I'd / don't 等）", categoryZh: '附录', pdf: [254, 255] },
  { key: 'appendix-5', unit: 120, kind: 'appendix', title: '附录 5 拼写', categoryZh: '附录', pdf: [256, 257] },
  { key: 'appendix-6', unit: 121, kind: 'appendix', title: '附录 6 常用短语动词（take off / give up 等）', categoryZh: '附录', pdf: [258] },
  { key: 'appendix-7', unit: 122, kind: 'appendix', title: '附录 7 短语动词+宾语（put out a fire / give up your job 等）', categoryZh: '附录', pdf: [259] },
  // 补充练习开篇的练习表（书 p.253 = PDF 260 页首）：提取后落盘 _keys/supp-index.json，
  // 作为补充练习条目（延展位 123 起）的权威清单与页面切分依据
  { key: 'supp-index', kind: 'index', title: '补充练习练习表', pdf: [260] },
  // 补充练习内容页扫描（kind=scan）：逐页提取落盘 supp-pages/，供 supp-01…35 组装时按练习编号切分
  { key: 'supp-pages', kind: 'scan', title: '补充练习内容页扫描', pdf: Array.from({ length: 19 }, (_, i) => 260 + i) },
  // 补充练习 35 条（supp-01…35 → 延展位 123-157）不在注册表静态列出：
  // key 匹配 supp-NN 时由 resolveSuppEntry 依据 _keys/supp-index.json 动态注册（title/units 取练习表）
  // 学习指导按页 12 条（guide-p272…p283 → 延展位 158-169；书 p.NNN = PDF NNN+7）
  ...Array.from({ length: 12 }, (_, i) => {
    const bookPage = 272 + i
    return { key: `guide-p${bookPage}`, unit: 158 + i, kind: 'guide', title: `学习指导 ${i + 1}`, categoryZh: '学习指导', pdf: [bookPage + 7] }
  }),
  { key: 'answers-main', kind: 'answers', title: '练习答案', pdf: Array.from({ length: 27 }, (_, i) => 291 + i) },
  { key: 'answers-supp', kind: 'answers', title: '补充练习答案', pdf: [318, 319, 320] },
  { key: 'answers-guide', kind: 'answers', title: '学习指导答案', pdf: [321, 322] },
  ],
}

const CATEGORY_BY_KIND = { appendix: 'appendix', supp: 'supplementary', guide: 'study_guide' }

function findBackmatter(book, key) {
  return (BACKMATTER_BY_BOOK[book] ?? []).find((e) => e.key === key)
}

function loadSuppIndex(book) {
  const indexPath = resolve(UNITS_BASE_DIR, book, KEYS_DIR_NAME, 'supp-index.json')
  if (!existsSync(indexPath)) {
    throw new Error(`缺少补充练习练习表 ${indexPath}，请先执行 --backmatter supp-index`)
  }
  return JSON.parse(readFileSync(indexPath, 'utf8'))
}

/** supp-01…supp-35 动态注册：title/units 取练习表行，延展位 = 122 + 练习编号 */
function resolveSuppEntry(key, book) {
  const match = /^supp-(\d{2})$/.exec(key)
  if (!match) return null
  const exNumber = Number(match[1])
  const index = loadSuppIndex(book)
  const row = (index.rows ?? []).find((r) => Array.isArray(r.exNumbers) && r.exNumbers.includes(exNumber))
  if (!row) throw new Error(`${key}: 练习编号 ${exNumber} 不在练习表（${index.rows?.length ?? 0} 行）中`)
  return {
    key,
    unit: 122 + exNumber,
    kind: 'supp',
    exNumber,
    title: row.title,
    suppUnits: row.units ?? [],
    unitsLabel: row.unitsLabel ?? '',
    categoryZh: '补充练习',
  }
}

/** 解析 --backmatter 参数：单 key / 逗号列表 / appendix-1-7 这类同前缀区间 */
function parseBackmatterKeys(arg) {
  const rangeMatch = /^(appendix|supp|guide)-(\d+)-(\d+)$/.exec(arg)
  if (rangeMatch) {
    const [, prefix, a, b] = rangeMatch
    const keys = []
    for (let n = Number(a); n <= Number(b); n += 1) {
      // 附录 key 不补零（appendix-1）；补充练习补零（supp-01）；学习指导按书内页码（guide-p272）
      const key = prefix === 'guide' ? `guide-p${n}` : prefix === 'supp' ? `${prefix}-${String(n).padStart(2, '0')}` : `${prefix}-${n}`
      keys.push(key)
    }
    return keys
  }
  return arg.split(',').map((s) => s.trim()).filter(Boolean)
}

function getBookConfig(book) {
  const cfg = BOOKS[book]
  if (!cfg) throw new Error(`未知语法书: ${book}（已知: ${Object.keys(BOOKS).join(', ')}）`)
  return { ...cfg, pdf: resolve(root, cfg.pdf) }
}

// ── env / args ────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = resolve(root, 'apps/web/.env.local')
  if (!existsSync(envPath)) return {}
  const env = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1)
    }
    env[trimmed.slice(0, eq).trim()] = value
  }
  return env
}

function usage() {
  console.log(`Usage: node scripts/extract-grammar-unit.mjs [options]

Options:
  --unit <n>        提取单个单元
  --range <a-b>     批量提取单元区间
  --backmatter <k>  书尾内容：单 key（appendix-1）、逗号列表或同前缀区间（appendix-1-7）
  --book <id>       语法书 ID（${Object.keys(BOOKS).join(' | ')}），默认 ${DEFAULT_BOOK}
  --no-upload       只落地 JSON，不写 Supabase
  --upload-only     跳过提取，直接读取已有 unit.json 入库
  --force           忽略 PNG / 页面 JSON 缓存重新提取
  --help            显示帮助
`)
}

function parseArgs(argv) {
  const opts = { units: [], backmatterKeys: [], book: DEFAULT_BOOK, noUpload: false, uploadOnly: false, force: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help') return { help: true }
    if (arg === '--no-upload') opts.noUpload = true
    else if (arg === '--upload-only') opts.uploadOnly = true
    else if (arg === '--force') opts.force = true
    else if (arg === '--book') {
      opts.book = argv[++i]
      if (!BOOKS[opts.book]) throw new Error(`未知语法书: ${opts.book}（已知: ${Object.keys(BOOKS).join(', ')}）`)
    }
    else if (arg === '--backmatter') {
      opts.backmatterKeys.push(...parseBackmatterKeys(argv[++i] ?? ''))
    }
    else if (arg === '--unit') {
      const n = Number.parseInt(argv[++i], 10)
      assertUnit(n, opts.book)
      opts.units.push(n)
    } else if (arg === '--range') {
      const match = /^(\d+)-(\d+)$/.exec(argv[++i] ?? '')
      if (!match) throw new Error('--range 格式应为 A-B，如 --range 1-10')
      const [a, b] = [Number(match[1]), Number(match[2])]
      assertUnit(a, opts.book)
      assertUnit(b, opts.book)
      if (b < a) throw new Error('--range 起点必须 <= 终点')
      for (let n = a; n <= b; n += 1) opts.units.push(n)
    } else throw new Error(`Unknown option: ${arg}`)
  }
  if (opts.units.length === 0 && opts.backmatterKeys.length === 0) {
    throw new Error('需要 --unit <n> / --range <a-b> / --backmatter <key>')
  }
  return opts
}

function assertUnit(n, book) {
  const max = BOOKS[book]?.maxUnits ?? 200
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new Error(`单元编号必须在 1-${max} 之间（书: ${book}），收到: ${n}`)
  }
}

// ── page mapping ──────────────────────────────────────────────────────────────

function resolvePageMap(book, unitNumber) {
  const mapPath = pageMapPathFor(book)
  if (existsSync(mapPath)) {
    const map = JSON.parse(readFileSync(mapPath, 'utf8'))
    const entry = map[String(unitNumber)]
    if (entry && Array.isArray(entry.pdf) && entry.pdf.length > 0) {
      return { pdf: entry.pdf, book: entry.book ?? entry.pdf, fromMap: true }
    }
    throw new Error(`${mapPath} 缺少 unit ${unitNumber} 的条目`)
  }
  // 临时公式 [19+2N, 20+2N] 是 essential 专用规律，禁止对新书兜底（错用会导致页码全错）
  if (book !== 'essential') {
    throw new Error(
      `book "${book}" 缺少 page-map 文件 ${mapPath}：先放入 PDF 并用 grammar-page-map-gen.mjs --book ${book} 生成`,
    )
  }
  const lesson = 19 + 2 * unitNumber
  return { pdf: [lesson, lesson + 1], book: [lesson, lesson + 1], fromMap: false }
}

// ── PDF rendering ─────────────────────────────────────────────────────────────

function renderPdfPage(pdfPage, force, pdfPath) {
  const stem = `page-${String(pdfPage).padStart(4, '0')}`
  const imagePath = resolve(PAGES_DIR, `${stem}.png`)
  if (!force && existsSync(imagePath)) return imagePath
  if (!existsSync(pdfPath)) throw new Error(`PDF 不存在: ${pdfPath}`)
  mkdirSync(PAGES_DIR, { recursive: true })
  const renderPrefix = resolve(PAGES_DIR, `${stem}-render`)
  execFileSync('pdftoppm', [
    '-f', String(pdfPage),
    '-l', String(pdfPage),
    '-singlefile',
    '-r', String(DPI),
    '-png',
    pdfPath,
    renderPrefix,
  ])
  renameSync(`${renderPrefix}.png`, imagePath)
  console.log(`[p.${pdfPage}] 渲染完成 (${DPI} DPI)`)
  return imagePath
}

// ── Vision extraction ─────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `你是一位英语语法教材内容的**逐字转录**专家。你的任务是**忠实地还原**图片中的全部教学内容，不要总结、不要改写、不要遗漏。

**输出要求**: 严格输出 JSON（不要 markdown 代码块包裹）。

{
  "unitNumber": <数字>,
  "title": "<英文标题，逐字抄写>",
  "titleZh": "<中文标题，逐字抄写>",
  "pageType": "lesson | exercise",
  "bookPage": <本页面角落标注的印刷页码数字；找不到则用你的最佳估计>,
  "category": "<英文分类 id，根据语法主题推断：present_tense / present_continuous / past_tense / future / modals / articles / prepositions / conjunctions / conditionals / passive / reported_speech / relative_clauses / quantifiers / comparatives / imperatives / gerunds_infinitives 等>",
  "categoryZh": "<中文分类名>",
  "difficulty": <1-5 的整数，根据内容难度推断>,
  "contentRegion": [x1, y1, x2, y2],  // 教学内容区域包围盒，坐标归一化到 0-1000（见规则 14）

  "sections": [
    {
      "label": "A | B | C | ...  或 null（无标签时）",
      "title": "<本节标题或描述，逐字抄写>",
      "blocks": [
        // 按页面从上到下的顺序，每个独立内容块为一个 block
        // block 类型如下（用 type 字段区分）：

        // 1) 情境对话/例句列表（通常配有人物插图）
        { "type": "example_set", "context": "<场景描述，如'Lisa 自我介绍'>", "items": [
          { "en": "<逐字英文>", "zh": "<逐字中文翻译>", "bold": ["<加粗的词>"] }
        ]},

        // 2) 语法表格（动词变位表等）
        { "type": "grammar_table", "title": "<表格标题，如'肯定式'/'否定式'>", "headers": ["<列标题>"], "rows": [["<单元格内容>"]] },

        // 3) 语法规则说明（中文段落）
        { "type": "rule_text", "text": "<逐字抄写中文语法说明，保留原文用词>" },

        // 4) 散列例句（带方块符号的例句列表）
        { "type": "examples", "items": [
          { "en": "<逐字英文>", "zh": "<逐字中文>", "note": "<括号内注释或 null>" }
        ]},

        // 5) 拼写/特殊规则
        { "type": "spelling_rule", "text": "<逐字抄写>", "examples": [
          { "base": "come", "form": "coming" }
        ]},

        // 6) 缩略形式说明
        { "type": "contraction_note", "items": [
          { "full": "that is", "short": "that's" }
        ]},

        // 7) 注意事项/提示
        { "type": "tip", "text": "<逐字抄写>" },

        // 8) 教学内容插图描述（插图本身承载教学内容，如 get in/get out 对比图）
        { "type": "image_description", "text": "<逐字描述插图内容与标注文字，可含换行>" }
      ]
    }
  ],

  "crossReferences": [
    { "text": "<逐字抄写，如 'am/is/are (疑问句) → Unit 2'>", "targetUnit": <数字或null> }
  ],

  "exercises": [
    {
      "section": "<分组编号，如 '1.1', '1.2'>",
      "instruction": "<题目指令，逐字抄写中文>",
      "items": [
        {
          "number": <组内序号>,
          "type": "fill_blank | sentence_completion | short_answer | transformation | multiple_choice | matching",
          "prompt": "<题干文本，逐字抄写，填空用 ______ 表示>",
          "options": ["A. ...", "B. ..."] | null,
          "answer": "<正确答案；matching / multiple_choice 只填选项字母（如 'G'）>",
          "answerNote": "<可选补充说明或解析>"
        }
      ]
    }
  ]
}

**严格规则**（必须遵守）：
1. **逐字抄写**，不要改写、总结或补充。原文写什么就提取什么
2. 英文例句中的**加粗词**记录到 bold 数组（如 ["is", "am"]）
3. 中文语法说明**原文照抄**，不要用你自己的话改写
4. 练习题的指令文字（如"填入 am, is 或 are"）**原文照抄**
5. 练习题填空处统一用 6 个下划线 ______ 表示
6. **不要遗漏任何内容**：包括脚注、交叉引用、附录引用
7. 忽略纯装饰性插图（人物漫画、背景画），但要描述有教学内容的情境插图（如"旅馆前台场景"）
8. sections 数组仅在 lesson 页用；exercise 页的 sections 为空数组
9. exercises 数组仅在 exercise 页使用；lesson 页的 exercises 为空数组
10. 如果图片中同时有讲解和练习（某些单元），两者都要提取
11. matching / 选择题：options 数组**只在组内第一题写一次**，后续题的 options 设为 null；题干不要重复写题号前缀
12. 题型选择：填词用 fill_blank；补全对话/句意用 sentence_completion；选字母答 matching/选择用 matching/multiple_choice；改写句子用 transformation；短答用 short_answer
13. 一空多答案的 answer 必须用英文逗号加空格 ", " 分隔各空答案（如 "started, finished"），段数 = 空格数；不要用 ; 或换行
14. 多空题的 answer **只写空格处的内容**，不要把整句写进 answer；单个空的答案含多个词时用 " / " 分隔（如 "too cold / to go out"）
15. 交叉引用（如 "→ Unit 5"）只放 crossReferences 数组，不要作为 sections 里的 block
16. contentRegion：框住页面上**全部教学内容**（标题、正文、表格、插图、练习题，含角落印刷页码）的最小矩形，排除四周纯白边距；四个整数归一化到 0-1000（图像左上角为 (0,0)，右下角为 (1000,1000)，x1<x2、y1<y2）；宁可略宽不可切到内容`

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ── Backmatter 专用 Prompt ────────────────────────────────────────────────────

/** 附录页：按原书版式忠实转录，只输出 sections/crossReferences（无练习） */
const APPENDIX_PROMPT = `你是一位英语语法教材**附录内容**的逐字转录专家。本页是书尾附录（非正文单元）。你的任务是**忠实还原**页面全部教学内容，按原书版式组织，不要总结、不要改写、不要遗漏。

**输出要求**: 严格输出 JSON（不要 markdown 代码块包裹）：

{
  "bookPage": <页面角落标注的印刷页码数字>,
  "contentRegion": [x1, y1, x2, y2],  // 教学内容区包围盒，归一化 0-1000，宁可略宽不可切到内容
  "sections": [
    {
      "label": "<小节编号如 '1.1'/'4.2'，无则 null>",
      "title": "<小节标题，逐字抄写>",
      "blocks": [ /* 按页面从上到下顺序 */ ]
    }
  ],
  "crossReferences": [
    { "text": "<逐字抄写，如 '参见 Unit 24'>", "targetUnit": <数字或 null> }
  ]
}

**block 类型与选择规则**（用 type 字段区分）：
- grammar_table：对照表/动词表等表格，**必须保留原书列结构与行列顺序**。headers 为列标题数组，rows 为单元格二维数组；空单元格用 "" 表示。每一行原书例句对应 rows 中一行（同一格内多条例句拆成多行，不要用 \n 塞进一个单元格）；行首的分组标签（如时态名）作为该行第一个单元格文本或独立 section title。并列排布的多张表（如左右两套三列动词表）拆为多个 grammar_table 按原书阅读顺序排列
- contraction_note：缩略形式对照（items: [{ full, short }]）
- spelling_rule：拼写规则（text = 规则说明逐字，examples: [{ base, form }]）
- examples：例句列表（items: [{ en, zh, note }]，加粗词记入 bold）
- rule_text：中文语法说明段落，原文照抄
- tip：注意事项/提示框文字
- image_description：有教学内容的插图（如短语动词配图）逐字描述，含图中标注文字

**严格规则**：
1. 逐字抄写，不改写不补充；中文说明原文照抄
2. 附录标题行（如“附录 1 主动语态与被动语态比较”）不要写入 sections，标题由外部注入
3. 对其他单元/附录的引用（如“参见 Unit 24”“参见附录 4.2”）写入 crossReferences，不作为 block；targetUnit 仅在引用 Unit N 时填数字
4. 动词表的发音注释（如 read (red)）保留在单元格文本内；页脚注释（如“下列动词既可…也可以…”）用 rule_text 完整转录
5. 不要遗漏任何内容：表格、例句、注释、脚注全部转录
6. 附录无练习题，不要输出 exercises 字段
7. contentRegion 坐标必须归一化到 0-1000，不得超出 1000`

/** 答案页：结构化转写 { unit, exercise, item, answer } */
const ANSWERS_PROMPT = `你是一位英语语法教材**练习答案页**的结构化转写专家。本页是书尾《练习答案》中的一页，按 "UNIT N" + 组号.题号 组织。

**输出要求**: 严格输出 JSON（不要 markdown 代码块包裹）：

{
  "bookPage": <页面角落标注的印刷页码数字>,
  "answers": [
    {
      "unit": <UNIT 标题的编号数字>,
      "exercise": "<组号，如 '1.2'，逐字抄写>",
      "item": <题号数字>,
      "answer": "<答案文本，逐字抄写>"
    }
  ]
}

**严格规则**：
1. 页面上每个 "组号.题号 答案" 条目都要输出，不遗漏不合并
2. UNIT 标题切换后，后续条目归属新 unit，直到下一个 UNIT 标题（页面可能从上一单元的中间开始，首个块也按其实际 UNIT 标题归属）
3. 答案原文照抄：多个可接受答案保持原书分隔形式（如 "it isn't / it's not"、"I'm / I am"）；括号内注释（如 (= ...)）一并保留
4. 标注“参考答案”的开放题答案照常提取（answer 不置空）
5. 不要输出其他字段（不要 bookPage/answers 以外的内容）`

const SUPP_INDEX_PROMPT = `你是一位英语语法教材**练习表**的结构化转写专家。本页页首有一张《补充练习》练习表（表格），列出全部补充练习的清单。只需转写这张表格，忽略页面上表格以外的练习内容。

**表格结构**：每行三列——练习编号（第一列，可能是单个数字如 "3"，也可能是范围如 "1-2"）、练习标题（第二列，如 "am/is/are"、"现在进行时"）、对应单元（第三列，如 "Units 1-2"、"Units 103-108, 111"）。

**输出要求**: 严格输出 JSON（不要 markdown 代码块包裹）：

{
  "bookPage": <页面角落标注的印刷页码数字>,
  "rows": [
    {
      "exNumbers": [<练习编号展开后的数字数组，"1-2" → [1,2]，"3" → [3]>],
      "title": "<练习标题，逐字抄写>",
      "unitsLabel": "<对应单元原文，如 'Units 1-2'>",
      "units": [<对应单元展开后的数字数组，"Units 1-2" → [1,2]，"Units 103-108, 111" → [103,104,105,106,107,108,111]>]
    }
  ]
}

**严格规则**：
1. 表格每一行都要输出，逐行逐字，不遗漏不合并，保持表格原有行序
2. 练习编号与对应单元中的范围（如 "1-2"、"103-108"）必须完整展开为连续数字数组
3. 标题含英文/中文/括号注释都照原样保留
4. 不要输出 rows/bookPage 以外的字段`

const SUPP_ANSWERS_PROMPT = `你是一位英语语法教材**补充练习答案页**的结构化转写专家。本页是书尾《补充练习答案》中的一页（页面顶部有"补充练习答案"标题）。

**页面结构**：分栏排版，按练习编号组织——每个练习以醒目的练习编号开头（如 "1"、"15"，编号按 1-35 递增），其下是逐题答案（题号. 答案）。页面可能从上一个练习的中间开始。

**输出要求**: 严格输出 JSON（不要 markdown 代码块包裹）：

{
  "bookPage": <页面角落标注的印刷页码数字>,
  "answers": [
    {
      "exNumber": <当前答案所属的练习编号数字（1-35）>,
      "item": <题号数字>,
      "answer": "<答案文本，逐字抄写>"
    }
  ]
}

**严格规则**：
1. 练习编号切换后，后续答案归属新练习，直到下一个练习编号出现
2. 每个 "题号 答案" 条目都要输出，不遗漏不合并；题号重复出现（如多组小题）也逐条输出
3. 答案原文照抄：多个可接受答案保持原书分隔形式（如 "she's / she is"）；括号注释一并保留
4. 标注"参考答案"的开放题答案照常提取（answer 不置空）
5. 不要输出 bookPage/answers 以外的字段`

/** 补充练习内容页：版面定位切分多练习，逐题转写（不推断答案，官方答案由 answers-supp 注入） */
const SUPP_PAGE_PROMPT = `你是一位英语语法教材**补充练习页**的结构化转写专家。本页是书尾《补充练习》中的一页（页眉通常含"补充练习"字样与涉及单元标注，如 "Units 1-2, 5-7, 9"）。你的任务是**忠实还原**页面上的全部练习题目，逐字抄写，不总结、不改写、不遗漏。

**版面定位规则**：
1. 页面可能包含多个练习：每个练习以**醒目的大号练习编号**开头（如 5、6、7），编号位于该练习第一行的最左侧，编号右侧或下方紧跟练习指令
2. 页首的"补充练习 Units X-Y"是页面级标题，不属于任何练习题，不要提取
3. 若页首有补充练习清单表格（练习编号/标题/对应单元三列），**忽略整张表格**，只提取表格之外的练习题目
4. 页面可能从上一个练习的中间开始（开头是无练习编号的续排题目）：该续排块的 exNumber 填 null，由外部根据上一页确定归属
5. 以新出现的大号练习编号切分练习边界；同一页内多个练习按页面从上到下顺序输出
6. **漫画面板/配图小题的编号是题号（item number），不是练习编号**：若页面是一组带插图的编号面板（如对话填空漫画），它们属于同一个练习的多个小题，输出为一个 exercise 下的多个 items，不要拆成多个 exercise
7. **编号括号空逐空拆分**：若练习是段落/书信/对话中嵌入编号括号空（如 (1) (2) (3)…）的填空题型，每个编号括号空都是一道独立小题（number = 括号编号，prompt = 含该空的句子），绝对不要把整段文字合并成一道题

**输出要求**: 严格输出 JSON（不要 markdown 代码块包裹）：

{
  "bookPage": <页面角落标注的印刷页码数字>,
  "contentRegion": [x1, y1, x2, y2],
  "exercises": [
    {
      "exNumber": <练习编号数字；续排块（见规则 4）填 null>,
      "instruction": "<练习指令文字，逐字抄写；续排块无指令时为空字符串>",
      "items": [
        {
          "number": <题号数字，按书上印刷编号>,
          "part": "<题号含字母后缀（如 2a/2b）时填字母（'a'），否则 null>",
          "type": "fill_blank | sentence_completion | short_answer | transformation | multiple_choice | matching",
          "prompt": "<题干文本，逐字抄写，填空用 ______ 表示>",
          "options": ["A. ...", "B. ..."] 或 null,
          "answer": "<页面上已预填/已写出的答案文字逐字抄写；未作答留空字符串>",
          "answerNote": null
        }
      ]
    }
  ]
}

**严格规则**：
1. 逐字抄写，不改写不补充不遗漏；练习指令原文照抄
2. 题号按书上印刷编号，不要自行重新编号
3. 配图题：把插图内容（场景、人物、标注文字）描述进 prompt 文本，让题目脱离图片也能读懂
4. 一空多答案的 answer 用英文逗号加空格 ", " 分隔各空答案；单个空的多个可接受答案用 " / " 分隔
5. 每个编号题目都要输出；选择题 options 只在组内第一题写一次
6. 页面上预填的例句/示例题（原书已给出完整答案的题目）照常输出，answer 填入页面印刷的答案文字；未作答的题目 answer 留空，**不要自行推断答案**
7. 题型选择：填词用 fill_blank；补全对话/句意用 sentence_completion；选字母答 matching/选择用 matching/multiple_choice；改写句子用 transformation；短答用 short_answer
8. contentRegion 框住全部练习内容（含页眉与角落印刷页码）的最小矩形，坐标归一化到 0-1000，宁可略宽不可切到内容
9. 不要输出 bookPage/contentRegion/exercises 以外的字段`

/** 学习指导内容页：三列定位（题号 / 题目选项 / 右侧 STUDY UNIT），逐题转写（答案由 answers-guide 注入） */
const GUIDE_PAGE_PROMPT = `你是一位英语语法教材**学习指导页**的结构化转写专家。本页是书尾《学习指导》中的一页。页面主体是四选一/五选一的选择题，不推断答案。

**版面三列定位规则**：
1. 最左列 = 点分题号（如 "1.1"、"2.5"：前段 = 语法专题编号，后段 = 专题内题号）
2. 中间 = 题干与选项（选项以 A B C D（部分题有 E）标注）
3. 最右侧深色竖栏 "STUDY UNIT" 下的数字 = 该题对应的学习单元号（如 "3, 23"），逐题对齐提取为 studyUnits 数组
4. 页面可能含多个语法专题：每个专题有加粗中文标题（如 "一般现在时"），同专题题目共享一个 section；一个专题可能跨页，本页只输出本页可见的部分
5. 若页首有《学习指导》中文使用说明文字（仅学习指导开篇页有），转写为 intro（每条规则一段）；没有则输出空数组

**输出要求**: 严格输出 JSON（不要 markdown 代码块包裹）：

{
  "bookPage": <页面角落标注的印刷页码数字>,
  "contentRegion": [x1, y1, x2, y2],
  "intro": ["<使用说明段落文字，逐字抄写>"],
  "sections": [
    {
      "sectionNumber": <专题编号数字（点分题号前段）>,
      "topicZh": "<专题中文标题，逐字抄写>",
      "items": [
        {
          "number": <专题内题号数字（点分题号后段）>,
          "prompt": "<题干文本，逐字抄写，填空用 ______ 表示>",
          "options": ["A ...", "B ...", "C ...", "D ..."],
          "studyUnits": [<右侧 STUDY UNIT 数字，多个逗号分隔时逐个列出>]
        }
      ]
    }
  ]
}

**严格规则**：
1. 逐字抄写题干与选项，不改写不省略；选项保留字母前缀（"A ..."）
2. 每道题的 studyUnits 必须与右侧 STUDY UNIT 栏逐题对齐，不得串行；看不清的宁缺勿错时输出空数组并照常输出题目
3. 题目跨页时本页只输出本页可见题目，不要猜测下一页内容
4. contentRegion 框住全部题目内容（含角落印刷页码）的最小矩形，坐标归一化到 0-1000，宁可略宽不可切到内容
5. 不要输出 bookPage/contentRegion/intro/sections 以外的字段`

/** 学习指导答案页：按语法专题组织，点分题号 + 字母答案（可能多个字母） */
const GUIDE_ANSWERS_PROMPT = `你是一位英语语法教材**学习指导答案页**的结构化转写专家。本页是书尾《学习指导答案》中的一页（页面顶部有"学习指导答案"标题）。

**页面结构**：分栏排版，按语法专题组织——每个专题有加粗中文标题（如 "一般现在时"、"介词"），其下是逐题答案，题号为点分形式（如 "1.1"、"16.19"：前段 = 专题编号，后段 = 题号），答案为选项字母。页面可能从上一个专题的中间开始。

**输出要求**: 严格输出 JSON（不要 markdown 代码块包裹）：

{
  "bookPage": <页面角落标注的印刷页码数字>,
  "answers": [
    {
      "guide": <专题编号数字（点分题号前段）>,
      "item": <题号数字（点分题号后段）>,
      "answer": "<答案字母，逐字抄写>"
    }
  ]
}

**严格规则**：
1. 专题标题切换后，后续答案归属新专题，直到下一个标题出现
2. 每条点分题号答案都要输出，不遗漏不合并
3. 多选答案保持原书形式逐字抄写（如 "C,D" 或 "A,B,D"），不要自行增删空格
4. 不要输出 bookPage/answers 以外的字段`

/** 通用页面提取（支持自定义 prompt） */
async function extractFromImage(imagePath, pdfPage, apiKey, baseUrl, prompt = EXTRACTION_PROMPT) {
  const base64 = readFileSync(imagePath).toString('base64')
  let lastError = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      console.log(`[p.${pdfPage}] 调用 ${VISION_MODEL}${attempt > 1 ? `（第 ${attempt} 次重试）` : ''}...`)
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: VISION_MODEL,
          max_tokens: 16384,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
                { type: 'text', text: prompt },
              ],
            },
          ],
        }),
      })
      if (!response.ok) {
        throw new Error(`API ${response.status}: ${await response.text()}`)
      }
      const result = await response.json()
      const raw = (result.choices?.[0]?.message?.content ?? '').trim()
      if (!raw) throw new Error('模型返回空内容')
      let cleaned = raw
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
      }
      const usage = result.usage ?? {}
      console.log(
        `[p.${pdfPage}] ✓ 提取完成（tokens: ${usage.prompt_tokens ?? '?'} in / ${usage.completion_tokens ?? '?'} out）`,
      )
      return JSON.parse(cleaned)
    } catch (err) {
      lastError = err
      if (attempt < 3) await sleep(1500 * 2 ** (attempt - 1))
    }
  }
  throw new Error(`[p.${pdfPage}] 提取失败（已重试 3 次）: ${lastError.message}`)
}

// ── unit assembly ─────────────────────────────────────────────────────────────

/**
 * 校验 LLM 输出的 contentRegion：4 个整数、归一化 0-1000、x1<x2 且 y1<y2，
 * 否则返回 null（旧数据 / 模型漏输出时静默忽略，crash-proof）。
 */
function normalizeContentRegion(raw) {
  if (!Array.isArray(raw) || raw.length !== 4) return null
  const nums = raw.map(Number)
  if (!nums.every((n) => Number.isFinite(n) && n >= 0 && n <= 1000)) return null
  const [x1, y1, x2, y2] = nums.map(Math.round)
  if (x2 <= x1 || y2 <= y1) return null
  return [x1, y1, x2, y2]
}

function assembleUnit(unitNumber, pageResults, pageMap, book) {
  const lessonPages = pageResults.filter((p) => (p.data.sections ?? []).length > 0 || (p.data.crossReferences ?? []).length > 0)
  const exercisePages = pageResults.filter((p) => (p.data.exercises ?? []).length > 0)
  // 元数据以讲解页为准，缺失时用练习页
  const meta = lessonPages[0]?.data ?? exercisePages[0]?.data ?? {}

  const sections = []
  for (const page of lessonPages) {
    // page-map 有明确书内页码时优先使用（LLM 容易把 PDF 页码误当印刷页码）
    const bookPage = page.fromMap ? page.expectedBookPage : (typeof page.data.bookPage === 'number' ? page.data.bookPage : page.expectedBookPage)
    if (!page.fromMap && typeof page.data.bookPage === 'number' && page.data.bookPage !== page.expectedBookPage) {
      console.warn(`⚠ unit ${unitNumber}: p.${page.pdfPage} LLM 提取页码 ${page.data.bookPage} 与期望 ${page.expectedBookPage} 不一致（WARN，不中止）`)
    }
    for (const section of page.data.sections ?? []) {
      sections.push({ ...section, bookPage })
    }
  }
  const crossReferences = lessonPages.flatMap((p) => p.data.crossReferences ?? [])

  const exercises = []
  for (const page of exercisePages) {
    const bookPage = page.fromMap ? page.expectedBookPage : (typeof page.data.bookPage === 'number' ? page.data.bookPage : page.expectedBookPage)
    for (const group of page.data.exercises ?? []) {
      exercises.push({ ...group, bookPage })
    }
  }

  for (const data of pageResults.map((p) => p.data)) {
    if (data.unitNumber !== unitNumber) {
      console.warn(`⚠ unit ${unitNumber}: 提取结果的 unitNumber=${data.unitNumber} 与请求不一致（WARN）`)
    }
  }

  // ── 页码二次校验 ──────────────────────────────────────────────────────────
  // 对每页检查 LLM 提取的 bookPage 是否与期望值一致
  let pageVerifyOk = true
  for (const p of pageResults) {
    const llmPage = typeof p.data.bookPage === 'number' ? p.data.bookPage : null
    if (llmPage === null) continue
    // LLM 值与期望一致 → 通过
    if (llmPage === p.expectedBookPage) continue
    // LLM 值 = PDF 页码（常见错误：LLM 把 PDF 页码误当印刷页码）
    if (llmPage === p.pdfPage) {
      console.warn(`⚠ unit ${unitNumber}: p.${p.pdfPage} LLM 把 PDF 页码 ${llmPage} 误当书内页码（期望 ${p.expectedBookPage}），已用 page-map 纠正`)
      continue
    }
    // 都不匹配 → 严重警告
    pageVerifyOk = false
    console.error(`❌ unit ${unitNumber}: p.${p.pdfPage} 页码校验失败！LLM=${llmPage} 期望=${p.expectedBookPage} PDF=${p.pdfPage}，请检查 page-map 或手动核对原书`)
  }
  // 跨页连续性检查：两页的书内页码应为连续数
  if (pageResults.length >= 2) {
    const bookPages = pageResults.map((p) => p.fromMap ? p.expectedBookPage : (typeof p.data.bookPage === 'number' ? p.data.bookPage : p.expectedBookPage))
    for (let i = 1; i < bookPages.length; i += 1) {
      if (bookPages[i] !== bookPages[i - 1] + 1) {
        pageVerifyOk = false
        console.error(`❌ unit ${unitNumber}: 书内页码不连续 [${bookPages.join(', ')}]，请检查 page-map`)
      }
    }
  }
  if (pageVerifyOk) {
    console.log(`✓ unit ${unitNumber}: 页码校验通过`)
  }
  if (sections.length === 0 && exercises.length === 0) {
    throw new Error(`unit ${unitNumber}: lesson 与 exercises 均为空，拒绝入库`)
  }

  // page_images: 每页对应一张 Storage 图片，type 按内容判定
  const unitPad = String(unitNumber).padStart(3, '0')
  const pageImages = pageResults.map((p) => {
    const pagePad = String(p.pdfPage).padStart(4, '0')
    const bookPage = p.fromMap ? p.expectedBookPage : (typeof p.data.bookPage === 'number' ? p.data.bookPage : p.expectedBookPage)
    const hasSections = (p.data.sections ?? []).length > 0
    const hasExercises = (p.data.exercises ?? []).length > 0
    // sections 优先判定 lesson；纯练习页为 exercise；仅有 crossRefs 时归 lesson
    const type = hasSections ? 'lesson' : hasExercises ? 'exercise' : 'lesson'
    // 内容区域坐标（新提取的页才有；旧数据无此字段，渲染端缺省回退整页）
    const region = normalizeContentRegion(p.data.contentRegion)
    if (region === null && Array.isArray(p.data.contentRegion)) {
      console.warn(`⚠ unit ${unitNumber}: p.${p.pdfPage} contentRegion 非法 ${JSON.stringify(p.data.contentRegion)}，已忽略`)
    }
    return {
      page: bookPage,
      path: `${book}/unit${unitPad}/page-${pagePad}.png`,
      type,
      ...(region ? { crop: { x1: region[0], y1: region[1], x2: region[2], y2: region[3] } } : {}),
    }
  })

  return {
    book,
    unit_number: unitNumber,
    title: meta.title ?? `Unit ${unitNumber}`,
    title_zh: meta.titleZh ?? '',
    category: meta.category ?? '',
    category_zh: meta.categoryZh ?? '',
    difficulty: meta.difficulty ?? 1,
    book_pages: pageMap.book,
    page_images: pageImages,
    lesson: { sections, crossReferences },
    exercises,
  }
}

// ── backmatter assembly ─────────────────────────────────────────────────

const BACKMATTER_PROMPT_BY_KIND = {
  appendix: APPENDIX_PROMPT,
  // supp / guide 专用 Prompt 在对应阶段补充
}

/** 书页码 = PDF 页 - 7（essential 已验证规律） */
const BOOK_PAGE_OFFSET = 7

function assembleBackmatter(entry, pageResults, book) {
  const sections = []
  const crossReferences = []
  const exercises = []
  let pageVerifyOk = true
  for (const page of pageResults) {
    const bookPage = page.pdfPage - BOOK_PAGE_OFFSET
    const llmPage = typeof page.data.bookPage === 'number' ? page.data.bookPage : null
    if (llmPage !== null && llmPage !== bookPage) {
      if (llmPage === page.pdfPage) {
        console.warn(`⚠ ${entry.key}: p.${page.pdfPage} LLM 把 PDF 页码误当书内页码（期望 ${bookPage}），已纠正`)
      } else {
        pageVerifyOk = false
        console.error(`❌ ${entry.key}: p.${page.pdfPage} 页码校验失败！LLM=${llmPage} 期望=${bookPage}`)
      }
    }
    for (const section of page.data.sections ?? []) sections.push({ ...section, bookPage })
    crossReferences.push(...(page.data.crossReferences ?? []))
    for (const group of page.data.exercises ?? []) exercises.push({ ...group, bookPage })
  }
  if (pageVerifyOk) console.log(`✓ ${entry.key}: 页码校验通过`)
  if (sections.length === 0 && exercises.length === 0) {
    throw new Error(`${entry.key}: sections 与 exercises 均为空，拒绝入库`)
  }

  const pageImages = pageResults.map((p) => {
    const region = normalizeContentRegion(p.data.contentRegion)
    if (region === null && Array.isArray(p.data.contentRegion)) {
      console.warn(`⚠ ${entry.key}: p.${p.pdfPage} contentRegion 非法 ${JSON.stringify(p.data.contentRegion)}，已忽略`)
    }
    return {
      page: p.pdfPage - BOOK_PAGE_OFFSET,
      path: `${book}/${entry.key}/page-${String(p.pdfPage).padStart(4, '0')}.png`,
      type: entry.kind === 'supp' ? 'exercise' : 'lesson',
      ...(region ? { crop: { x1: region[0], y1: region[1], x2: region[2], y2: region[3] } } : {}),
    }
  })

  return {
    book,
    unit_number: entry.unit,
    title: entry.title,
    title_zh: '',
    category: CATEGORY_BY_KIND[entry.kind] ?? '',
    category_zh: entry.categoryZh ?? '',
    difficulty: 1,
    book_pages: entry.pdf.map((p) => p - BOOK_PAGE_OFFSET),
    page_images: pageImages,
    lesson: { sections, crossReferences },
    exercises,
  }
}

// ── supp assembly ─────────────────────────────────────────────────────

/** 读取 supp-pages 全部页面缓存（按 PDF 页码排序） */
function loadSuppPageCache(book) {
  const dir = resolve(UNITS_BASE_DIR, book, 'supp-pages')
  if (!existsSync(dir)) {
    throw new Error('缺少补充练习内容页缓存，请先执行 --backmatter supp-pages')
  }
  const files = readdirSync(dir).filter((f) => /^page-\d{4}\.json$/.test(f)).sort()
  if (files.length === 0) {
    throw new Error(`supp-pages 目录为空: ${dir}，请先执行 --backmatter supp-pages`)
  }
  return files.map((f) => {
    const pdfPage = Number(/(\d{4})/.exec(f)?.[1])
    return { pdfPage, data: JSON.parse(readFileSync(resolve(dir, f), 'utf8')) }
  })
}

/** 跨页展平练习块：续排块（exNumber=null）归属上一页最后一个练习编号 */
function flattenSuppBlocks(pages) {
  const blocks = []
  let lastEx = null
  for (const { pdfPage, data } of pages) {
    for (const ex of data.exercises ?? []) {
      const exNumber = typeof ex.exNumber === 'number' ? ex.exNumber : lastEx
      if (exNumber === null) {
        console.warn(`⚠ supp-pages p.${pdfPage}: 首位续排块无法确定归属（前文无练习编号），已跳过`)
        continue
      }
      blocks.push({ pdfPage, exNumber, ex })
      lastEx = exNumber
    }
  }
  return blocks
}

/** 用 _keys/answers-supp.json 的官方答案填充题目；按（题号 + 出现顺序）消费，兼容重复题号的多部分练习 */
function injectSuppAnswers(exNumber, items, book) {
  const answersPath = resolve(UNITS_BASE_DIR, book, KEYS_DIR_NAME, 'answers-supp.json')
  if (!existsSync(answersPath)) {
    console.warn(`⚠ ${answersPath} 不存在，跳过答案注入（请先执行 --backmatter answers-supp）`)
    return
  }
  const official = JSON.parse(readFileSync(answersPath, 'utf8')).answers.filter((a) => a.exNumber === exNumber)
  const pool = official.map((a) => ({ ...a, used: false }))
  let injected = 0
  const unmatched = []
  for (const item of items) {
    // 同句多空题（按句聚合，number = 句内首个空编号，prompt 带 (n) 编号空）：按连续编号 n…n+k-1 逐空消费官方答案；
    // 无编号空的练习（每条官方答案自带 " ... " 多空分隔）：仅按同题号消费，避免误吞邻题
    // 其余情形：同题号多条答案（如对话填空）按出现顺序消费
    const blanks = (item.prompt.match(/______/g) ?? []).length
    const numberedBlanks = (item.prompt.match(/\(\d+\)\s*______/g) ?? []).length
    let hits = []
    if (blanks >= 2 && numberedBlanks === blanks) {
      // 先探测再标记，避免部分命中时误消费
      const candidates = []
      for (let num = item.number; num < item.number + blanks; num += 1) {
        const a = pool.find((x) => !x.used && x.item === num && !candidates.includes(x))
        if (!a) break
        candidates.push(a)
      }
      if (candidates.length === blanks) {
        for (const a of candidates) {
          a.used = true
          hits.push(a.answer.trim())
        }
      }
    }
    if (hits.length === 0) {
      for (const a of pool) {
        if (!a.used && a.item === item.number) {
          a.used = true
          hits.push(a.answer.trim())
        }
      }
    }
    if (hits.length === 0) {
      unmatched.push(item.number)
      continue
    }
    injected += 1
    // 官方答案页用 " ... " 分隔同题多空（如 "was built ... is used"），归一为约定的 ", "
    const officialAnswer = hits.join(', ').split(' ... ').join(', ')
    const pageAnswer = (item.answer ?? '').trim()
    if (pageAnswer && officialAnswer && pageAnswer !== officialAnswer) {
      console.warn(`⚠ 补充练习 ${exNumber} 题 ${item.number}: 页面预填 "${pageAnswer.slice(0, 40)}" ≠ 官方 "${officialAnswer.slice(0, 40)}"，采用官方答案`)
    }
    item.answer = officialAnswer
  }
  const leftovers = pool.filter((a) => !a.used)
  if (leftovers.length > 0) {
    console.warn(`⚠ 补充练习 ${exNumber}: 官方答案未匹配到题目 ${leftovers.map((a) => `#${a.item}`).join(', ')}（可能漏题/题号错位，需人工核对）`)
  }
  if (unmatched.length > 0) {
    console.log(`ℹ 补充练习 ${exNumber}: 无官方答案的题 ${unmatched.join(',')}（多为原书预填示例题，保留页面答案）`)
  }
  console.log(`✓ 补充练习 ${exNumber}: 官方答案注入 ${injected}/${items.length} 题`)
}

/** 组装单条补充练习条目（延展位 122 + exNumber）：跨页合并 + 答案注入 */
function assembleSupp(entry, book) {
  const blocks = flattenSuppBlocks(loadSuppPageCache(book)).filter((b) => b.exNumber === entry.exNumber)
  if (blocks.length === 0) {
    throw new Error(`${entry.key}: 练习 ${entry.exNumber} 未在内容页缓存中找到（先执行 --backmatter supp-pages）`)
  }

  const items = []
  let instruction = ''
  const pdfPages = []
  for (const b of blocks) {
    if (!instruction && b.ex.instruction) instruction = b.ex.instruction
    if (!pdfPages.includes(b.pdfPage)) pdfPages.push(b.pdfPage)
    for (const it of b.ex.items ?? []) items.push({ ...it, bookPage: b.pdfPage - BOOK_PAGE_OFFSET })
  }
  if (items.length === 0) throw new Error(`${entry.key}: 练习 ${entry.exNumber} 无题目，拒绝组装`)

  // 题号重复检查（多部分练习允许：仅提醒）
  const numCount = new Map()
  for (const it of items) numCount.set(it.number, (numCount.get(it.number) ?? 0) + 1)
  const dupNums = [...numCount.entries()].filter(([, c]) => c > 1).map(([n]) => n)
  if (dupNums.length > 0) console.log(`ℹ ${entry.key}: 题号重复 ${dupNums.join(',')}（多部分练习，按顺序对齐答案）`)

  injectSuppAnswers(entry.exNumber, items, book)

  const exercises = [{
    section: String(entry.exNumber),
    instruction,
    items,
    bookPage: pdfPages[0] - BOOK_PAGE_OFFSET,
  }]
  const pageImages = pdfPages.map((p) => ({
    page: p - BOOK_PAGE_OFFSET,
    path: `${book}/supp-pages/page-${String(p).padStart(4, '0')}.png`,
    type: 'exercise',
  }))

  return {
    book,
    unit_number: entry.unit,
    title: entry.title,
    title_zh: '',
    category: CATEGORY_BY_KIND.supp,
    category_zh: entry.categoryZh ?? '补充练习',
    difficulty: 1,
    book_pages: pdfPages.map((p) => p - BOOK_PAGE_OFFSET),
    page_images: pageImages,
    units: entry.suppUnits ?? [],
    lesson: { sections: [], crossReferences: [] },
    exercises,
  }
}

// ── guide assembly ──────────────────────────────────────────────

/** 用 _keys/answers-guide.json 的官方答案填充学习指导题目（按 专题编号 + 题号 匹配） */
function injectGuideAnswers(items, book, entryKey) {
  const answersPath = resolve(UNITS_BASE_DIR, book, KEYS_DIR_NAME, 'answers-guide.json')
  if (!existsSync(answersPath)) {
    console.warn(`⚠ ${answersPath} 不存在，跳过答案注入（请先执行 --backmatter answers-guide）`)
    return
  }
  const pool = JSON.parse(readFileSync(answersPath, 'utf8')).answers.map((a) => ({ ...a, used: false }))
  let injected = 0
  for (const item of items) {
    const hit = pool.find((a) => !a.used && a.guide === item.sectionNumber && a.item === item.number)
    if (!hit) {
      console.warn(`⚠ ${entryKey} ${item.sectionNumber}.${item.number}: 无官方答案，保留空答案`)
      continue
    }
    hit.used = true
    injected += 1
    // 多选答案原书形如 "C,D"，归一为 ", " 分隔
    item.answer = String(hit.answer).trim().split(',').map((s) => s.trim()).filter(Boolean).join(', ')
  }
  // 跨页专题的答案消费情况无法逐页判定（前页/后页都可能持有对应题目），
  // 逐页不报未消费告警；全量组装后用全局审计核对（官方答案 ↔ 题目双向覆盖）
  console.log(`✓ ${entryKey}: 官方答案注入 ${injected}/${items.length} 题`)
}

/** 组装单条学习指导条目（按页，延展位 158-169）：页面提取 + 答案注入 */
async function assembleGuide(entry, opts, env) {
  const book = opts.book
  const bookCfg = getBookConfig(book)
  const apiKey = env.AI_EMBED_API_KEY
  const baseUrl = env.AI_EMBED_BASE_URL
  if (!apiKey || !baseUrl) {
    throw new Error('提取需要 AI_EMBED_API_KEY 与 AI_EMBED_BASE_URL（apps/web/.env.local）')
  }
  const entryDir = resolve(UNITS_BASE_DIR, book, entry.key)
  mkdirSync(entryDir, { recursive: true })

  const pdfPage = entry.pdf[0]
  const rawJsonPath = resolve(entryDir, `page-${String(pdfPage).padStart(4, '0')}.json`)
  let data
  if (!opts.force && existsSync(rawJsonPath)) {
    console.log(`[p.${pdfPage}] 使用缓存 ${rawJsonPath}`)
    data = JSON.parse(readFileSync(rawJsonPath, 'utf8'))
  } else {
    const imagePath = renderPdfPage(pdfPage, opts.force, bookCfg.pdf)
    data = await extractFromImage(imagePath, pdfPage, apiKey, baseUrl, GUIDE_PAGE_PROMPT)
    writeFileSync(rawJsonPath, JSON.stringify(data, null, 2) + '\n')
  }

  const bookPage = pdfPage - BOOK_PAGE_OFFSET
  const llmPage = typeof data.bookPage === 'number' ? data.bookPage : null
  if (llmPage !== null && llmPage !== bookPage) {
    console.warn(`⚠ ${entry.key}: 页码校验 LLM=${llmPage} 期望=${bookPage}${llmPage === pdfPage ? '（PDF 页码误当书页码，已纠正）' : '，请人工核对'}`)
  }

  const sectionsRaw = data.sections ?? []
  if (sectionsRaw.length === 0) throw new Error(`${entry.key}: 未提取到任何专题/题目，拒绝组装`)

  const exercises = []
  const allItems = []
  for (const sec of sectionsRaw) {
    const items = (sec.items ?? []).map((it) => ({
      number: it.number,
      type: 'multiple_choice',
      prompt: String(it.prompt ?? '').trim(),
      options: Array.isArray(it.options) ? it.options : [],
      answer: '',
      studyUnits: Array.isArray(it.studyUnits) ? it.studyUnits.map(Number).filter((n) => Number.isFinite(n)) : [],
      sectionNumber: sec.sectionNumber,
    }))
    allItems.push(...items)
    exercises.push({ section: String(sec.topicZh ?? sec.sectionNumber), instruction: '', items, bookPage })
  }
  injectGuideAnswers(allItems, book, entry.key)
  // sectionNumber 是注入用的临时字段，不入 DB
  for (const it of allItems) delete it.sectionNumber

  // 开篇使用说明（仅学习指导首页有）转写为讲解 section
  const lessonSections = []
  if (Array.isArray(data.intro) && data.intro.length > 0) {
    lessonSections.push({
      label: null,
      title: '学习指导使用说明',
      bookPage,
      blocks: data.intro.map((text) => ({ type: 'rule_text', text: String(text) })),
    })
  }

  return {
    book,
    unit_number: entry.unit,
    title: entry.title,
    title_zh: '',
    category: CATEGORY_BY_KIND.guide,
    category_zh: entry.categoryZh ?? '学习指导',
    difficulty: 1,
    book_pages: [bookPage],
    page_images: [{
      page: bookPage,
      path: `${book}/${entry.key}/page-${String(pdfPage).padStart(4, '0')}.png`,
      type: 'exercise',
      ...(() => {
        const region = normalizeContentRegion(data.contentRegion)
        return region ? { crop: { x1: region[0], y1: region[1], x2: region[2], y2: region[3] } } : {}
      })(),
    }],
    lesson: { sections: lessonSections, crossReferences: [] },
    exercises,
  }
}

async function processBackmatter(entry, opts, env) {
  // 补充练习内容页扫描：逐页提取落盘 supp-pages/page-*.json（纯缓存，不入库），末尾打印练习分布
  if (entry.kind === 'scan') {
    const book = opts.book
    const bookCfg = getBookConfig(book)
    const apiKey = env.AI_EMBED_API_KEY
    const baseUrl = env.AI_EMBED_BASE_URL
    if (!apiKey || !baseUrl) {
      throw new Error('提取需要 AI_EMBED_API_KEY 与 AI_EMBED_BASE_URL（apps/web/.env.local）')
    }
    const entryDir = resolve(UNITS_BASE_DIR, book, entry.key)
    mkdirSync(entryDir, { recursive: true })
    const summary = []
    for (const pdfPage of entry.pdf) {
      const rawJsonPath = resolve(entryDir, `page-${String(pdfPage).padStart(4, '0')}.json`)
      let data
      if (!opts.force && existsSync(rawJsonPath)) {
        console.log(`[p.${pdfPage}] 使用缓存 ${rawJsonPath}`)
        data = JSON.parse(readFileSync(rawJsonPath, 'utf8'))
      } else {
        const imagePath = renderPdfPage(pdfPage, opts.force, bookCfg.pdf)
        data = await extractFromImage(imagePath, pdfPage, apiKey, baseUrl, SUPP_PAGE_PROMPT)
        writeFileSync(rawJsonPath, JSON.stringify(data, null, 2) + '\n')
      }
      const exLabels = (data.exercises ?? []).map((g) => (typeof g.exNumber === 'number' ? String(g.exNumber) : '↤续排'))
      summary.push(`p.${pdfPage}（书 ${pdfPage - BOOK_PAGE_OFFSET}）: ${exLabels.join(', ') || '（无练习）'}`)
    }
    console.log('\n── 补充练习页面扫描结果 ──')
    for (const line of summary) console.log(line)
    return
  }

  // 补充练习单条组装：从 supp-pages 缓存按练习编号切分，跨页合并，注入官方答案
  if (entry.kind === 'supp' && !opts.uploadOnly) {
    const row = assembleSupp(entry, opts.book)
    const entryDir = resolve(UNITS_BASE_DIR, opts.book, entry.key)
    mkdirSync(entryDir, { recursive: true })
    writeFileSync(resolve(entryDir, 'exercise.json'), JSON.stringify(row.exercises, null, 2) + '\n')
    writeFileSync(resolve(entryDir, 'unit.json'), JSON.stringify(row, null, 2) + '\n')
    console.log(`✓ ${entry.key} JSON 已落地: ${row.exercises[0].items.length} 题 / ${row.book_pages.length} 页（title: ${row.title}，units: ${row.units.join(',')}）`)
    if (!opts.noUpload) {
      for (const img of row.page_images) {
        const match = /page-(\d+)\.png$/.exec(img.path)
        if (!match) continue
        const localPath = resolve(PAGES_DIR, `page-${String(Number(match[1])).padStart(4, '0')}.png`)
        if (!existsSync(localPath)) {
          console.warn(`⚠ 本地 PNG 不存在: ${localPath}，跳过上传`)
          continue
        }
        await uploadPageImage(localPath, img.path, env)
      }
      await upsertUnit(row, env)
    }
    return
  }

  // 练习表：提取页首表格落盘 _keys/supp-index.json（纯数据，不入库）
  if (entry.kind === 'index') {
    const book = opts.book
    const bookCfg = getBookConfig(book)
    const apiKey = env.AI_EMBED_API_KEY
    const baseUrl = env.AI_EMBED_BASE_URL
    if (!apiKey || !baseUrl) {
      throw new Error('提取需要 AI_EMBED_API_KEY 与 AI_EMBED_BASE_URL（apps/web/.env.local）')
    }
    const entryDir = resolve(UNITS_BASE_DIR, book, entry.key)
    mkdirSync(entryDir, { recursive: true })
    const rows = []
    for (const pdfPage of entry.pdf) {
      const rawJsonPath = resolve(entryDir, `page-${String(pdfPage).padStart(4, '0')}.json`)
      let data
      if (!opts.force && existsSync(rawJsonPath)) {
        console.log(`[p.${pdfPage}] 使用缓存 ${rawJsonPath}`)
        data = JSON.parse(readFileSync(rawJsonPath, 'utf8'))
      } else {
        const imagePath = renderPdfPage(pdfPage, opts.force, bookCfg.pdf)
        data = await extractFromImage(imagePath, pdfPage, apiKey, baseUrl, SUPP_INDEX_PROMPT)
        writeFileSync(rawJsonPath, JSON.stringify(data, null, 2) + '\n')
      }
      rows.push(...(data.rows ?? []))
    }
    const keysDir = resolve(UNITS_BASE_DIR, book, KEYS_DIR_NAME)
    mkdirSync(keysDir, { recursive: true })
    const outPath = resolve(keysDir, `${entry.key}.json`)
    writeFileSync(outPath, JSON.stringify({ key: entry.key, totalRows: rows.length, rows }, null, 2) + '\n')
    console.log(`✓ ${entry.key}: ${rows.length} 行练习表已落盘 ${outPath}`)
    return
  }

  // 答案页：结构化提取后合并落盘 _keys/<key>.json（纯数据，不入库）
  if (entry.kind === 'answers') {
    const book = opts.book
    const bookCfg = getBookConfig(book)
    const apiKey = env.AI_EMBED_API_KEY
    const baseUrl = env.AI_EMBED_BASE_URL
    if (!apiKey || !baseUrl) {
      throw new Error('提取需要 AI_EMBED_API_KEY 与 AI_EMBED_BASE_URL（apps/web/.env.local）')
    }
    const entryDir = resolve(UNITS_BASE_DIR, book, entry.key)
    mkdirSync(entryDir, { recursive: true })
    const answers = []
    for (const pdfPage of entry.pdf) {
      const rawJsonPath = resolve(entryDir, `page-${String(pdfPage).padStart(4, '0')}.json`)
      let data
      if (!opts.force && existsSync(rawJsonPath)) {
        console.log(`[p.${pdfPage}] 使用缓存 ${rawJsonPath}`)
        data = JSON.parse(readFileSync(rawJsonPath, 'utf8'))
      } else {
        const imagePath = renderPdfPage(pdfPage, opts.force, bookCfg.pdf)
        const prompt = entry.key === 'answers-supp' ? SUPP_ANSWERS_PROMPT : entry.key === 'answers-guide' ? GUIDE_ANSWERS_PROMPT : ANSWERS_PROMPT
        data = await extractFromImage(imagePath, pdfPage, apiKey, baseUrl, prompt)
        writeFileSync(rawJsonPath, JSON.stringify(data, null, 2) + '\n')
      }
      for (const a of data.answers ?? []) answers.push({ ...a, pdfPage })
    }
    answers.sort((x, y) => ((x.unit ?? x.guide ?? 0) - (y.unit ?? y.guide ?? 0)) || String(x.exercise ?? 0).localeCompare(String(y.exercise ?? 0), undefined, { numeric: true }) || (x.item - y.item))
    const keysDir = resolve(UNITS_BASE_DIR, book, KEYS_DIR_NAME)
    mkdirSync(keysDir, { recursive: true })
    const outPath = resolve(keysDir, `${entry.key}.json`)
    writeFileSync(outPath, JSON.stringify({ key: entry.key, total: answers.length, answers }, null, 2) + '\n')
    console.log(`✓ ${entry.key}: ${answers.length} 条答案已落盘 ${outPath}`)
    return
  }

  // 学习指导按页组装：页面提取 + 答案注入（需先执行 --backmatter answers-guide）
  if (entry.kind === 'guide' && !opts.uploadOnly) {
    const row = await assembleGuide(entry, opts, env)
    const entryDir = resolve(UNITS_BASE_DIR, opts.book, entry.key)
    mkdirSync(entryDir, { recursive: true })
    writeFileSync(resolve(entryDir, 'exercise.json'), JSON.stringify(row.exercises, null, 2) + '\n')
    writeFileSync(resolve(entryDir, 'unit.json'), JSON.stringify(row, null, 2) + '\n')
    console.log(`✓ ${entry.key} JSON 已落地: ${row.exercises.reduce((s, g) => s + g.items.length, 0)} 题 / ${row.exercises.length} 专题（title: ${row.title}）`)
    if (!opts.noUpload) {
      for (const img of row.page_images) {
        const match = /page-(\d+)\.png$/.exec(img.path)
        if (!match) continue
        const localPath = resolve(PAGES_DIR, `page-${String(Number(match[1])).padStart(4, '0')}.png`)
        if (!existsSync(localPath)) {
          console.warn(`⚠ 本地 PNG 不存在: ${localPath}，跳过上传`)
          continue
        }
        await uploadPageImage(localPath, img.path, env)
      }
      await upsertUnit(row, env)
    }
    return
  }

  const book = opts.book
  const bookCfg = getBookConfig(book)
  const entryDir = resolve(UNITS_BASE_DIR, book, entry.key)
  mkdirSync(entryDir, { recursive: true })
  const unitJsonPath = resolve(entryDir, 'unit.json')

  if (opts.uploadOnly) {
    if (!existsSync(unitJsonPath)) {
      throw new Error(`${entry.key}: 未找到 ${unitJsonPath}，请先执行提取（去掉 --upload-only）`)
    }
    const row = JSON.parse(readFileSync(unitJsonPath, 'utf8'))
    for (const img of row.page_images) {
      const match = /page-(\d+)\.png$/.exec(img.path)
      if (!match) continue
      const localPath = resolve(PAGES_DIR, `page-${String(Number(match[1])).padStart(4, '0')}.png`)
      if (!existsSync(localPath)) {
        console.warn(`⚠ 本地 PNG 不存在: ${localPath}，跳过上传`)
        continue
      }
      await uploadPageImage(localPath, img.path, env)
    }
    await upsertUnit(row, env)
    return
  }

  const prompt = BACKMATTER_PROMPT_BY_KIND[entry.kind]
  if (!prompt) throw new Error(`${entry.key}: kind=${entry.kind} 的提取 Prompt 尚未实现`)
  const apiKey = env.AI_EMBED_API_KEY
  const baseUrl = env.AI_EMBED_BASE_URL
  if (!apiKey || !baseUrl) {
    throw new Error('提取需要 AI_EMBED_API_KEY 与 AI_EMBED_BASE_URL（apps/web/.env.local）')
  }

  const pageResults = []
  for (const pdfPage of entry.pdf) {
    const rawJsonPath = resolve(entryDir, `page-${String(pdfPage).padStart(4, '0')}.json`)
    let data
    if (!opts.force && existsSync(rawJsonPath)) {
      console.log(`[p.${pdfPage}] 使用缓存 ${rawJsonPath}`)
      data = JSON.parse(readFileSync(rawJsonPath, 'utf8'))
    } else {
      const imagePath = renderPdfPage(pdfPage, opts.force, bookCfg.pdf)
      data = await extractFromImage(imagePath, pdfPage, apiKey, baseUrl, prompt)
      writeFileSync(rawJsonPath, JSON.stringify(data, null, 2) + '\n')
    }
    pageResults.push({ pdfPage, data })
  }

  const row = assembleBackmatter(entry, pageResults, book)
  writeFileSync(resolve(entryDir, 'lesson.json'), JSON.stringify(row.lesson, null, 2) + '\n')
  writeFileSync(resolve(entryDir, 'exercise.json'), JSON.stringify(row.exercises, null, 2) + '\n')
  writeFileSync(unitJsonPath, JSON.stringify(row, null, 2) + '\n')
  console.log(`✓ ${entry.key} JSON 已落地: ${entryDir}`)

  if (!opts.noUpload) {
    for (const img of row.page_images) {
      const match = /page-(\d+)\.png$/.exec(img.path)
      if (!match) continue
      const localPath = resolve(PAGES_DIR, `page-${String(Number(match[1])).padStart(4, '0')}.png`)
      if (!existsSync(localPath)) {
        console.warn(`⚠ 本地 PNG 不存在: ${localPath}，跳过上传`)
        continue
      }
      await uploadPageImage(localPath, img.path, env)
    }
    await upsertUnit(row, env)
  }
}

// ── Storage upload ───────────────────────────────────────────────────────────

const STORAGE_BUCKET = 'grammar-pages'

async function uploadPageImage(imagePath, storagePath, env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('上传图片需要 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY')
  const imageBuf = readFileSync(imagePath)
  const response = await fetch(
    `${url}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`,
    {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
      },
      body: imageBuf,
    },
  )
  if (!response.ok) {
    throw new Error(`Storage 上传失败 ${storagePath}: ${response.status} ${await response.text()}`)
  }
  console.log(`✓ 图片已上传: ${STORAGE_BUCKET}/${storagePath}`)
}

async function uploadUnitImages(pageImages, pageResults, book, unitNumber, env) {
  const unitPad = String(unitNumber).padStart(3, '0')
  for (let i = 0; i < pageImages.length; i += 1) {
    const img = pageImages[i]
    const pdfPage = pageResults[i].pdfPage
    const stem = `page-${String(pdfPage).padStart(4, '0')}`
    const localPath = resolve(PAGES_DIR, `${stem}.png`)
    if (!existsSync(localPath)) {
      console.warn(`⚠ 本地 PNG 不存在: ${localPath}，跳过上传`)
      continue
    }
    await uploadPageImage(localPath, img.path, env)
  }
}

// ── upload ────────────────────────────────────────────────────────────────────

/** 降级列表：迁移 0028 未应用时逐列剔除扩展字段重试 */
const EXTENSION_COLUMNS = ['units', 'supp_entries', 'study_guide_units', 'search_text']

function missingColumnError(body) {
  if (!/column|PGRST204|42703/.test(body)) return null
  return EXTENSION_COLUMNS.find((col) => body.includes(col)) ?? null
}

async function upsertUnit(row, env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('入库需要 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY（apps/web/.env.local）')
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  let payload = {
    ...row,
    search_text: buildGrammarSearchText(row),
    updated_at: new Date().toISOString(),
  }

  // 策略：POST 纯插入（不带 on_conflict）→ 409 冲突说明行已存在，改 PATCH 全字段更新。
  // 不用 merge-duplicates upsert：本项目 PostgREST 对既有行的冲突检测失效，
  // 会走 INSERT 分支触发 title NOT NULL（23502）。
  for (;;) {
    const insert = await fetch(`${url}/rest/v1/grammar_units`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(payload),
    })
    if (insert.ok) break
    const insertBody = await insert.text()
    if (insert.status === 409 || /23505/.test(insertBody)) {
      // 行已存在：PATCH 全字段覆盖（幂等）
      const { book, unit_number, ...rest } = payload
      const patch = await fetch(
        `${url}/rest/v1/grammar_units?book=eq.${book}&unit_number=eq.${unit_number}`,
        {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal,count=exact' },
          body: JSON.stringify(rest),
        },
      )
      if (patch.ok) {
        const count = Number(patch.headers.get('content-range')?.split('/')[1] ?? NaN)
        if (count !== 1) throw new Error(`upsert 异常：PATCH 命中 ${count} 行（期望 1）`)
        break
      }
      const patchBody = await patch.text()
      const missing = missingColumnError(patchBody)
      if (missing) {
        console.warn(`⚠ unit ${row.unit_number}: ${missing} 列不存在（对应迁移未应用），降级为不带该列重试；请尽快应用迁移后重新 --upload-only`)
        const next = { ...payload }
        delete next[missing]
        payload = next
        continue
      }
      throw new Error(`upsert 失败 ${patch.status}: ${patchBody}`)
    }
    const missing = missingColumnError(insertBody)
    if (missing) {
      console.warn(`⚠ unit ${row.unit_number}: ${missing} 列不存在（对应迁移未应用），降级为不带该列重试；请尽快应用迁移后重新 --upload-only`)
      const next = { ...payload }
      delete next[missing]
      payload = next
      continue
    }
    throw new Error(`upsert 失败 ${insert.status}: ${insertBody}`)
  }
  console.log(`✓ unit ${row.unit_number} 已入库（title: ${row.title}，lesson sections: ${row.lesson.sections.length}，exercise groups: ${row.exercises.length}）`)
}

// ── per-unit flow ─────────────────────────────────────────────────────────────

async function processUnit(unitNumber, opts, env) {
  const bookCfg = getBookConfig(opts.book)
  const unitDir = resolve(UNITS_BASE_DIR, opts.book, `unit${String(unitNumber).padStart(3, '0')}`)
  mkdirSync(unitDir, { recursive: true })
  const unitJsonPath = resolve(unitDir, 'unit.json')

  if (opts.uploadOnly) {
    if (!existsSync(unitJsonPath)) {
      throw new Error(`unit ${unitNumber}: 未找到 ${unitJsonPath}，请先执行提取（去掉 --upload-only）`)
    }
    const row = JSON.parse(readFileSync(unitJsonPath, 'utf8'))
    // 上传原文图片到 Storage（如果本地 PNG 存在）
    if (Array.isArray(row.page_images) && row.page_images.length > 0) {
      for (const img of row.page_images) {
        const match = /page-(\d+)\.png$/.exec(img.path)
        if (!match) continue
        const pdfPage = Number(match[1])
        const localPath = resolve(PAGES_DIR, `page-${String(pdfPage).padStart(4, '0')}.png`)
        if (!existsSync(localPath)) {
          console.warn(`⚠ 本地 PNG 不存在: ${localPath}，跳过上传`)
          continue
        }
        await uploadPageImage(localPath, img.path, env)
      }
    }
    await upsertUnit(row, env)
    return
  }

  const pageMap = resolvePageMap(opts.book, unitNumber)
  const apiKey = env.AI_EMBED_API_KEY
  const baseUrl = env.AI_EMBED_BASE_URL
  if (!apiKey || !baseUrl) {
    throw new Error('提取需要 AI_EMBED_API_KEY 与 AI_EMBED_BASE_URL（apps/web/.env.local）')
  }

  const pageResults = []
  for (let i = 0; i < pageMap.pdf.length; i += 1) {
    const pdfPage = pageMap.pdf[i]
    const expectedBookPage = pageMap.book[i] ?? pdfPage
    const rawJsonPath = resolve(unitDir, `page-${String(pdfPage).padStart(4, '0')}.json`)
    let data
    if (!opts.force && existsSync(rawJsonPath)) {
      console.log(`[p.${pdfPage}] 使用缓存 ${rawJsonPath}`)
      data = JSON.parse(readFileSync(rawJsonPath, 'utf8'))
    } else {
      const imagePath = renderPdfPage(pdfPage, opts.force, bookCfg.pdf)
      data = await extractFromImage(imagePath, pdfPage, apiKey, baseUrl)
      writeFileSync(rawJsonPath, JSON.stringify(data, null, 2) + '\n')
    }
    pageResults.push({ pdfPage, expectedBookPage, fromMap: pageMap.fromMap, data })
  }

  const row = assembleUnit(unitNumber, pageResults, pageMap, opts.book)
  writeFileSync(resolve(unitDir, 'lesson.json'), JSON.stringify(row.lesson, null, 2) + '\n')
  writeFileSync(resolve(unitDir, 'exercise.json'), JSON.stringify(row.exercises, null, 2) + '\n')
  writeFileSync(unitJsonPath, JSON.stringify(row, null, 2) + '\n')
  console.log(`✓ unit ${unitNumber} JSON 已落地: ${unitDir}`)

  if (!opts.noUpload) {
    await uploadUnitImages(row.page_images, pageResults, opts.book, unitNumber, env)
    await upsertUnit(row, env)
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) return usage()
  const env = loadEnv()

  console.log('═'.repeat(60))
  if (opts.backmatterKeys.length > 0) {
    console.log(`Grammar Extract — book: ${opts.book}, backmatter: ${opts.backmatterKeys.join(', ')}${opts.uploadOnly ? '（upload-only）' : opts.noUpload ? '（no-upload）' : ''}`)
  } else {
    console.log(`Grammar Extract — book: ${opts.book}, units: ${opts.units.join(', ')}${opts.uploadOnly ? '（upload-only）' : opts.noUpload ? '（no-upload）' : ''}`)
  }
  console.log('═'.repeat(60))

  let failed = 0
  if (opts.backmatterKeys.length > 0) {
    if (opts.book !== 'essential' && !BACKMATTER_BY_BOOK[opts.book]) {
      throw new Error(`book "${opts.book}" 的书尾（backmatter）注册表尚未配置，接入该书时先在 BACKMATTER_BY_BOOK 补充`)
    }
    for (const key of opts.backmatterKeys) {
      const entry = findBackmatter(opts.book, key) ?? resolveSuppEntry(key, opts.book)
      if (!entry) {
        failed += 1
        console.error(`✗ ${key}: 不在 BACKMATTER 注册表（或需先生成练习表后动态注册）`)
        continue
      }
      try {
        await processBackmatter(entry, opts, env)
      } catch (err) {
        failed += 1
        console.error(`✗ ${key}: ${err.message}`)
      }
    }
  } else {
    for (const unitNumber of opts.units) {
      try {
        await processUnit(unitNumber, opts, env)
      } catch (err) {
        failed += 1
        console.error(`✗ unit ${unitNumber}: ${err.message}`)
      }
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} 个条目失败`)
    process.exit(1)
  }
  console.log('\n全部完成 🎉')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
