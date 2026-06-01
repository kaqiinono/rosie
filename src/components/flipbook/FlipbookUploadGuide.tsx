import { FLIPBOOK_MAX_PAGES } from '@/utils/flipbook-types'
import { formatCloudPageBasename } from '@/utils/flipbook-naming'

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
          <h3 className="font-semibold text-white/70">书名</h3>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li>
              <strong className="text-white/65">优先</strong>：讲解音频文件名（去扩展名），如{' '}
              <code className="text-orange-300/90">第43讲-课前测.mp3</code> → 书名「第43讲 课前测」。
            </li>
            <li>
              <strong className="text-white/65">其次</strong>：sync 文件名，如{' '}
              <code className="text-orange-300/90">第43讲-课前测.sync.json</code>。
            </li>
            <li>
              <strong className="text-white/65">否则</strong>：在表单中手动填写书名（无音频且无 sync 时必填）。
            </li>
            <li>PDF 文件名不用于自动填书名。</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-white/70">批量上传 · 多本书</h3>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li>
              每本书一个子文件夹，<strong className="text-white/65">文件夹名与音频/sync 文件名主干一致</strong>
              。
            </li>
            <li>
              示例：
              <code className="text-orange-300/90">第43讲-课前测/0001.png</code> +{' '}
              <code className="text-orange-300/90">第43讲-课前测.mp3</code>（可选用「选择文件夹」一次选中）。
            </li>
            <li>
              仅一本书且页图在根目录：须同时有<strong className="text-white/65">唯一</strong>一份音频或
              sync，页图为 <code className="text-orange-300/90">0001.png</code> 等。
            </li>
            <li>同一本书不能同时上传 PDF 与页图。</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-white/70">注意事项</h3>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li>单本书最多 {FLIPBOOK_MAX_PAGES} 页；各页宽高建议一致。</li>
            <li>
              sync.json 页数须与实际页数一致；推荐使用 Python{' '}
              <code className="text-orange-300/90">generate_sync.py</code> 的 align 输出（含{' '}
              <code className="text-orange-300/90">_pageKind</code>、
              <code className="text-orange-300/90">_stats.narrationEndSec</code>）。无 sync
              时可阅读，但不会自动按时间翻页。
            </li>
            <li>
              检测到重复（书架同名或页码多张图）时会弹窗：覆盖 / 跳过 / 放弃上传；批量可勾选「对后续重复项执行相同操作」。
            </li>
          </ul>
        </section>
      </div>
    </details>
  )
}
