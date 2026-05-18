'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Voucher, VoucherCategory } from '@/utils/type'

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
    async (category: VoucherCategory): Promise<Voucher | null> => {
      if (!user) return null
      try {
        const { data, error } = await supabase
          .from('calc_vouchers')
          .insert({ user_id: user.id, category, coins_spent: 50 })
          .select('id,category,redeemed_at,used_at,coins_spent')
          .single()
        if (error || !data) return null
        const v = rowToVoucher(data as VoucherRow)
        setVouchers(prev => [v, ...prev])
        return v
      } catch {
        return null
      }
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

  return { vouchers, redeem, markUsed, refresh, isLoading }
}
