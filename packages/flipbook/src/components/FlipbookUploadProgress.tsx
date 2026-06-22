'use client'

import clsx from 'clsx'

export type FlipbookProgressStep = {
  current: number
  total: number
}

export type FlipbookUploadProgressProps = {
  /** e.g. 解析 PDF、处理页图、上传页图 */
  headline?: string
  /** PDF 时为「生成页图」，直传页图时为「准备页图」 */
  renderLabel?: string
  render?: FlipbookProgressStep | null
  upload?: FlipbookProgressStep | null
  audioStatus?: 'idle' | 'uploading' | 'done' | null
  overallPercent?: number | null
  className?: string
}

function stepPercent(step: FlipbookProgressStep | null | undefined): number {
  if (!step || step.total <= 0) return 0
  return Math.min(100, Math.round((step.current / step.total) * 100))
}

export default function FlipbookUploadProgress({
  headline,
  renderLabel = '生成页图',
  render,
  upload,
  audioStatus,
  overallPercent,
  className,
}: FlipbookUploadProgressProps) {
  const showRender = render != null && render.total > 0
  const showUpload = upload != null && upload.total > 0
  const showAudio = audioStatus != null && audioStatus !== 'idle'

  if (!showRender && !showUpload && !showAudio && overallPercent == null) {
    return null
  }

  return (
    <div
      className={clsx(
        'space-y-3 rounded-xl border border-white/10 bg-black/30 p-4',
        className,
      )}
    >
      {(headline || overallPercent != null) && (
        <div className="flex items-center justify-between gap-2 text-xs">
          {headline && <span className="font-medium text-white/80">{headline}</span>}
          {overallPercent != null && (
            <span className="shrink-0 font-mono tabular-nums text-orange-300/90">
              {overallPercent}%
            </span>
          )}
        </div>
      )}

      {overallPercent != null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-600 to-orange-400 transition-all duration-300 ease-out"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      )}

      {showRender && (
        <ProgressRow
          label={renderLabel}
          step={render}
          accent="amber"
        />
      )}

      {showUpload && (
        <ProgressRow
          label="上传页图"
          step={upload}
          accent="orange"
        />
      )}

      {showAudio && (
        <div className="flex items-center justify-between text-[11px] text-white/50">
          <span>上传音频</span>
          <span
            className={clsx(
              audioStatus === 'done' && 'text-emerald-400/90',
              audioStatus === 'uploading' && 'text-orange-300/90',
            )}
          >
            {audioStatus === 'done' ? '完成' : audioStatus === 'uploading' ? '上传中…' : ''}
          </span>
        </div>
      )}
    </div>
  )
}

function ProgressRow({
  label,
  step,
  accent,
}: {
  label: string
  step: FlipbookProgressStep
  accent: 'amber' | 'orange'
}) {
  const pct = stepPercent(step)
  const done = step.total > 0 && step.current >= step.total

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-white/55">{label}</span>
        <span className="font-mono tabular-nums text-white/70">
          {step.current}/{step.total}
          <span className="ml-1.5 text-white/40">{pct}%</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-300 ease-out',
            accent === 'amber' ? 'bg-amber-500/90' : 'bg-orange-500',
            done && 'opacity-90',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export type FlipbookOverallProgressInput = {
  parseDone?: boolean
  render?: FlipbookProgressStep | null
  upload?: FlipbookProgressStep | null
  audio?: 'idle' | 'uploading' | 'done'
  saving?: boolean
}

/** Single 0–100 bar: parse 8% · render 42% · upload 38% · audio 7% · save 5% */
export function flipbookOverallUploadPercent(input: FlipbookOverallProgressInput): number {
  let p = 0
  if (input.parseDone) p += 8
  if (input.render && input.render.total > 0) {
    p += (input.render.current / input.render.total) * 42
  }
  if (input.upload && input.upload.total > 0) {
    p += (input.upload.current / input.upload.total) * 38
  }
  if (input.audio === 'uploading') p = Math.max(p, 88)
  if (input.audio === 'done') p = Math.max(p, 93)
  if (input.saving) p = Math.max(p, 97)
  return Math.min(100, Math.round(p))
}
