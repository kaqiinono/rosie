'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CalcVouchersRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/vouchers') }, [router])
  return null
}
