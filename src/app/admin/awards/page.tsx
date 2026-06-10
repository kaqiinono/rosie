'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useCalcWallet } from '@/hooks/useCalcWallet'
import { useStarEarning } from '@/hooks/useStarEarning'
import { useCalcVouchers } from '@/hooks/useCalcVouchers'
import { useVoucherCatalog } from '@/hooks/useVoucherCatalog'
import { supabase } from '@/lib/supabase'
import { todayStr } from '@/utils/constant'
import ColoredStar from '@/components/stars/ColoredStar'
import { STAR_COLOR_HEX, type StarColor } from '@/components/stars/star-types'
import type { VoucherCategory, VoucherTemplate } from '@/utils/type'
import VoucherTemplateModal from '@/components/admin/VoucherTemplateModal'

const COLOR_TO_SOURCE: Record<StarColor, 'calc' | 'english' | 'math'> = {
  yellow: 'calc',
  red: 'english',
  blue: 'math',
}
const COLORS: StarColor[] = ['yellow', 'red', 'blue']
const QUICK_AMOUNTS = [1, 5, 10, 50]

interface TodayStarRow {
  id: string
  source: 'english' | 'math' | 'calc'
  coins_earned: number
  created_at: string
}

interface TodayVoucherRow {
  id: string
  category: VoucherCategory
  free: boolean | null
  redeemed_at: string
}

export default function AwardsAdminPage() {
  const { user } = useAuth()
  const wallet = useCalcWallet(user)
  const { earnStars } = useStarEarning(user)
  const { grantFree } = useCalcVouchers(user)
  const catalog = useVoucherCatalog(user)

  const [amounts, setAmounts] = useState<Record<StarColor, number>>({
    yellow: 10,
    red: 10,
    blue: 10,
  })
  const [busy, setBusy] = useState<string | null>(null)
  const [todayStars, setTodayStars] = useState<TodayStarRow[]>([])
  const [todayVouchers, setTodayVouchers] = useState<TodayVoucherRow[]>([])
  const [flash, setFlash] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  /** Modal mode: null = closed, 'new' = create, VoucherTemplate = edit that one */
  const [modalMode, setModalMode] = useState<null | 'new' | VoucherTemplate>(null)

  const loadToday = useCallback(async () => {
    if (!user) return
    const today = todayStr()
    const [{ data: starRows }, { data: vRows }] = await Promise.all([
      supabase
        .from('star_sessions')
        .select('id, source, coins_earned, created_at')
        .eq('user_id', user.id)
        .eq('date', today)
        .order('created_at', { ascending: false })
        .limit(80),
      supabase
        .from('calc_vouchers')
        .select('id, category, free, redeemed_at')
        .eq('user_id', user.id)
        .gte('redeemed_at', `${today}T00:00:00`)
        .order('redeemed_at', { ascending: false })
        .limit(40),
    ])
    setTodayStars((starRows ?? []) as TodayStarRow[])
    setTodayVouchers((vRows ?? []) as TodayVoucherRow[])
  }, [user])

  useEffect(() => {
    void loadToday()
  }, [loadToday])

  const triggerFlash = (msg: string) => {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 1500)
  }

  const handleAddStars = useCallback(
    async (color: StarColor, amount: number) => {
      if (busy || amount <= 0) return
      const key = `star:${color}:${amount}`
      setBusy(key)
      try {
        await earnStars(COLOR_TO_SOURCE[color], amount)
        await wallet.refresh()
        await loadToday()
        const hex = STAR_COLOR_HEX[color]
        triggerFlash(`已添加 ${amount} 颗${hex.cnLabel}${hex.shapeLabel}`)
      } finally {
        setBusy(null)
      }
    },
    [busy, earnStars, wallet, loadToday],
  )

  const handleGrantVoucher = useCallback(
    async (template: VoucherTemplate) => {
      if (busy) return
      const key = `voucher:${template.category}`
      setBusy(key)
      try {
        const v = await grantFree(template)
        if (v) {
          await wallet.refresh()
          await loadToday()
          triggerFlash(`已赠送【${template.label}】`)
        } else {
          triggerFlash('赠送失败，请重试')
        }
      } finally {
        setBusy(null)
      }
    },
    [busy, grantFree, wallet, loadToday],
  )

  const handleSaveTemplate = useCallback(
    async (draft: Parameters<typeof catalog.create>[0]) => {
      if (modalMode === 'new') {
        const created = await catalog.create(draft)
        if (created) {
          triggerFlash(`已创建【${created.label}】`)
          setModalMode(null)
        } else {
          triggerFlash('创建失败')
        }
      } else if (modalMode && typeof modalMode === 'object') {
        const ok = await catalog.update(modalMode.category, draft)
        if (ok) {
          triggerFlash(`已保存【${draft.label}】`)
          setModalMode(null)
        } else {
          triggerFlash('保存失败')
        }
      }
    },
    [catalog, modalMode],
  )

  const handleToggleArchive = useCallback(
    async (template: VoucherTemplate) => {
      const action = template.archived ? '恢复' : '下架'
      if (!window.confirm(`确定${action}【${template.label}】？`)) return
      const ok = template.archived
        ? await catalog.restore(template.category)
        : await catalog.archive(template.category)
      if (ok) triggerFlash(`已${action}【${template.label}】`)
    },
    [catalog],
  )

  const activeTemplates = useMemo(
    () => catalog.visible.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [catalog.visible],
  )
  const archivedTemplates = useMemo(
    () => catalog.archived.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [catalog.archived],
  )

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        请先登录
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg,#fffbeb 0%,#fff1f2 45%,#eff6ff 100%)' }}>
      {/* Sticky header */}
      <header
        className="sticky top-0 z-30 border-b border-amber-200/40 backdrop-blur"
        style={{ background: 'rgba(255,255,255,0.85)' }}
      >
        <div className="mx-auto flex h-14 max-w-[760px] items-center gap-3 px-4">
          <Link
            href="/admin"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-amber-700 transition hover:scale-110"
            style={{ background: 'rgba(245,158,11,0.10)', border: '1.5px solid rgba(245,158,11,0.30)' }}
            aria-label="返回管理后台"
          >
            ←
          </Link>
          <div className="flex items-center gap-1.5 text-[17px] font-extrabold text-amber-900">
            <span aria-hidden>🛠</span>
            <span>管理 · 星星与奖券</span>
          </div>
          {flash && (
            <div
              className="ml-auto rounded-full px-3 py-1 text-[12px] font-extrabold text-emerald-700"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.4)' }}
            >
              ✓ {flash}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[760px] space-y-6 px-4 py-6 pb-20">
        {/* Current balances */}
        <section
          className="rounded-3xl p-5"
          style={{
            background: 'linear-gradient(135deg,rgba(251,191,36,0.10) 0%,rgba(244,63,94,0.08) 50%,rgba(59,130,246,0.10) 100%)',
            border: '1.5px solid rgba(245,158,11,0.22)',
          }}
        >
          <div className="mb-3 text-[11px] font-extrabold tracking-[0.22em] text-amber-800/80 uppercase">
            当前余额
          </div>
          <div className="grid grid-cols-3 gap-3">
            {COLORS.map((c) => {
              const hex = STAR_COLOR_HEX[c]
              const balance = c === 'yellow' ? wallet.yellowBalance : c === 'red' ? wallet.redBalance : wallet.blueBalance
              const earned = c === 'yellow' ? wallet.yellowEarnedTotal : c === 'red' ? wallet.redEarned : wallet.blueEarned
              const spent = c === 'yellow' ? wallet.yellowSpent : c === 'red' ? wallet.redSpent : wallet.blueSpent
              return (
                <div
                  key={c}
                  className="rounded-2xl p-3 text-center"
                  style={{
                    background: `linear-gradient(160deg,${hex.bg},rgba(255,255,255,0.5))`,
                    border: `1.5px solid ${hex.border}`,
                  }}
                >
                  <div className="flex justify-center">
                    <ColoredStar color={c} size={26} withBadge glow={8} />
                  </div>
                  <div
                    className="font-fredoka mt-1 text-[26px] leading-none font-black tabular-nums"
                    style={{ color: hex.outline }}
                  >
                    {balance}
                  </div>
                  <div className="mt-1 text-[10px] font-bold text-slate-500">
                    赚 {earned} · 花 {spent}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Add stars */}
        <section>
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-[15px] font-extrabold text-slate-800">添加星星</h2>
            <span className="text-[11px] text-slate-500">每次点击插入一条记录，当天可多次添加</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {COLORS.map((c) => {
              const hex = STAR_COLOR_HEX[c]
              return (
                <div
                  key={c}
                  className="rounded-2xl bg-white/85 p-4 shadow-sm"
                  style={{ border: `1.5px solid ${hex.border}` }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <ColoredStar color={c} size={20} glow={6} />
                    <span className="text-[14px] font-extrabold" style={{ color: hex.outline }}>
                      {hex.cnLabel}
                      {hex.shapeLabel}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={amounts[c]}
                    onChange={(e) =>
                      setAmounts((prev) => ({ ...prev, [c]: Math.max(1, Number(e.target.value) || 1) }))
                    }
                    className="font-fredoka mb-2 w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 text-center text-[18px] font-black tabular-nums focus:border-amber-400 focus:outline-none"
                    style={{ color: hex.outline }}
                  />
                  <div className="mb-2 flex flex-wrap gap-1">
                    {QUICK_AMOUNTS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setAmounts((prev) => ({ ...prev, [c]: q }))}
                        className={`flex-1 cursor-pointer rounded-md px-1.5 py-1 text-[11px] font-extrabold tabular-nums transition ${
                          amounts[c] === q
                            ? 'text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                        style={
                          amounts[c] === q
                            ? { background: hex.primary, border: `1px solid ${hex.outline}` }
                            : { border: '1px solid #e2e8f0' }
                        }
                      >
                        +{q}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => handleAddStars(c, amounts[c])}
                    className="w-full cursor-pointer rounded-lg py-2 text-[13px] font-extrabold text-white shadow transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      background: `linear-gradient(135deg,${hex.primary},${hex.outline})`,
                      boxShadow: `0 3px 12px ${hex.glow}`,
                    }}
                  >
                    {busy === `star:${c}:${amounts[c]}` ? '添加中…' : `添加 ${amounts[c]} 颗${hex.shapeLabel}`}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* Grant vouchers */}
        <section>
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-[15px] font-extrabold text-slate-800">赠送兑换券</h2>
            <span className="text-[11px] text-slate-500">点击即赠，不扣星星（标记为 free）</span>
          </div>
          {activeTemplates.length === 0 ? (
            <div className="rounded-xl bg-white/60 py-6 text-center text-[12px] text-slate-400">
              还没有可用模版，去下方"兑换券模版"创建一个
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {activeTemplates.map((t) => {
                const isBusy = busy === `voucher:${t.category}`
                return (
                  <button
                    key={t.category}
                    type="button"
                    disabled={!!busy}
                    onClick={() => handleGrantVoucher(t)}
                    className="group flex cursor-pointer flex-col items-start rounded-2xl bg-white/85 p-3 text-left shadow-sm transition hover:-translate-y-px hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ border: '1.5px solid rgba(15,23,42,0.08)' }}
                  >
                    <div className="mb-1 flex w-full items-center justify-between">
                      <span className="text-[24px] leading-none">{t.emoji}</span>
                      {isBusy && (
                        <span className="animate-pulse text-[10px] font-extrabold text-amber-700">…</span>
                      )}
                    </div>
                    <div className="text-[13px] font-extrabold text-slate-800">{t.label}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(['yellow', 'red', 'blue'] as const).map((c) => {
                        const v = c === 'yellow' ? t.priceYellow : c === 'red' ? t.priceRed : t.priceBlue
                        if (v <= 0) return null
                        const hex = STAR_COLOR_HEX[c]
                        return (
                          <span
                            key={c}
                            className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-black tabular-nums line-through opacity-60"
                            style={{ background: `${hex.primary}22`, color: hex.outline }}
                          >
                            <ColoredStar color={c} size={9} glow={0} />
                            {v}
                          </span>
                        )
                      })}
                      <span
                        className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-black"
                        style={{ background: 'rgba(16,185,129,0.12)', color: '#065f46' }}
                      >
                        赠送
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* Voucher template CRUD */}
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[15px] font-extrabold text-slate-800">兑换券模版</h2>
              <span className="text-[11px] text-slate-500">
                共 {activeTemplates.length} 启用 · {archivedTemplates.length} 已下架
              </span>
            </div>
            <button
              type="button"
              onClick={() => setModalMode('new')}
              className="cursor-pointer rounded-full px-3 py-1 text-[12px] font-extrabold text-white shadow transition hover:-translate-y-px"
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #b45309)',
                boxShadow: '0 3px 10px rgba(245,158,11,0.4)',
              }}
            >
              + 新增模版
            </button>
          </div>
          <div className="space-y-1.5">
            {activeTemplates.map((t) => (
              <TemplateRow
                key={t.category}
                template={t}
                onEdit={() => setModalMode(t)}
                onToggleArchive={() => handleToggleArchive(t)}
              />
            ))}
          </div>

          {archivedTemplates.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="cursor-pointer text-[12px] font-bold text-slate-500 transition hover:text-slate-700"
              >
                {showArchived ? '▾' : '▸'} 已下架 ({archivedTemplates.length})
              </button>
              {showArchived && (
                <div className="mt-2 space-y-1.5">
                  {archivedTemplates.map((t) => (
                    <TemplateRow
                      key={t.category}
                      template={t}
                      onEdit={() => setModalMode(t)}
                      onToggleArchive={() => handleToggleArchive(t)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Today's log */}
        <section>
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-[15px] font-extrabold text-slate-800">今日操作日志</h2>
            <span className="text-[11px] text-slate-500">
              {todayStars.length + todayVouchers.length} 条
            </span>
          </div>
          {todayStars.length === 0 && todayVouchers.length === 0 ? (
            <div className="rounded-xl bg-white/60 py-6 text-center text-[12px] text-slate-400">
              今天还没有操作
            </div>
          ) : (
            <div className="space-y-1">
              {todayVouchers.map((v) => {
                const t = catalog.getById(v.category)
                return (
                  <div
                    key={`v-${v.id}`}
                    className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-[12px]"
                  >
                    <span className="text-[16px]">{t?.emoji ?? '🎫'}</span>
                    <span className="font-extrabold text-slate-700">
                      {t?.label ?? v.category}
                    </span>
                    {v.free && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-black"
                        style={{ background: 'rgba(16,185,129,0.12)', color: '#065f46' }}
                      >
                        FREE
                      </span>
                    )}
                    <span className="ml-auto font-mono text-[11px] text-slate-400 tabular-nums">
                      {new Date(v.redeemed_at).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )
              })}
              {todayStars.map((s) => {
                const color: StarColor =
                  s.source === 'calc' ? 'yellow' : s.source === 'english' ? 'red' : 'blue'
                const hex = STAR_COLOR_HEX[color]
                return (
                  <div
                    key={`s-${s.id}`}
                    className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-[12px]"
                  >
                    <ColoredStar color={color} size={14} glow={4} />
                    <span className="font-extrabold" style={{ color: hex.outline }}>
                      +{s.coins_earned} {hex.cnLabel}
                      {hex.shapeLabel}
                    </span>
                    <span className="ml-auto font-mono text-[11px] text-slate-400 tabular-nums">
                      {new Date(s.created_at).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>

      {modalMode !== null && (
        <VoucherTemplateModal
          initial={modalMode === 'new' ? undefined : modalMode}
          onCancel={() => setModalMode(null)}
          onSubmit={handleSaveTemplate}
        />
      )}
    </div>
  )
}

interface TemplateRowProps {
  template: VoucherTemplate
  onEdit: () => void
  onToggleArchive: () => void
}

function TemplateRow({ template: t, onEdit, onToggleArchive }: TemplateRowProps) {
  return (
    <div
      className="relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2"
      style={{
        background: 'rgba(255,255,255,0.85)',
        border: t.archived ? '1.5px dashed rgba(15,23,42,0.18)' : '1.5px solid rgba(15,23,42,0.08)',
        opacity: t.archived ? 0.6 : 1,
      }}
    >
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-[20px]">
        <div className={`absolute inset-0 bg-gradient-to-br ${t.gradient} opacity-25`} aria-hidden />
        <span className="relative">{t.emoji}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-extrabold text-slate-800">{t.label}</div>
        <div className="mt-0.5 flex flex-wrap gap-1">
          {(['yellow', 'red', 'blue'] as const).map((c) => {
            const v = c === 'yellow' ? t.priceYellow : c === 'red' ? t.priceRed : t.priceBlue
            if (v <= 0) return null
            const hex = STAR_COLOR_HEX[c]
            return (
              <span
                key={c}
                className="inline-flex items-center gap-0.5 rounded px-1 py-0 text-[10px] font-black tabular-nums"
                style={{ background: `${hex.primary}1f`, color: hex.outline }}
              >
                <ColoredStar color={c} size={9} glow={0} />
                {v}
              </span>
            )
          })}
          <span className="font-mono text-[9px] text-slate-400 tabular-nums">{t.category}</span>
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="cursor-pointer rounded px-2 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100"
        >
          编辑
        </button>
        <button
          type="button"
          onClick={onToggleArchive}
          className="cursor-pointer rounded px-2 py-1 text-[11px] font-bold transition"
          style={{
            color: t.archived ? '#15803d' : '#b91c1c',
            background: t.archived ? 'rgba(22,163,74,0.10)' : 'rgba(220,38,38,0.08)',
          }}
        >
          {t.archived ? '恢复' : '下架'}
        </button>
      </div>
    </div>
  )
}
