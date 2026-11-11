'use client'

import Link from 'next/link'
import { PageShell } from '@rosie/ui'
import { Button } from '@rosie/ui/themes'
import TodayDashboard from '@/components/today/TodayDashboard'
import TodayProgressBackup from '@/components/today/TodayProgressBackup'

function todayLabel() {
  const d = new Date()
  const months = [
    '1月',
    '2月',
    '3月',
    '4月',
    '5月',
    '6月',
    '7月',
    '8月',
    '9月',
    '10月',
    '11月',
    '12月',
  ]
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${months[d.getMonth()]}${d.getDate()}日 ${days[d.getDay()]}`
}

export default function TodayPage() {
  const label = todayLabel()

  return (
    <PageShell
      tone="mint"
      width="default"
      padded={false}
      backHref="/"
      icon="🗓️"
      title="今日计划"
      subtitle={label}
      actions={
        <>
          <Button asChild size="1" variant="soft" color="sky" radius="full">
            <Link href="/today/calendar">🗓️ 日历</Link>
          </Button>
          <Button asChild size="1" variant="soft" color="amber" radius="full">
            <Link href="/today/records">📈 记录</Link>
          </Button>
          <Button asChild size="1" variant="soft" color="green" radius="full">
            <Link href="/today/report">📊 报告</Link>
          </Button>
        </>
      }
    >
      <div className="pt-5">
        <TodayProgressBackup />
        <TodayDashboard />
      </div>
    </PageShell>
  )
}
