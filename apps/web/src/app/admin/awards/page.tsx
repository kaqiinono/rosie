'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isAdminUser, useAuth } from '@rosie/core'
import { StarAdjustmentPanel, useCalcWallet } from '@rosie/rewards'
import { useStarEarning } from '@rosie/rewards'
import { useCalcVouchers } from '@rosie/rewards'
import { useVoucherCatalog } from '@rosie/rewards'
import { supabase } from '@rosie/core'
import { todayStr } from '@rosie/core'
import { ColoredStar } from '@rosie/rewards'
import { STAR_COLOR_HEX, STAR_UNIT_PRICE_LABEL, formatYuan, starBalanceValueYuan, type StarColor } from '@rosie/rewards'
import type { VoucherCategory, VoucherTemplate } from '@rosie/core'
import VoucherTemplateModal from '@/components/admin/VoucherTemplateModal'

const COLOR_TO_SOURCE: Record<StarColor, 'calc' | 'english' | 'math'> = {
  yellow: 'calc',
  red: 'english',
  blue: 'math',
}
const COLORS: StarColor[] = ['yellow', 'red', 'blue']

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

/** Unified today-log entry (star ops + voucher ops) sorted by timestamp. */
type TodayLogEntry =
  | { kind: 'voucher'; id: string; time: string; category: VoucherCategory; free: boolean | null }
  | { kind: 'star'; id: string; time: string; color: StarColor; amount: number }

type ParentAction =
  | { kind: 'addStars'; color: StarColor; amount: number }
  | { kind: 'grantVoucher'; template: VoucherTemplate }

const LOG_PAGE_SIZE = 10

export default function AwardsAdminPage() {
  const pathname = usePathname()
  const isTemplateAdmin = pathname === '/admin/voucher-templates'
  const { user } = useAuth()
  const isAdmin = isAdminUser(user)
  const wallet = useCalcWallet(user)
  const { earnStars } = useStarEarning(user)
  const { grantFree } = useCalcVouchers(user)
  const catalog = useVoucherCatalog(user)

  const [busy, setBusy] = useState<string | null>(null)
  const [todayStars, setTodayStars] = useState<TodayStarRow[]>([])
  const [todayVouchers, setTodayVouchers] = useState<TodayVoucherRow[]>([])
  const [flash, setFlash] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [logPage, setLogPage] = useState(1)
  /** Modal mode: null = closed, 'new' = create, VoucherTemplate = edit that one */
  const [modalMode, setModalMode] = useState<null | 'new' | VoucherTemplate>(null)
  const [parentAction, setParentAction] = useState<ParentAction | null>(null)
  const [parentPin, setParentPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)

  const loadToday = useCallback(async () => {
    if (!user) return
    const today = todayStr()
    const [{ data: starRows }, { data: vRows }] = await Promise.all([
      supabase
        .from('star_sessions')
        .select('id, source, coins_earned, created_at')
        .eq('user_id', user.id)
        .eq('date', today)
        .order('created_at', { ascending: false }),
      supabase
        .from('calc_vouchers')
        .select('id, category, free, redeemed_at')
        .eq('user_id', user.id)
        .gte('redeemed_at', `${today}T00:00:00`)
        .order('redeemed_at', { ascending: false }),
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

  const getBalance = useCallback(
    (color: StarColor) =>
      color === 'yellow' ? wallet.yellowBalance : color === 'red' ? wallet.redBalance : wallet.blueBalance,
    [wallet.yellowBalance, wallet.redBalance, wallet.blueBalance],
  )

  const handleAdjustStars = useCallback(
    async (color: StarColor, amount: number, mode: 'add' | 'spend') => {
      if (busy || amount <= 0) return
      const hex = STAR_COLOR_HEX[color]
      if (mode === 'spend' && amount > getBalance(color)) {
        triggerFlash(`余额不足，当前 ${getBalance(color)} 颗${hex.shapeLabel}`)
        return
      }
      const key = `star:${mode}:${color}:${amount}`
      if (mode === 'add' && !isAdmin) {
        setParentAction({ kind: 'addStars', color, amount })
        setParentPin('')
        setPinError(null)
        return
      }
      setBusy(key)
      try {
        if (mode === 'add') {
          const ok = await earnStars(COLOR_TO_SOURCE[color], amount)
          if (!ok) {
            triggerFlash('添加失败，请重试')
            return
          }
        } else {
          const { error } = await supabase.from('star_sessions').insert({
            user_id: user!.id,
            date: todayStr(),
            source: COLOR_TO_SOURCE[color],
            coins_earned: -amount,
          })
          if (error) {
            console.error('[star_sessions] spend failed', { color, amount, error })
            triggerFlash('消费失败，请重试')
            return
          }
        }
        await wallet.refresh()
        await loadToday()
        triggerFlash(
          mode === 'add'
            ? `已添加 ${amount} 颗${hex.shapeLabel}`
            : `已消费 ${amount} 颗${hex.shapeLabel}`,
        )
      } finally {
        setBusy(null)
      }
    },
    [isAdmin, busy, earnStars, wallet, loadToday, getBalance, user],
  )

  const handleGrantVoucher = useCallback(
    async (template: VoucherTemplate) => {
      if (busy) return
      if (!isAdmin) {
        setParentAction({ kind: 'grantVoucher', template })
        setParentPin('')
        setPinError(null)
        return
      }
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
    [busy, grantFree, wallet, loadToday, isAdmin],
  )

  const submitParentAction = useCallback(async () => {
    if (!parentAction || parentPin.length !== 6 || busy) return
    setBusy('parent-action')
    setPinError(null)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setPinError('登录已失效，请重新登录')
        return
      }
      const payload = parentAction.kind === 'addStars'
        ? {
            action: 'add_stars', pin: parentPin,
            source: COLOR_TO_SOURCE[parentAction.color], amount: parentAction.amount,
          }
        : { action: 'grant_voucher', pin: parentPin, category: parentAction.template.category }
      const response = await fetch('/api/rewards/parent-action', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setPinError(result.error === 'invalid_parent_pin' ? '家长 PIN 不正确' : '操作失败，请稍后重试')
        return
      }
      const message = parentAction.kind === 'addStars'
        ? `已添加 ${parentAction.amount} 颗${STAR_COLOR_HEX[parentAction.color].shapeLabel}`
        : `已赠送【${parentAction.template.label}】`
      setParentAction(null)
      setParentPin('')
      await wallet.refresh()
      await loadToday()
      triggerFlash(message)
    } finally {
      setBusy(null)
    }
  }, [parentAction, parentPin, busy, wallet, loadToday])

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

  /** Admin-only manual trigger for the nightly star_sessions compaction job. */
  const handleCompactStars = useCallback(async () => {
    if (busy) return
    if (!window.confirm('合并 7 天前的星星记录（按日汇总，总额不变）？')) return
    setBusy('compact')
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        triggerFlash('请先登录')
        return
      }
      const res = await fetch('/api/stars/compact', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      const payload = (await res.json().catch(() => ({}))) as { deleted?: number }
      if (res.ok) {
        triggerFlash(`已合并 ${payload.deleted ?? 0} 条历史记录`)
      } else {
        triggerFlash('合并失败，请重试')
      }
    } catch {
      triggerFlash('合并失败，请重试')
    } finally {
      setBusy(null)
    }
  }, [busy])

  const activeTemplates = useMemo(
    () => catalog.visible.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [catalog.visible],
  )
  const archivedTemplates = useMemo(
    () => catalog.archived.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [catalog.archived],
  )

  /** Today's net totals per color — spends (negative rows) are included. */
  const todayTotals = useMemo(() => {
    const totals: Record<StarColor, number> = { yellow: 0, red: 0, blue: 0 }
    for (const s of todayStars) {
      const color: StarColor = s.source === 'calc' ? 'yellow' : s.source === 'english' ? 'red' : 'blue'
      totals[color] += s.coins_earned
    }
    return totals
  }, [todayStars])

  /** Star ops + voucher ops interleaved by timestamp (newest first) for paging. */
  const todayLog = useMemo<TodayLogEntry[]>(() => {
    const entries: TodayLogEntry[] = [
      ...todayVouchers.map((v) => ({
        kind: 'voucher' as const,
        id: v.id,
        time: v.redeemed_at,
        category: v.category,
        free: v.free,
      })),
      ...todayStars.map((s) => ({
        kind: 'star' as const,
        id: s.id,
        time: s.created_at,
        color: (s.source === 'calc' ? 'yellow' : s.source === 'english' ? 'red' : 'blue') as StarColor,
        amount: s.coins_earned,
      })),
    ]
    entries.sort((a, b) => b.time.localeCompare(a.time))
    return entries
  }, [todayStars, todayVouchers])

  const rawMaxLogPage = Math.max(1, Math.ceil(todayLog.length / LOG_PAGE_SIZE))
  const currentPage = Math.min(logPage, rawMaxLogPage)
  const pagedLog = todayLog.slice((currentPage - 1) * LOG_PAGE_SIZE, currentPage * LOG_PAGE_SIZE)

  const balancesByColor = useMemo(
    (): Record<StarColor, number> => ({
      yellow: wallet.yellowBalance,
      red: wallet.redBalance,
      blue: wallet.blueBalance,
    }),
    [wallet.yellowBalance, wallet.redBalance, wallet.blueBalance],
  )

  const valueByColor = useMemo(
    (): Record<StarColor, number> => ({
      yellow: starBalanceValueYuan('yellow', balancesByColor.yellow),
      red: starBalanceValueYuan('red', balancesByColor.red),
      blue: starBalanceValueYuan('blue', balancesByColor.blue),
    }),
    [balancesByColor],
  )

  const totalValueYuan = useMemo(
    () => valueByColor.yellow + valueByColor.red + valueByColor.blue,
    [valueByColor],
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
        <div className="mx-auto flex h-14 max-w-[1024px] items-center gap-3 px-4">
          <Link
            href={isTemplateAdmin ? '/admin' : '/setting'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-amber-700 transition hover:scale-110"
            style={{ background: 'rgba(245,158,11,0.10)', border: '1.5px solid rgba(245,158,11,0.30)' }}
            aria-label={isTemplateAdmin ? '返回管理后台' : '返回用户配置'}
          >
            ←
          </Link>
          <div className="flex items-center gap-1.5 text-[17px] font-extrabold text-amber-900">
            <span aria-hidden>🛠</span>
            <span>{isTemplateAdmin ? '管理 · 奖券模板' : '配置 · 星星与奖券'}</span>
          </div>
          {flash && (
            <div
              className="ml-auto rounded-full px-3 py-1 text-[12px] font-extrabold text-emerald-700"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.4)' }}
            >
              ✓ {flash}
            </div>
          )}
          {isAdmin && !isTemplateAdmin && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void handleCompactStars()}
              className={`rounded-full px-3 py-1 text-[11px] font-extrabold text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 ${flash ? '' : 'ml-auto'}`}
              style={{ background: 'rgba(100,116,139,0.10)', border: '1px solid rgba(100,116,139,0.28)' }}
              title="把 7 天前的逐题星星记录按日合并，总额不变"
            >
              {busy === 'compact' ? '合并中…' : '压缩历史记录'}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1024px] space-y-6 px-4 py-6 pb-20">
        {!isTemplateAdmin && <>
        {/* Current balances + face value */}
        <section
          className="rounded-3xl p-5"
          style={{
            background: 'linear-gradient(135deg,rgba(251,191,36,0.10) 0%,rgba(244,63,94,0.08) 50%,rgba(59,130,246,0.10) 100%)',
            border: '1.5px solid rgba(245,158,11,0.22)',
          }}
        >
          <div className="mb-3 flex items-end justify-between gap-3">
            <div className="text-[11px] font-extrabold tracking-[0.22em] text-amber-800/80 uppercase">
              当前余额
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-500">合计面值</div>
              <div className="font-fredoka text-[28px] leading-none font-black tabular-nums text-amber-900">
                {formatYuan(totalValueYuan)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {COLORS.map((c) => {
              const hex = STAR_COLOR_HEX[c]
              const balance = balancesByColor[c]
              const earned = c === 'yellow' ? wallet.yellowEarnedTotal : c === 'red' ? wallet.redEarned : wallet.blueEarned
              const spent = c === 'yellow' ? wallet.yellowSpent : c === 'red' ? wallet.redSpent : wallet.blueSpent
              const faceValue = valueByColor[c]
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
                  <div
                    className="mx-auto mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold tabular-nums"
                    style={{ background: `${hex.primary}18`, color: hex.outline, border: `1px solid ${hex.border}` }}
                  >
                    {STAR_UNIT_PRICE_LABEL[c]}
                  </div>
                  <div
                    className="font-fredoka mt-1.5 text-[15px] font-black tabular-nums"
                    style={{ color: hex.outline }}
                  >
                    {formatYuan(faceValue)}
                  </div>
                  <div className="mt-1 text-[10px] font-bold text-slate-500">
                    赚 {earned} · 花 {spent}
                  </div>
                </div>
              )
            })}
          </div>
          <div
            className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl px-3 py-2 text-[11px] font-bold text-slate-600"
            style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(245,158,11,0.18)' }}
          >
            {COLORS.map((c, i) => {
              const hex = STAR_COLOR_HEX[c]
              return (
                <span key={c} className="inline-flex items-center gap-1 tabular-nums">
                  {i > 0 && <span className="text-slate-300">+</span>}
                  <ColoredStar color={c} size={11} glow={0} />
                  <span style={{ color: hex.outline }}>
                    {balancesByColor[c]}×{STAR_UNIT_PRICE_LABEL[c]}
                  </span>
                  <span className="text-slate-400">= {formatYuan(valueByColor[c])}</span>
                </span>
              )
            })}
          </div>
        </section>

        <StarAdjustmentPanel
          balances={balancesByColor}
          disabled={!!busy}
          helperText="消费无需验证；添加需要管理员权限或家长 PIN"
          onAdjust={handleAdjustStars}
        />

        {/* Grant vouchers */}
        <section>
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-[15px] font-extrabold text-slate-800">赠送兑换券</h2>
            <span className="text-[11px] text-slate-500">点击即赠，不扣星星（标记为 free）</span>
          </div>
          {activeTemplates.length === 0 ? (
            <div className="rounded-xl bg-white/60 py-6 text-center text-[12px] text-slate-400">
              还没有可用模版，去下方“兑换券模版”创建一个
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

        </>}

        {/* Voucher template CRUD */}
        {isTemplateAdmin && <section>
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
        </section>}

        {/* Today's log */}
        {!isTemplateAdmin && <section>
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-[15px] font-extrabold text-slate-800">今日操作日志</h2>
            <span className="text-[11px] text-slate-500">
              {todayLog.length} 条
            </span>
          </div>
          {todayLog.length === 0 ? (
            <div className="rounded-xl bg-white/60 py-6 text-center text-[12px] text-slate-400">
              今天还没有操作
            </div>
          ) : (
            <>
              {/* Today's net totals per color (spends included) */}
              <div
                className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-3 py-2"
                style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(245,158,11,0.18)' }}
              >
                <span className="text-[11px] font-extrabold text-slate-500">今日合计</span>
                {COLORS.map((c) => {
                  const hex = STAR_COLOR_HEX[c]
                  const total = todayTotals[c]
                  return (
                    <span key={c} className="inline-flex items-center gap-1 text-[12px] font-black tabular-nums" style={{ color: hex.outline }}>
                      <ColoredStar color={c} size={13} glow={4} />
                      {total >= 0 ? '+' : ''}{total} {hex.shapeLabel}
                    </span>
                  )
                })}
              </div>
              <div className="space-y-1">
                {pagedLog.map((entry) => {
                  if (entry.kind === 'voucher') {
                    const t = catalog.getById(entry.category)
                    return (
                      <div
                        key={`v-${entry.id}`}
                        className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-[12px]"
                      >
                        <span className="text-[16px]">{t?.emoji ?? '🎫'}</span>
                        <span className="font-extrabold text-slate-700">
                          {t?.label ?? entry.category}
                        </span>
                        {entry.free && (
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-black"
                            style={{ background: 'rgba(16,185,129,0.12)', color: '#065f46' }}
                          >
                            FREE
                          </span>
                        )}
                        <span className="ml-auto font-mono text-[11px] text-slate-400 tabular-nums">
                          {new Date(entry.time).toLocaleTimeString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )
                  }
                  const hex = STAR_COLOR_HEX[entry.color]
                  return (
                    <div
                      key={`s-${entry.id}`}
                      className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-[12px]"
                    >
                      <ColoredStar color={entry.color} size={14} glow={4} />
                      <span className="font-extrabold" style={{ color: hex.outline }}>
                        {entry.amount >= 0 ? '+' : ''}
                        {entry.amount} {hex.cnLabel}
                        {hex.shapeLabel}
                      </span>
                      <span className="ml-auto font-mono text-[11px] text-slate-400 tabular-nums">
                        {new Date(entry.time).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )
                })}
              </div>
              {rawMaxLogPage > 1 && (
                <div className="mt-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setLogPage(currentPage - 1)}
                    className="cursor-pointer rounded-lg px-3 py-1 text-[12px] font-extrabold text-amber-800 transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ background: 'rgba(255,255,255,0.9)', border: '1.5px solid rgba(245,158,11,0.35)' }}
                  >
                    ← 上一页
                  </button>
                  <span className="text-[12px] font-bold text-slate-500 tabular-nums">
                    第 {currentPage} / {rawMaxLogPage} 页
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= rawMaxLogPage}
                    onClick={() => setLogPage(currentPage + 1)}
                    className="cursor-pointer rounded-lg px-3 py-1 text-[12px] font-extrabold text-amber-800 transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ background: 'rgba(255,255,255,0.9)', border: '1.5px solid rgba(245,158,11,0.35)' }}
                  >
                    下一页 →
                  </button>
                </div>
              )}
            </>
          )}
        </section>}
      </main>

      {isTemplateAdmin && modalMode !== null && (
        <VoucherTemplateModal
          initial={modalMode === 'new' ? undefined : modalMode}
          onCancel={() => setModalMode(null)}
          onSubmit={handleSaveTemplate}
        />
      )}
      {parentAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="parent-pin-title"
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            onSubmit={(event) => { event.preventDefault(); void submitParentAction() }}
          >
            <h2 id="parent-pin-title" className="text-lg font-extrabold text-slate-900">需要家长确认</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              {parentAction.kind === 'addStars'
                ? `添加 ${parentAction.amount} 颗${STAR_COLOR_HEX[parentAction.color].shapeLabel}`
                : `免费赠送【${parentAction.template.label}】`}
            </p>
            <label className="mt-5 grid gap-1.5 text-sm font-semibold text-slate-700">
              家长 PIN
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]{6}"
                maxLength={6}
                value={parentPin}
                onChange={(event) => { setParentPin(event.target.value.replace(/\D/g, '').slice(0, 6)); setPinError(null) }}
                aria-describedby={pinError ? 'parent-pin-error' : undefined}
                className="min-h-12 rounded-xl border-2 border-slate-200 px-3 text-center font-mono text-xl tracking-[0.35em] outline-none focus:border-amber-400"
              />
            </label>
            {pinError && <p id="parent-pin-error" className="mt-2 text-sm font-semibold text-red-600">{pinError}</p>}
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={busy === 'parent-action'}
                onClick={() => setParentAction(null)}
                className="min-h-11 flex-1 rounded-xl border border-slate-200 font-semibold text-slate-600 disabled:opacity-50"
              >取消</button>
              <button
                type="submit"
                disabled={parentPin.length !== 6 || busy === 'parent-action'}
                className="min-h-11 flex-1 rounded-xl bg-amber-500 font-extrabold text-white shadow disabled:cursor-not-allowed disabled:opacity-50"
              >{busy === 'parent-action' ? '验证中…' : '确认操作'}</button>
            </div>
          </form>
        </div>
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
