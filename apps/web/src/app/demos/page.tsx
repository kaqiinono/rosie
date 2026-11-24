import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowIcon, LearningIcon, PageShell, StickerCard } from '@rosie/ui'

export const metadata: Metadata = { title: 'Demo 总入口 · Rosie' }

const demos = [
  {
    href: '/dev-preview/time-tree-organic',
    title: '生命树场景',
    description: '查看 3D 树形、泡泡和果实交互。',
    icon: <span className="text-2xl">🌳</span>,
  },
  {
    href: '/dev-preview/homework-content',
    title: '作业内容',
    description: '选择已保存的作业内容，预览生命树里的内容面板。',
    icon: <LearningIcon name="plan" size={28} />,
  },
  {
    href: '/dev-preview/exams',
    title: '考一考题型',
    description: '查看 14 种题面和 3 个专项预览，调试作答交互。',
    icon: <LearningIcon name="learn" size={28} />,
  },
  {
    href: '/dev-preview/chinese-cards',
    title: '语文生字卡',
    description: '比较有词组和无词组的卡面，检查翻面效果。',
    icon: <LearningIcon name="wordCards" size={28} />,
  },
  {
    href: '/math/demo',
    title: '数学数字谜',
    description: '调试竖式布局、方框填数和汉字数字谜。',
    icon: <LearningIcon name="calculator" size={28} />,
  },
  {
    href: '/dev-preview/tomato',
    title: '番茄计时',
    description: '体验计时界面和专注、休息状态。',
    icon: <span className="text-2xl">🍅</span>,
  },
]

export default function DemosPage() {
  return (
    <PageShell title="Demo 总入口">
      <nav aria-label="Demo 模块">
        <ul className="grid gap-3 sm:grid-cols-2">
          {demos.map(({ href, title, description, icon }) => (
            <li key={href}>
              <StickerCard asChild interactive elevation="sm" radius="md" className="h-full">
                <Link href={href} prefetch={false} className="flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-8)]">
                  <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center">{icon}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-text-primary font-bold">{title}</h2>
                    <p className="text-text-secondary mt-0.5 text-sm">{description}</p>
                  </div>
                  <span aria-hidden="true" className="shrink-0 text-[var(--accent-11)]"><ArrowIcon size={16} /></span>
                </Link>
              </StickerCard>
            </li>
          ))}
        </ul>
      </nav>
    </PageShell>
  )
}
