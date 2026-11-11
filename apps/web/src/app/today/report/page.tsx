'use client'

import Link from 'next/link'
import { PageShell } from '@rosie/ui'
import { Button } from '@rosie/ui/themes'
import TodayReport from '@/components/today/TodayReport'

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

export default function TodayReportPage() {
  const label = todayLabel()

  return (
    <PageShell
      tone="mint"
      width="default"
      padded={false}
      backHref="/today"
      icon="📊"
      title="今日练习报告"
      subtitle={label}
      actions={
        <>
          <Button asChild size="1" variant="soft" color="amber" radius="full">
            <Link href="/today/records">练习记录</Link>
          </Button>
        </>
      }
    >
      <div className="pt-2">
        <TodayReport />
      </div>
    </PageShell>
  )
}
