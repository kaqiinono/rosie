'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import type { Voucher, VoucherCategory, VoucherTemplate } from '@rosie/core'
import { templateTotalPrice } from './useVoucherCatalog'

interface VoucherRow {
  id: string
  category: VoucherCategory
  redeemed_at: string
  used_at: string | null
  coins_spent: number
}

function rowToVoucher(r: VoucherRow): Voucher {
  return {
    id: r.id,
    category: r.category,
    redeemedAt: r.redeemed_at,
    usedAt: r.used_at,
    coinsSpent: r.coins_spent,
  }
}

export function useCalcVouchers(user: User | null) {
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [isLoading, setIsLoading] = useState(() => user !== null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const init = async () => {
      const { data } = await supabase
        .from('calc_vouchers')
        .select('id,category,redeemed_at,used_at,coins_spent')
        .eq('user_id', user.id)
        .order('redeemed_at', { ascending: false })
      if (cancelled) return
      setVouchers((data ?? []).map(r => rowToVoucher(r as VoucherRow)))
      setIsLoading(false)
    }
    void init()
    return () => { cancelled = true }
  }, [user])

  const refresh = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('calc_vouchers')
      .select('id,category,redeemed_at,used_at,coins_spent')
      .eq('user_id', user.id)
      .order('redeemed_at', { ascending: false })
    setVouchers((data ?? []).map(r => rowToVoucher(r as VoucherRow)))
  }, [user])

  const redeem = useCallback(
    async (template: VoucherTemplate): Promise<Voucher | null> => {
      if (!user) return null
      try {
        const { data, error } = await supabase
          .from('calc_vouchers')
          .insert({
            user_id: user.id,
            category: template.category,
            coins_spent: templateTotalPrice(template),
            free: false,
          })
          .select('id,category,redeemed_at,used_at,coins_spent')
          .single()
        if (error || !data) {
          console.error('[calc_vouchers] redeem failed', { category: template.category, error })
          return null
        }
        const v = rowToVoucher(data as VoucherRow)
        setVouchers(prev => [v, ...prev])
        return v
      } catch (err) {
        console.error('[calc_vouchers] redeem threw', err)
        return null
      }
    },
    [user],
  )

  /**
   * Admin grant: create a voucher without deducting any stars from balance.
   * Persists `free=true` so `useCalcWallet` skips it in spent totals.
   */
  const grantFree = useCallback(
    async (template: VoucherTemplate): Promise<Voucher | null> => {
      if (!user) return null
      const { data, error } = await supabase
        .from('calc_vouchers')
        .insert({ user_id: user.id, category: template.category, coins_spent: 0, free: true })
        .select('id,category,redeemed_at,used_at,coins_spent')
        .single()
      if (error || !data) {
        console.error('[calc_vouchers] grant failed', error)
        return null
      }
      const v = rowToVoucher(data as VoucherRow)
      setVouchers(prev => [v, ...prev])
      return v
    },
    [user],
  )

  const markUsed = useCallback(
    async (id: string) => {
      if (!user) return
      const nowIso = new Date().toISOString()
      try {
        await supabase
          .from('calc_vouchers')
          .update({ used_at: nowIso })
          .eq('user_id', user.id)
          .eq('id', id)
      } catch { /* ignore */ }
      setVouchers(prev => prev.map(v => v.id === id ? { ...v, usedAt: nowIso } : v))
    },
    [user],
  )

  return { vouchers, redeem, grantFree, markUsed, refresh, isLoading }
}
