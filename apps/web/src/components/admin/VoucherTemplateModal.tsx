'use client'

import { useState } from 'react'
import { voucherSolidClass, type VoucherTemplate } from '@rosie/core'
import type { VoucherTemplateDraft } from '@rosie/rewards'
import { GRADIENT_PRESETS, DEFAULT_GRADIENT } from '@/utils/voucher-gradients'
import { ColoredStar } from '@rosie/rewards'
import { AppDialog } from '@rosie/ui'
import { Button, TextField } from '@rosie/ui/themes'

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
    <AppDialog
      open
      title={initial ? '编辑兑换券模版' : '新增兑换券模版'}
      description={initial ? `分类：${initial.category}` : undefined}
      closeDisabled={submitting}
      onOpenChange={(open) => {
        if (!open && !submitting) onCancel()
      }}
    >
      <div>
        {/* Live preview card */}
        <div
          className="relative mb-4 overflow-hidden rounded-2xl p-3"
          style={{
            border: '1.5px solid rgba(15,23,42,0.10)',
            boxShadow: '0 3px 0 rgba(15,23,42,.3)',
          }}
        >
          <div className={`absolute inset-0 ${voucherSolidClass(gradient)}`} aria-hidden />
          <div className="relative flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[22px]"
              style={{
                background: 'rgba(255,255,255,0.28)',
                boxShadow: '0 3px 0 rgba(0,0,0,.3)',
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
            <TextField.Root
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="比如：周末免作业券"
              size="2"
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-extrabold tracking-wide text-slate-500 uppercase">
                Emoji
              </label>
              <TextField.Root
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={6}
                size="2"
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
                    <button // native-ok: 纯色色板方块，非标准按钮
                      key={g.value}
                      type="button"
                      title={g.label}
                      onClick={() => setGradient(g.value)}
                      className="aspect-square cursor-pointer rounded-md transition"
                      style={{
                        background: `${g.swatch[0]}`,
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
                  <TextField.Root
                    type="number"
                    min={0}
                    value={price[c]}
                    onChange={(e) => setPrice[c](Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <Button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            variant="outline"
            color="gray"
            size="2"
            className="flex-1"
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSubmit}
            size="2"
            className="flex-[2]"
          >
            {submitting ? '保存中…' : initial ? '保存修改' : '创建模版'}
          </Button>
        </div>
      </div>
    </AppDialog>
  )
}
