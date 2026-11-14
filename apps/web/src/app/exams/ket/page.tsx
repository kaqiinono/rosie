import type { Metadata } from 'next'
import { KetExamsPage } from '@rosie/exams'

export const metadata: Metadata = {
  title: '考一考 · KET',
}

export default function Page() {
  return <KetExamsPage />
}
