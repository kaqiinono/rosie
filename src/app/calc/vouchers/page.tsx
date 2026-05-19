'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCalcSettings } from '@/hooks/useCalcSettings'
import { useCalcWallet } from '@/hooks/useCalcWallet'
import { useCalcMistakes } from '@/hooks/useCalcMistakes'
import { useCalcVouchers } from '@/hooks/useCalcVouchers'
import CalcAppHeader from '@/components/calc/CalcAppHeader'
import VoucherCard from '@/components/calc/VoucherCard'
import VoucherRedeemModal from '@/components/calc/VoucherRedeemModal'
import EarnStarsModal from '@/components/calc/EarnStarsModal'
import { VOUCHER_PRICE } from '@/utils/calc-helpers'
import { MAX_NUMERIC_LEVEL } from '@/utils/calc-levels'
import { playSfx } from '@/components/calc/audio'
import { launchConfetti } from '@/utils/confetti'
import { todayStr } from '@/utils/constant'
import type { VoucherCategory, CalcLevel } from '@/utils/type'

export default function CalcVouchersPage() {
  const { user } = useAuth()
  const { settings, update } = useCalcSettings(user)
  const wallet = useCalcWallet(user)
  const { mistakes } = useCalcMistakes(user)
  const { vouchers, redeem, markUsed, isLoading } = useCalcVouchers(user)
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [earnOpen, setEarnOpen] = useState(false)

  const { available, used } = useMemo(() => {
    const a: typeof vouchers = []
    const u: typeof vouchers = []
    for (const v of vouchers) {
      (v.usedAt ? u : a).push(v)
    }
    return { available: a, used: u }
  }, [vouchers])

  const canRedeem = wallet.balance >= VOUCHER_PRICE
  const gap = VOUCHER_PRICE - wallet.balance

  // Progress toward next voucher (0-100)
  const pct = Math.min(100, Math.round((wallet.balance / VOUCHER_PRICE) * 100))

  const handleConfirm = async (category: VoucherCategory) => {
    const v = await redeem(category)
    if (v) {
      wallet.spendCoins()
      void wallet.refresh()
      playSfx('redeem', settings.soundEnabled)
      launchConfetti(40)
    }
    setRedeemOpen(false)
  }

  const handleEarnDone = async (starsEarned: number) => {
    setEarnOpen(false)
    if (starsEarned > 0) {
      // Record a mini session to persist coins
      await wallet.recordSession({
        date: todayStr(),
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        count: starsEarned,
        correctCount: starsEarned,
        retryCount: 0,
        wrongCount: 0,
        challengeCorrect: 0,
        timeSpentSec: 0,
        coinsEarned: starsEarned,
        mode: 'free',
        maxStreak: 0,
        topLevel: (typeof settings.currentLevel === 'number'
          ? Math.min(settings.currentLevel + 1, MAX_NUMERIC_LEVEL)
          : settings.currentLevel) as CalcLevel,
      })
      if (starsEarned > 0) {
        playSfx('coin', settings.soundEnabled)
        launchConfetti(20)
      }
    }
  }

  return (
    <>
      <CalcAppHeader
        balance={wallet.balance}
        soundEnabled={settings.soundEnabled}
        onToggleSound={() => update({ soundEnabled: !settings.soundEnabled })}
        title="我的奖券"
        backHref="/calc"
        backLabel="口算"
      />

      <main className="mx-auto max-w-[640px] px-4 pt-5 pb-12 space-y-5 relative">

        {/* ── Star wallet card ── */}
        <section
          className="rounded-3xl p-5 text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(249,168,212,0.08) 50%, rgba(165,243,252,0.06) 100%)',
            border: '1.5px solid rgba(251,191,36,0.2)',
            boxShadow: '0 8px 32px rgba(251,191,36,0.08)',
          }}
        >
          {/* Decorative corner stars */}
          <div className="pointer-events-none absolute top-2 left-3 text-[20px] opacity-30" style={{ animation: 'bounce-slow 2.5s ease-in-out infinite' }}>✨</div>
          <div className="pointer-events-none absolute top-3 right-4 text-[16px] opacity-25" style={{ animation: 'bounce-slow 3s ease-in-out infinite 0.8s' }}>⭐</div>
          <div className="pointer-events-none absolute bottom-2 left-8 text-[12px] opacity-20" style={{ animation: 'bounce-slow 2.8s ease-in-out infinite 0.4s' }}>🌟</div>

          <div className="text-[10px] font-extrabold tracking-widest uppercase mb-1" style={{ color: 'rgba(251,191,36,0.5)' }}>
            我的星星
          </div>

          {/* Big star balance */}
          <div
            className="my-1 font-fredoka text-[44px] font-black tabular-nums leading-none"
            style={{
              background: 'linear-gradient(135deg, #fbbf24 0%, #f9a8d4 60%, #a5f3fc 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            ⭐ {wallet.balance}
          </div>
          <div className="text-[12px] mt-0.5 mb-3" style={{ color: 'rgba(251,191,36,0.5)' }}>
            每张奖券需要 {VOUCHER_PRICE} ⭐
          </div>

          {/* Progress bar to next voucher */}
          {!canRedeem && (
            <div className="mb-3">
              <div
                className="h-2.5 rounded-full overflow-hidden mb-1.5"
                style={{ background: 'rgba(255,255,255,0.07)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: 'linear-gradient(90deg, #fbbf24, #f9a8d4)',
                    boxShadow: '0 0 10px rgba(251,191,36,0.4)',
                  }}
                />
              </div>
              <div className="text-[10px] font-semibold" style={{ color: 'rgba(251,191,36,0.45)' }}>
                {pct}% · 还差 {gap} ⭐
              </div>
            </div>
          )}

          {/* CTA buttons */}
          {canRedeem ? (
            <button
              type="button"
              onClick={() => setRedeemOpen(true)}
              className="w-full rounded-2xl px-5 py-3.5 text-[16px] font-black text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
              style={{
                background: 'linear-gradient(135deg, #d97706, #ec4899)',
                boxShadow: '0 6px 24px rgba(245,158,11,0.35)',
              }}
            >
              🎁 兑换奖券！
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEarnOpen(true)}
              className="w-full rounded-2xl px-5 py-3.5 text-[16px] font-black text-white transition-all hover:-translate-y-0.5 active:translate-y-0 group"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #db2777)',
                boxShadow: '0 6px 24px rgba(139,92,246,0.3)',
              }}
            >
              <span className="inline-block transition-transform group-hover:scale-110">✨</span>{' '}
              去答题攒星星！还差 {gap} ⭐{' '}
              <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
            </button>
          )}
        </section>

        {/* ── Loading ── */}
        {isLoading && (
          <div className="py-10 text-center text-[13px]" style={{ color: 'rgba(196,181,253,0.4)' }}>
            加载中…
          </div>
        )}

        {/* ── Available vouchers ── */}
        {!isLoading && available.length > 0 && (
          <section>
            <div className="mb-2 flex items-center gap-2">
              <h2
                className="text-[11px] font-extrabold tracking-widest uppercase"
                style={{ color: 'rgba(196,181,253,0.45)' }}
              >
                可使用
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                style={{ background: 'rgba(249,168,212,0.2)', color: '#f9a8d4' }}
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
            <div className="mb-2 flex items-center gap-2">
              <h2
                className="text-[11px] font-extrabold tracking-widest uppercase"
                style={{ color: 'rgba(245,243,255,0.2)' }}
              >
                已使用
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)' }}
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

        {/* ── Empty state ── */}
        {!isLoading && vouchers.length === 0 && (
          <div
            className="rounded-3xl px-6 py-10 text-center"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '2px dashed rgba(251,191,36,0.15)',
            }}
          >
            <div
              className="text-5xl mb-3"
              style={{ animation: 'bounce-slow 2s ease-in-out infinite' }}
            >
              🎁
            </div>
            <div className="text-[14px] font-extrabold mb-1" style={{ color: '#fde68a' }}>
              还没有奖券～
            </div>
            <div className="text-[12px]" style={{ color: 'rgba(253,230,138,0.45)' }}>
              攒够 {VOUCHER_PRICE} ⭐ 就可以兑换啦！加油！
            </div>
            <button
              type="button"
              onClick={() => setEarnOpen(true)}
              className="mt-4 rounded-2xl px-5 py-2.5 text-[14px] font-black text-white transition-all hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #db2777)',
                boxShadow: '0 4px 16px rgba(139,92,246,0.3)',
              }}
            >
              ✨ 马上去攒！
            </button>
          </div>
        )}
      </main>

      {redeemOpen && (
        <VoucherRedeemModal
          balance={wallet.balance}
          onCancel={() => setRedeemOpen(false)}
          onConfirm={handleConfirm}
        />
      )}

      {earnOpen && (
        <EarnStarsModal
          gap={Math.max(1, gap)}
          settings={settings}
          mistakes={mistakes}
          soundEnabled={settings.soundEnabled}
          onClose={handleEarnDone}
        />
      )}
    </>
  )
}
