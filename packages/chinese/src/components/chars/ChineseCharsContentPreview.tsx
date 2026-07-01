'use client'

import type { LessonContentBlock } from '../../utils/chinese-chars-session-helpers'

interface ChineseCharsContentPreviewProps {
  blocks: LessonContentBlock[]
}

type ContentRowProps = {
  label: string
  labelClass: string
  children: React.ReactNode
}

function ContentRow({ label, labelClass, children }: ContentRowProps) {
  return (
    <div className="flex min-w-0 items-baseline gap-1">
      <span
        className={`shrink-0 rounded px-1 py-px text-[9px] leading-none font-extrabold tracking-wide ${labelClass}`}
      >
        {label}
      </span>
      <div className="min-w-0 flex flex-1 flex-wrap gap-x-1 gap-y-0.5">{children}</div>
    </div>
  )
}

function CharItem({ ch, className }: { ch: string; className: string }) {
  return (
    <span className={`text-[11px] leading-tight font-bold ${className}`}>{ch}</span>
  )
}

function TextItem({ text, className }: { text: string; className: string }) {
  return (
    <span className={`text-[10px] leading-snug font-semibold ${className}`}>{text}</span>
  )
}

function LessonBlock({ block }: { block: LessonContentBlock }) {
  const hasContent =
    block.recognize.length > 0 ||
    block.write.length > 0 ||
    block.phrases.length > 0 ||
    block.poems.length > 0 ||
    block.accumulationLabels.length > 0

  return (
    <section className="cn-content-section cn-content-section-compact rounded-xl p-2.5">
      <header className="mb-1.5 flex min-w-0 items-center gap-1 border-b border-amber-900/8 pb-1.5">
        <h3 className="min-w-0 truncate text-[13px] leading-tight font-extrabold text-stone-900">
          {block.lessonLabel}
        </h3>
        <span className="shrink-0 text-[9px] font-bold text-amber-800/40">U{block.unit}</span>
        {block.bookLessonNo !== null && (
          <span className="shrink-0 text-[9px] font-bold text-indigo-700/50">
            #{block.bookLessonNo}
          </span>
        )}
        {block.hasPassage && (
          <span
            className="ml-auto shrink-0 rounded bg-amber-100/80 px-1 py-px text-[8px] font-extrabold text-amber-800/55"
            title="含课文原文"
          >
            课文
          </span>
        )}
      </header>

      {hasContent ? (
        <div className="space-y-1">
          {block.recognize.length > 0 && (
            <ContentRow label="认" labelClass="bg-sky-100 text-sky-700">
              {block.recognize.map((ch) => (
                <CharItem key={`r-${ch}`} ch={ch} className="text-sky-800" />
              ))}
            </ContentRow>
          )}

          {block.write.length > 0 && (
            <ContentRow label="写" labelClass="bg-rose-100 text-rose-700">
              {block.write.map((ch) => (
                <CharItem key={`w-${ch}`} ch={ch} className="text-rose-800" />
              ))}
            </ContentRow>
          )}

          {block.phrases.length > 0 && (
            <ContentRow label="词" labelClass="bg-violet-100 text-violet-700">
              {block.phrases.map((p) => (
                <TextItem key={p} text={p} className="text-violet-800" />
              ))}
            </ContentRow>
          )}

          {block.poems.length > 0 && (
            <ContentRow label="诗" labelClass="bg-indigo-100 text-indigo-700">
              {block.poems.map((poem) => (
                <TextItem key={poem.id} text={poem.title} className="text-indigo-800" />
              ))}
            </ContentRow>
          )}

          {block.accumulationLabels.length > 0 && (
            <ContentRow label="积" labelClass="bg-emerald-100 text-emerald-700">
              {block.accumulationLabels.map((label) => (
                <TextItem key={label} text={label} className="text-emerald-800" />
              ))}
            </ContentRow>
          )}
        </div>
      ) : (
        <p className="text-[10px] font-medium text-amber-900/40">暂无生字与拓展内容</p>
      )}
    </section>
  )
}

export default function ChineseCharsContentPreview({ blocks }: ChineseCharsContentPreviewProps) {
  if (blocks.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-amber-900/45">
        请选择单元或课文，下方将显示对应的学习内容
      </p>
    )
  }

  const gridClass =
    blocks.length === 1
      ? 'grid grid-cols-1'
      : blocks.length === 2
        ? 'grid grid-cols-1 gap-2 sm:grid-cols-2'
        : 'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3'

  return (
    <div className={gridClass}>
      {blocks.map((block) => (
        <LessonBlock key={block.lessonKey} block={block} />
      ))}
    </div>
  )
}
