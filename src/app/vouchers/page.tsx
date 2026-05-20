'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useCalcWallet } from '@/hooks/useCalcWallet'
import { useCalcVouchers } from '@/hooks/useCalcVouchers'
import VoucherCard from '@/components/calc/VoucherCard'
import { VOUCHER_META, VOUCHER_PRICES } from '@/utils/calc-helpers'
import { playSfx } from '@/components/calc/audio'
import { launchConfetti } from '@/utils/confetti'
import type { VoucherCategory } from '@/utils/type'

const CATEGORIES = (Object.keys(VOUCHER_PRICES) as VoucherCategory[])
  .sort((a, b) => (VOUCHER_PRICES[a] ?? 0) - (VOUCHER_PRICES[b] ?? 0))

const EARN_MODULES = [
  { href: '/calc', emoji: '🧮', label: '口算答题', desc: '闯关赚星星', color: 'from-violet-500/25 to-purple-500/10', borderColor: 'rgba(139,92,246,0.35)' },
  { href: '/english/words', emoji: '📖', label: '英语练习', desc: '测验得星星', color: 'from-emerald-500/25 to-teal-500/10', borderColor: 'rgba(16,185,129,0.35)' },
  { href: '/math', emoji: '🔢', label: '数学题目', desc: '解题赚星星', color: 'from-blue-500/25 to-indigo-500/10', borderColor: 'rgba(59,130,246,0.35)' },
]

export default function VouchersPage() {
  const { user } = useAuth()
  const wallet = useCalcWallet(user)
  const { vouchers, redeem, markUsed, isLoading } = useCalcVouchers(user)
  const [redeeming, setRedeeming] = useState<VoucherCategory | null>(null)

  const { available, used } = useMemo(() => {
    const a: typeof vouchers = []
    const u: typeof vouchers = []
    for (const v of vouchers) {
      (v.usedAt ? u : a).push(v)
    }
    return { available: a, used: u }
  }, [vouchers])

  const affordableCount = CATEGORIES.filter(c => wallet.balance >= (VOUCHER_PRICES[c] ?? 50)).length
  const cheapestPrice = VOUCHER_PRICES[CATEGORIES[0]] ?? 50
  const starsToNext = wallet.balance < cheapestPrice ? cheapestPrice - wallet.balance : 0

  const handleRedeem = async (category: VoucherCategory) => {
    const price = VOUCHER_PRICES[category] ?? 50
    if (wallet.balance < price || redeeming) return
    const meta = VOUCHER_META[category]
    if (!window.confirm(`确定花 ${price} ⭐ 兑换【${meta?.label ?? category}】？`)) return
    setRedeeming(category)
    try {
      const v = await redeem(category)
      if (v) {
        await wallet.spendCoins(price)
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
          background: 'radial-gradient(ellipse 70% 50% at 50% -5%, rgba(139,92,246,0.18) 0%, transparent 60%), linear-gradient(180deg, #0a091e 0%, #0c0b22 100%)',
        }}
      />

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-30"
        style={{
          background: 'rgba(10,9,30,0.8)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(139,92,246,0.13)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        <div className="mx-auto flex h-14 max-w-[640px] items-center gap-3 px-4">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-violet-300 no-underline transition-all hover:scale-110 hover:text-white"
            style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}
          >
            <span className="text-[15px] font-bold leading-none">←</span>
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-xl">⭐</span>
            <span
              className="font-fredoka truncate text-[18px] font-extrabold tracking-tight"
              style={{
                background: 'linear-gradient(90deg, #fbbf24, #f9a8d4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              我的奖券
            </span>
          </div>

          <div
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{
              background: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.22)',
            }}
          >
            <span className="text-[13px] leading-none">⭐</span>
            <span className="font-fredoka text-[15px] font-black tabular-nums" style={{ color: '#fbbf24' }}>
              {wallet.balance}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[640px] px-4 pt-6 pb-16 space-y-6">

        {/* ── Star balance hero ── */}
        <section
          className="relative overflow-hidden rounded-3xl p-6"
          style={{
            background: 'linear-gradient(135deg, rgba(251,191,36,0.09) 0%, rgba(249,168,212,0.06) 50%, rgba(139,92,246,0.07) 100%)',
            border: '1.5px solid rgba(251,191,36,0.15)',
            boxShadow: '0 16px 48px rgba(251,191,36,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Decorative glow orbs */}
          <div
            className="pointer-events-none absolute -top-10 -right-10 h-36 w-36 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.2) 0%, transparent 70%)' }}
          />
          <div
            className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(249,168,212,0.15) 0%, transparent 70%)' }}
          />

          <div className="relative text-center">
            <div
              className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: 'rgba(251,191,36,0.45)' }}
            >
              我的星星余额
            </div>

            <div
              className="my-2 font-fredoka text-[60px] font-black tabular-nums leading-none"
              style={{
                background: 'linear-gradient(135deg, #fbbf24 0%, #fde68a 35%, #f9a8d4 70%, #c4b5fd 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 24px rgba(251,191,36,0.25))',
              }}
            >
              {wallet.balance}
            </div>

            <div className="min-h-[20px]">
              {starsToNext > 0 ? (
                <p className="text-[12px] font-semibold" style={{ color: 'rgba(196,181,253,0.55)' }}>
                  再赚{' '}
                  <span className="font-extrabold" style={{ color: '#fbbf24' }}>
                    {starsToNext} ⭐
                  </span>{' '}
                  可兑换最便宜的奖券
                </p>
              ) : affordableCount > 0 ? (
                <p className="text-[12px] font-semibold" style={{ color: '#34d399' }}>
                  ✨ 可兑换 {affordableCount} 种奖券，快去选一个吧！
                </p>
              ) : null}
            </div>

            {/* ── Earn module links ── */}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {EARN_MODULES.map(m => (
                <Link
                  key={m.href}
                  href={m.href}
                  className={`flex items-center gap-2 rounded-2xl bg-gradient-to-br px-3.5 py-2 no-underline transition-all hover:-translate-y-0.5 ${m.color}`}
                  style={{ border: `1px solid ${m.borderColor}` }}
                >
                  <span className="text-[18px] leading-none">{m.emoji}</span>
                  <div className="text-left">
                    <div className="text-[11px] font-extrabold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                      {m.label}
                    </div>
                    <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                      {m.desc}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Redeem shop ── */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span
              className="text-[11px] font-extrabold uppercase tracking-[0.15em]"
              style={{ color: 'rgba(196,181,253,0.45)' }}
            >
              兑换商店
            </span>
            {affordableCount > 0 && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                style={{ background: 'rgba(52,211,153,0.13)', color: '#34d399' }}
              >
                {affordableCount} 可兑换
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {CATEGORIES.map(cat => {
              const meta = VOUCHER_META[cat]
              const price = VOUCHER_PRICES[cat] ?? 50
              const canAfford = wallet.balance >= price
              const isRedeeming = redeeming === cat
              return (
                <button
                  key={cat}
                  type="button"
                  disabled={!canAfford || !!redeeming}
                  onClick={() => handleRedeem(cat)}
                  className="group relative overflow-hidden rounded-2xl p-3 text-left transition-all duration-200"
                  style={{
                    background: canAfford ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.025)',
                    border: canAfford
                      ? '1px solid rgba(255,255,255,0.14)'
                      : '1px solid rgba(255,255,255,0.05)',
                    cursor: canAfford && !redeeming ? 'pointer' : 'not-allowed',
                    boxShadow: canAfford ? '0 4px 20px rgba(0,0,0,0.22)' : 'none',
                    transform: isRedeeming ? 'scale(0.95)' : undefined,
                  }}
                >
                  {/* Static tinted base */}
                  {canAfford && (
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-[0.11]`}
                    />
                  )}

                  {/* Hover glow */}
                  {canAfford && (
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-0 transition-opacity duration-200 group-hover:opacity-20`}
                    />
                  )}

                  <div className="relative">
                    <div
                      className={`text-[30px] leading-none transition-all duration-200 ${canAfford ? '' : 'opacity-25 grayscale'}`}
                    >
                      {meta.emoji}
                    </div>
                    <div
                      className="mt-1.5 text-[12px] font-extrabold leading-tight"
                      style={{ color: canAfford ? '#e9d5ff' : 'rgba(245,243,255,0.28)' }}
                    >
                      {meta.label}
                    </div>
                    <div
                      className="mt-1 text-[11px] font-black tabular-nums"
                      style={{ color: canAfford ? '#fbbf24' : 'rgba(251,191,36,0.3)' }}
                    >
                      {isRedeeming ? (
                        <span className="animate-pulse">兑换中…</span>
                      ) : (
                        <>{price} ⭐</>
                      )}
                    </div>
                    {!canAfford && (
                      <div
                        className="mt-0.5 text-[10px] font-bold"
                        style={{ color: 'rgba(248,113,113,0.55)' }}
                      >
                        差 {price - wallet.balance} ⭐
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
              className="inline-flex items-center gap-2 text-[13px]"
              style={{ color: 'rgba(196,181,253,0.38)' }}
            >
              <span className="animate-spin text-[16px]">⭐</span>
              加载中…
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!isLoading && vouchers.length === 0 && (
          <div className="py-10 text-center">
            <div className="mb-3 text-[36px] opacity-50">🎫</div>
            <div
              className="text-[13px] font-bold"
              style={{ color: 'rgba(196,181,253,0.4)' }}
            >
              还没有奖券
            </div>
            <div
              className="mt-1 text-[12px]"
              style={{ color: 'rgba(196,181,253,0.25)' }}
            >
              快去赚星星，兑换你的第一张奖券吧
            </div>
          </div>
        )}

        {/* ── Available vouchers ── */}
        {!isLoading && available.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2
                className="text-[11px] font-extrabold uppercase tracking-[0.15em]"
                style={{ color: 'rgba(196,181,253,0.45)' }}
              >
                可使用
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                style={{ background: 'rgba(249,168,212,0.13)', color: '#f9a8d4' }}
              >
                {available.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {available.map(v => (
                <VoucherCard
                  key={v.id}
                  voucher={v}
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
              <h2
                className="text-[11px] font-extrabold uppercase tracking-[0.15em]"
                style={{ color: 'rgba(245,243,255,0.18)' }}
              >
                已使用
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }}
              >
                {used.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {used.map(v => (
                <VoucherCard key={v.id} voucher={v} />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  )
}
