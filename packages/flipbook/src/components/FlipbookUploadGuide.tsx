import { FLIPBOOK_MAX_PAGES } from '../utils/flipbook-types'
import { formatCloudPageBasename } from '../utils/flipbook-naming'

export default function FlipbookUploadGuide() {
  const sample = formatCloudPageBasename(1, 'png')
  const sample2 = formatCloudPageBasename(2, 'png')

  return (
    <details className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white/55">
      <summary className="cursor-pointer font-semibold text-white/75">
        上传方式与命名规则（PDF 或整组页图）
      </summary>
      <div className="mt-3 flex flex-col gap-3 leading-relaxed">
        <section>
          <h3 className="font-semibold text-white/70">两种方式（二选一）</h3>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li>
              <strong className="text-white/65">PDF</strong>：本地转成 WebP 后上传，PDF 原文件不入库。
            </li>
            <li>
              <strong className="text-white/65">整组页图</strong>：已是{' '}
              <code className="text-orange-300/90">.webp</code> 时直接上传；PNG / JPG
              会在浏览器内转成 WebP 后再上传。
            </li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-white/70">页图命名（与云端一致）</h3>
          <p className="mt-1">
            本地文件名须与 Storage 中页图规则相同，仅扩展名可为 png/jpg/webp，上传后存为{' '}
            <code className="text-orange-300/90">0001.webp</code>、
            <code className="text-orange-300/90">0002.webp</code>…
          </p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li>
              格式：<code className="text-orange-300/90">四位页码.扩展名</code>，例如{' '}
              <code className="text-orange-300/90">{sample}</code>、
              <code className="text-orange-300/90">{sample2}</code>（不要用 01.png、书名-01.png）。
            </li>
            <li>按页码数字排序；缺号、重复页码会导致顺序异常。</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-white/70">讲解音频</h3>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li>
              可选；阅读时与翻页并行播放，翻页由孩子手动控制。
            </li>
            <li>
              文件名用于自动填书名，如{' '}
              <code className="text-orange-300/90">第43讲-课前测.mp3</code> → 书名「第43讲 课前测」。
            </li>
            <li>无音频时请在表单中手动填写书名。</li>
            <li>PDF 文件名不用于自动填书名。</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-white/70">词汇 sync.json（可选）</h3>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li>
              与 PDF/音频<strong className="text-white/65">同名主干</strong>配对，如{' '}
              <code className="text-orange-300/90">书名.sync.json</code>。
            </li>
            <li>
              格式：<code className="text-orange-300/90">{'{ "version": 1, "pages": [...] }'}</code>
              ，每页含 <code className="text-orange-300/90">page</code>、
              <code className="text-orange-300/90">content</code>、
              <code className="text-orange-300/90">words</code>（无时间轴）。
            </li>
            <li>上传时自动匹配词库，书架可预览词汇卡片。</li>
            <li>无音频时可用 sync 文件名推断书名。</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-white/70">批量上传 · 多本书</h3>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li>
              <strong className="text-white/65">推荐目录结构</strong>：每本书一个子文件夹；页图在{' '}
              <code className="text-orange-300/90">pages/0001.webp</code>；目录内任意文件名的 mp3 / json
              均自动配对（不要求与文件夹同名）。书名默认取文件夹名。
            </li>
            <li>
              <strong className="text-white/65">旧版扁平结构</strong>：子文件夹名与音频/sync 文件名主干一致，页图直接在子文件夹内（无{' '}
              <code className="text-orange-300/90">pages/</code>）。
            </li>
            <li>
              示例（扁平）：
              <code className="text-orange-300/90">第43讲-课前测/0001.png</code> +{' '}
              <code className="text-orange-300/90">第43讲-课前测.mp3</code>
            </li>
            <li>同一本书不能同时上传 PDF 与页图。</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-white/70">注意事项</h3>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li>单本书最多 {FLIPBOOK_MAX_PAGES} 页；各页宽高建议一致。</li>
            <li>
              检测到重复（书架同名或页码多张图）时会弹窗：覆盖 / 跳过 / 放弃上传；批量可勾选「对后续重复项执行相同操作」。
            </li>
          </ul>
        </section>
      </div>
    </details>
  )
}
