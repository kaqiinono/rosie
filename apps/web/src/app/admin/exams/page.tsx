import type { Metadata } from 'next'
import { AdminExamsPage } from '@rosie/exams'

export const metadata: Metadata = {
  title: '考试管理',
}

export default function Page() {
  return <AdminExamsPage />
}
