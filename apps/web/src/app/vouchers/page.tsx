'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { useCalcWallet } from '@rosie/rewards'
import { useCalcVouchers } from '@rosie/rewards'
import { templateTotalPrice, useVoucherCatalog } from '@rosie/rewards'
import VoucherCard from '@/components/calc/VoucherCard'
import { playSfx } from '@/components/calc/audio'
import { launchConfetti } from '@rosie/core'
import type { VoucherCategory, VoucherTemplate } from '@rosie/core'
import { ColoredStar } from '@rosie/rewards'
import { STAR_COLOR_HEX } from '@rosie/rewards'

export default function VouchersPage() {
  const { user } = useAuth()
  const wallet = useCalcWallet(user)
  const { vouchers, redeem, markUsed, isLoading } = useCalcVouchers(user)
  const catalog = useVoucherCatalog(user)
  const [redeeming, setRedeeming] = useState<VoucherCategory | null>(null)

  // Catalog shown in shop: active (non-archived) templates, sorted by total price
  const shopTemplates = useMemo(
    () => [...catalog.visible].sort((a, b) => templateTotalPrice(a) - templateTotalPrice(b)),
    [catalog.visible],
  )

  const { available, used } = useMemo(() => {
    const a: typeof vouchers = []
    const u: typeof vouchers = []
    for (const v of vouchers) {
      ;(v.usedAt ? u : a).push(v)
    }
    return { available: a, used: u }
  }, [vouchers])

  const canAffordTemplate = (t: VoucherTemplate): boolean =>
    wallet.yellowBalance >= t.priceYellow
    && wallet.redBalance >= t.priceRed
    && wallet.blueBalance >= t.priceBlue

  const affordableCount = shopTemplates.filter(canAffordTemplate).length

  const handleRedeem = async (t: VoucherTemplate) => {
    if (redeeming) return
    if (!canAffordTemplate(t)) return
    const costStr = `口算 ${t.priceYellow}⭐ · 英语 ${t.priceRed}⭐ · 数学 ${t.priceBlue}⭐`
    if (!window.confirm(`确定花 ${costStr} 兑换【${t.label}】？`)) return
    setRedeeming(t.category)
    try {
      const v = await redeem(t)
      if (v) {
        await wallet.spendVoucher(t.category)
        await wallet.refresh()
        playSfx('redeem', true)
        launchConfetti(40)
      } else {
        alert('兑换失败，请重试')
      }
    } finally {
      setRedeeming(null)
    }
  }

  return (
    <>
      {/* ── Ambient background ── */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% -5%, rgba(251,191,36,0.10) 0%, transparent 60%), linear-gradient(160deg, #fffbeb 0%, #fff1f2 45%, #eff6ff 100%)',
        }}
      />

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-30"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(245,158,11,0.18)',
          boxShadow: '0 2px 14px rgba(251,191,36,0.08)',
        }}
      >
        <div className="mx-auto flex h-14 max-w-[640px] items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full no-underline transition-all hover:scale-110"
            style={{
              background: 'rgba(245,158,11,0.10)',
              border: '1.5px solid rgba(245,158,11,0.30)',
              color: '#b45309',
            }}
            aria-label="返回首页"
          >
            <span className="text-[15px] leading-none font-bold">←</span>
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <div className="hidden shrink-0 items-center -space-x-1 sm:flex">
              <ColoredStar color="yellow" size={18} />
              <ColoredStar color="red" size={18} />
              <ColoredStar color="blue" size={18} />
            </div>
            <span
              className="truncate text-[17px] font-extrabold tracking-tight sm:ml-1 sm:text-[19px]"
              style={{ color: '#7c2d12' }}
            >
              我的奖券
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[640px] space-y-5 px-3 pt-5 pb-16 sm:space-y-6 sm:px-4 sm:pt-6">
        {/* ── Star balance hero ── */}
        <section
          className="relative overflow-hidden rounded-3xl p-4 sm:p-6"
          style={{
            background:
              'linear-gradient(135deg, rgba(251,191,36,0.10) 0%, rgba(244,63,94,0.08) 50%, rgba(59,130,246,0.10) 100%)',
            border: '1.5px solid rgba(245,158,11,0.22)',
            boxShadow: '0 12px 40px rgba(251,191,36,0.10), inset 0 1px 0 rgba(255,255,255,0.6)',
          }}
        >
          {/* Decorative glow orbs */}
          <div
            className="pointer-events-none absolute -top-10 -right-10 h-36 w-36 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(251,191,36,0.28) 0%, transparent 70%)',
            }}
          />
          <div
            className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(59,130,246,0.22) 0%, transparent 70%)',
            }}
          />

          <div className="relative text-center">
            <div
              className="text-[11px] font-extrabold tracking-[0.22em] uppercase"
              style={{ color: '#92400e' }}
            >
              我的星星余额
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                {
                  color: 'yellow' as const,
                  label: '口算',
                  value: wallet.yellowBalance,
                  bg: 'rgba(245,158,11,0.14)',
                  border: 'rgba(245,158,11,0.55)',
                  href: '/calc',
                  emoji: '🧮',
                },
                {
                  color: 'red' as const,
                  label: '英语',
                  value: wallet.redBalance,
                  bg: 'rgba(239,68,68,0.14)',
                  border: 'rgba(239,68,68,0.55)',
                  href: '/english/words',
                  emoji: '📖',
                },
                {
                  color: 'blue' as const,
                  label: '数学',
                  value: wallet.blueBalance,
                  bg: 'rgba(37,99,235,0.14)',
                  border: 'rgba(37,99,235,0.55)',
                  href: '/math',
                  emoji: '🔢',
                },
              ].map((c) => {
                const hex = STAR_COLOR_HEX[c.color]
                return (
                  <Link
                    key={c.color}
                    href={c.href}
                    aria-label={`去${c.label}赚${hex.shapeLabel}`}
                    className="group relative block cursor-pointer overflow-hidden rounded-2xl px-1.5 py-2.5 no-underline transition-all hover:-translate-y-0.5 sm:px-2 sm:py-3"
                    style={{
                      background: `linear-gradient(160deg, ${c.bg}, rgba(255,255,255,0.55))`,
                      border: `1.5px solid ${c.border}`,
                      boxShadow: `0 4px 16px ${hex.primary}33, inset 0 1px 0 rgba(255,255,255,0.6)`,
                    }}
                  >
                    {/* corner color flag for unmistakable category tag */}
                    <div
                      className="pointer-events-none absolute -top-2 -right-2 h-12 w-12 rounded-full opacity-55"
                      style={{
                        background: `radial-gradient(circle, ${hex.primary}, transparent 70%)`,
                      }}
                      aria-hidden
                    />
                    <div className="relative flex justify-center">
                      <ColoredStar color={c.color} size={30} withBadge glow={10} />
                    </div>
                    <div
                      className="font-fredoka mt-1.5 text-center text-[22px] leading-none font-black tabular-nums sm:text-[26px]"
                      style={{ color: hex.outline }}
                    >
                      {c.value}
                    </div>
                    <div className="mt-1.5 flex justify-center">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold transition-transform group-hover:translate-x-0.5 sm:text-[12px]"
                        style={{
                          background: `${hex.primary}2e`,
                          color: hex.outline,
                          border: `1px solid ${hex.primary}99`,
                        }}
                      >
                        <span aria-hidden>{c.emoji}</span>
                        <span>去{c.label}</span>
                        <span aria-hidden className="font-black">→</span>
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>

            <div className="mt-3 min-h-[22px]">
              {affordableCount > 0 ? (
                <p className="text-[13px] font-bold" style={{ color: '#047857' }}>
                  ✨ 可兑换 {affordableCount} 种奖券，快去选一个吧！
                </p>
              ) : (
                <p className="text-[13px] font-semibold" style={{ color: '#475569' }}>
                  收集三种颜色的星星，解锁更多奖券
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Redeem shop ── */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[13px] font-extrabold tracking-wide" style={{ color: '#334155' }}>
              兑换商店
            </span>
            {affordableCount > 0 && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-extrabold"
                style={{
                  background: 'rgba(5,150,105,0.16)',
                  color: '#047857',
                  border: '1px solid rgba(5,150,105,0.30)',
                }}
              >
                {affordableCount} 可兑换
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
            {shopTemplates.map((t) => {
              const meta = { emoji: t.emoji, label: t.label, gradient: t.gradient }
              const [py, pr, pb] = [t.priceYellow, t.priceRed, t.priceBlue]
              const canAfford = canAffordTemplate(t)
              const isRedeeming = redeeming === t.category
              const missY = Math.max(0, py - wallet.yellowBalance)
              const missR = Math.max(0, pr - wallet.redBalance)
              const missB = Math.max(0, pb - wallet.blueBalance)
              const priceList = [
                { color: 'yellow' as const, value: py },
                { color: 'red' as const, value: pr },
                { color: 'blue' as const, value: pb },
              ].filter((c) => c.value > 0)
              const missList = [
                { color: 'yellow' as const, miss: missY },
                { color: 'red' as const, miss: missR },
                { color: 'blue' as const, miss: missB },
              ].filter((c) => c.miss > 0)
              return (
                <button
                  key={t.category}
                  type="button"
                  disabled={!canAfford || !!redeeming}
                  onClick={() => handleRedeem(t)}
                  className="group relative flex min-h-[140px] flex-col overflow-hidden rounded-2xl p-3 text-left transition-all duration-200 sm:min-h-[150px]"
                  style={{
                    background: canAfford ? 'rgba(255,255,255,0.88)' : 'rgba(248,250,252,0.75)',
                    border: canAfford
                      ? '1.5px solid rgba(15,23,42,0.10)'
                      : '1.5px solid rgba(15,23,42,0.06)',
                    cursor: canAfford && !redeeming ? 'pointer' : 'not-allowed',
                    boxShadow: canAfford ? '0 4px 18px rgba(15,23,42,0.08)' : 'none',
                    transform: isRedeeming ? 'scale(0.95)' : undefined,
                  }}
                >
                  {/* Static tinted base */}
                  {canAfford && (
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-[0.18]`}
                    />
                  )}

                  {/* Hover glow */}
                  {canAfford && (
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-0 transition-opacity duration-200 group-hover:opacity-30`}
                    />
                  )}

                  <div className="relative flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-1">
                      <div
                        className={`text-[28px] leading-none transition-all duration-200 sm:text-[30px] ${canAfford ? '' : 'opacity-30 grayscale'}`}
                      >
                        {meta.emoji}
                      </div>
                      {!canAfford && !isRedeeming && (
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide uppercase"
                          style={{
                            background: 'rgba(148,163,184,0.20)',
                            color: '#475569',
                            border: '1px solid rgba(148,163,184,0.35)',
                          }}
                        >
                          未解锁
                        </span>
                      )}
                    </div>

                    <div
                      className="mt-1.5 text-[13px] leading-tight font-extrabold sm:text-[14px]"
                      style={{ color: canAfford ? '#0f172a' : '#475569' }}
                    >
                      {meta.label}
                    </div>

                    {isRedeeming ? (
                      <div
                        className="mt-2 animate-pulse text-[12px] font-black tabular-nums"
                        style={{ color: '#b45309' }}
                      >
                        兑换中…
                      </div>
                    ) : canAfford ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {priceList.map((c) => {
                          const hex = STAR_COLOR_HEX[c.color]
                          return (
                            <span
                              key={c.color}
                              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-black tabular-nums sm:text-[12px]"
                              style={{
                                background: `${hex.primary}2a`,
                                color: hex.outline,
                                border: `1.5px solid ${hex.primary}99`,
                              }}
                            >
                              <ColoredStar color={c.color} size={12} glow={5} />
                              {c.value}
                            </span>
                          )
                        })}
                      </div>
                    ) : (
                      <div
                        className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] font-bold tabular-nums"
                        style={{ color: '#94a3b8' }}
                      >
                        <span className="text-[10px] tracking-wider uppercase">需要</span>
                        {priceList.map((c, i) => (
                          <span key={c.color} className="inline-flex items-center gap-0.5">
                            {i > 0 && <span className="opacity-60">·</span>}
                            <ColoredStar color={c.color} size={10} glow={0} />
                            {c.value}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* spacer pushes the "还差" focal callout to the bottom */}
                    <div className="flex-1" />

                    {!canAfford && !isRedeeming && missList.length > 0 && (
                      <div
                        className="mt-2 flex flex-wrap items-center gap-1 rounded-lg px-1.5 py-1"
                        style={{
                          background: 'rgba(220,38,38,0.10)',
                          border: '1.5px solid rgba(220,38,38,0.35)',
                        }}
                      >
                        <span
                          className="text-[11px] leading-none font-black"
                          style={{ color: '#b91c1c' }}
                        >
                          还差
                        </span>
                        {missList.map((c) => {
                          const hex = STAR_COLOR_HEX[c.color]
                          return (
                            <span
                              key={c.color}
                              className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-black tabular-nums"
                              style={{
                                background: `${hex.primary}33`,
                                color: hex.outline,
                              }}
                            >
                              <ColoredStar color={c.color} size={11} glow={3} />
                              {c.miss}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Loading ── */}
        {isLoading && (
          <div className="py-12 text-center">
            <div
              className="inline-flex items-center gap-2 text-[14px] font-semibold"
              style={{ color: '#475569' }}
            >
              <span className="inline-block animate-spin">
                <ColoredStar color="yellow" size={16} />
              </span>
              加载中…
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!isLoading && vouchers.length === 0 && (
          <div className="py-10 text-center">
            <div className="mb-3 text-[36px] opacity-70">🎫</div>
            <div className="text-[15px] font-extrabold" style={{ color: '#334155' }}>
              还没有奖券
            </div>
            <div className="mt-1.5 text-[13px] font-semibold" style={{ color: '#64748b' }}>
              快去赚星星，兑换你的第一张奖券吧
            </div>
          </div>
        )}

        {/* ── Available vouchers ── */}
        {!isLoading && available.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-[13px] font-extrabold tracking-wide" style={{ color: '#334155' }}>
                可使用
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-extrabold"
                style={{
                  background: 'rgba(236,72,153,0.18)',
                  color: '#9d174d',
                  border: '1px solid rgba(236,72,153,0.35)',
                }}
              >
                {available.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
              {available.map((v) => (
                <VoucherCard
                  key={v.id}
                  voucher={v}
                  template={catalog.getById(v.category)}
                  onMarkUsed={() => {
                    if (window.confirm('确定标记为已使用？')) {
                      void markUsed(v.id)
                    }
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Used vouchers ── */}
        {!isLoading && used.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-[13px] font-extrabold tracking-wide" style={{ color: '#64748b' }}>
                已使用
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-extrabold"
                style={{
                  background: 'rgba(15,23,42,0.10)',
                  color: '#64748b',
                  border: '1px solid rgba(15,23,42,0.18)',
                }}
              >
                {used.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {used.map((v) => (
                <VoucherCard key={v.id} voucher={v} template={catalog.getById(v.category)} />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  )
}
