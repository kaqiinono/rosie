import type { Metadata } from 'next'
import HomeworkContentDemo from '@/components/homework-content-demo/HomeworkContentDemo'

export const metadata: Metadata = { title: '作业内容预览 · Rosie' }

export default function HomeworkContentDemoPage() {
  return <HomeworkContentDemo />
}
