'use client'

import { useEffect, useState } from 'react'
import type { VoucherTemplate } from '@/utils/type'
import type { VoucherTemplateDraft } from '@/hooks/useVoucherCatalog'
import { GRADIENT_PRESETS, DEFAULT_GRADIENT } from '@/utils/voucher-gradients'
import ColoredStar from '@/components/stars/ColoredStar'

interface Props {
  /** When provided, modal is in "edit" mode; otherwise "create". */
  initial?: VoucherTemplate
  onCancel: () => void
  onSubmit: (draft: VoucherTemplateDraft) => Promise<void>
}

const COLORS = ['yellow', 'red', 'blue'] as const
type Color = (typeof COLORS)[number]
const COLOR_LABEL: Record<Color, string> = { yellow: '黄星', red: '红月', blue: '蓝日' }

export default function VoucherTemplateModal({ initial, onCancel, onSubmit }: Props) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '🎁')
  const [gradient, setGradient] = useState(initial?.gradient ?? DEFAULT_GRADIENT)
  const [priceYellow, setPriceYellow] = useState(initial?.priceYellow ?? 0)
  const [priceRed, setPriceRed] = useState(initial?.priceRed ?? 0)
  const [priceBlue, setPriceBlue] = useState(initial?.priceBlue ?? 0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, submitting])

  const canSubmit = label.trim().length > 0 && emoji.trim().length > 0 && !submitting

  const handleSave = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onSubmit({
        label: label.trim(),
        emoji: emoji.trim(),
        gradient,
        priceYellow: Math.max(0, Math.floor(priceYellow)),
        priceRed: Math.max(0, Math.floor(priceRed)),
        priceBlue: Math.max(0, Math.floor(priceBlue)),
      })
    } finally {
      setSubmitting(false)
    }
  }

  const setPrice: Record<Color, (n: number) => void> = {
    yellow: setPriceYellow,
    red: setPriceRed,
    blue: setPriceBlue,
  }
  const price: Record<Color, number> = {
    yellow: priceYellow,
    red: priceRed,
    blue: priceBlue,
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(8px)' }}
      onClick={() => !submitting && onCancel()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="text-[16px] font-extrabold text-slate-800">
            {initial ? '编辑兑换券模版' : '新增兑换券模版'}
          </h3>
          {initial && (
            <span className="font-mono text-[10px] text-slate-400 tabular-nums">{initial.category}</span>
          )}
        </div>

        {/* Live preview card */}
        <div
          className="relative mb-4 overflow-hidden rounded-2xl p-3"
          style={{
            border: '1.5px solid rgba(15,23,42,0.10)',
            boxShadow: '0 4px 18px rgba(15,23,42,0.12)',
          }}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} aria-hidden />
          <div className="relative flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[22px]"
              style={{
                background: 'rgba(255,255,255,0.28)',
                backdropFilter: 'blur(6px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
              }}
            >
              {emoji || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-[14px] leading-snug font-black text-white"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.22)' }}
              >
                {label || '未命名'}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {COLORS.map((c) => {
                  const v = price[c]
                  if (v <= 0) return null
                  return (
                    <span
                      key={c}
                      className="inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[10px] font-black tabular-nums"
                      style={{ background: 'rgba(0,0,0,0.22)', color: '#fff' }}
                    >
                      <ColoredStar color={c} size={10} glow={3} />
                      {v}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-extrabold tracking-wide text-slate-500 uppercase">
              名称
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="比如：周末免作业券"
              className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-[14px] font-bold focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-extrabold tracking-wide text-slate-500 uppercase">
                Emoji
              </label>
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={6}
                className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-center text-[20px] focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-extrabold tracking-wide text-slate-500 uppercase">
                配色
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                {GRADIENT_PRESETS.map((g) => {
                  const active = g.value === gradient
                  return (
                    <button
                      key={g.value}
                      type="button"
                      title={g.label}
                      onClick={() => setGradient(g.value)}
                      className="aspect-square cursor-pointer rounded-md transition"
                      style={{
                        background: `linear-gradient(135deg, ${g.swatch[0]}, ${g.swatch[1]})`,
                        outline: active ? '2px solid #0f172a' : '1px solid rgba(15,23,42,0.12)',
                        outlineOffset: active ? '2px' : '0',
                        transform: active ? 'scale(1.06)' : undefined,
                      }}
                      aria-label={g.label}
                      aria-pressed={active}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-extrabold tracking-wide text-slate-500 uppercase">
              三色价格
            </label>
            <div className="grid grid-cols-3 gap-2">
              {COLORS.map((c) => (
                <div key={c} className="rounded-lg bg-slate-50 p-2">
                  <div className="mb-1 flex items-center justify-center gap-1 text-[10px] font-extrabold text-slate-600">
                    <ColoredStar color={c} size={12} glow={3} />
                    {COLOR_LABEL[c]}
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={price[c]}
                    onChange={(e) => setPrice[c](Math.max(0, Number(e.target.value) || 0))}
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-center text-[14px] font-black tabular-nums focus:border-amber-400 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 cursor-pointer rounded-lg border border-slate-200 bg-white py-2 text-[13px] font-extrabold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSubmit}
            className="flex-[2] cursor-pointer rounded-lg py-2 text-[13px] font-extrabold text-white shadow transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #b45309)',
              boxShadow: '0 3px 12px rgba(245,158,11,0.4)',
            }}
          >
            {submitting ? '保存中…' : initial ? '保存修改' : '创建模版'}
          </button>
        </div>
      </div>
    </div>
  )
}
